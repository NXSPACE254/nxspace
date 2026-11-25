import { ApiError, isId, isWishCode, isRequestKey } from './validation.mjs';
import { digest, equalDigest } from './crypto.mjs';

const fields = {
  receipt: ['claimId','wishCode','expectedVersion','evidenceId','locationCode','quantity','note'],
  batch: ['organisationId','items','plannedAt','locationCode','note'],
  accept: ['batchId','expectedVersion','handedAt','receivedQuantity','acceptanceReference'],
  delivery: ['claimId','expectedVersion','handoffId','deliveredAt','evidenceId'],
  exception: ['claimId','expectedVersion','reasonCode','note'],
  resolve: ['claimId','expectedVersion','reasonCode','note']
};
const permissions = { receipt: 'gift.receive', batch: 'gift.handoff', accept: 'gift.accept', delivery: 'gift.deliver', exception: 'gift.exception', resolve: 'gift.exception' };
const text = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.length <= max && !/[\u0000-\u001f]/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
function validate(kind, input) {
  if (!fields[kind] || !input || Array.isArray(input) || Object.keys(input).some(key => !fields[kind].includes(key)&&!(kind==='accept'&&key==='checkedItems'))) throw new ApiError('INVALID_FIELDS');
  for (const key of fields[kind]) if (!(key in input)) throw new ApiError('MISSING_FIELD');
  for (const key of ['claimId','evidenceId','locationCode','organisationId','batchId','handoffId']) if (key in input && !isId(input[key])) throw new ApiError('INVALID_REFERENCE');
  if('wishCode' in input&&!isWishCode(input.wishCode))throw new ApiError('INVALID_REFERENCE');
  if ('expectedVersion' in input && !integer(input.expectedVersion)) throw new ApiError('VERSION_REQUIRED', 428);
  if ('note' in input && !text(input.note, 0, 1000)) throw new ApiError('INVALID_NOTE');
  for (const key of ['quantity','receivedQuantity']) if (key in input && (!Number.isSafeInteger(input[key]) || input[key] < 1 || input[key] > (key === 'quantity' ? 100 : 15000))) throw new ApiError('INVALID_QUANTITY');
  for (const key of ['plannedAt','handedAt','deliveredAt']) if (key in input && !integer(input[key])) throw new ApiError('INVALID_TIME');
  if ('acceptanceReference' in input && !/^[A-Za-z0-9_-]{8,80}$/.test(input.acceptanceReference)) throw new ApiError('ACCEPTANCE_REQUIRED');
  if (['exception','resolve'].includes(kind) && !['gift_mismatch','damaged','lost','count_mismatch','partner_refused','delivery_failed','reviewed_corrected'].includes(input.reasonCode)) throw new ApiError('INVALID_REASON');
  if (kind === 'batch') {
    if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 150 || new Set(input.items.map(i => i?.claimId)).size !== input.items.length) throw new ApiError('INVALID_BATCH');
    for (const item of input.items) if (!item || Object.keys(item).some(k => !['claimId','expectedVersion'].includes(k)) || !isId(item.claimId) || !integer(item.expectedVersion)) throw new ApiError('INVALID_BATCH');
  }
  if(kind==='accept'&&input.checkedItems!==undefined&&(!Array.isArray(input.checkedItems)||!input.checkedItems.length||input.checkedItems.length>150||new Set(input.checkedItems).size!==input.checkedItems.length||input.checkedItems.some(id=>!isId(id))))throw new ApiError('INVALID_BATCH');
  // Stable property/item ordering for semantically identical retries.
  return {...(kind==='accept'&&input.checkedItems?{checkedItems:[...input.checkedItems].sort()}:{}),...Object.fromEntries(fields[kind].map(key => [key, key === 'items' ? input.items.map(i => ({ claimId: i.claimId, expectedVersion: i.expectedVersion })).sort((a,b) => a.claimId.localeCompare(b.claimId)) : input[key]]))};
}

export class FulfillmentRepository {
  constructor(repository) { this.core = repository; this.db = repository.db; }
  statement(sql, ...values) { return this.core.statement(sql, ...values); }
  async organisation(campaignId, organisationId, actor, permission) {
    const actorId = await this.core.admin(campaignId, actor, permission);
    const org = await this.statement('SELECT id FROM Organisations WHERE id=? AND campaign_id=? AND active=1', organisationId, campaignId).first();
    if (!org) throw new ApiError('ORGANISATION_FORBIDDEN', 403);
    if (['gift.accept','gift.deliver'].includes(permission) && !await this.statement('SELECT user_id FROM OrganisationMembers WHERE user_id=? AND organisation_id=? AND campaign_id=?', actorId, organisationId, campaignId).first()) throw new ApiError('ORGANISATION_FORBIDDEN', 403);
    return actorId;
  }
  async claimOrganisation(campaignId, claimId) {
    const row = await this.statement('SELECT c.status,c.version,c.exception_from_status,w.organisation_id,w.public_code FROM Claims c JOIN Wishes w ON w.id=c.wish_id WHERE c.id=? AND c.campaign_id=?', claimId, campaignId).first();
    if (!row?.organisation_id) throw new ApiError('ORGANISATION_UNASSIGNED', 409);
    return row;
  }
  async authorize(campaignId, kind, payload, actor) {
    if (kind === 'batch') return this.organisation(campaignId, payload.organisationId, actor, permissions[kind]);
    if (kind === 'accept') {
      const row = await this.statement('SELECT organisation_id FROM HandoffBatches WHERE id=? AND campaign_id=?', payload.batchId, campaignId).first();
      if (!row) throw new ApiError('NOT_FOUND', 404);
      return this.organisation(campaignId, row.organisation_id, actor, permissions[kind]);
    }
    const claim = await this.claimOrganisation(campaignId, payload.claimId);
    const actorId = await this.organisation(campaignId, claim.organisation_id, actor, permissions[kind]);
    if (['exception','resolve'].includes(kind)) {
      const nx = await this.statement("SELECT user_id FROM UserRoles WHERE user_id=? AND campaign_id=? AND role_id IN ('nx_admin','nx_staff')", actorId, campaignId).first();
      if (!nx && (!['handed_over'].includes(claim.exception_from_status || claim.status) || !await this.statement('SELECT user_id FROM OrganisationMembers WHERE user_id=? AND organisation_id=? AND campaign_id=?', actorId, claim.organisation_id, campaignId).first())) throw new ApiError('ORGANISATION_FORBIDDEN', 403);
    }
    return actorId;
  }
  async execute(campaignId, kind, input, actor, idempotencyKey,handler=null,{prefixStatements=[]}={}) {
    if (!isRequestKey(idempotencyKey)) throw new ApiError('IDEMPOTENCY_KEY_REQUIRED', 428);
    const payload = validate(kind, input);
    const unit=this.core.operationsEnabled?await this.core.operating.fulfillmentContext(campaignId,kind,payload,actor,handler):null;
    const actorId = await this.authorize(campaignId, kind, payload, actor);
    const keyHash = await digest(`${campaignId}:${actorId}:${idempotencyKey}`);
    const requestHash = await digest(JSON.stringify({ kind, payload,...(unit?{unitId:unit.unit_id,handler:unit.handler}:{}) }));
    const find = () => this.statement('SELECT request_hash,result_json FROM FulfillmentOperations WHERE campaign_id=? AND actor_id=? AND idempotency_hash=?', campaignId, actorId, keyHash).first();
    const replay = row => { if (!equalDigest(row.request_hash, requestHash)) throw new ApiError('IDEMPOTENCY_MISMATCH', 409); return JSON.parse(row.result_json); };
    const previous = await find(); if (previous) return replay(previous);
    const id = crypto.randomUUID();
    const status = kind === 'resolve' ? (await this.claimOrganisation(campaignId, payload.claimId)).exception_from_status : { receipt: 'gift_received', batch: 'draft', accept: 'handed_over', delivery: 'delivered', exception: 'exception' }[kind];
    const result = { operationId: id, resourceId: kind === 'batch' ? id : payload.claimId || payload.batchId, status, resourceVersion: kind === 'batch' ? 0 : payload.expectedVersion + 1 };
    try {
      // ONE D1 statement; all evidence/state/audit writes run in its triggers.
      const operation = (unit?this.statement('INSERT INTO FulfillmentOperations(id,campaign_id,actor_id,kind,idempotency_hash,request_hash,payload,result_json,unit_id,handler) VALUES(?,?,?,?,?,?,?,?,?,?)', id, campaignId, actorId, kind, keyHash, requestHash, JSON.stringify(payload), JSON.stringify(result),unit.unit_id,unit.handler):this.statement('INSERT INTO FulfillmentOperations(id,campaign_id,actor_id,kind,idempotency_hash,request_hash,payload,result_json) VALUES(?,?,?,?,?,?,?,?)', id, campaignId, actorId, kind, keyHash, requestHash, JSON.stringify(payload), JSON.stringify(result)));
      if(prefixStatements.length)await this.db.batch([...prefixStatements,operation]);else await operation.run();
    } catch (error) {
      const committed = await find(); if (committed) return replay(committed);
      if (/CONFLICT|UNIQUE|FORBIDDEN|REQUIRED|INVALID|CHECK|FOREIGN KEY|SCOPE/i.test(error.message)) throw new ApiError('FULFILLMENT_CONFLICT', 409);
      throw new ApiError('WRITE_UNCONFIRMED', 503);
    }
    const committed = await find(); if (!committed) throw new ApiError('WRITE_UNCONFIRMED', 503);
    return replay(committed);
  }
  async batch(campaignId, batchId, actor) {
    if(this.core.operationsEnabled)await this.core.operating.batchScope(campaignId,batchId,actor);
    const actorId = await this.core.admin(campaignId, actor, 'claim.read');
    const row = await this.statement('SELECT b.id,b.organisation_id,b.planned_at,b.created_by,b.created_at,b.accepted_at,b.status,b.version,b.acceptance_reference,b.note,h.handed_at,o.label FROM HandoffBatches b JOIN Organisations o ON o.id=b.organisation_id LEFT JOIN Handoffs h ON h.id=b.id WHERE b.id=? AND b.campaign_id=? AND o.active=1', batchId, campaignId).first();
    if (!row) throw new ApiError('NOT_FOUND', 404);
    const nx = await this.statement("SELECT user_id FROM UserRoles WHERE user_id=? AND campaign_id=? AND role_id IN ('nx_admin','nx_staff')", actorId, campaignId).first();
    if (!nx && !await this.statement('SELECT user_id FROM OrganisationMembers WHERE user_id=? AND organisation_id=? AND campaign_id=?', actorId, row.organisation_id, campaignId).first()) throw new ApiError('ORGANISATION_FORBIDDEN', 403);
    const { results } = await this.statement('SELECT c.id AS claim_id,w.public_code,i.quantity,c.status,c.version FROM HandoffBatchItems i JOIN Claims c ON c.id=i.claim_id JOIN Wishes w ON w.id=c.wish_id WHERE i.batch_id=? ORDER BY w.public_code', batchId).all();
    return { ...row, items: results, totalQuantity: results.reduce((sum,i) => sum + i.quantity, 0) };
  }
  async history(campaignId, claimId, actor) {
    if(this.core.operationsEnabled)await this.core.operating.claimScope(campaignId,claimId,actor);
    const actorId = await this.core.admin(campaignId, actor, 'claim.read');
    const claim = await this.claimOrganisation(campaignId, claimId);
    const nx = await this.statement("SELECT user_id FROM UserRoles WHERE user_id=? AND campaign_id=? AND role_id IN ('nx_admin','nx_staff')", actorId, campaignId).first();
    if (!nx) await this.organisation(campaignId, claim.organisation_id, actor, 'gift.accept');
    const { results } = await this.statement("SELECT id,kind,created_at,json_extract(payload,'$.reasonCode') AS reason_code,json_extract(payload,'$.note') AS note,json_extract(result_json,'$.status') AS status FROM FulfillmentOperations WHERE campaign_id=? AND json_extract(payload,'$.claimId')=? ORDER BY created_at,id", campaignId, claimId).all();
    return { claimId, wishCode: claim.public_code, status: claim.status, version: claim.version, organisationId: claim.organisation_id, events: results };
  }
  async progress(campaignId, credentials) {
    const claim = await this.core.recover(campaignId, credentials);
    const dates = await this.statement('SELECT g.received_at,h.partner_accepted_at,d.delivered_at FROM Claims c LEFT JOIN GiftReceipts g ON g.claim_id=c.id LEFT JOIN HandoffItems i ON i.claim_id=c.id LEFT JOIN Handoffs h ON h.id=i.handoff_id LEFT JOIN DeliveryConfirmations d ON d.claim_id=c.id WHERE c.id=? AND c.campaign_id=?', claim.claimId, campaignId).first();
    return { ...claim, receivedAt: dates.received_at, handedOverAt: dates.partner_accepted_at, deliveredAt: dates.delivered_at, notificationSent: false };
  }
}

export function validateEvidence({bytes,contentType,retentionUntil}) {
  const signature=bytes instanceof Uint8Array?Array.from(bytes.slice(0,8)):[];
  const matches=contentType==='application/pdf'?String.fromCharCode(...signature.slice(0,5))==='%PDF-':contentType==='image/png'?signature.join(',')==='137,80,78,71,13,10,26,10':contentType==='image/jpeg'&&signature.slice(0,3).join(',')==='255,216,255';
  if(!(bytes instanceof Uint8Array)||bytes.length<1||bytes.length>5242880||!matches||!Number.isInteger(retentionUntil)||retentionUntil<=Math.floor(Date.now()/1000))throw new ApiError('INVALID_EVIDENCE');
}
export function createPrivateEvidenceService({ fulfillment, store, scan }) {
  return { async ingest(campaignId, claimId, actor, { bytes, contentType, retentionUntil }) {
    if(fulfillment.core.operationsEnabled)await fulfillment.core.operating.claimScope(campaignId,claimId,actor,{allowUnreceived:true});
    const state = await fulfillment.claimOrganisation(campaignId, claimId);
    // Delivery/document evidence may be added after delivery by its authorised
    // organisation. Uploading evidence does not perform a state transition.
    const permission = ['handed_over','delivered'].includes(state.status) ? 'gift.deliver' : 'gift.receive';
    const actorId = await fulfillment.organisation(campaignId, state.organisation_id, actor, permission);
    if (!store?.put || !store?.delete || typeof scan !== 'function') throw new ApiError('PRIVATE_STORAGE_UNAVAILABLE', 503);
    validateEvidence({bytes,contentType,retentionUntil});
    if (await scan(bytes, contentType) !== 'clean') throw new ApiError('EVIDENCE_REJECTED', 422);
    const id = crypto.randomUUID(), key = `private/${crypto.randomUUID()}`;
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2,'0')).join('');
    await store.put(key, bytes, { contentType, private: true });
    try {
      await fulfillment.db.batch([
        fulfillment.statement('INSERT INTO Attachments(id,campaign_id,claim_id,object_key,sha256,content_type,byte_size,verified_at,retention_until) VALUES(?,?,?,?,?,?,?,unixepoch(),?)', id, campaignId, claimId, key, hash, contentType, bytes.length, retentionUntil),
        fulfillment.statement("INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code) VALUES(?,'attachment',?,'attachment.verified','admin',?,'private_evidence')", campaignId, id, actorId)
      ]);
    } catch { try { await store.delete(key); } catch { /* Orphan cleanup requires a private reconciliation job, never log key. */ } throw new ApiError('EVIDENCE_UNCONFIRMED', 503); }
    return { evidenceId: id }; // Never return object_key or public/signed URL.
  } };
}
