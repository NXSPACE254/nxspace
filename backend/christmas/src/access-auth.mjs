import { ApiError, readJson } from './validation.mjs';

const denied = () => new ApiError('UNAUTHORIZED', 401);
function decode(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw denied();
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
}
function object(value) {
  const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode(value)));
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw denied();
  return parsed;
}
export function createAccessVerifier({ issuer, audience, fetchJwks, now = () => Math.floor(Date.now() / 1000), cacheSeconds = 300, maxSessionSeconds = Infinity } = {}) {
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer || '') || !audience || typeof fetchJwks !== 'function' || cacheSeconds < 1 || cacheSeconds > 300) throw new ApiError('ACCESS_NOT_CONFIGURED', 503);
  const certsUrl = `${issuer}/cdn-cgi/access/certs`;
  let keys = [], expires = 0, refreshed = -Infinity, pending;
  async function refresh() {
    if (pending) return pending;
    pending = (async () => {
      // Fixed URL, no token-controlled jku/x5u or redirect destination.
      const response = await fetchJwks(certsUrl, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new ApiError('ACCESS_KEYS_UNAVAILABLE', 503);
      const jwks = await readJson(response, 65536);
      if (!Array.isArray(jwks.keys) || !jwks.keys.length || jwks.keys.length > 10) throw new ApiError('ACCESS_KEYS_UNAVAILABLE', 503);
      keys = jwks.keys; expires = now() + cacheSeconds; refreshed = now();
    })();
    try { await pending; } catch { throw new ApiError('ACCESS_KEYS_UNAVAILABLE', 503); } finally { pending = null; }
  }
  return async function verifyAccess(request) {
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token || token.length > 16384) throw denied();
    try {
      const parts = token.split('.'); if (parts.length !== 3) throw denied();
      const header = object(parts[0]), payload = object(parts[1]);
      if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 200 || header.crit || header.jku || header.x5u || (header.typ && header.typ !== 'JWT')) throw denied();
      if (expires <= now()) await refresh();
      let matching = keys.filter(key => key.kid === header.kid);
      if (!matching.length && now() - refreshed >= 30) { await refresh(); matching = keys.filter(key => key.kid === header.kid); }
      if (matching.length !== 1) throw denied();
      const jwk = matching[0];
      if (jwk.kty !== 'RSA' || (jwk.alg && jwk.alg !== 'RS256') || (jwk.use && jwk.use !== 'sig') || jwk.d || (jwk.key_ops && !jwk.key_ops.includes('verify'))) throw denied();
      const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      if (!key.algorithm.modulusLength || key.algorithm.modulusLength < 2048) throw denied();
      if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) throw denied();
      const time = now();
      if (payload.iss !== issuer || !Array.isArray(payload.aud) || !payload.aud.includes(audience) || payload.type !== 'app' || typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 200 || !Number.isInteger(payload.exp) || payload.exp <= time || !Number.isInteger(payload.iat) || payload.iat > time + 30 || !Number.isInteger(payload.nbf) || payload.nbf > time + 30 || payload.exp <= payload.iat) throw denied();
      if (payload.exp - payload.iat > maxSessionSeconds) throw denied();
      return Object.freeze({ verified: true, issuer, subject: payload.sub, ...(Number.isFinite(maxSessionSeconds) ? { issuedAt: payload.iat } : {}) });
    } catch (error) {
      if (error instanceof ApiError && error.status === 503) throw error;
      // No token, underlying crypto exception or JWT claim in response/logs.
      throw denied();
    }
  };
}
