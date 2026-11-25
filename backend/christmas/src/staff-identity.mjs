import { createHmac, timingSafeEqual } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { digest, generateClaimSecret } from './crypto.mjs';
import { createD1RateLimiter } from './security.mjs';
import { standardPasswordMinimum, strongPassword, supabaseStaffAuth } from './supabase-staff-auth.mjs';
import { ApiError, isId } from './validation.mjs';

export const staffIssuer = 'nxspace:staff';
const cookieName = '__Host-nxspace_staff';
const cookie = (token = '', age = 0) => `${cookieName}=${token}; Max-Age=${age}; Path=/; Secure; HttpOnly; SameSite=Strict`;
const denied = () => new ApiError('UNAUTHORIZED', 401);
const now = () => Math.floor(Date.now() / 1000);
const usernamePattern = /^[a-z][a-z0-9_-]{2,39}$/;
const roles = { admin: ['nx_admin'], bookhouse: ['nx_staff', 'partner_staff'], collection: ['nx_staff'] };

function totpKey(secret) {
  if (typeof secret !== 'string' || !/^[A-Z2-7]{32}$/.test(secret)) throw new ApiError('MFA_NOT_CONFIGURED', 503);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret].map(char => alphabet.indexOf(char).toString(2).padStart(5, '0')).join('');
  return Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
}

export function staffIdentity(db, cryptoService, env) {
  const standardMinimum = standardPasswordMinimum(env);
  const minimumFor = actor => actor.is_super ? 15 : standardMinimum;
  const query = (sql, ...args) => db.prepare(sql).bind(...args);
  const provider = supabaseStaffAuth(env);
  const limiter = (limit, windowSeconds) => createD1RateLimiter({ db, fingerprint: cryptoService.fingerprint, limit, windowSeconds });
  const globalLimit = limiter(60, 60), ipLimit = limiter(20, 300), accountLimit = limiter(8, 300);
  const audit = (action, actor = null, target = null) =>
    query('INSERT INTO StaffIdentityAudit(id,actor_id,target_id,action) VALUES(?,?,?,?)', crypto.randomUUID(), actor, target, action);

  async function guard(request, name) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!await globalLimit({ scope: 'staff:global' }) || !await ipLimit({ scope: `staff:ip:${ip}` }) ||
        !await accountLimit({ scope: `staff:account:${name}` })) throw new ApiError('RATE_LIMITED', 429);
  }

  async function guardPasswordChange(request, name) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const buckets = [
      ['staff:global', 60, 60],
      [`staff:ip:${ip}`, 300, 20],
      [`staff:account:${name}`, 300, 8]
    ];
    const time = now();
    const keys = await Promise.all(buckets.map(async ([scope, window, limit]) =>
      [await cryptoService.fingerprint({ rateScope: scope }), Math.floor(time / window) * window, window, limit]));
    const results = await db.batch(keys.map(([hash, start, window], index) => {
      const earlier = keys.slice(0, index);
      const predicates = earlier.map(() =>
        'EXISTS(SELECT 1 FROM SecurityRateLimits WHERE scope_hash=? AND window_start=? AND hits<=?)');
      return query(`INSERT INTO SecurityRateLimits(scope_hash,window_start,hits,expires_at)
        SELECT ?,?,1,? WHERE ${predicates.join(' AND ') || '1'}
        ON CONFLICT(scope_hash,window_start) DO UPDATE SET hits=hits+1 RETURNING hits`,
      hash, start, start + window * 2, ...earlier.flatMap(([key, bucket, , limit]) => [key, bucket, limit]));
    }));
    if (results.some(({ results: rows }, index) => !rows.length || rows[0].hits > keys[index][3])) {
      throw new ApiError('RATE_LIMITED', 429);
    }
  }

  function* matchingMfaCounters(code) {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw denied();
    const key = totpKey(env.STAFF_SUPER_TOTP);
    const current = Math.floor(now() / 30);
    const supplied = Buffer.from(code);
    for (const time of [0, -1, 1]) {
      const counter = current + time;
      const message = Buffer.alloc(8);
      message.writeBigUInt64BE(BigInt(counter));
      const mac = createHmac('sha1', key).update(message).digest();
      const number = (mac.readUInt32BE(mac[19] & 15) & 0x7fffffff) % 1000000;
      if (timingSafeEqual(Buffer.from(String(number).padStart(6, '0')), supplied)) yield counter;
    }
  }

  async function consumeMfa(row, code) {
    if (!row.is_super) return;
    for (const counter of matchingMfaCounters(code)) {
      const accepted = await query('UPDATE StaffIdentities SET mfa_counter=? WHERE id=? AND enabled=1 AND version=? AND mfa_counter<? RETURNING id',
        counter, row.id, row.version, counter).first();
      if (accepted) return;
    }
    throw denied();
  }

  async function authenticate(request) {
    const cookies = (request.headers.get('Cookie') || '').split(';').map(value => value.trim())
      .filter(value => value.startsWith(cookieName + '='));
    const token = cookies[0]?.slice(cookieName.length + 1);
    if (cookies.length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(token || '')) throw denied();
    const row = await query(`SELECT i.*, s.token_hash, s.issued_at, s.expires_at, s.elevated_until
      FROM StaffSessions s JOIN StaffIdentities i ON i.id=s.identity_id
      WHERE s.token_hash=? AND s.expires_at>unixepoch() AND i.enabled=1 AND i.credential_change_pending=0 AND i.version=s.credential_version`, await digest(token)).first();
    if (!row || !provider.acceptsSession(row)) throw denied();
    return { ...row, verified: true, issuer: staffIssuer, subject: row.id, issuedAt: row.issued_at };
  }

  function requireElevation(actor) {
    if (!actor.is_super || actor.must_change || actor.elevated_until <= now()) throw new ApiError('REAUTH_REQUIRED', 403);
  }

  async function requireExportAccess(actor, fresh = true) {
    const allowed = !actor.is_super && !actor.must_change && await query(`SELECT 1 FROM OperatingAccounts a
      JOIN CampaignOperatingRules r ON r.campaign_id=a.campaign_id AND r.bookhouse_id=a.organisation_id
      JOIN Organisations o ON o.id=a.organisation_id AND o.campaign_id=a.campaign_id AND o.active=1
      JOIN AdminUsers u ON u.id=a.user_id AND u.status='active'
      WHERE a.user_id=? AND a.campaign_id=? AND a.kind='bookhouse' AND a.revoked_at IS NULL AND a.documents_export=1`,
      actor.id,env.CAMPAIGN_ID).first();
    if(!allowed)throw new ApiError('DOCUMENT_EXPORT_FORBIDDEN',403);
    if(fresh&&actor.elevated_until<=now())throw new ApiError('EXPORT_REAUTH_REQUIRED',403);
  }

  async function login(request, body) {
    const name = typeof body.username === 'string' ? body.username.toLowerCase() : '';
    const username = usernamePattern.test(name) ? name : 'invalid';
    await guard(request, username);
    if (!strongPassword(body.password, 8)) throw denied();
    const row = await query(`SELECT i.* FROM StaffIdentities i
      JOIN OperatingAccounts a ON a.user_id=i.id JOIN AdminUsers u ON u.id=i.id
      WHERE i.username=? AND a.campaign_id=? AND a.revoked_at IS NULL AND u.status='active'`, username, env.CAMPAIGN_ID).first();
    const eligible = row?.enabled && !row.credential_change_pending &&
      (!row.is_super || strongPassword(body.password));
    if (!await provider.verify(body.password, eligible ? row : null)) {
      await audit('login.failed').run();
      throw denied();
    }
    try { await consumeMfa(row, body.code); } catch (error) { await audit('login.failed').run(); throw error; }
    const token = generateClaimSecret();
    const issued = now();
    const inserted = await query(`INSERT INTO StaffSessions(token_hash,identity_id,credential_version,issued_at,expires_at)
      SELECT ?,i.id,i.version,?,? FROM StaffIdentities i JOIN OperatingAccounts a ON a.user_id=i.id
      WHERE i.id=? AND i.version=? AND i.enabled=1 AND i.credential_change_pending=0
      AND a.campaign_id=? AND a.revoked_at IS NULL RETURNING identity_id`,
      await digest(token), issued, issued + 86400, row.id, row.version, env.CAMPAIGN_ID).first();
    if (!inserted) throw denied();
    await audit('login.success', row.id).run();
    return { data: passwordStatus(row), cookie: cookie(token, 86400) };
  }

  const passwordStatus = actor => ({
    mustChange: Boolean(actor.must_change),
    minimumPasswordLength: minimumFor(actor),
    ...(actor.is_super && actor.must_change ? { splitPassword: true } : {})
  });

  const validProof = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
  const passwordProofHash = (proof, password) => cryptoService.fingerprint({ purpose: 'staff.first_password', proof, password });
  const liveSession = `token_hash=? AND identity_id=StaffIdentities.id AND credential_version=StaffIdentities.version
    AND expires_at>unixepoch()`;
  const activeAccount = `EXISTS(SELECT 1 FROM OperatingAccounts a JOIN AdminUsers u ON u.id=a.user_id
    WHERE a.user_id=StaffIdentities.id AND a.campaign_id=? AND a.revoked_at IS NULL AND u.status='active')`;

  async function prepareFirstPassword(request, body, actor) {
    if (!actor.is_super || !actor.must_change) throw denied();
    await guardPasswordChange(request, actor.username);
    if (!strongPassword(body.password) || !await provider.verify(body.password, actor)) throw denied();
    if (!strongPassword(body.newPassword) || body.password === body.newPassword) throw new ApiError('PASSWORD_POLICY');
    const counter = firstUnusedCounter(actor, body.code);
    const proof = generateClaimSecret();
    const hash = await passwordProofHash(proof, body.newPassword);
    const [, issued] = await db.batch([
      query(`UPDATE StaffIdentities SET mfa_counter=?
        WHERE id=? AND version=? AND enabled=1 AND must_change=1 AND is_super=1 AND credential_change_pending=0
        AND mfa_counter<? AND ${activeAccount} AND EXISTS(SELECT 1 FROM StaffSessions WHERE ${liveSession}
          AND coalesce(first_password_proof_expires_at,0)<=unixepoch())`,
      counter, actor.id, actor.version, counter, env.CAMPAIGN_ID, actor.token_hash),
      query(`UPDATE StaffSessions SET first_password_proof_hash=?,first_password_proof_expires_at=min(expires_at,unixepoch()+45)
        WHERE token_hash=? AND changes()=1 RETURNING token_hash`, hash, actor.token_hash)
    ]);
    if (!issued.results.length) throw denied();
    return { data: { proof } };
  }

  function firstUnusedCounter(actor, code) {
    for (const candidate of matchingMfaCounters(code)) {
      if (candidate > actor.mfa_counter) return candidate;
    }
    throw denied();
  }

  async function sessionAction(action, request, body, actor) {
    if (action === 'status') return { data: passwordStatus(actor) };
    if (action === 'logout') {
      await db.batch([query('DELETE FROM StaffSessions WHERE token_hash=?', actor.token_hash), audit('session.logout', actor.id)]);
      return { data: { revoked: true }, cookie: cookie() };
    }
    if (action === 'password-prepare') return prepareFirstPassword(request, body, actor);
    if (action === 'password-commit') {
      if (!actor.is_super || !actor.must_change || !validProof(body.proof)) throw denied();
      if (!strongPassword(body.newPassword)) throw new ApiError('PASSWORD_POLICY');
      const hash = await passwordProofHash(body.proof, body.newPassword);
      await replacePassword(actor, body.newPassword, actor.id, false, actor.token_hash, null, hash);
      return { data: { changed: true }, cookie: cookie() };
    }
    if (action === 'password' && actor.is_super && actor.must_change) throw denied();
    if (action === 'password') await guardPasswordChange(request, actor.username);
    else await guard(request, actor.username);
    if (!strongPassword(body.password, actor.is_super ? 15 : 8) || !await provider.verify(body.password, actor)) throw denied();
    if (action === 'step-up' || action === 'export-step-up') {
      if(action==='export-step-up')await requireExportAccess(actor,false);
      else{
        if (!actor.is_super || actor.must_change) throw new ApiError('FORBIDDEN', 403);
        await consumeMfa(actor, body.code);
      }
      const token = generateClaimSecret();
      const elevated = await query(`UPDATE StaffSessions SET token_hash=?,elevated_until=min(expires_at,?) WHERE token_hash=?
        AND credential_version=? AND expires_at>unixepoch()
        AND EXISTS(SELECT 1 FROM StaffIdentities i WHERE i.id=identity_id AND i.version=credential_version
          AND i.enabled=1 AND i.credential_change_pending=0) RETURNING expires_at`,
      await digest(token), now() + 900, actor.token_hash, actor.version).first();
      if (!elevated) throw denied();
      await audit(action==='export-step-up'?'session.export_elevated':'session.elevated', actor.id).run();
      return { data: { elevated: true }, cookie: cookie(token, Math.max(0, elevated.expires_at - now())) };
    }
    if (!strongPassword(body.newPassword, minimumFor(actor)) || body.password === body.newPassword) throw new ApiError('PASSWORD_POLICY');
    const counter = actor.is_super ? firstUnusedCounter(actor, body.code) : null;
    await replacePassword(actor, body.newPassword, actor.id, false, actor.token_hash, counter);
    return { data: { changed: true }, cookie: cookie() };
  }

  async function replacePassword(target, password, actorId, mustChange, session = null, counter = null, proofHash = null) {
    const proofGuard = proofHash ? `AND must_change=1 AND is_super=1 AND ${activeAccount}` : '';
    const proofSession = proofHash ? 'AND first_password_proof_hash=? AND first_password_proof_expires_at>unixepoch()' : '';
    const [lock] = await db.batch([
      query(`UPDATE StaffIdentities SET credential_change_pending=1,version=version+1,mfa_counter=coalesce(?,mfa_counter)
        WHERE id=? AND version=? AND credential_change_pending=0
        AND (? IS NULL OR mfa_counter<?)
        ${proofGuard}
        AND (? IS NULL OR (enabled=1 AND EXISTS(SELECT 1 FROM StaffSessions WHERE ${liveSession} ${proofSession})))
        RETURNING version`, counter, target.id, target.version, counter, counter,
      ...(proofHash ? [env.CAMPAIGN_ID] : []), session, session, ...(proofHash ? [proofHash] : [])),
      query(`INSERT INTO StaffIdentityAudit(id,actor_id,target_id,action)
        SELECT ?,?,?,'password.change_started' WHERE changes()=1`, crypto.randomUUID(), actorId, target.id),
      query('DELETE FROM StaffSessions WHERE identity_id=? AND changes()=1', target.id)
    ]);
    const locked = lock.results[0];
    if (!locked) throw counter === null && !proofHash ? new ApiError('CREDENTIAL_CHANGE_UNAVAILABLE', 409) : denied();
    // The audit and revocation depend on this transaction acquiring the lock.
    // An uncertain provider write leaves the account fenced for reconciliation.
    try {
      await provider.reset(target, password);
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'PASSWORD_POLICY' || error.status !== 422) throw error;
      // Supabase verifies strength before committing the update. Only close this
      // particular rejected attempt. Keep its version, MFA counter and revocation.
      const [closed] = await db.batch([
        query('UPDATE StaffIdentities SET credential_change_pending=0 WHERE id=? AND version=? AND credential_change_pending=1 RETURNING id', target.id, locked.version),
        query(`INSERT INTO StaffIdentityAudit(id,actor_id,target_id,action)
          SELECT ?,?,?,'password.policy_rejected' WHERE changes()=1`, crypto.randomUUID(), actorId, target.id)
      ]);
      if (!closed.results.length) throw new ApiError('CREDENTIAL_CHANGE_UNAVAILABLE', 409);
      throw error;
    }
    await db.batch([
      query('UPDATE StaffIdentities SET must_change=?,credential_change_pending=0 WHERE id=? AND version=?', Number(mustChange), target.id, locked.version),
      audit(mustChange ? 'account.reset' : 'password.changed', actorId, target.id)
    ]);
  }

  async function accounts(action, body, actor, campaign) {
    if (!actor.is_super || actor.must_change) throw new ApiError('FORBIDDEN', 403);
    if (action === 'list') {
      const [users, units, events] = await db.batch([
        query(`SELECT i.id, i.username, i.enabled, i.must_change, i.credential_change_pending, a.organisation_id, a.kind, a.revoked_at FROM StaffIdentities i
          JOIN OperatingAccounts a ON a.user_id=i.id WHERE a.campaign_id=? AND i.is_super=0 ORDER BY i.username`, campaign),
        query(`SELECT o.id,o.label,o.unit_kind,
          NOT EXISTS(SELECT 1 FROM OperatingAccounts a WHERE a.campaign_id=o.campaign_id AND a.organisation_id=o.id) AS available
          FROM Organisations o
          WHERE o.campaign_id=? AND o.active=1 AND o.unit_kind IN ('admin','bookhouse','collection')
          ORDER BY o.label`, campaign),
        query('SELECT actor_id,target_id,action,occurred_at FROM StaffIdentityAudit ORDER BY occurred_at DESC,rowid DESC LIMIT 50')
      ]);
      return { users: users.results, units: units.results, events: events.results, minimumPasswordLength: standardMinimum };
    }
    requireElevation(actor);
    if (action === 'create') {
      if (provider.requiresVerifiedEmail && body.emailVerified !== true) throw new ApiError('EMAIL_VERIFICATION_REQUIRED', 400);
      const username = typeof body.username === 'string' ? body.username.toLowerCase() : '';
      const email = provider.email(body.email);
      if (!email || !usernamePattern.test(username) || username === 'talgo292' || !strongPassword(body.password, standardMinimum) || !isId(body.unitId)) throw new ApiError('INVALID_ACCOUNT');
      const unit = await query("SELECT id,unit_kind FROM Organisations WHERE id=? AND campaign_id=? AND active=1", body.unitId, campaign).first();
      if (!unit || !Object.hasOwn(roles, unit.unit_kind)) throw new ApiError('INVALID_UNIT');
      const id = crypto.randomUUID();
      if (await query('SELECT 1 FROM StaffIdentities WHERE username=? OR auth_email=? UNION ALL SELECT 1 FROM OperatingAccounts WHERE campaign_id=? AND organisation_id=?',
        username, email, campaign, unit.id).first()) throw new ApiError('ACCOUNT_EXISTS', 409);
      await db.batch([
        query('INSERT INTO StaffIdentities(id,username,auth_email,credential_change_pending,enabled) VALUES(?,?,?,1,0)', id, username, email),
        query('INSERT INTO AdminUsers(id,issuer,subject) VALUES(?,?,?)', id, staffIssuer, id),
        ...roles[unit.unit_kind].map(role => query('INSERT INTO UserRoles(user_id,role_id,campaign_id) VALUES(?,?,?)', id, role, campaign)),
        query('INSERT INTO OrganisationMembers(user_id,organisation_id,campaign_id) VALUES(?,?,?)', id, unit.id, campaign),
        query('INSERT INTO OperatingAccounts(user_id,campaign_id,organisation_id,kind) VALUES(?,?,?,?)', id, campaign, unit.id, unit.unit_kind),
        audit('account.create_started', actor.id, id)
      ]);
      const providerId = await provider.create(email, body.password);
      await db.batch([
        query('UPDATE StaffIdentities SET provider_user_id=?,credential_change_pending=0,enabled=1 WHERE id=? AND provider_user_id IS NULL', providerId, id),
        ...(provider.requiresVerifiedEmail ? [audit('account.email_verified', actor.id, id)] : []),
        audit('account.created', actor.id, id)
      ]);
      return { id };
    }
    const target = isId(body.id) && await query(`SELECT i.id,i.version,i.auth_email,i.provider_user_id,i.credential_change_pending FROM StaffIdentities i JOIN OperatingAccounts a ON a.user_id=i.id
      WHERE i.is_super=0 AND i.id=? AND a.campaign_id=?`, body.id, campaign).first();
    if (!target) throw new ApiError('NOT_FOUND', 404);
    if (target.credential_change_pending) throw new ApiError('CREDENTIAL_CHANGE_UNAVAILABLE', 409);
    let change;
    if (action === 'reset') {
      if (!strongPassword(body.password, standardMinimum)) throw new ApiError('PASSWORD_POLICY');
      await replacePassword(target, body.password, actor.id, true);
      return { updated: true };
    } else if (action === 'suspend-access' || action === 'restore-access') {
      await db.batch([
        query('UPDATE OperatingAccounts SET revoked_at=? WHERE user_id=? AND campaign_id=?', action === 'suspend-access' ? now() : null, target.id, campaign),
        query('UPDATE StaffIdentities SET version=version+1 WHERE id=? AND credential_change_pending=0', target.id),
        query('DELETE FROM StaffSessions WHERE identity_id=?', target.id),
        audit(`account.${action}`, actor.id, target.id)
      ]);
      return { updated: true };
    } else if (action === 'enable' || action === 'disable') {
      change = query('UPDATE StaffIdentities SET enabled=?,version=version+1 WHERE id=? AND version=? AND credential_change_pending=0', Number(action === 'enable'), target.id, target.version);
    } else {
      change = query('UPDATE StaffIdentities SET version=version+1 WHERE id=? AND version=? AND credential_change_pending=0', target.id, target.version);
    }
    const [outcome] = await db.batch([change, query('DELETE FROM StaffSessions WHERE identity_id=?', target.id), audit(`account.${action}`, actor.id, target.id)]);
    if (!outcome.meta.changes) throw new ApiError('CREDENTIAL_CHANGE_UNAVAILABLE', 409);
    return { updated: true };
  }
  async function profile(actor, body) {
    if (!body) {
      const row = await query('SELECT display_name,contact_email FROM StaffProfiles WHERE identity_id=?', actor.id).first();
      return { displayName: row?.display_name ?? '', contactEmail: row?.contact_email ?? '' };
    }
    const { displayName, contactEmail } = body;
    if (Object.keys(body).some(key => !['displayName', 'contactEmail'].includes(key)) ||
        typeof displayName !== 'string' || displayName.length > 80 || /[\x00-\x1f\x7f]/.test(displayName) ||
        typeof contactEmail !== 'string' || contactEmail.length > 254 ||
        (contactEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || /[\x00-\x1f\x7f]/.test(contactEmail)))) {
      throw new ApiError('INVALID_PROFILE');
    }
    await db.batch([
      query(`INSERT INTO StaffProfiles(identity_id,display_name,contact_email) VALUES(?,?,?)
        ON CONFLICT(identity_id) DO UPDATE SET display_name=excluded.display_name,contact_email=excluded.contact_email`,
      actor.id, displayName.trim(), contactEmail),
      audit('profile.updated', actor.id)
    ]);
    return { updated: true };
  }

  return { login, authenticate, sessionAction, accounts, profile, requireElevation, requireExportAccess };
}
