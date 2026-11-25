import { ApiError } from './validation.mjs';

export const providerUserId = value => typeof value === 'string' &&
  /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value);

export function managedEmail(value, domain) {
  if (typeof value !== 'string' || typeof domain !== 'string') return null;
  const email = value.trim().toLowerCase();
  const parts = email.split('@');
  return parts.length === 2 && parts[1] === domain &&
    /^[a-z0-9][a-z0-9._+-]{0,63}$/.test(parts[0]) ? email : null;
}

export function specialStaffEmail(value) {
  if (typeof value !== 'string') return null;
  const domain = value.trim().toLowerCase().split('@')[1];
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain || '') ? managedEmail(value, domain) : null;
}

function mailboxKey(email) {
  if (!email) return null;
  const [local, domain] = email.split('@');
  const base = local.split('+')[0];
  if (domain === 'gmail.com' || domain === 'googlemail.com') return base.replaceAll('.', '') + '@gmail.com';
  return base + '@' + domain;
}

export const standardPasswordMinimum = env => env.STAFF_STANDARD_PASSWORD_MINIMUM === '8' ? 8 : 15;

export const strongPassword = (value, minimum = 15) => typeof value === 'string' && value.length <= 72 &&
  [...value].length >= minimum && new TextEncoder().encode(value).length <= 72 &&
  !/[\x00-\x1f\x7f]/.test(value) && /[A-Za-z]/.test(value) && /[0-9]/.test(value);

export function supabaseStaffAuth(env) {
  const unavailable = () => new ApiError('STAFF_PROVIDER_UNAVAILABLE', 503);
  const project = env.SUPABASE_URL;
  const domain = env.STAFF_LOGIN_EMAIL_DOMAIN;
  const configuredSuper = env.STAFF_SUPER_LOGIN_EMAIL !== undefined;
  const verifiedAccounts = env.STAFF_EMAIL_MODE === 'admin-verified';
  const superEmail = configuredSuper ? specialStaffEmail(env.STAFF_SUPER_LOGIN_EMAIL) : null;
  const decoy = configuredSuper ? specialStaffEmail(env.STAFF_AUTH_DECOY_EMAIL) : managedEmail(env.STAFF_AUTH_DECOY_EMAIL, domain);
  const protectedMailboxes = new Set([mailboxKey(decoy), mailboxKey(superEmail)]);
  const mailboxesConfigured = decoy && (!configuredSuper || superEmail && protectedMailboxes.size === 2) &&
    (!verifiedAccounts || configuredSuper);

  async function call(path, body, method = 'POST', admin = false) {
    const key = admin ? env.SUPABASE_SECRET_KEY : env.SUPABASE_PUBLISHABLE_KEY;
    if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(project || '') ||
        !/^sb_[a-z]+_[A-Za-z0-9_-]{16,}$/.test(key || '') ||
        !key.startsWith(admin ? 'sb_secret_' : 'sb_publishable_') || !mailboxesConfigured) throw unavailable();
    try {
      const response = await fetch(project + '/auth/v1/' + path, {
        method, body: JSON.stringify(body),
        headers: { apikey: key, 'Content-Type': 'application/json' },
        redirect: 'manual', signal: AbortSignal.timeout(5000)
      });
      if (response.status >= 300 && response.status < 400) throw unavailable();
      const payload = await response.json();
      return { status: response.status, ok: response.ok, payload };
    } catch {
      throw unavailable();
    }
  }

  function ordinaryEmail(value) {
    const email = verifiedAccounts ? specialStaffEmail(value) : managedEmail(value, domain);
    return email && !protectedMailboxes.has(mailboxKey(email)) ? email : null;
  }

  function authorizedEmail(identity) {
    if (identity?.is_super && identity.username === 'talgo292' && configuredSuper) {
      return identity.auth_email === superEmail ? superEmail : null;
    }
    return ordinaryEmail(identity?.auth_email);
  }

  return {
    email: ordinaryEmail,
    requiresVerifiedEmail: verifiedAccounts,
    acceptsSession(identity) {
      return !configuredSuper && !verifiedAccounts || Boolean(mailboxesConfigured && authorizedEmail(identity));
    },
    async verify(password, identity) {
      const email = authorizedEmail(identity);
      const result = await call('token?grant_type=password', { email: email ?? decoy, password });
      if (!result.ok) {
        if ([400, 403, 422].includes(result.status) &&
            ['invalid_credentials', 'email_not_confirmed', 'user_banned', 'user_not_found'].includes(result.payload?.error_code)) return false;
        throw unavailable();
      }
      const user = result.payload?.user;
      if (!providerUserId(user?.id)) throw unavailable();
      return Boolean(email && user.id === identity.provider_user_id && user.email?.toLowerCase() === email);
    },
    async create(email, password) {
      if (ordinaryEmail(email) !== email) throw unavailable();
      const result = await call('admin/users', { email, password, email_confirm: true }, 'POST', true);
      if (!result.ok || !providerUserId(result.payload?.id) || result.payload.email?.toLowerCase() !== email) throw unavailable();
      return result.payload.id;
    },
    async reset(identity, password) {
      if (!providerUserId(identity.provider_user_id) || !authorizedEmail(identity)) throw unavailable();
      const result = await call('admin/users/' + identity.provider_user_id, { password }, 'PUT', true);
      if (result.status === 422 && result.payload?.error_code === 'weak_password') {
        throw new ApiError('PASSWORD_POLICY', 422);
      }
      if (!result.ok || result.payload?.id !== identity.provider_user_id || result.payload.email?.toLowerCase() !== identity.auth_email) throw unavailable();
    }
  };
}
