import { ApiError } from './validation.mjs';
import { digest } from './crypto.mjs';
import { createLocalApi } from './local-api.mjs';

// Log only a fixed code + generated correlation ID. Never accept raw errors,
// headers, URL, bodies, email, IP, JWT or capabilities as log fields.
export function securityEvent(code) {
  const allowed = ['DENIED', 'RATE_LIMITED', 'INTERNAL_ERROR', 'AUTH_UNAVAILABLE'];
  return Object.freeze({ code: allowed.includes(code) ? code : 'INTERNAL_ERROR', correlationId: crypto.randomUUID() });
}
export function createD1RateLimiter({ db, fingerprint, limit = 20, windowSeconds = 60, now = () => Math.floor(Date.now() / 1000) }) {
  if (!db || typeof fingerprint !== 'function' || !Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowSeconds) || windowSeconds < 1) throw new ApiError('RATE_LIMIT_NOT_CONFIGURED', 503);
  return async ({ scope }) => {
    if (typeof scope !== 'string' || !scope || scope.length > 500) return false;
    const hash = await fingerprint({ rateScope: scope });
    const start = Math.floor(now() / windowSeconds) * windowSeconds;
    const row = await db.prepare(`INSERT INTO SecurityRateLimits(scope_hash,window_start,hits,expires_at) VALUES(?,?,1,?) ON CONFLICT(scope_hash,window_start) DO UPDATE SET hits=hits+1 RETURNING hits`).bind(hash, start, start + windowSeconds * 2).first();
    return row.hits <= limit;
  };
}
export function createSecurityBoundary({ repository, verifyAccess, rateLimit, origins = [], log = () => {} }) {
  if (!origins.length || origins.some(value => { try { const url = new URL(value); return url.origin !== value || !(url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === '127.0.0.1')); } catch { return true; } })) throw new ApiError('ORIGINS_NOT_CONFIGURED', 503);
  async function guard(request) {
    if (new URL(request.url).search || request.headers.has('Authorization')) throw new ApiError('REQUEST_FORBIDDEN', 403);
    const origin = request.headers.get('Origin');
    if ((origin && !origins.includes(origin)) || (!['GET', 'HEAD'].includes(request.method) && !origin)) throw new ApiError('ORIGIN_FORBIDDEN', 403);
    // Fixed global bucket is deliberately conservative until trusted edge-IP
    // and account buckets are configured. Never trust X-Forwarded-For.
    if (!rateLimit) throw new ApiError('RATE_LIMIT_NOT_CONFIGURED', 503);
    if (!await rateLimit({ scope: 'christmas:global' })) throw new ApiError('RATE_LIMITED', 429);
  }
  async function run(request, action) {
    try { await guard(request); return await action(); }
    catch (error) {
      const safe = error instanceof ApiError ? error : new ApiError('SECURITY_UNAVAILABLE', 503);
      log(securityEvent(safe.status === 429 ? 'RATE_LIMITED' : safe.status >= 500 ? 'AUTH_UNAVAILABLE' : 'DENIED'));
      throw safe;
    }
  }
  return {
    inspect: request => run(request, async () => true),
    async admin(request, campaignId, permission) {
      return run(request, async () => {
        if (!verifyAccess) throw new ApiError('ACCESS_NOT_CONFIGURED', 503);
        const actor = await verifyAccess(request);
        const actorId = await repository.admin(campaignId, actor, permission);
        if (!await rateLimit({ scope: `admin:${await digest(`${actor.issuer}:${actor.subject}`)}` })) throw new ApiError('RATE_LIMITED', 429);
        return { ...actor, actorId };
      });
    },
    donor(request, campaignId, credentials, expectedClaimId) {
      return run(request, async () => {
        const result = await repository.recover(campaignId, credentials);
        if (expectedClaimId && result.claimId !== expectedClaimId) throw new ApiError('RESULT_NOT_AUTHENTICATED', 404);
        if (!await rateLimit({ scope: `claim:${result.claimId}` })) throw new ApiError('RATE_LIMITED', 429);
        return result;
      });
    }
  };
}
// Local-only composition for acceptance. Default worker.mjs does not import it.
// Cookie is never an identity source; Access assertion is independently verified.
export function createSecuredLocalApi({ repository, fulfillment = null, management = null, experience = null, verifyAccess, verifyIntent, rateLimit, origin = 'http://127.0.0.1:8787', log = () => {} }) {
  const boundary = createSecurityBoundary({ repository, verifyAccess, rateLimit, origins: [origin], log });
  const app = createLocalApi({ repository, fulfillment, management, experience, verifyIntent, origin, rateLimit: async () => true, authenticate: async request => {
    if (!verifyAccess) throw new ApiError('ACCESS_NOT_CONFIGURED', 503);
    const actor = await verifyAccess(request);
    if (actor?.verified !== true || !actor.issuer || !actor.subject) throw new ApiError('UNAUTHORIZED', 401);
    if (!await rateLimit({ scope: `admin:${await digest(`${actor.issuer}:${actor.subject}`)}` })) throw new ApiError('RATE_LIMITED', 429);
    return actor;
  } });
  return { async fetch(request) {
    try {
      await boundary.inspect(request);
      const response = await app.fetch(request);
      if (response.status >= 400) log(securityEvent(response.status === 429 ? 'RATE_LIMITED' : 'DENIED'));
      // Same-origin local acceptance; no wildcard CORS and no credential cookies.
      return response;
    } catch (error) {
      const safe = error instanceof ApiError ? error : new ApiError('SECURITY_UNAVAILABLE', 503);
      return new Response(JSON.stringify({ error: { code: safe.code, retryable: safe.status === 503 } }), { status: safe.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
    }
  } };
}
// Replaceable interface only. No provider and no real messages by default.
export function createContactVerificationProvider(provider) {
  return {
    async requestChallenge(input) {
      if (!provider?.requestChallenge) throw new ApiError('CONTACT_VERIFICATION_UNAVAILABLE', 503);
      return provider.requestChallenge(input);
    },
    async verifyIntent(input) {
      if (!provider?.verifyIntent) throw new ApiError('CONTACT_VERIFICATION_UNAVAILABLE', 503);
      return provider.verifyIntent(input);
    }
  };
}
