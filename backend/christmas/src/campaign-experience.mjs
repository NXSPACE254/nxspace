import { ApiError, isId, isRequestKey, validateWish } from './validation.mjs';
import { digest, equalDigest } from './crypto.mjs';
import { validateEvidence, createPrivateEvidenceService, FulfillmentRepository } from './fulfillment.mjs';

const seconds=()=>Math.floor(Date.now()/1000);
const keys=(body,allowed)=>{if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!allowed.includes(k)))throw new ApiError('INVALID_FIELDS');};
const text=(value,max,required=false)=>{if(typeof value!=='string'||value.length>max||(required&&!value.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw new ApiError('INVALID_TEXT');return value.trim();};
const mediaKinds=['wish_card','wish_image','thank_you','receipt_record','delivery_proof','activity_photo','institution_tax_receipt'];
export class CampaignExperience {
  constructor({core,management,store=null,scan=null,recovery=null}) {Object.assign(this,{core,management,store,scan,recovery});core.experienceEnabled=true;}
  async audit(campaign,type,id,action,actor,reason) {await this.core.statement('INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code) VALUES(?,?,?,?,\'admin\',?,?)',campaign,type,id,action,actor,reason).run();}
  async wish(campaign,id,actor) {
    if(this.core.operationsEnabled)return this.core.operating.wishAccess(campaign,id,actor);
    const ctx=await this.management.context(campaign,actor),row=await this.core.statement('SELECT * FROM Wishes WHERE id=? AND campaign_id=?',id,campaign).first();
    if(!row)throw new ApiError('NOT_FOUND',404);
    if(!ctx.nx&&!ctx.organisations.some(o=>o.id===row.organisation_id))throw new ApiError('ORGANISATION_FORBIDDEN',403);
    return {ctx,row};
  }
  async wishes(campaign,code=null) {
    const c=await this.core.campaign(campaign);
    const {results}=await this.core.statement(`SELECT w.public_code,w.public_nickname,w.age_band,w.title,w.description,w.gift_name,w.specifications,w.status,COALESCE(w.claim_due_at,c.claim_deadline_at,c.closes_at) AS claim_due_at,COALESCE(w.gift_due_at,c.gift_due_at) AS gift_due_at FROM Wishes w JOIN Campaigns c ON c.id=w.campaign_id WHERE w.campaign_id=? AND w.publication_status='approved' AND (? IS NULL OR w.public_code=?) ORDER BY w.public_code LIMIT 1000`,campaign,code,code).all();
    if(code&&!results.length)throw new ApiError('NOT_FOUND',404);
    const media=(await this.core.statement(`SELECT w.public_code,m.id,m.kind,m.content_type FROM WishMedia m JOIN Wishes w ON w.id=m.wish_id WHERE m.campaign_id=? AND w.publication_status='approved' AND m.visibility='public' AND m.review_status='approved' AND m.retention_until>unixepoch()`,campaign).all()).results;
    const messages=(await this.core.statement(`SELECT w.public_code,p.nickname,p.message FROM ClaimPublicMessages p JOIN Claims c ON c.id=p.claim_id JOIN Wishes w ON w.id=c.wish_id JOIN DonorContacts d ON d.id=c.donor_contact_id WHERE p.campaign_id=? AND w.publication_status='approved' AND c.status NOT IN ('cancelled','expired') AND d.erased_at IS NULL AND d.retention_until>unixepoch()`,campaign).all()).results;
    const receiptSites=this.core.operationsEnabled?new Map((await this.core.statement("SELECT w.public_code,o.label FROM Wishes w JOIN Claims c ON c.wish_id=w.id JOIN ReceiptLocations g ON g.claim_id=c.id JOIN Organisations o ON o.id=g.effective_location WHERE w.campaign_id=? AND w.publication_status='approved' AND c.status='gift_received' AND o.unit_kind='collection'",campaign).all()).results.map(r=>[r.public_code,r.label])):new Map();
    for(const w of results){if(this.core.operationsEnabled){w.gift_due_at=c.gift_due_at;const site=receiptSites.get(w.public_code);if(site)w.receivedLabel=site.includes('CAMA')?'CAMA CAFE':site;}w.canAdopt=w.status==='available'&&c.status==='open'&&c.opens_at<=seconds()&&c.closes_at>seconds()&&w.claim_due_at>seconds();w.media=media.filter(m=>m.public_code===w.public_code).map(({id,kind,content_type})=>({id,kind,content_type}));w.messages=messages.filter(m=>m.public_code===w.public_code).map(({nickname,message})=>({nickname,message}));}return results;
  }
  async saveWish(campaign,input,actor,key,unitContext=null) {
    if(this.core.operationsEnabled&&!unitContext)return this.core.operating.saveWish(campaign,input,actor,key);
    const ctx=unitContext?.editor??await this.management.context(campaign,actor,'wish.write');
    keys(input,['wishId','expectedVersion','publicCode','publicNickname','ageBand','title','description','giftName','specifications','organisationId','claimDueAt','giftDueAt','publicationStatus','realName','necessaryContact','internalNote','privateReason','reviewConfirmed','deliveryDays']);
    if(!isRequestKey(key))throw new ApiError('IDEMPOTENCY_KEY_REQUIRED',428);
    const create=!input.wishId, id=input.wishId||crypto.randomUUID();
    const old=create?null:unitContext?.oldWish??(await this.wish(campaign,id,actor)).row;
    if(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0||(create&&input.expectedVersion!==0))throw new ApiError('VERSION_REQUIRED',428);
    const normalized={publicNickname:text(input.publicNickname,40,true),title:text(input.title,100,true),description:text(input.description,1000,true),giftName:text(input.giftName,100,true),specifications:text(input.specifications,1000),organisationId:input.organisationId,claimDueAt:input.claimDueAt,giftDueAt:input.giftDueAt,publicationStatus:input.publicationStatus};
    if(!ctx.organisations.some(o=>o.id===input.organisationId)||!['draft','approved'].includes(input.publicationStatus))throw new ApiError('INVALID_ORGANISATION_OR_PUBLICATION');
    if(input.publicationStatus==='approved'){await this.core.admin(campaign,actor,'staff.manage');if(input.reviewConfirmed!==true)throw new ApiError('PRIVACY_REVIEW_REQUIRED');}
    const c=unitContext?.campaignInfo??await this.core.campaign(campaign);
    if(this.core.operationsEnabled){if(input.deliveryDays!==null&&input.deliveryDays!==undefined&&(!Number.isInteger(input.deliveryDays)||input.deliveryDays<1||input.deliveryDays>90))throw new ApiError('INVALID_DELIVERY_DAYS');normalized.deliveryDays=input.deliveryDays||null;}
    if(!Number.isInteger(input.claimDueAt)||input.claimDueAt<=c.opens_at||input.claimDueAt>c.claim_deadline_at||(input.giftDueAt!==null&&(!Number.isInteger(input.giftDueAt)||input.giftDueAt<input.claimDueAt||c.gift_due_at!==null&&input.giftDueAt>c.gift_due_at)))throw new ApiError('INVALID_DEADLINES');
    // Preserve inherited campaign dates on legacy wishes, including when hiding
    // an already-claimed wish. Do not turn a visibility edit into a date change.
    if(old?.claim_due_at===null&&input.claimDueAt===c.claim_deadline_at)normalized.claimDueAt=null;
    if(old?.gift_due_at===null&&input.giftDueAt===c.gift_due_at)normalized.giftDueAt=null;
    const code=create?input.publicCode:old.public_code, alias=create?'anon-'+crypto.randomUUID().slice(0,8):old.child_alias;
    validateWish({publicCode:code,childAlias:alias,ageBand:input.ageBand,title:normalized.title,description:normalized.description,giftName:normalized.giftName,category:'gift',referenceAmount:0,specifications:normalized.specifications});
    if(!create&&(input.publicCode!==old.public_code||input.ageBand!==old.age_band))throw new ApiError('IDENTITY_IMMUTABLE',409);
    const hash=await this.core.crypto.fingerprint(input),keyHash=await digest(`${campaign}:${ctx.id}:${key}`);
    const find=()=>this.core.statement('SELECT id,wish_id,expected_version,request_hash FROM WishChanges WHERE campaign_id=? AND actor_id=? AND idempotency_hash=?',campaign,ctx.id,keyHash).first();
    const replay=row=>{if(!equalDigest(row.request_hash,hash))throw new ApiError('IDEMPOTENCY_MISMATCH',409);return {operationId:row.id,wishId:row.wish_id,version:row.expected_version+1};};
    if(!unitContext?.editor){const prior=await find();if(prior)return replay(prior);}
    const statements=[];
    if(create)statements.push(this.core.statement(`INSERT INTO Wishes(id,public_code,campaign_id,child_alias,age_band,title,description,gift_name,category,reference_amount,specifications,created_at) VALUES(?,?,?,?,?,?,?,?, 'gift',0,?,unixepoch())`,id,code,campaign,alias,input.ageBand,normalized.title,normalized.description,normalized.giftName,normalized.specifications));
    const changeIndex=statements.length;
    const changeColumns=this.core.operationsEnabled?',unit_id,handler':'';
    const changePlaceholders=this.core.operationsEnabled?',?,?':'';
    const unitValues=this.core.operationsEnabled?[ctx.unit_id,unitContext.handler]:[];
    statements.push(this.core.statement(`INSERT INTO WishChanges(id,campaign_id,wish_id,actor_id,expected_version,idempotency_hash,request_hash,payload${changeColumns})
      VALUES(?,?,?,?,?,?,?,?${changePlaceholders}) RETURNING id,wish_id,expected_version,request_hash`,
    crypto.randomUUID(),campaign,id,ctx.id,input.expectedVersion,keyHash,hash,JSON.stringify(normalized),...unitValues));
    if(create&&this.core.operating?.caseMode)statements.push(this.core.statement('UPDATE Wishes SET created_unit_id=? WHERE id=? AND created_unit_id IS NULL',ctx.unit_id,id));
    if(input.realName){text(input.privateReason,80,true);const name=text(input.realName,80,true),version=this.core.crypto.keyVersion,cipher=await this.core.crypto.encrypt({realName:name,necessaryContact:text(input.necessaryContact||'',160),internalNote:text(input.internalNote||'',1000)},`${campaign}:${id}:child:${version}`);
      statements.push(this.core.statement(`INSERT INTO WishPrivateProfiles(wish_id,campaign_id,ciphertext,key_version,retention_until,updated_by) VALUES(?,?,?,?,?,?) ON CONFLICT(wish_id) DO UPDATE SET ciphertext=excluded.ciphertext,key_version=excluded.key_version,updated_by=excluded.updated_by,updated_at=unixepoch()`,id,campaign,cipher,version,(c.gift_due_at??c.closes_at)+90*86400,ctx.id));
    }
    let committed;
    try{committed=await this.core.db.batch(statements);}catch(error){const prior=await find();if(prior)return replay(prior);throw new ApiError(/CONFLICT|IMMUTABLE|UNIQUE|FORBIDDEN|INVALID/.test(error.message)?'WISH_EDIT_CONFLICT':'WRITE_UNCONFIRMED',/CONFLICT|IMMUTABLE|UNIQUE|FORBIDDEN|INVALID/.test(error.message)?409:503);}
    const saved=committed[changeIndex].results[0];if(!saved)throw new ApiError('WRITE_UNCONFIRMED',503);return replay(saved);
  }
  // No HTTP route returns child names. A time-limited, per-wish business grant
  // is required even for an NX admin; audit must commit before plaintext leaves.
  async readChildName(campaign,id,actor,reason) {
    const actorId=await this.core.admin(campaign,actor,'staff.manage');text(reason,80,true);
    if(!await this.core.statement('SELECT wish_id FROM WishNameAccess WHERE wish_id=? AND user_id=? AND expires_at>unixepoch()',id,actorId).first())throw new ApiError('BUSINESS_ACCESS_REQUIRED',403);
    const row=await this.core.statement('SELECT ciphertext,key_version FROM WishPrivateProfiles WHERE wish_id=? AND campaign_id=? AND erased_at IS NULL AND retention_until>unixepoch()',id,campaign).first();if(!row)throw new ApiError('NOT_FOUND',404);
    const data=await this.core.crypto.decrypt(row.ciphertext,`${campaign}:${id}:child:${row.key_version}`,row.key_version);await this.audit(campaign,'wish',id,'wish.private_read',actorId,reason);return data;
  }
  async eraseChildName(campaign,id,actor) {
    const actorId=await this.core.admin(campaign,actor,'staff.manage');
    const row=await this.core.statement(`UPDATE WishPrivateProfiles SET ciphertext='ERASED',key_version='erased',erased_at=unixepoch(),updated_by=?,updated_at=unixepoch() WHERE wish_id=? AND campaign_id=? AND retention_until<=unixepoch() AND legal_hold=0 AND erased_at IS NULL RETURNING wish_id`,actorId,id,campaign).first();
    if(!row)throw new ApiError('RETENTION_NOT_DUE_OR_HELD',409);return {erased:true};
  }
  async eraseClosedCaseChildProfile(campaign, claimId, actor) {
    const actorId = await this.core.admin(campaign, actor, 'staff.manage');
    if (!isId(claimId)) throw new ApiError('INVALID_CASE', 400);
    const row = await this.core.statement(`UPDATE WishPrivateProfiles AS profile
      SET ciphertext='ERASED',key_version='erased',erased_at=unixepoch(),updated_by=?,updated_at=unixepoch()
      WHERE profile.campaign_id=? AND profile.erased_at IS NULL AND profile.legal_hold=0
        AND profile.retention_until<=unixepoch()
        AND EXISTS (
          SELECT 1 FROM CaseRetentionDeadlines d JOIN Claims c ON c.id=d.claim_id
          WHERE d.claim_id=? AND d.campaign_id=profile.campaign_id AND d.wish_id=profile.wish_id
            AND c.status='delivered' AND d.ended_at+7776000<=unixepoch()
        )
      RETURNING wish_id`, actorId, campaign, claimId).first();
    if (!row) throw new ApiError('RETENTION_NOT_DUE_OR_HELD', 409);
    return { erased: true };
  }
  async closeUnclaimedWish(campaign, wishId, actor) {
    const actorId = await this.core.admin(campaign, actor, 'staff.manage');
    if (!isId(wishId)) throw new ApiError('INVALID_CASE', 400);
    const row = await this.core.statement(`INSERT INTO UnclaimedWishClosures(wish_id,campaign_id,actor_id)
      SELECT id,campaign_id,? FROM Wishes WHERE id=? AND campaign_id=?
      AND NOT EXISTS(SELECT 1 FROM Claims WHERE wish_id=Wishes.id)
      ON CONFLICT(wish_id) DO NOTHING RETURNING wish_id`, actorId, wishId, campaign).first();
    if (!row) throw new ApiError('CASE_CANNOT_CLOSE', 409);
    return { closed: true };
  }
  async eraseUnclaimedChildProfile(campaign, wishId, actor) {
    const actorId = await this.core.admin(campaign, actor, 'staff.manage');
    if (!isId(wishId)) throw new ApiError('INVALID_CASE', 400);
    const row = await this.core.statement(`UPDATE WishPrivateProfiles AS p
      SET ciphertext='ERASED',key_version='erased',erased_at=unixepoch(),updated_by=?,updated_at=unixepoch()
      WHERE p.wish_id=? AND p.campaign_id=? AND p.erased_at IS NULL AND p.legal_hold=0
        AND p.retention_until<=unixepoch() AND EXISTS(SELECT 1 FROM UnclaimedWishClosures e
          WHERE e.wish_id=p.wish_id AND e.campaign_id=p.campaign_id AND e.ended_at+7776000<=unixepoch())
        AND NOT EXISTS(SELECT 1 FROM Claims WHERE wish_id=p.wish_id) RETURNING wish_id`,
    actorId,wishId,campaign).first();
    if (!row) throw new ApiError('RETENTION_NOT_DUE_OR_HELD',409);
    return { erased:true };
  }
  async eraseExpiredPortalPin(campaign, portalId, actor) {
    const actorId = await this.core.admin(campaign, actor, 'staff.manage');
    if (!isId(portalId)) throw new ApiError('INVALID_CASE', 400);
    const eligible = `EXISTS(SELECT 1 FROM DonorPortals WHERE id=? AND campaign_id=?)
      AND EXISTS(SELECT 1 FROM Claims WHERE portal_id=?)
      AND NOT EXISTS(SELECT 1 FROM Claims AS c
        LEFT JOIN CaseRetentionDeadlines d ON d.claim_id=c.id AND d.campaign_id=c.campaign_id
        LEFT JOIN DonorContacts p ON p.id=c.donor_contact_id AND p.campaign_id=c.campaign_id
        WHERE c.portal_id=? AND (c.campaign_id<>? OR d.ended_at IS NULL
          OR d.ended_at+7776000>unixepoch() OR p.id IS NULL OR p.legal_hold<>0))`;
    const args = [portalId,campaign,portalId,portalId,campaign];
    const results = await this.core.db.batch([
      this.core.statement(`DELETE FROM DonorPins WHERE portal_id=? AND ${eligible}`,portalId,...args),
      this.core.statement(`INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code)
        SELECT ?,'portal',?,'pin.retention_erased','admin',?,'last_case_retention_elapsed' WHERE changes()=1`,
      campaign,portalId,actorId),
      this.core.statement(`UPDATE OwnerAccess SET revoked_at=unixepoch()
        WHERE portal_id=? AND revoked_at IS NULL AND NOT EXISTS(SELECT 1 FROM DonorPins WHERE portal_id=?)
          AND ${eligible}`,portalId,portalId,...args)
    ]);
    if (!results[0].meta.changes) throw new ApiError('RETENTION_NOT_DUE_OR_HELD',409);
    return { erased:true };
  }
  async eraseRetainedDocuments(campaign, claimId, actor) {
    const actorId = await this.core.admin(campaign,actor,'staff.manage');
    if (!isId(claimId)) throw new ApiError('INVALID_CASE',400);
    try {
      const row = await this.core.statement(`INSERT INTO CaseDocumentErasures(claim_id,campaign_id,actor_id)
        SELECT id,campaign_id,? FROM Claims WHERE id=? AND campaign_id=?
        ON CONFLICT(claim_id) DO NOTHING RETURNING claim_id`,actorId,claimId,campaign).first();
      if (row) return { erased:true };
    } catch(error) {
      const code = /RETENTION_NOT_DUE_OR_HELD|ATTACHMENT_STORAGE_UNRESOLVED/.exec(error.message)?.[0];
      if (code) throw new ApiError(code,409);
      throw error;
    }
    const recorded = await this.core.statement('SELECT 1 AS erased FROM CaseDocumentErasures WHERE claim_id=? AND campaign_id=?',claimId,campaign).first();
    if (!recorded) throw new ApiError('NOT_FOUND',404);
    return { erased:true };
  }
  async mediaList(campaign,actor) {
    if(this.core.operationsEnabled)return this.core.operating.mediaList(campaign,actor);
    const ctx=await this.management.context(campaign,actor);
    return (await this.core.statement(`SELECT m.id,m.wish_id,m.claim_id,m.evidence_id,m.kind,m.visibility,m.review_status,m.content_type,m.version,m.issuing_organisation FROM WishMedia m JOIN Wishes w ON w.id=m.wish_id WHERE m.campaign_id=? AND (?=1 OR EXISTS(SELECT 1 FROM OrganisationMembers om JOIN Organisations o ON o.id=om.organisation_id WHERE om.user_id=? AND om.campaign_id=m.campaign_id AND om.organisation_id=w.organisation_id AND o.active=1)) ORDER BY m.created_at DESC LIMIT 1000`,campaign,ctx.nx?1:0,ctx.id).all()).results;
  }
  async upload(campaign,input,actor,unitContext=null) {
    if(this.core.operationsEnabled&&!unitContext)return this.core.operating.upload(campaign,input,actor);
    keys(input,['wishId','claimId','kind','contentType','dataBase64','issuingOrganisation']);
    const {ctx}=await this.wish(campaign,input.wishId,actor);
    if(!mediaKinds.includes(input.kind)||typeof input.dataBase64!=='string'||input.dataBase64.length>90000||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.dataBase64))throw new ApiError('INVALID_MEDIA');
    if(input.kind==='institution_tax_receipt')throw new ApiError('RECEIPT_ISSUANCE_NOT_ENABLED',503);
    if(input.claimId&&!await this.core.statement('SELECT id FROM Claims WHERE id=? AND wish_id=? AND campaign_id=?',input.claimId,input.wishId,campaign).first())throw new ApiError('CLAIM_SCOPE',403);
    if(!this.store?.put||!this.store?.delete||!this.store?.get||typeof this.scan!=='function')throw new ApiError('PRIVATE_STORAGE_UNAVAILABLE',503);
    const bytes=Uint8Array.from(atob(input.dataBase64),c=>c.charCodeAt(0));if(bytes.length>65536)throw new ApiError('MEDIA_TOO_LARGE',413);
    const c=await this.core.campaign(campaign),retentionUntil=(c.gift_due_at??c.closes_at)+90*86400;
    validateEvidence({bytes,contentType:input.contentType,retentionUntil});
    const id=crypto.randomUUID(),isEvidence=['receipt_record','delivery_proof'].includes(input.kind);let key='private/'+crypto.randomUUID(),evidenceId=null;
    if(isEvidence){if(!input.claimId)throw new ApiError('CLAIM_BINDING_REQUIRED');const evidence=createPrivateEvidenceService({fulfillment:new FulfillmentRepository(this.core),store:this.store,scan:this.scan});evidenceId=(await evidence.ingest(campaign,input.claimId,actor,{bytes,contentType:input.contentType,retentionUntil})).evidenceId;key=(await this.core.statement('SELECT object_key FROM Attachments WHERE id=?',evidenceId).first()).object_key;}
    else {if(await this.scan(bytes,input.contentType)!=='clean')throw new ApiError('EVIDENCE_REJECTED',422);await this.store.put(key,bytes,{contentType:input.contentType,private:true});}
    const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
    try{await this.core.db.batch([
      this.core.statement(`INSERT INTO WishMedia(id,campaign_id,wish_id,claim_id,evidence_id,kind,object_key,content_type,byte_size,sha256,uploaded_by,retention_until${unitContext?',unit_id,handler':''}) VALUES(?,?,?,?,?,?,?,?,?,?,?,?${unitContext?',?,?':''})`,id,campaign,input.wishId,input.claimId||null,evidenceId,input.kind,key,input.contentType,bytes.length,sha,ctx.id,retentionUntil,...(unitContext?[unitContext.unit_id,unitContext.handler]:[])),
      this.core.statement(`INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code) VALUES(?,'media',?,'media.uploaded','admin',?,'private_pending')`,campaign,id,ctx.id)
    ]);}catch{if(!isEvidence)try{await this.store.delete(key);}catch{/* Private orphan reconciliation required. */}throw new ApiError('MEDIA_UNCONFIRMED',503);}
    return {mediaId:id,evidenceId,version:0,reviewStatus:'pending',visibility:'staff'};
  }
  async reviewMedia(campaign,id,input,actor) {
    if(this.core.operationsEnabled)return this.core.operating.reviewMedia(campaign,id,input,actor);
    const actorId=await this.core.admin(campaign,actor,'staff.manage');keys(input,['expectedVersion','visibility','reviewStatus','privacyConfirmed','reason']);text(input.reason,80,true);
    if(!Number.isSafeInteger(input.expectedVersion)||!['public','donor','staff'].includes(input.visibility)||!['approved','rejected','pending'].includes(input.reviewStatus)||input.privacyConfirmed!==true)throw new ApiError('PRIVACY_REVIEW_REQUIRED');
    const existing=await this.core.statement('SELECT claim_id FROM WishMedia WHERE id=? AND campaign_id=?',id,campaign).first();if(!existing)throw new ApiError('NOT_FOUND',404);if(input.visibility==='donor'&&!existing.claim_id)throw new ApiError('CLAIM_BINDING_REQUIRED');
    const row=await this.core.statement(`UPDATE WishMedia SET visibility=?,review_status=?,reviewed_by=?,review_reason=?,version=version+1 WHERE id=? AND campaign_id=? AND version=? RETURNING id,version`,input.visibility,input.reviewStatus,actorId,input.reason,id,campaign,input.expectedVersion).first();if(!row)throw new ApiError('CONFLICT',409);return row;
  }
  async readMedia(campaign,id,{actor=null,credentials=null}={}) {
    if(!this.store?.get)throw new ApiError('PRIVATE_STORAGE_UNAVAILABLE',503);
    const row=await this.core.statement('SELECT m.*,w.publication_status FROM WishMedia m JOIN Wishes w ON w.id=m.wish_id WHERE m.id=? AND m.campaign_id=? AND m.retention_until>unixepoch()',id,campaign).first();if(!row)throw new ApiError('NOT_FOUND',404);
    if(actor){const {ctx}=await this.wish(campaign,row.wish_id,actor);if(this.core.operationsEnabled&&ctx.kind==='collection'&&row.unit_id!==ctx.unit_id)throw new ApiError('COLLECTION_SCOPE',403);await this.audit(campaign,'media',id,'media.read',ctx.id,'authorized_media');}
    else if(credentials){const claim=await this.core.recover(campaign,credentials);if(row.review_status!=='approved'||row.visibility!=='donor'||row.claim_id!==claim.claimId)throw new ApiError('MEDIA_FORBIDDEN',403);}
    else if(row.visibility!=='public'||row.review_status!=='approved'||row.publication_status!=='approved')throw new ApiError('NOT_FOUND',404);
    const object=await this.store.get(row.object_key);if(!object?.bytes)throw new ApiError('MEDIA_UNAVAILABLE',503);
    return {id,kind:row.kind,contentType:row.content_type,dataBase64:btoa(String.fromCharCode(...object.bytes)),taxDeductible:false,issuingOrganisation:row.issuing_organisation};
  }
  async donorMedia(campaign,credentials) {
    const claim=await this.core.recover(campaign,credentials);
    return (await this.core.statement(`SELECT id,kind,content_type FROM WishMedia WHERE campaign_id=? AND claim_id=? AND visibility='donor' AND review_status='approved' AND retention_until>unixepoch()`,campaign,claim.claimId).all()).results;
  }
  async reviewMessage(campaign,id,input,actor) {
    const actorId=await this.core.admin(campaign,actor,'staff.manage');keys(input,['nickname','message','privacyConfirmed']);if(input.privacyConfirmed!==true)throw new ApiError('PRIVACY_REVIEW_REQUIRED');
    const row=await this.core.statement('SELECT donor_contact_id FROM Claims WHERE id=? AND campaign_id=?',id,campaign).first();if(!row)throw new ApiError('NOT_FOUND',404);
    const contact=await this.core.contact(campaign,row.donor_contact_id,actor,'message_review');
    if(!contact.publicConsent||!contact.publicNickname)throw new ApiError('PUBLIC_CONSENT_REQUIRED',403);
    const nickname=text(input.nickname,40,true),message=text(input.message,500,true);
    await this.core.db.batch([this.core.statement('INSERT INTO ClaimPublicMessages(claim_id,campaign_id,nickname,message,reviewed_by) VALUES(?,?,?,?,?) ON CONFLICT(claim_id) DO UPDATE SET nickname=excluded.nickname,message=excluded.message,reviewed_by=excluded.reviewed_by,reviewed_at=unixepoch()',id,campaign,nickname,message,actorId),this.core.statement(`INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code) VALUES(?,'claim',?,'message.reviewed','admin',?,'consented_redacted')`,campaign,id,actorId)]);return {reviewed:true};
  }
  async messageDraft(campaign,id,actor) {
    await this.core.admin(campaign,actor,'staff.manage');
    const row=await this.core.statement('SELECT donor_contact_id FROM Claims WHERE id=? AND campaign_id=?',id,campaign).first();if(!row)throw new ApiError('NOT_FOUND',404);
    const contact=await this.core.contact(campaign,row.donor_contact_id,actor,'public_message_review');
    return contact.publicConsent?{publicConsent:true,nickname:contact.publicNickname||'',message:contact.blessing||''}:{publicConsent:false,nickname:'',message:''};
  }
  async documentRequests(campaign,actor) {
    await this.core.admin(campaign,actor,'contact.read');return (await this.core.statement('SELECT claim_id,material_proof,paper_thank_you,electronic_thank_you,electronic_proof,dispatch_status FROM DocumentRequests WHERE campaign_id=?',campaign).all()).results;
  }
  async requestRecovery(campaign,input) {
    keys(input,['phone','wishCode']);if(!/^\+?[0-9]{8,15}$/.test(input.phone||'')||!isId(input.wishCode))throw new ApiError('INVALID_RECOVERY');
    if(!this.recovery?.requestChallenge)throw new ApiError('PHONE_VERIFICATION_UNAVAILABLE',503);
    const challenge=await this.recovery.requestChallenge({campaign,...input});if(!isId(challenge?.challengeId))throw new ApiError('VERIFICATION_UNAVAILABLE',503);return {challengeId:challenge.challengeId};
  }
  async finishRecovery(campaign,input) {
    keys(input,['challengeId','code','claimSecret']);if(!isId(input.challengeId)||!/^\d{6}$/.test(input.code||'')||!/^[A-Za-z0-9_-]{43}$/.test(input.claimSecret||''))throw new ApiError('OTP_REQUIRED',403);
    if(!this.recovery?.verifyChallenge)throw new ApiError('PHONE_VERIFICATION_UNAVAILABLE',503);
    const verification=await this.recovery.verifyChallenge({campaign,challengeId:input.challengeId,code:input.code});
    if(!verification?.verified||verification.campaign!==campaign||!Number.isSafeInteger(verification.expiresAt)||verification.expiresAt<=seconds()||verification.expiresAt>seconds()+300||!/^\+?[0-9]{8,15}$/.test(verification.phone||'')||!isId(verification.wishCode))throw new ApiError('OTP_INVALID',403);
    const row=await this.core.statement(`SELECT c.id,c.version,c.capability_hash,d.phone_lookup_hash,d.phone_lookup_version FROM Claims c JOIN DonorContacts d ON d.id=c.donor_contact_id JOIN Wishes w ON w.id=c.wish_id WHERE c.campaign_id=? AND w.public_code=? AND d.erased_at IS NULL AND d.retention_until>unixepoch() AND c.capability_revoked_at IS NULL AND c.capability_expires_at>unixepoch() AND c.status NOT IN ('cancelled','expired')`,campaign,verification.wishCode).first();
    if(!row?.phone_lookup_hash||!equalDigest(row.phone_lookup_hash,await this.core.crypto.fingerprint({phone:verification.phone},row.phone_lookup_version)))throw new ApiError('RECOVERY_UNAVAILABLE',404);
    await this.core.statement('INSERT INTO CapabilityRotations(claim_id,rotation_hash,old_hash,new_hash,expected_version) VALUES(?,?,?,?,?)',row.id,await digest(input.challengeId),row.capability_hash,await digest(input.claimSecret),row.version).run();
    return {claimId:row.id,claimSecret:input.claimSecret};
  }
}
