import { ApiError } from './validation.mjs';

const encoder = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
const base64 = bytes => btoa(String.fromCharCode(...bytes));
const validKey = key => key instanceof Uint8Array && key.length === 32;
const importAes = key => crypto.subtle.importKey('raw', key, 'AES-GCM', false, ['encrypt', 'decrypt']);
const importHmac = key => crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const sign = async (key, value) => hex(await crypto.subtle.sign('HMAC', key, encoder.encode(JSON.stringify(value))));
async function encryptWith(key, value, aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(aad) }, key, encoder.encode(JSON.stringify(value)));
  return JSON.stringify({ iv: base64(iv), data: base64(new Uint8Array(encrypted)) });
}
async function decryptWith(key, ciphertext, aad) {
  const value = JSON.parse(ciphertext);
  const bytes = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(value.iv), additionalData: encoder.encode(aad) }, key, bytes(value.data))));
}
export const generateClaimSecret = () => base64(crypto.getRandomValues(new Uint8Array(32))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
export const digest = async text => hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
export function equalDigest(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== 64 || b.length !== 64) return false;
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
// Keys are injected by the caller. No default keys, persistent plaintext or logging.
export async function createCrypto({ encryptionKey, requestKey, keyVersion, requestKeyVersion = 'legacy' }) {
  if (!validKey(encryptionKey) || !validKey(requestKey) || !keyVersion) throw new ApiError('KEYS_NOT_CONFIGURED', 503);
  const aes = await importAes(encryptionKey);
  const hmac = await importHmac(requestKey);
  return {
    keyVersion,
    requestKeyVersion,
    fingerprint: value => sign(hmac, value),
    encrypt: (value, aad) => encryptWith(aes, value, aad),
    decrypt: (ciphertext, aad) => decryptWith(aes, ciphertext, aad)
  };
}

function keyImports(keys, importKey) {
  return new Map(Object.entries(keys).map(([version, key]) => {
    if (!version || !validKey(key)) throw new ApiError('KEYS_NOT_CONFIGURED', 503);
    const raw = new Uint8Array(key);
    let imported;
    return [version, () => imported ??= importKey(raw)];
  }));
}

// Explicit version maps injected from secret bindings. Old encryption/HMAC
// keys must remain available until migration/idempotency retention is complete.
export async function createKeyring({ encryptionKeys, requestKeys, activeEncryptionVersion, activeRequestVersion }) {
  const aes = keyImports(encryptionKeys ?? {}, importAes);
  const hmac = keyImports(requestKeys ?? {}, importHmac);
  if (!aes.has(activeEncryptionVersion) || !hmac.has(activeRequestVersion)) throw new ApiError('KEYS_NOT_CONFIGURED', 503);
  return {
    keyVersion: activeEncryptionVersion,
    requestKeyVersion: activeRequestVersion,
    async fingerprint(value, version = activeRequestVersion) {
      const key = hmac.get(version);
      if (!key) throw new ApiError('REQUEST_KEY_UNAVAILABLE', 503);
      return sign(await key(), value);
    },
    async encrypt(value, aad) {
      return encryptWith(await aes.get(activeEncryptionVersion)(), value, aad);
    },
    async decrypt(ciphertext, aad, version = activeEncryptionVersion) {
      const key = aes.get(version);
      if (!key) throw new ApiError('ENCRYPTION_KEY_UNAVAILABLE', 503);
      try { return await decryptWith(await key(), ciphertext, aad); }
      catch { throw new ApiError('DECRYPTION_FAILED', 503); }
    }
  };
}
