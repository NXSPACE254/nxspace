import { ApiError, validateBody, validateClaim } from './validation.mjs';
import {normalizeContactPhone} from './contact-rules.mjs';
import { publicWish } from './domain.mjs';
import { digest, equalDigest } from './crypto.mjs';

const conflict = () => new ApiError('CONFLICT', 409);
const activeCapability = row => row && !row.capability_revoked_at && Number.isInteger(row.capability_expires_at) && row.capability_expires_at > Math.floor(Date.now() / 1000);
const result = row => ({ claimId: row.id, status: row.status, version: row.version, expiresAt: row.expires_at, giftDueAt: row.gift_due_at });
const wishInsert = `INSERT INTO Wishes(id,public_code,campaign_id,child_alias,age_band,title,description,gift_name,category,reference_amount,specifications)
 SELECT json_extract(value,'$.id'),json_extract(value,'$.publicCode'),?,json_extract(value,'$.childAlias'),json_extract(value,'$.ageBand'),json_extract(value,'$.title'),json_extract(value,'$.description'),json_extract(value,'$.giftName'),json_extract(value,'$.category'),json_extract(value,'$.referenceAmount'),json_extract(value,'$.specifications') FROM json_each(?)`;

export class ChristmasRepository {
  #requestCampaigns;
  constructor(db, cryptoService, { reuseRequestCampaign = false } = {}) {
    this.db = db;
    this.crypto = cryptoService;
    if (reuseRequestCampaign) this.#requestCampaigns = new Map();
  }
  statement(sql, ...values) { return this.db.prepare(sql).bind(...values); }
  async admin(campaignId, actor, permission) {
    if(this.operationsEnabled)return this.operating.authorize(campaignId,actor,permission);
    if (!actor?.verified || !actor.issuer || !actor.subject) throw new ApiError('UNAUTHORIZED', 401);
    // Roles and account status are loaded from D1, never from a request role.
    const { results } = await this.statement(`SELECT a.id,r.role_id FROM AdminUsers a JOIN UserRoles r ON r.user_id=a.id WHERE a.status='active' AND a.issuer=? AND a.subject=? AND r.campaign_id=?`, actor.issuer, actor.subject, campaignId).all();
    const { hasPermission } = await import('./domain.mjs');
    if (!hasPermission({ verified: true, roles: results.map(r => r.role_id), campaignIds: [campaignId] }, permission, campaignId)) throw new ApiError('FORBIDDEN', 403);
    return results[0].id;
  }
  campaignStatement(campaignId) {
    return this.statement(`SELECT id,slug,title,partner_label,status,opens_at,closes_at,COALESCE(claim_deadline_at,closes_at) AS claim_deadline_at,gift_due_at FROM Campaigns WHERE id=? AND status IN ('open','closed') AND collaboration_confirmed=1`, campaignId);
  }
  async campaign(campaignId, preloaded) {
    const cached = this.#requestCampaigns?.get(campaignId);
    if (cached) return { ...cached };
    const row = preloaded ? preloaded.row : await this.campaignStatement(campaignId).first();
    if (!row) throw new ApiError('NOT_FOUND', 404);
    if(this.operationsEnabled){row.delivery_days=(await this.operating.rule(campaignId,preloaded)).delivery_days;row.time_zone='Asia/Taipei';}
    if (this.#requestCampaigns) this.#requestCampaigns.set(campaignId, { ...row });
    return row;
  }
  async wishes(campaignId, publicCode = null) {
    await this.campaign(campaignId);
    const { results } = await this.statement(`SELECT public_code,age_band,title,description,gift_name,category,reference_amount,specifications,status FROM Wishes WHERE campaign_id=? AND publication_status='approved' AND (? IS NULL OR public_code=?) ORDER BY public_code LIMIT 150`, campaignId, publicCode, publicCode).all();
    if (publicCode && !results.length) throw new ApiError('NOT_FOUND', 404);
    return results.map(publicWish);
  }
  async importWishes(campaignId, wishes, actor) {
    if(this.operationsEnabled)throw new ApiError('USE_OPERATIONAL_WISH_EDITOR',403);
    const actorId = await this.admin(campaignId, actor, 'wish.write');
    validateBody('import', { wishes });
    const rows = wishes.map(w => ({ ...w, id: crypto.randomUUID() }));
    // Two statements, two JSON parameters: avoids 150*column bind limits.
    // Audit failure or ANY duplicate aborts the entire D1 batch.
    await this.db.batch([
      this.statement(wishInsert, campaignId, JSON.stringify(rows)),
      this.statement(`INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code) SELECT ?,'wish',json_extract(value,'$.id'),'wish.created','admin',?,'draft_import' FROM json_each(?)`, campaignId, actorId, JSON.stringify(rows))
    ]);
    return { count: rows.length, wishes: rows.map(w => ({ id: w.id, publicCode: w.publicCode, publicationStatus: 'draft' })) };
  }
  async claim(campaignId, input, verifiedIntent,claimContext=null) {
    const direct=Boolean(this.operationsEnabled&&this.operating.directMode&&claimContext?.direct===true);
    validateClaim(input,{operations:Boolean(this.operationsEnabled),direct});
    if(this.operating?.directMode&&!direct)throw new ApiError('DIRECT_CLAIM_REQUIRED',403);
    if(this.operationsEnabled&&(!claimContext||!['online','assisted'].includes(claimContext.source)||verifiedIntent?.method!==(claimContext.source==='online'?(direct?'direct':'email'):'assisted')))throw new ApiError('OPERATIONAL_VERIFICATION_REQUIRED',403);
    const secretHash = await digest(input.claimSecret);
    const contact = { ...input.contact, channel: input.contact.channel, address: input.contact.address.trim(), displayName: input.contact.displayName.trim() };
    if(Object.keys(contact).some(k=>!['channel','address','displayName'].includes(k))&&!this.experienceEnabled)throw new ApiError('CONTACT_EXTENSION_NOT_CONFIGURED',503);
    const idempotencyHash = await digest(`${campaignId}:${input.idempotencyKey}`);
    const find = () => this.statement('SELECT * FROM Claims WHERE campaign_id=? AND idempotency_hash=?', campaignId, idempotencyHash).first();
    const existing = await find();
    const requestKeyVersion = existing?.request_key_version || this.crypto.requestKeyVersion || 'legacy';
    const requestHash = await this.crypto.fingerprint({ campaignId, wishId: input.wishId, contact, consentVersion: input.consentVersion, secretHash,...(claimContext?.assistance?{assistance:claimContext.assistance}:{}) }, requestKeyVersion);
    const replay = row => {
      if (!equalDigest(row.request_hash, requestHash)) throw new ApiError('IDEMPOTENCY_MISMATCH', 409);
      if (!activeCapability(row) || !equalDigest(row.capability_hash, secretHash)) throw new ApiError('CREDENTIAL_INVALID', 403);
      return result(row);
    };
    // A possession-authenticated replay works after an intent expires or response is lost.
    if (existing) return replay(existing);
    // Trusted adapter must bind verified contact, consent, wish and capability to THIS fingerprint.
    if (verifiedIntent?.verified !== true || !equalDigest(verifiedIntent.requestHash, requestHash) || !Number.isInteger(verifiedIntent.expiresAt) || verifiedIntent.expiresAt <= Math.floor(Date.now() / 1000)) throw new ApiError('VERIFIED_INTENT_REQUIRED', 403);
    const campaign = await this.campaign(campaignId);
    if (input.consentVersion !== (await this.statement('SELECT privacy_version FROM Campaigns WHERE id=?', campaignId).first()).privacy_version) throw new ApiError('CONSENT_VERSION_MISMATCH', 409);
    const wish = await this.statement(this.operationsEnabled?'SELECT id,claim_due_at,gift_due_at,delivery_days FROM Wishes WHERE campaign_id=? AND public_code=?':this.experienceEnabled?'SELECT id,claim_due_at,gift_due_at FROM Wishes WHERE campaign_id=? AND public_code=?':'SELECT id FROM Wishes WHERE campaign_id=? AND public_code=?', campaignId, input.wishId).first();
    if (!wish) throw new ApiError('NOT_FOUND', 404);
    const id = crypto.randomUUID(), contactId = crypto.randomUUID();
    const ciphertext = await this.crypto.encrypt(contact, `${campaignId}:${contactId}:${this.crypto.keyVersion}`);
    const giftDue=this.operationsEnabled?await this.operating.deliveryDeadline(campaignId,Math.floor(Date.now()/1000),campaign.gift_due_at):(wish.gift_due_at??campaign.gift_due_at);
    const claimBoundary=wish.claim_due_at??campaign.claim_deadline_at;
    const expiresAt=giftDue===null?claimBoundary:Math.min(claimBoundary,giftDue);
    const retentionUntil=(campaign.gift_due_at??campaign.closes_at)+90*86400;
    try {
      const statements=[...(direct?claimContext.beforeStatements||[]:[]),
        this.statement(`INSERT INTO DonorContacts(id,campaign_id,ciphertext,key_version,verified_at,consent_version,retention_until${direct?',verification_method':''}) VALUES(?,?,?,?,${direct?'0':'unixepoch()'},?,?${direct?",'self_reported'":''})`, contactId, campaignId, ciphertext, this.crypto.keyVersion, input.consentVersion, retentionUntil),
        this.statement(`INSERT INTO Claims(id,campaign_id,wish_id,donor_contact_id,source,idempotency_hash,request_hash,capability_hash,expires_at,gift_due_at,actor_type,actor_ref,last_reason,request_key_version,capability_expires_at${this.operationsEnabled?',portal_id,assisted_unit_id,assisted_verifier_hash':''}) VALUES(?,?,?,?,?,?,?,?,?,?,'${claimContext?.source==='assisted'?'admin':'donor'}',?,'verified_claim',?,?${this.operationsEnabled?',?,?,?':''})`, id, campaignId, wish.id, contactId,claimContext?.source||'online', idempotencyHash, requestHash, secretHash,expiresAt,giftDue,claimContext?.assistance?.actorId||id, requestKeyVersion, retentionUntil,...(this.operationsEnabled?[claimContext.portalId||null,claimContext.assistance?.unitId||null,claimContext.assistance?.secondHash||null]:[]))
      ];
      if(this.experienceEnabled){const phone=contact.phone||(contact.channel==='phone'?contact.address:null);if(phone)statements.push(this.statement('UPDATE DonorContacts SET phone_lookup_hash=?,phone_lookup_version=? WHERE id=?',await this.crypto.fingerprint({phone:direct?normalizeContactPhone(phone).base:phone}),this.crypto.requestKeyVersion||'legacy',contactId));
        const p=contact.documentPreferences||{};statements.push(this.statement('INSERT INTO DocumentRequests(claim_id,campaign_id,material_proof,paper_thank_you,electronic_thank_you,electronic_proof) VALUES(?,?,?,?,?,?)',id,campaignId,p.materialProof?1:0,p.paperThankYou?1:0,p.electronicThankYou?1:0,p.electronicProof?1:0));}
      if(this.operationsEnabled){const a=claimContext.assistance;if(a)statements.push(this.statement('INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id,reference) VALUES(?,?,?,?,?,\'claim.assisted\',?,?)',crypto.randomUUID(),campaignId,a.unitId,a.actorId,a.handler,id,a.consentReference));}
      await this.db.batch(statements);
    } catch (error) {
      // Includes a batch response lost AFTER commit. Never return success based on a client cache.
      const committed = await find();
      if (committed) return replay(committed);
      if (/UNIQUE|WISH_NOT_AVAILABLE|CHECK constraint/i.test(error.message)) throw conflict();
      throw new ApiError('WRITE_UNCONFIRMED', 503);
    }
    const committed = await find();
    if (!committed) throw new ApiError('WRITE_UNCONFIRMED', 503);
    return replay(committed);
  }
  async recover(campaignId, input) {
    validateBody('lookup', input);
    const row = input.claimId?await this.statement('SELECT * FROM Claims WHERE campaign_id=? AND id=?',campaignId,input.claimId).first():await this.statement('SELECT * FROM Claims WHERE campaign_id=? AND idempotency_hash=?', campaignId, await digest(`${campaignId}:${input.idempotencyKey}`)).first();
    if (!activeCapability(row) || !equalDigest(row.capability_hash, await digest(input.claimSecret))) throw new ApiError('RESULT_NOT_AUTHENTICATED', 404);
    if(row.source==='assisted'&&this.operationsEnabled&&(!input.secondFactor||!equalDigest(row.assisted_verifier_hash,await this.crypto.fingerprint({assisted:input.claimSecret,secondFactor:input.secondFactor},row.request_key_version))))throw new ApiError('SECOND_VERIFICATION_REQUIRED',403);
    return result(row);
  }
  async revokeCapability(campaignId, claimId, expectedVersion, reasonCode, actor) {
    const actorId = await this.admin(campaignId, actor, 'claim.revoke');
    validateBody('action', { expectedVersion, reasonCode });
    const changed = await this.statement(`UPDATE Claims SET capability_revoked_at=unixepoch(),version=version+1,last_reason=?,actor_type='admin',actor_ref=?,updated_at=unixepoch() WHERE id=? AND campaign_id=? AND version=? AND capability_revoked_at IS NULL RETURNING id`, reasonCode, actorId, claimId, campaignId, expectedVersion).first();
    if (!changed) throw conflict();
    return { claimId, revoked: true };
  }
  async contact(campaignId, contactId, actor, reasonCode) {
    const actorId = await this.admin(campaignId, actor, 'contact.read');
    validateBody('action', { expectedVersion: 0, reasonCode });
    const row = await this.statement('SELECT * FROM DonorContacts WHERE campaign_id=? AND id=? AND erased_at IS NULL', campaignId, contactId).first();
    if (!row) throw new ApiError('NOT_FOUND', 404);
    const plaintext = await this.crypto.decrypt(row.ciphertext, `${campaignId}:${row.id}:${row.key_version}`, row.key_version);
    // No plaintext leaves this function unless the read audit succeeds.
    await this.statement(`INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code) VALUES(?,'contact',?,'contact.read','admin',?,?)`, campaignId, contactId, actorId, reasonCode).run();
    return plaintext;
  }
  async protectContact(campaignId, contactId, actor, reasonCode, erase = false) {
    const actorId = await this.admin(campaignId, actor, erase ? 'contact.erase' : 'contact.rotate');
    validateBody('action', { expectedVersion: 0, reasonCode });
    const row = await this.statement('SELECT * FROM DonorContacts WHERE campaign_id=? AND id=? AND erased_at IS NULL', campaignId, contactId).first();
    if (!row) throw new ApiError('NOT_FOUND', 404);
    if (erase && (row.retention_until > Math.floor(Date.now() / 1000) || row.legal_hold)) throw new ApiError('RETENTION_NOT_DUE_OR_HELD', 409);
    const plaintext = erase ? null : await this.crypto.decrypt(row.ciphertext, `${campaignId}:${contactId}:${row.key_version}`, row.key_version);
    const newVersion = erase ? 'erased' : this.crypto.keyVersion;
    const ciphertext = erase ? 'ERASED' : await this.crypto.encrypt(plaintext, `${campaignId}:${contactId}:${newVersion}`);
    // Guarded audit INSERT trigger below makes an audit failure abort the UPDATE.
    const changed = await this.statement(`UPDATE DonorContacts SET ciphertext=?,key_version=?,erased_at=CASE WHEN ?=1 THEN unixepoch() ELSE NULL END,protection_actor=?,protection_reason=? WHERE id=? AND campaign_id=? AND ciphertext=? AND key_version=? AND erased_at IS NULL RETURNING id`, ciphertext, newVersion, erase ? 1 : 0, actorId, reasonCode, contactId, campaignId, row.ciphertext, row.key_version).first();
    if (!changed) throw conflict();
    return { contactId, erased: erase, keyVersion: newVersion };
  }
  async rotateCapability(campaignId, claimId, { rotationKey, oldSecret, newSecret, expectedVersion }) {
    validateBody('lookup', { idempotencyKey: rotationKey, claimSecret: oldSecret });
    validateBody('lookup', { idempotencyKey: rotationKey, claimSecret: newSecret });
    if (!Number.isInteger(expectedVersion) || expectedVersion < 0) throw new ApiError('VERSION_REQUIRED', 428);
    const oldHash = await digest(oldSecret), newHash = await digest(newSecret);
    const rotationHash = await digest(`${campaignId}:${rotationKey}`);
    const row = await this.statement('SELECT * FROM Claims WHERE id=? AND campaign_id=?', claimId, campaignId).first();
    if (!activeCapability(row)) throw new ApiError('CREDENTIAL_INVALID', 403);
    const previous = await this.statement('SELECT * FROM CapabilityRotations WHERE claim_id=? AND rotation_hash=?', claimId, rotationHash).first();
    if (previous) {
      if (!equalDigest(previous.old_hash, oldHash) || !equalDigest(previous.new_hash, newHash) || previous.expected_version !== expectedVersion || !equalDigest(row.capability_hash, newHash)) throw conflict();
      return result(row);
    }
    if (!equalDigest(row.capability_hash, oldHash) || oldHash === newHash) throw new ApiError('CREDENTIAL_INVALID', 403);
    await this.statement('INSERT INTO CapabilityRotations(claim_id,rotation_hash,old_hash,new_hash,expected_version) VALUES(?,?,?,?,?)', claimId, rotationHash, oldHash, newHash, expectedVersion).run();
    // Single SQL statement includes rotation, capability CAS and existing audit trigger.
    return result(await this.statement('SELECT * FROM Claims WHERE id=? AND campaign_id=?', claimId, campaignId).first());
  }
  async transition(campaignId, claimId, to, input, actor) {
    if(this.operationsEnabled)throw new ApiError('USE_OPERATIONAL_REVIEW',403);
    validateBody('action', input);
    const permission = { cancelled: 'claim.cancel', expired: 'claim.expire', exception: 'gift.exception' }[to];
    if (!permission) throw new ApiError('NOT_IMPLEMENTED', 501);
    let actorId, actorType;
    if (to === 'expired') {
      // Scheduler injection is unavailable to HTTP routes.
      if (!actor?.verifiedSystem) throw new ApiError('FORBIDDEN', 403);
      actorId = 'expiry_scheduler'; actorType = 'system';
    } else { actorId = await this.admin(campaignId, actor, permission); actorType = 'admin'; }
    // Partner-only accounts cannot change pre-handoff claims.
    if (to === 'exception') {
      const row = await this.statement('SELECT status FROM Claims WHERE id=? AND campaign_id=?', claimId, campaignId).first();
      if (!row) throw new ApiError('NOT_FOUND', 404);
      if (!['handed_over', 'delivered'].includes(row.status)) await this.admin(campaignId, actor, 'claim.cancel');
    }
    // RETURNING identifies the matched claim without depending on whether a
    // runtime's meta.changes includes trigger writes to Wishes and AuditLogs.
    const changed = await this.statement(`UPDATE Claims SET exception_from_status=CASE WHEN ?='exception' THEN status ELSE NULL END,status=?,version=version+1,last_reason=?,actor_type=?,actor_ref=?,updated_at=unixepoch() WHERE id=? AND campaign_id=? AND version=? RETURNING id`, to, to, input.reasonCode, actorType, actorId, claimId, campaignId, input.expectedVersion).first();
    if (!changed) throw conflict();
    return { claimId, status: to, version: input.expectedVersion + 1 };
  }
}
