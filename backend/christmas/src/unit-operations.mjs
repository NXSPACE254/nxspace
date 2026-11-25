import {normalizeWishCode,collectionSites} from './operational-policy.mjs';
import { ApiError, validateClaim, validateWish, isId, isRequestKey } from './validation.mjs';
import { digest, equalDigest } from './crypto.mjs';

const permissions={
  admin:['wish.write','wish.reopen','claim.read','claim.cancel','claim.assist','gift.receive','gift.handoff','gift.accept','gift.deliver','gift.exception','audit.read','contact.read','contact.rotate','contact.erase','claim.revoke','staff.manage','child.read','case.manage'],
  bookhouse:['wish.write','wish.reopen','claim.read','claim.cancel','claim.assist','gift.accept','gift.deliver','gift.exception','audit.read','contact.read','child.read','case.manage'],
  collection:['claim.read','claim.assist','gift.receive','gift.handoff','gift.exception','audit.read']
};
const now=()=>Math.floor(Date.now()/1000);
// One row per wish; gift buckets are disjoint, document work is independent.
export function dashboardSummary(rows,at=now(),reminderDays=2) {
  const effective=r=>Boolean(r.claim_id)&&!['cancelled','expired'].includes(r.claim_status);
  const outstanding=rows.filter(r=>effective(r)&&(r.claim_status==='claimed'||r.claim_status==='exception'&&r.exception_from_status==='claimed')&&!r.receipt_id);
  const tasks=outstanding.filter(r=>Number.isSafeInteger(r.gift_due_at)).map(r=>({...r,remaining_days:Math.floor((r.gift_due_at+28800)/86400)-Math.floor((at+28800)/86400)})).filter(r=>r.gift_due_at<at||reminderDays!==null&&r.remaining_days<=reminderDays).sort((a,b)=>a.remaining_days-b.remaining_days||a.gift_due_at-b.gift_due_at||a.public_code.localeCompare(b.public_code));
  const count=fn=>rows.filter(fn).length;
  return {total:rows.length,claimed:count(effective),urgent:tasks.length,available:count(r=>!effective(r)&&r.status==='available'&&r.publication_status==='approved'),pending:outstanding.filter(r=>r.claim_status==='claimed').length,received:count(r=>effective(r)&&r.claim_status==='gift_received'),custody:count(r=>effective(r)&&r.claim_status==='handed_over'),delivered:count(r=>effective(r)&&r.claim_status==='delivered'),exceptions:count(r=>effective(r)&&r.claim_status==='exception'),thankPending:count(r=>effective(r)&&r.thank_status&&!['sent','not_required'].includes(r.thank_status)),proofPending:count(r=>effective(r)&&r.proof_status&&!['sent','not_required'].includes(r.proof_status)),review:count(r=>r.publication_status==='draft'||r.pending_review),tasks};
}
export function taipeiDeliveryDeadline(claimedAt,days,finalDeadline){
  if(!Number.isSafeInteger(claimedAt)||(days!==null&&(!Number.isInteger(days)||days<1||days>90))||
    (finalDeadline!==null&&!Number.isSafeInteger(finalDeadline)))throw new ApiError('INVALID_DEADLINE');
  if(days===null)return finalDeadline;
  const relative=(Math.floor((claimedAt+28800)/86400)+days+1)*86400-28800-1;
  return finalDeadline===null?relative:Math.min(relative,finalDeadline);
}
export function pendingTasks(rows,at,reminderDays){
  return rows.filter(r=>r.status==='claimed').map(r=>{
    if(!Number.isSafeInteger(r.gift_due_at))return {...r,remaining_days:null,queue:'pending'};
    const remaining_days=Math.floor((r.gift_due_at+28800)/86400)-Math.floor((at+28800)/86400);
    return {...r,remaining_days,queue:r.gift_due_at<at?'overdue_pending_confirmation':reminderDays!==null&&remaining_days<=reminderDays?'due_soon':'pending'};
  }).sort((a,b)=>(a.gift_due_at??Infinity)-(b.gift_due_at??Infinity)||String(a.id).localeCompare(String(b.id)));
}
const privateLinkToken=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const text=(s,max=80,min=2)=>{if(typeof s!=='string'||s.trim().length<min||s.length>max||/[\u0000-\u001f]/.test(s))throw new ApiError('OPERATOR_OR_REFERENCE_REQUIRED');return s.trim();};
const only=(o,keys)=>{if(!o||Array.isArray(o)||typeof o!=='object'||Object.keys(o).some(k=>!keys.includes(k)))throw new ApiError('INVALID_FIELDS');};
const booleanPrefs=p=>{if(p!==undefined){only(p,['materialProof','paperThankYou','electronicThankYou','electronicProof']);if(Object.values(p).some(v=>typeof v!=='boolean'))throw new ApiError('INVALID_PREFERENCES');}return Object.fromEntries(['materialProof','paperThankYou','electronicThankYou','electronicProof'].map(k=>[k,Boolean(p?.[k])]));};
export class UnitOperations {
  #requestContext;
  constructor({core,experience,management,fulfillment,email=null,reuseRequestContext=false}){
    Object.assign(this,{core,experience,management,fulfillment,email});core.operating=this;core.operationsEnabled=true;
    if(reuseRequestContext)this.#requestContext={rules:new Map()};
  }
  async context(campaign,actor,permission='claim.read',{reviewSubmit=false}={}){
    const cache=this.#requestContext;
    if(!cache)return this.#loadContext(campaign,actor,permission);
    if(cache.actor!==actor||cache.campaign!==campaign||!cache.result||cache.reviewSubmit&&!reviewSubmit){
      cache.result=await this.#loadContext(campaign,actor,permission,reviewSubmit);
      cache.campaign=campaign;
      cache.actor=actor;
      cache.reviewSubmit=reviewSubmit;
    }
    if(!cache.result.permissions.includes(permission))throw new ApiError('UNIT_FORBIDDEN_OR_REVOKED',403);
    return cache.result;
  }
  async #loadContext(campaign,actor,permission,reviewSubmit=false){
    if(!actor?.verified||!actor.issuer||!actor.subject)throw new ApiError('UNAUTHORIZED',401);
    const a=await this.core.statement(`SELECT u.id,a.organisation_id AS unit_id,a.kind,o.label,a.documents_export,a.display_name FROM AdminUsers u JOIN OperatingAccounts a ON a.user_id=u.id JOIN Organisations o ON o.id=a.organisation_id WHERE u.issuer=? AND u.subject=? AND u.status='active' AND a.campaign_id=? AND a.revoked_at IS NULL AND o.active=1 AND EXISTS(SELECT 1 FROM UserRoles r WHERE r.user_id=u.id AND r.campaign_id=a.campaign_id AND r.role_id=CASE WHEN a.kind='admin' THEN 'nx_admin' ELSE 'nx_staff' END)`,actor.issuer,actor.subject,campaign).first();
    if(!a||!permissions[a.kind]?.includes(permission)||this.acceptanceMode&&a.kind!=='admin'&&permission==='audit.read')throw new ApiError('UNIT_FORBIDDEN_OR_REVOKED',403);
    const {display_name,...account}=a;
    account.documents_export=this.caseMode?a.documents_export:0;
    const displayName=(this.caseMode&&display_name)||({admin:'授權管理者',bookhouse:'書屋授權人員',collection:'據點收件人員'}[a.kind]);
    const label=a.kind==='admin'?(this.caseMode?'NXSPACE':'NX SPACE'):a.label;
    // Submission needs only the bookhouse's own membership and no collection sites.
    if(reviewSubmit&&a.kind!=='collection'){
      const [campaignRows,ruleRows,...membership]=await this.core.db.batch([
        this.core.campaignStatement(campaign),this.ruleStatement(campaign),
        ...(a.kind==='bookhouse'?[this.core.statement(`SELECT o.id FROM Organisations o
          JOIN OrganisationMembers m ON m.organisation_id=o.id AND m.campaign_id=o.campaign_id
          WHERE o.id=? AND o.campaign_id=? AND o.active=1 AND m.user_id=?`,a.unit_id,campaign,a.id)]:[])
      ]);
      await this.core.campaign(campaign,{row:campaignRows.results[0],rule:ruleRows.results[0]});
      return {...account,displayName,label,
        bookhouseId:ruleRows.results[0].bookhouse_id,organisations:membership[0]?.results??[],
        permissions:permissions[a.kind].filter(p=>!this.acceptanceMode||a.kind==='admin'||p!=='audit.read')};
    }
    const [members,sites,campaignRows,ruleRows]=await this.core.db.batch([
      this.core.statement(`SELECT o.id,o.label FROM Organisations o WHERE o.campaign_id=? AND o.active=1 AND (?='admin' OR EXISTS(SELECT 1 FROM OrganisationMembers m WHERE m.organisation_id=o.id AND m.campaign_id=o.campaign_id AND m.user_id=?))`,campaign,a.kind,a.id),
      this.core.statement("SELECT id,label FROM Organisations WHERE campaign_id=? AND unit_kind='collection' AND active=1",campaign),
      ...(this.#requestContext?[this.core.campaignStatement(campaign),this.ruleStatement(campaign)]:[])
    ]);
    const campaignInfo=await this.core.campaign(campaign,campaignRows?{row:campaignRows.results[0],rule:ruleRows.results[0]}:undefined);
    return {displayName:(this.caseMode&&display_name)||({admin:'授權管理者',bookhouse:'書屋授權人員',collection:'據點收件人員'}[a.kind]),roleLabel:{admin:'公益管理者',bookhouse:'書屋工作人員',collection:'收件人員'}[a.kind],...account,label:a.kind==='admin'?(this.caseMode?'NXSPACE':'NX SPACE'):a.label,claimDeadlineAt:this.caseMode?Math.min(campaignInfo.closes_at,campaignInfo.claim_deadline_at):campaignInfo.claim_deadline_at,giftDeadlineAt:campaignInfo.gift_due_at,bookhouseId:(await this.rule(campaign)).bookhouse_id,collectionSites:sites.results,nx:a.kind==='admin',operating:true,permissions:permissions[a.kind].filter(p=>!this.acceptanceMode||a.kind==='admin'||p!=='audit.read'),organisations:members.results};
  }
  async authorize(campaign,actor,permission){return (await this.context(campaign,actor,permission)).id;}
  async deliveryDeadline(campaign,claimedAt,finalDeadline){const days=(await this.rule(campaign)).delivery_days;return taipeiDeliveryDeadline(claimedAt,days,finalDeadline);}
  async dashboard(campaign,actor,at=now()) {
    const ctx=await this.context(campaign,actor),rule=await this.rule(campaign);
    const rows=(await this.core.statement(`SELECT w.id,w.public_code,w.public_nickname,w.gift_name,w.status,w.publication_status,w.organisation_id,w.version,c.id AS claim_id,c.status AS claim_status,c.exception_from_status,c.claimed_at,c.gift_due_at,g.id AS receipt_id,g.effective_location AS location_code,f.thank_status,f.proof_status,f.closed_at,EXISTS(SELECT 1 FROM HandoffBatchItems i WHERE i.claim_id=c.id) AS in_batch,EXISTS(SELECT 1 FROM PublicWishProposals p WHERE p.wish_id=w.id AND p.status='pending') AS pending_review FROM Wishes w LEFT JOIN Claims c ON c.wish_id=w.id AND c.status NOT IN ('cancelled','expired') LEFT JOIN ReceiptLocations g ON g.claim_id=c.id LEFT JOIN CaseFiles f ON f.claim_id=c.id WHERE w.campaign_id=? ORDER BY w.public_code`,campaign).all()).results;
    const summary=dashboardSummary(rows,at,rule.reminder_days===null?null:undefined),{tasks,...counts}=summary;
    const scoped=rows.filter(r=>ctx.kind==='admin'||r.organisation_id===rule.bookhouse_id);
    const visible=ctx.kind==='collection'?scoped.filter(r=>r.publication_status==='approved').map(r=>r.location_code===ctx.unit_id?r:{id:r.id,public_code:r.public_code,public_nickname:r.public_nickname,gift_name:r.gift_name,status:r.status,publication_status:r.publication_status}):scoped;
    const sites=ctx.collectionSites.filter(s=>ctx.kind!=='collection'||s.id===ctx.unit_id).map(s=>({...s,received:rows.filter(r=>r.location_code===s.id&&r.claim_status==='gift_received').length,awaitingPickup:rows.filter(r=>r.location_code===s.id&&r.claim_status==='gift_received').length}));
    // Collection accounts receive global non-sensitive counts, never other claims' metadata.
    const reusableFirstCode=ctx.kind!=='collection'&&!rows.some(row=>row.public_code==='NX-001')&&
      await this.core.statement("SELECT reason_code AS public_code FROM AuditLogs WHERE campaign_id=? AND action='test_case.archived' AND reason_code='NX-001' AND NOT EXISTS(SELECT 1 FROM Wishes WHERE public_code='NX-001') LIMIT 1",campaign).first();
    return {counts,rows:visible,tasks:ctx.kind==='collection'?[]:tasks.filter(r=>ctx.kind==='admin'||r.organisation_id===rule.bookhouse_id),sites,generatedAt:at,timeZone:'Asia/Taipei',...(ctx.kind==='collection'?{}:{nextCode:reusableFirstCode?.public_code||'NX-'+String(Math.max(0,...rows.filter(r=>/^NX-\d{3,12}$/.test(r.public_code)).map(r=>Number(r.public_code.slice(3))))+1).padStart(3,'0')})};
  }
  async fulfill(campaign,{kind,payload},actor,key){const ctx=await this.context(campaign,actor),body={...payload};if(this.caseMode&&['accept','delivery'].includes(kind)&&ctx.kind!=='bookhouse')throw new ApiError('BOOKHOUSE_ONLY',403);const deliveryNote=kind==='delivery'&&this.caseMode?text(body.note||'',1000,0):'';if(kind==='delivery'&&this.caseMode)delete body.note;if(kind==='batch'&&this.caseMode&&body.plannedAt==null)body.plannedAt=0;if(['receipt','batch','exception','resolve'].includes(kind))body.note=body.note||'';if(kind==='accept')body.acceptanceReference=body.acceptanceReference||crypto.randomUUID();const prefixStatements=[];
  if (kind === 'receipt' && ctx.kind === 'collection') {
    body.locationCode = ctx.unit_id;
    const { claim } = await this.claimScope(campaign, body.claimId, actor, { allowUnreceived: true });
    const original = claim.planned_site_id || claim.assisted_unit_id;
    if (original && original !== ctx.unit_id) {
      if (body.wishCode !== claim.public_code || body.crossSiteConfirmed !== true) throw new ApiError('CROSS_SITE_RECEIPT_CONFIRMATION_REQUIRED', 403);
      prefixStatements.push(this.action(campaign, ctx, ctx.label, 'receipt.cross_site', claim.id,
        JSON.stringify({ originalSite: original, actualSite: ctx.unit_id, reason: '民眾改至其他合作據點交件' })));
    }
    delete body.crossSiteConfirmed;
  }
  if(this.manualMode&&['receipt','delivery'].includes(kind)){
 if(body.manuallyConfirmed!==true)throw new ApiError('MANUAL_CONFIRMATION_REQUIRED');delete body.manuallyConfirmed;
 const id='manual_'+(await digest(campaign+':'+ctx.id+':'+key+':'+kind)).slice(0,40),at=now(),record=JSON.stringify({kind,actorId:ctx.id,unitId:ctx.unit_id,claimId:body.claimId,quantity:body.quantity||1,confirmedAt:at,method:'physical_paper_and_staff_check',note:deliveryNote});
 const priorManual=await this.core.statement('SELECT manual_record FROM Attachments WHERE id=?',id).first();if(priorManual&&(JSON.parse(priorManual.manual_record).note||'')!==deliveryNote)throw new ApiError('IDEMPOTENCY_MISMATCH',409);body.evidenceId=id;prefixStatements.push(this.core.statement('INSERT INTO Attachments(id,campaign_id,claim_id,object_key,sha256,content_type,byte_size,verified_at,retention_until,manual_record) VALUES(?,?,?,?,?,?,?,?,?,?)',id,campaign,body.claimId,'manual-record:'+id,await digest(record),'application/vnd.nxspace.manual-attestation+json',new TextEncoder().encode(record).length,at,at+31536000,record));
 }const result=await this.fulfillment.execute(campaign,kind,body,actor,key,ctx.label,{prefixStatements});if(['receipt','delivery','exception'].includes(kind))await this.notifyClaim(campaign,body.claimId,kind,key);return result;}
  async release(campaign,input,actor,key){
    const ctx=await this.context(campaign,actor,'claim.cancel');
    if(!isRequestKey(key)||!['donor_cancel','overdue_confirmed'].includes(input.reason))throw new ApiError('INVALID_RELEASE');
    const {claim}=await this.claimScope(campaign,input.claimId,actor);
    if(this.caseMode&&(typeof input.note!=='string'||input.note.trim().length<2||input.note.length>1000))throw new ApiError('CANCELLATION_NOTE_REQUIRED');
    const hash=await this.core.crypto.fingerprint({claimId:input.claimId,expectedVersion:input.expectedVersion,expectedWishVersion:input.expectedWishVersion,reason:input.reason,...(this.caseMode?{note:input.note}:{})});
    const prior=await this.core.statement('SELECT actor_id,request_hash FROM ClaimReleases WHERE id=? AND campaign_id=?',key,campaign).first();
    if(prior){if(prior.actor_id!==ctx.id||!equalDigest(prior.request_hash,hash))throw new ApiError('CONFLICT',409);return {released:true};}
    try{
      const statement=this.core.statement('INSERT INTO ClaimReleases(id,campaign_id,claim_id,expected_version,wish_version,actor_id,reason,request_hash) VALUES(?,?,?,?,?,?,?,?)',key,campaign,input.claimId,input.expectedVersion,input.expectedWishVersion,ctx.id,input.reason,hash);
      if(this.caseMode){
        const kv=this.core.crypto.keyVersion,payload=await this.core.crypto.encrypt({type:'取消認領',description:input.note,contact:'已核對認領紀錄',result:'認領已取消，心願已重新開放'},`${campaign}:${claim.wish_id}:${key}:${kv}`);
        const note=this.core.statement("INSERT INTO CaseSupportEvents(id,campaign_id,wish_id,unit_id,actor_id,topic_id,version,status,ciphertext,key_version) VALUES(?,?,?,?,?,?,1,'resolved',?,?)",key,campaign,claim.wish_id,ctx.unit_id,ctx.id,key,payload,kv);
        await this.core.db.batch([note,statement]);
      }else await statement.run();
    }catch(error){const conflict=/CONFLICT|FORBIDDEN|UNIQUE/.test(error.message);throw new ApiError(conflict?'RELEASE_CONFLICT':'WRITE_UNCONFIRMED',conflict?409:503);}
    await this.notifyClaim(campaign,input.claimId,'cancellation',key);return {released:true};
  }
  async correctLocation(campaign,input,actor,key){if(this.caseMode)text(input.note,500,2);const ctx=await this.context(campaign,actor,'staff.manage');if(!isRequestKey(key)||!ctx.collectionSites.some(s=>s.id===input.newLocation))throw new ApiError('INVALID_COLLECTION_SITE');await this.claimScope(campaign,input.claimId,actor);try{await this.core.statement('INSERT INTO ReceiptLocationCorrections(id,claim_id,old_location,new_location,actor_id,note) VALUES(?,?,?,?,?,?)',key,input.claimId,input.oldLocation,input.newLocation,ctx.id,typeof input.note==='string'?input.note.slice(0,500):'').run();}catch(e){throw new ApiError(/CONFLICT|FORBIDDEN|UNIQUE/.test(e.message)?'CORRECTION_CONFLICT':'WRITE_UNCONFIRMED',/CONFLICT|FORBIDDEN|UNIQUE/.test(e.message)?409:503);}return {corrected:true};}
  async requestOwnerLink(campaign,input){if(this.directMode)throw new ApiError('NOTIFICATIONS_DISABLED',403);only(input,['email','phone']);if(!this.email?.sendLink)throw new ApiError('EMAIL_UNCONFIGURED',503);if((input.email!==undefined&&typeof input.email!=='string')||(input.phone!==undefined&&typeof input.phone!=='string'))throw new ApiError('INVALID_CONTACT');const email=(input.email||'').trim().toLowerCase(),phone=input.phone||'';if((!email&&!phone)||email.length>160||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||(phone&&!/^\+?[0-9]{8,15}$/.test(phone)))throw new ApiError('INVALID_CONTACT');const portals=(await this.core.statement('SELECT * FROM DonorPortals WHERE campaign_id=?',campaign).all()).results,targets=new Map(),requestId=crypto.randomUUID();
    if(email){for(const p of portals)if(equalDigest(p.email_hash,await this.core.crypto.fingerprint({email},p.key_version)))targets.set(p.id,email);}
    else{const rows=(await this.core.statement('SELECT d.*,c.portal_id FROM DonorContacts d JOIN Claims c ON c.donor_contact_id=d.id WHERE c.campaign_id=? AND c.portal_id IS NOT NULL AND d.phone_lookup_hash IS NOT NULL AND d.erased_at IS NULL AND d.retention_until>unixepoch()',campaign).all()).results;for(const d of rows)if(equalDigest(d.phone_lookup_hash,await this.core.crypto.fingerprint({phone},d.phone_lookup_version))){const value=await this.core.crypto.decrypt(d.ciphertext,`${campaign}:${d.id}:${d.key_version}`,d.key_version);if(value.channel==='email'&&portals.some(p=>p.id===d.portal_id))targets.set(d.portal_id,value.address);}}
    for(const [portalId,address]of [...targets].slice(0,3)){const token=privateLinkToken();await this.core.statement('INSERT INTO OwnerRecoveryLinks(token_hash,portal_id,expires_at) VALUES(?,?,?)',await digest(token),portalId,now()+600).run();try{await this.email.sendLink({email:address,requestId,token,managementRoute:'/#christmas/manage/verify/'+token});}catch{/* Generic acknowledgement prevents contact enumeration; no private log. */}}
    return {accepted:true,requestId};
  }
  async redeemOwnerLink(campaign,{token,portalSecret}){if(this.directMode)throw new ApiError('NOTIFICATIONS_DISABLED',403);if(!/^[\w-]{43}$/.test(token||'')||!/^[\w-]{43}$/.test(portalSecret||''))throw new ApiError('INVALID_CREDENTIAL',403);const row=await this.core.statement('UPDATE OwnerRecoveryLinks SET used_at=unixepoch() WHERE token_hash=? AND used_at IS NULL AND expires_at>unixepoch() AND portal_id IN (SELECT id FROM DonorPortals WHERE campaign_id=?) RETURNING portal_id',await digest(token),campaign).first();if(!row)throw new ApiError('LINK_EXPIRED_OR_USED',403);return this.issueAccess(row.portal_id,portalSecret);}
  async extendDeadline(campaign,input,actor,key){
    only(input,['claimId','expectedVersion','newDueAt','reason']);const ctx=await this.context(campaign,actor,'claim.cancel');
    if(!isRequestKey(key)||!Number.isSafeInteger(input.expectedVersion)||!Number.isSafeInteger(input.newDueAt)||typeof input.reason!=='string'||input.reason.trim().length<2||input.reason.length>500)throw new ApiError('INVALID_DEADLINE');
    const {claim}=await this.claimScope(campaign,input.claimId,actor);
    const prior=await this.core.statement('SELECT * FROM ClaimDeadlineExtensions WHERE id=?',key).first();if(prior){if(prior.campaign_id!==campaign||prior.claim_id!==input.claimId||prior.actor_id!==ctx.id||prior.expected_version!==input.expectedVersion||prior.new_due_at!==input.newDueAt||prior.reason!==input.reason)throw new ApiError('CONFLICT',409);return {saved:true};}
    try{await this.core.statement('INSERT INTO ClaimDeadlineExtensions(id,campaign_id,claim_id,actor_id,expected_version,old_due_at,new_due_at,reason) VALUES(?,?,?,?,?,?,?,?)',key,campaign,input.claimId,ctx.id,input.expectedVersion,claim.gift_due_at,input.newDueAt,input.reason).run();}catch{throw new ApiError('DEADLINE_CONFLICT',409);}return {saved:true};
  }
  async notifyClaim(campaign,claimId,kind,key){
    if(this.directMode||!this.email?.notify)return false;
    try{const c=await this.core.statement('SELECT c.*,w.public_code FROM Claims c JOIN Wishes w ON w.id=c.wish_id WHERE c.id=? AND c.campaign_id=?',claimId,campaign).first();if(!c)return false;const d=await this.core.statement('SELECT * FROM DonorContacts WHERE id=? AND erased_at IS NULL AND retention_until>unixepoch()',c.donor_contact_id).first();if(!d)return false;const contact=await this.core.crypto.decrypt(d.ciphertext,`${campaign}:${d.id}:${d.key_version}`,d.key_version);if(contact.channel!=='email')return false;return await this.email.notify(kind,{email:contact.address,claimId,wishCode:c.public_code,giftDueAt:c.gift_due_at},campaign+':'+kind+':'+claimId+':'+key)===true;}catch{return false;}
  }
  async previewReminders(campaign,actor){
    await this.context(campaign,actor,'staff.manage');if(!this.email?.previews)throw new ApiError('LOCAL_PREVIEW_ONLY',503);
    const rows=await this.overdue(campaign,actor);let recorded=0;for(const row of rows.filter(r=>r.queue==='due_soon'))if(await this.notifyClaim(campaign,row.id,'reminder',String(Math.floor((now()+28800)/86400))))recorded++;return {testOnly:true,recorded};
  }
  async publicContent(campaign,input=null,actor=null){
    await this.core.campaign(campaign);
    const ctx=actor?await this.context(campaign,actor,'staff.manage'):null;
    if(input){
      if(!ctx?.nx)throw new ApiError('FORBIDDEN',403);
      only(input,['expectedVersion','content']);
      const c=input.content, fields=['headline','introduction','partnership','miller','tree','cama','faq'];
      if(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0||!c||Array.isArray(c)||typeof c!=='object')throw new ApiError('INVALID_CONTENT');
      only(c,fields);
      if(fields.slice(0,-1).some(k=>typeof c[k]!=='string'||!c[k].trim()||c[k].length>2000)||!Array.isArray(c.faq)||c.faq.length!==12||c.faq.some(r=>!Array.isArray(r)||r.length!==2||r.some(v=>typeof v!=='string'||!v.trim()||v.length>1500)))throw new ApiError('INVALID_CONTENT');
      const result=await this.core.db.batch([
        this.core.statement('INSERT INTO CampaignPublicContent(campaign_id,payload,version) SELECT ?,?,1 WHERE ?=0 OR EXISTS(SELECT 1 FROM CampaignPublicContent WHERE campaign_id=?) ON CONFLICT(campaign_id) DO UPDATE SET payload=excluded.payload,version=CampaignPublicContent.version+1,updated_at=unixepoch() WHERE CampaignPublicContent.version=? AND ?>0',campaign,JSON.stringify(c),input.expectedVersion,campaign,input.expectedVersion,input.expectedVersion),
        this.core.statement("INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id) SELECT ?,?,?,?,?, 'content.updated',? WHERE changes()=1",crypto.randomUUID(),campaign,ctx.unit_id,ctx.id,ctx.label,campaign)
      ]);
      if(!result[0].meta.changes)throw new ApiError('CONTENT_CONFLICT',409);
    }
    const row=await this.core.statement('SELECT payload,version FROM CampaignPublicContent WHERE campaign_id=?',campaign).first();
    const content=row?JSON.parse(row.payload):null;if(content&&!actor){delete content.hiddenFaq;if(this.acceptanceMode)content.collectionSites=await collectionSites(this,campaign);}return {content,version:row?.version||0};
  }
  async settings(campaign,input,actor){const ctx=await this.context(campaign,actor,'staff.manage');if(!input)return this.rule(campaign);only(input,['handler','reminderDays','deliveryDays','automaticRelease']);input={...input,handler:ctx.label};if(input.deliveryDays!==undefined&&input.deliveryDays!==null&&(!Number.isInteger(input.deliveryDays)||input.deliveryDays<1||input.deliveryDays>90))throw new ApiError('INVALID_DELIVERY_DAYS');if(input.reminderDays!==null&&(!Number.isInteger(input.reminderDays)||input.reminderDays<1||input.reminderDays>30)||input.automaticRelease!==false)throw new ApiError('INVALID_OPERATING_RULE');await this.core.db.batch([this.core.statement('UPDATE CampaignOperatingRules SET reminder_days=?,delivery_days=CASE WHEN ? THEN ? ELSE delivery_days END WHERE campaign_id=?',input.reminderDays,input.deliveryDays!==undefined?1:0,input.deliveryDays??null,campaign),this.action(campaign,ctx,input.handler,'settings.updated',campaign)]);return {saved:true,automaticRelease:false};}
  async importWishes(campaign,{handler,wishes},actor,key){const ctx=await this.context(campaign,actor,'wish.write');handler=ctx.label;if(!isRequestKey(key)||!Array.isArray(wishes)||!wishes.length||wishes.length>50)throw new ApiError('INVALID_IMPORT');const results=[];for(let i=0;i<wishes.length;i++){try{const row=await this.saveWish(campaign,{...wishes[i],handler},actor,`${key}-${i}`);results.push({index:i,status:'saved',...row});}catch(error){results.push({index:i,status:'not_confirmed',code:error instanceof ApiError?error.code:'WRITE_UNCONFIRMED'});break;}}return {results,complete:results.length===wishes.length&&results.every(r=>r.status==='saved')};}
  action(campaign,ctx,handler,action,resource,reference='',id=crypto.randomUUID()){return this.core.statement('INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id,reference) VALUES(?,?,?,?,?,?,?,?)',id,campaign,ctx.unit_id,ctx.id,text(this.caseMode?(ctx.displayName||ctx.label):(handler||ctx.label)),action,resource,reference);}
  ruleStatement(campaign){
    return this.core.statement('SELECT * FROM CampaignOperatingRules WHERE campaign_id=?',campaign);
  }
  async rule(campaign,preloaded){
    const rules=this.#requestContext?.rules;
    const cached=rules?.get(campaign);
    if(cached)return {...cached};
    const row=preloaded?preloaded.rule:await this.ruleStatement(campaign).first();
    if(!row)throw new ApiError('OPERATIONS_UNCONFIGURED',503);
    if(rules)rules.set(campaign,{...row});
    return row;
  }
  async claimScope(campaign,id,actor,{allowUnreceived=false}={}){
    const ctx=await this.context(campaign,actor),c=await this.core.statement(`SELECT c.*,w.organisation_id,w.public_code,g.effective_location AS location_code FROM Claims c JOIN Wishes w ON w.id=c.wish_id LEFT JOIN ReceiptLocations g ON g.claim_id=c.id WHERE c.id=? AND c.campaign_id=?`,id,campaign).first();if(!c)throw new ApiError('NOT_FOUND',404);
    const rule=await this.rule(campaign);
    if(ctx.kind==='bookhouse'&&c.organisation_id!==rule.bookhouse_id)throw new ApiError('UNIT_SCOPE',403);
    if(ctx.kind==='collection'&&c.location_code!==ctx.unit_id&&c.assisted_unit_id!==ctx.unit_id&&c.planned_site_id!==ctx.unit_id&&!(allowUnreceived&&c.status==='claimed'))throw new ApiError('COLLECTION_SCOPE',403);
    if(ctx.kind==='collection'&&c.location_code&&c.location_code!==ctx.unit_id)throw new ApiError('COLLECTION_SCOPE',403);
    return {ctx,claim:c};
  }
  async wishAccess(campaign,id,actor,includePending=false){
    const ctx=await this.context(campaign,actor);
    const sql=includePending
      ? `SELECT w.*,p.id AS pending_proposal_id,p.created_by AS pending_proposal_actor
        FROM Wishes w LEFT JOIN PublicWishProposals p ON p.wish_id=w.id AND p.status='pending'
        WHERE w.id=? AND w.campaign_id=?`
      : 'SELECT * FROM Wishes WHERE id=? AND campaign_id=?';
    const row=await this.core.statement(sql,id,campaign).first();
    if(!row)throw new ApiError('NOT_FOUND',404);
    if(ctx.kind==='bookhouse'&&row.organisation_id!==(await this.rule(campaign)).bookhouse_id)throw new ApiError('UNIT_SCOPE',403);
    if(ctx.kind==='collection'){const c=await this.core.statement("SELECT id FROM Claims WHERE wish_id=? AND status NOT IN ('cancelled','expired')",id).first();if(!c)throw new ApiError('COLLECTION_SCOPE',403);await this.claimScope(campaign,c.id,actor);}
    return {ctx,row};
  }
  async batchScope(campaign,id,actor){const ctx=await this.context(campaign,actor),row=await this.core.statement('SELECT * FROM HandoffBatches WHERE id=? AND campaign_id=?',id,campaign).first();if(!row)throw new ApiError('NOT_FOUND',404);if(ctx.kind==='collection'&&row.collection_unit_id!==ctx.unit_id)throw new ApiError('COLLECTION_SCOPE',403);if(ctx.kind==='bookhouse'&&row.organisation_id!==(await this.rule(campaign)).bookhouse_id)throw new ApiError('UNIT_SCOPE',403);return row;}
  async fulfillmentContext(campaign,kind,payload,actor,handler){const map={receipt:'gift.receive',batch:'gift.handoff',accept:'gift.accept',delivery:'gift.deliver',exception:'gift.exception',resolve:'gift.exception'},ctx=await this.context(campaign,actor,map[kind]);handler=this.caseMode?ctx.displayName:ctx.label;if(this.caseMode&&['accept','delivery'].includes(kind)&&ctx.kind!=='bookhouse')throw new ApiError('BOOKHOUSE_ONLY',403);if(kind==='receipt'&&ctx.kind==='collection')payload.locationCode=ctx.unit_id;if(kind==='accept'&&!payload.acceptanceReference)payload.acceptanceReference=crypto.randomUUID();if(kind==='receipt'&&ctx.kind!=='admin'&&payload.locationCode!==ctx.unit_id)throw new ApiError('COLLECTION_SCOPE',403);if(['receipt','batch'].includes(kind)&&!ctx.collectionSites.some(s=>s.id===payload.locationCode))throw new ApiError('INVALID_COLLECTION_SITE',403);if(kind==='batch'){if(ctx.kind!=='admin'&&payload.locationCode!==ctx.unit_id)throw new ApiError('COLLECTION_SCOPE',403);const scoped=await this.core.statement("SELECT count(*) n FROM Claims c JOIN ReceiptLocations g ON g.claim_id=c.id WHERE c.campaign_id=? AND c.id IN (SELECT json_extract(value,'$.claimId') FROM json_each(?)) AND (?='admin' OR g.effective_location=?)",campaign,JSON.stringify(payload.items),ctx.kind,ctx.unit_id).first();if(scoped.n!==payload.items.length)throw new ApiError('COLLECTION_SCOPE',403);if(payload.organisationId!==(await this.rule(campaign)).bookhouse_id)throw new ApiError('UNIT_SCOPE',403);}else if(kind==='accept')await this.batchScope(campaign,payload.batchId,actor);else await this.claimScope(campaign,payload.claimId,actor,{allowUnreceived:kind==='receipt'});return {...ctx,handler};}
  async read(campaign,path,actor){
    const ctx=await this.context(campaign,actor,path==='/audit'?'audit.read':'claim.read');if(path==='/context')return ctx;
    if(path==='/wishes'){const r=await this.rule(campaign);return (await this.core.statement(`SELECT w.id,w.public_code,w.public_nickname,w.age_band,w.title,w.gift_name,w.description,w.specifications,w.status,w.publication_status,w.organisation_id,w.version,w.claim_due_at,w.gift_due_at,w.delivery_days FROM Wishes w WHERE w.campaign_id=? AND (?<>'collection' OR w.publication_status='approved') AND (?='admin' OR w.organisation_id=?) ORDER BY w.public_code`,campaign,ctx.kind,ctx.kind,r.bookhouse_id).all()).results;}
    if(path==='/claims')return (await this.core.statement(`SELECT c.id,c.status,c.version,c.gift_due_at,c.source,c.assisted_unit_id,w.id AS wish_id,w.public_code,w.gift_name,w.organisation_id,g.effective_location AS location_code,w.version AS wish_version,f.proof_status,f.thank_status,f.closed_at,f.version AS case_version,(SELECT handoff_id FROM HandoffItems WHERE claim_id=c.id) AS handoff_id FROM Claims c JOIN Wishes w ON w.id=c.wish_id LEFT JOIN ReceiptLocations g ON g.claim_id=c.id LEFT JOIN CaseFiles f ON f.claim_id=c.id WHERE c.campaign_id=? AND (?<>'collection' OR c.assisted_unit_id=? OR c.planned_site_id=? OR g.effective_location=?) AND (?='admin' OR w.organisation_id=(SELECT bookhouse_id FROM CampaignOperatingRules WHERE campaign_id=?)) AND (?<>'collection' OR g.effective_location IS NULL OR g.effective_location=?) ORDER BY w.public_code`,campaign,ctx.kind,ctx.unit_id,ctx.unit_id,ctx.unit_id,ctx.kind,campaign,ctx.kind,ctx.unit_id).all()).results.filter(c=>!this.acceptanceMode||ctx.nx||!['cancelled','expired'].includes(c.status));
    if(path==='/batches')return (await this.core.statement(`SELECT id,status,version,organisation_id,collection_unit_id,planned_at FROM HandoffBatches WHERE campaign_id=? AND (?<>'collection' OR collection_unit_id=?) ORDER BY created_at DESC`,campaign,ctx.kind,ctx.unit_id).all()).results;
    if(this.acceptanceMode&&path==='/audit'&&!ctx.nx)throw new ApiError('FORBIDDEN',403);if(path==='/audit')return (await this.core.statement(`SELECT id,unit_id,handler,action,resource_id,occurred_at AS created_at FROM UnitActions WHERE campaign_id=? AND (?<>'collection' OR unit_id=?) ORDER BY occurred_at DESC LIMIT 200`,campaign,ctx.kind,ctx.unit_id).all()).results;
    throw new ApiError('NOT_FOUND',404);
  }
  async search(campaign,{code,normalizeCode=false},actor){
    const submitted = code;
    if(this.acceptanceMode||normalizeCode)code=normalizeWishCode(code);
    const ctx=await this.context(campaign,actor),w=await this.core.statement("SELECT id,public_code,public_nickname,gift_name,specifications,status FROM Wishes WHERE public_code=? AND campaign_id=? AND (publication_status='approved' OR EXISTS(SELECT 1 FROM Claims c WHERE c.wish_id=Wishes.id AND c.status NOT IN ('cancelled','expired')))",code,campaign).first();
    if(!w)throw new ApiError('NOT_FOUND',404);
    const c=await this.core.statement("SELECT c.id,c.version,c.status,c.gift_due_at,c.planned_site_id,c.assisted_unit_id,g.effective_location AS location_code FROM Claims c LEFT JOIN ReceiptLocations g ON g.claim_id=c.id WHERE c.wish_id=? AND c.status NOT IN ('cancelled','expired')",w.id).first();
    if(ctx.kind==='collection'){
      const summary={id:w.id,public_code:w.public_code,gift_name:w.gift_name,specifications:w.specifications,status:w.status};
      if(c?.location_code&&c.location_code!==ctx.unit_id)return {...summary,status:'received_elsewhere'};
      const original=c?.planned_site_id||c?.assisted_unit_id;
      const crossSite=Boolean(original&&original!==ctx.unit_id&&!c.location_code);
      if(crossSite&&submitted!==w.public_code)throw new ApiError('FULL_WISH_CODE_REQUIRED');
      const eligible=c?.status==='claimed'&&!c.location_code;
      return {...summary,claim:c?{id:c.id,version:c.version,status:c.status}:null,receipt:eligible?{
        crossSite,originalSite:ctx.collectionSites.find(site=>site.id===original)?.label||original||null,actualSite:ctx.label
      }:null};
    }
    return {...w,claim:c?{id:c.id,version:c.version,status:c.status,giftDueAt:c.gift_due_at}:null};
  }
  async saveWish(campaign,input,actor,key){
    const body={...input};const submit=body.submitForReview===true;delete body.submitForReview;delete body.handler;const ctx=await this.context(campaign,actor,'wish.write'),handler=ctx.label;body.deliveryDays=null;
    const campaignInfo=this.caseMode?await this.core.campaign(campaign):null;
    if(this.caseMode){
      if(body.creatingUnitId!==undefined&&body.creatingUnitId!==ctx.unit_id)throw new ApiError('CREATING_UNIT_FORBIDDEN',403);
      delete body.creatingUnitId;
      if(!body.wishId&&body.claimDueAt>Math.min(campaignInfo.closes_at,campaignInfo.claim_deadline_at))throw new ApiError('CLAIM_DELIVERY_WINDOW_CONFLICT',409);
    }
    if(body.organisationId!==ctx.bookhouseId)throw new ApiError('UNIT_SCOPE',403);
    if(!body.wishId&&!/^NX-(?!0+$)[0-9]{3,12}$/.test(body.publicCode||''))throw new ApiError('PUBLIC_CODE_NX_REQUIRED');
    const old=body.wishId?(await this.wishAccess(campaign,body.wishId,actor,this.caseMode)).row:null;
    if(old?.pending_proposal_id&&old.pending_proposal_id!==key)throw new ApiError('REVIEW_ALREADY_PENDING',409);
    if(campaignInfo&&old&&body.claimDueAt!==(old.claim_due_at??campaignInfo.claim_deadline_at)&&body.claimDueAt>Math.min(campaignInfo.closes_at,campaignInfo.claim_deadline_at))throw new ApiError('CLAIM_DELIVERY_WINDOW_CONFLICT',409);
    if(ctx.kind==='bookhouse'&&old?.publication_status==='approved'){
      if(body.realName)throw new ApiError('USE_PRIVATE_PROFILE');
      validateWish({publicCode:old.public_code,childAlias:old.child_alias,ageBand:old.age_band,title:body.title,description:body.description,giftName:body.giftName,specifications:body.specifications,category:'gift',referenceAmount:0});
      if(body.publicationStatus!=='approved')throw new ApiError('ADMIN_PUBLICATION_REQUIRED',403);
      const c=campaignInfo??await this.core.campaign(campaign);if(!Number.isInteger(body.claimDueAt)||body.claimDueAt>c.claim_deadline_at||body.claimDueAt<=c.opens_at||(body.giftDueAt!==null&&(!Number.isInteger(body.giftDueAt)||body.giftDueAt<body.claimDueAt||c.gift_due_at!==null&&body.giftDueAt>c.gift_due_at))||body.expectedVersion!==old.version)throw new ApiError('CONFLICT',409);
      if(!isRequestKey(key))throw new ApiError('IDEMPOTENCY_KEY_REQUIRED',428);
      const payload={publicNickname:text(body.publicNickname,40,1),title:body.title,description:body.description,giftName:body.giftName,specifications:body.specifications,organisationId:old.organisation_id,claimDueAt:old.claim_due_at===null&&body.claimDueAt===c.claim_deadline_at?null:body.claimDueAt,giftDueAt:old.gift_due_at===null&&body.giftDueAt===c.gift_due_at?null:body.giftDueAt,publicationStatus:'approved',deliveryDays:body.deliveryDays||null};
      await this.core.db.batch([this.core.statement('INSERT INTO PublicWishProposals(id,campaign_id,wish_id,base_version,payload,created_by,handler) VALUES(?,?,?,?,?,?,?)',key,campaign,old.id,old.version,JSON.stringify(payload),ctx.id,handler),this.action(campaign,ctx,handler,'wish.proposed',old.id)]);return {proposalId:key,status:'pending'};
    }
    const saved=await this.experience.saveWish(campaign,body,actor,key,{editor:ctx,handler,oldWish:old,campaignInfo});
    if(submit){
      if(!await this.#submitSavedDraft(campaign,saved,ctx,key)){
        await this.submitWish(campaign,{wishId:saved.wishId,expectedVersion:saved.version},actor,key);
      }
      return {...saved,status:'pending'};
    }
    return saved;
  }
  async #submitSavedDraft(campaign,{wishId,version},ctx,key){
    const [proposal]=await this.core.db.batch([
      this.core.statement(`INSERT INTO PublicWishProposals(id,campaign_id,wish_id,base_version,payload,created_by,handler)
        SELECT ?,w.campaign_id,w.id,w.version,json_object(
          'publicNickname',w.public_nickname,'title',w.title,'description',w.description,
          'giftName',w.gift_name,'specifications',w.specifications,'organisationId',w.organisation_id,
          'claimDueAt',w.claim_due_at,'giftDueAt',w.gift_due_at,'publicationStatus','approved','deliveryDays',w.delivery_days),?,?
        FROM Wishes w
        WHERE w.id=? AND w.campaign_id=? AND w.version=? AND w.publication_status='draft'
          AND (?='admin' OR w.organisation_id=(SELECT bookhouse_id FROM CampaignOperatingRules WHERE campaign_id=?))
          AND NOT EXISTS(SELECT 1 FROM PublicWishProposals p WHERE p.wish_id=w.id AND p.status='pending')
          AND NOT EXISTS(SELECT 1 FROM PublicWishProposals WHERE id=?)
        RETURNING id`,key,ctx.id,ctx.label,wishId,campaign,version,ctx.kind,campaign,key),
      this.core.statement(`INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id,reference)
        SELECT ?,?,?,?,?,'wish.submitted',?,'' WHERE changes()=1`,
      crypto.randomUUID(),campaign,ctx.unit_id,ctx.id,text(this.caseMode?ctx.displayName||ctx.label:ctx.label),wishId)
    ]);
    return proposal.results.length>0;
  }
  async submitWish(campaign,{wishId,expectedVersion},actor,key){
    const ctx=await this.context(campaign,actor,'claim.read',{reviewSubmit:true});
    if(!ctx.permissions.includes('wish.write')||!isRequestKey(key))throw new ApiError('FORBIDDEN',403);
    if(Number.isSafeInteger(expectedVersion)&&typeof wishId==='string'&&await this.#submitSavedDraft(campaign,{wishId,version:expectedVersion},ctx,key))return {status:'pending',proposalId:key};
    const {row:w}=await this.wishAccess(campaign,wishId,actor,true);
    if(Number.isSafeInteger(expectedVersion)){
      const previous=await this.core.statement(`SELECT status FROM PublicWishProposals
        WHERE id=? AND campaign_id=? AND wish_id=? AND base_version=? AND created_by=?`,key,campaign,w.id,expectedVersion,ctx.id).first();
      if(previous)return {status:previous.status,proposalId:key};
    }
    if(w.pending_proposal_id)throw new ApiError('REVIEW_ALREADY_PENDING',409);
    throw new ApiError('CONFLICT',409);
  }
  proposalsStatement(campaign,ctx,wishId){
    return this.core.statement(`SELECT p.id,p.wish_id,p.payload,p.status,p.base_version,p.created_by,p.created_at,p.reviewed_by,p.reviewed_at,(SELECT reason FROM ProposalReviews WHERE proposal_id=p.id ORDER BY created_at DESC,rowid DESC LIMIT 1) AS return_reason,w.public_code FROM PublicWishProposals p JOIN Wishes w ON w.id=p.wish_id WHERE p.campaign_id=? AND (?='admin' OR p.created_by=?) ${wishId===undefined?'':'AND p.wish_id=?'} ORDER BY p.created_at DESC`,campaign,ctx.kind,ctx.id,...(wishId===undefined?[]:[wishId]));
  }
  async proposals(campaign,actor){
    const ctx=await this.context(campaign,actor,'wish.write');
    return (await this.proposalsStatement(campaign,ctx).all()).results;
  }
  async reviewProposal(campaign,{proposalId,decision,handler,reason=''},actor,key){if(decision==='rejected'&&(typeof reason!=='string'||reason.trim().length<2||reason.length>1000))throw new ApiError('RETURN_REASON_REQUIRED');await this.context(campaign,actor,'staff.manage');if(!isRequestKey(key)||!['approved','rejected'].includes(decision))throw new ApiError('INVALID_FIELDS');const ctx=await this.context(campaign,actor,'staff.manage');if(!await this.core.statement('SELECT id FROM PublicWishProposals WHERE id=? AND campaign_id=?',proposalId,campaign).first())throw new ApiError('NOT_FOUND',404);await this.core.statement('INSERT INTO ProposalReviews(id,proposal_id,actor_id,handler,decision,reason) VALUES(?,?,?,?,?,?)',key,proposalId,ctx.id,ctx.label,decision,decision==='rejected'?text(reason,1000,2):'').run();return {decision};}
  async child(campaign,input,actor,write=false){const ctx=await this.context(campaign,actor,'child.read');input={...input,handler:ctx.label,reason:input.reason||'operational_task'};text(input.reason);await this.wishAccess(campaign,input.wishId,actor);const row=await this.core.statement('SELECT * FROM WishPrivateProfiles WHERE wish_id=? AND campaign_id=? AND erased_at IS NULL AND retention_until>unixepoch()',input.wishId,campaign).first();if(!write){if(!row){if(this.acceptanceMode)await this.action(campaign,ctx,ctx.displayName,'child.private_empty',input.wishId,'not_created').run();throw new ApiError(this.acceptanceMode?'CHILD_PROFILE_NOT_CREATED':'NOT_FOUND',404);}const data=await this.core.crypto.decrypt(row.ciphertext,`${campaign}:${input.wishId}:child:${row.key_version}`,row.key_version);await this.action(campaign,ctx,input.handler,'child.private_read',input.wishId,input.reason).run();return data;}
    text(input.realName,80,1);if(input.necessaryContact!==undefined)text(input.necessaryContact,160,0);const c=await this.core.campaign(campaign),v=this.core.crypto.keyVersion,cipher=await this.core.crypto.encrypt({realName:input.realName,necessaryContact:input.necessaryContact||'',internalNote:typeof input.internalNote==='string'?input.internalNote.slice(0,1000):''},`${campaign}:${input.wishId}:child:${v}`);await this.core.db.batch([this.core.statement(`INSERT INTO WishPrivateProfiles(wish_id,campaign_id,ciphertext,key_version,retention_until,updated_by) VALUES(?,?,?,?,?,?) ON CONFLICT(wish_id) DO UPDATE SET ciphertext=excluded.ciphertext,key_version=excluded.key_version,updated_by=excluded.updated_by,updated_at=unixepoch()`,input.wishId,campaign,cipher,v,(c.gift_due_at??c.closes_at)+90*86400,ctx.id),this.action(campaign,ctx,input.handler,'child.private_saved',input.wishId,input.reason)]);return {saved:true};
  }
  async fingerprint(campaign,claim,assistance=null){return this.core.crypto.fingerprint({campaignId:campaign,wishId:claim.wishId,contact:claim.contact,consentVersion:claim.consentVersion,secretHash:await digest(claim.claimSecret),...(assistance?{assistance}: {})});}
  async assist(campaign,{claim,handler,consent,consentReference,secondFactor},actor){const ctx=await this.context(campaign,actor,'claim.assist');handler=ctx.label;consentReference=consentReference||'unit_consent:'+crypto.randomUUID();text(consentReference);text(secondFactor,80,8);if([claim?.claimSecret,claim?.contact?.address,claim?.contact?.phone,claim?.contact?.email].includes(secondFactor))throw new ApiError('INDEPENDENT_SECOND_VERIFICATION_REQUIRED');if(consent!==true)throw new ApiError('CONSENT_REQUIRED');validateClaim(claim,{operations:true});const assistance={actorId:ctx.id,unitId:ctx.unit_id,handler,consentReference,secondHash:await this.core.crypto.fingerprint({assisted:claim.claimSecret,secondFactor})};return this.core.claim(campaign,claim,{verified:true,method:'assisted',expiresAt:now()+60,requestHash:await this.fingerprint(campaign,claim,assistance)},{source:'assisted',assistance});}
  async assistedLookup(campaign,{claimId,handler,identityCheckReference,consent},actor){const ctx=await this.context(campaign,actor,'claim.assist');handler=ctx.label;identityCheckReference=identityCheckReference||'unit_identity:'+crypto.randomUUID();text(identityCheckReference);if(consent!==true)throw new ApiError('IDENTITY_CHECK_REQUIRED',403);const {claim}=await this.claimScope(campaign,claimId,actor);if(ctx.kind==='collection'&&claim.assisted_unit_id!==ctx.unit_id)throw new ApiError('UNIT_SCOPE',403);await this.action(campaign,ctx,handler,'claim.identity_checked',claimId,identityCheckReference).run();return this.progressRow(claim);}
  async emailChallenge(campaign,input){if(this.directMode)throw new ApiError('NOTIFICATIONS_DISABLED',403);if(!this.email?.challenge||!this.email?.verify||!this.email?.sendConfirmation)throw new ApiError('EMAIL_UNCONFIGURED',503);let email,hash;if(input.purpose==='adopt'){validateClaim(input.claim,{operations:true});if(input.claim.contact.channel!=='email')throw new ApiError('EMAIL_REQUIRED');email=input.claim.contact.address.trim().toLowerCase();if(email!==input.claim.contact.address)throw new ApiError('NORMALIZED_EMAIL_REQUIRED');hash=await this.fingerprint(campaign,input.claim);}else if(input.purpose==='manage'){email=text(input.email,160,6).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new ApiError('EMAIL_REQUIRED');hash=await this.core.crypto.fingerprint({email,purpose:'manage'});}else throw new ApiError('INVALID_PURPOSE');const r=await this.email.challenge({campaign,email,hash,purpose:input.purpose});if(!isId(r?.challengeId))throw new ApiError('EMAIL_UNAVAILABLE',503);return {challengeId:r.challengeId};}
  async portal(campaign,email){const rows=(await this.core.statement('SELECT * FROM DonorPortals WHERE campaign_id=?',campaign).all()).results;for(const r of rows)if(equalDigest(r.email_hash,await this.core.crypto.fingerprint({email},r.key_version)))return r.id;const id=crypto.randomUUID(),hash=await this.core.crypto.fingerprint({email}),v=this.core.crypto.requestKeyVersion||'legacy';await this.core.statement('INSERT OR IGNORE INTO DonorPortals(id,campaign_id,email_hash,key_version) VALUES(?,?,?,?)',id,campaign,hash,v).run();return (await this.core.statement('SELECT id FROM DonorPortals WHERE campaign_id=? AND email_hash=?',campaign,hash).first()).id;}
  async issueAccess(portalId,secret){if(!/^[\w-]{43}$/.test(secret||''))throw new ApiError('INVALID_CREDENTIAL');const accessId=crypto.randomUUID();await this.core.statement('INSERT INTO OwnerAccess(id,portal_id,capability_hash,expires_at) VALUES(?,?,?,?)',accessId,portalId,await digest(secret),now()+86400).run();return {accessId,secret};}
  async online(campaign,{claim,challengeId,code,portalSecret}){if(this.directMode)throw new ApiError('NOTIFICATIONS_DISABLED',403);if(!/^[\w-]{43}$/.test(portalSecret||''))throw new ApiError('INVALID_CREDENTIAL');if(!this.email?.verify||!this.email?.sendConfirmation)throw new ApiError('EMAIL_UNCONFIGURED',503);validateClaim(claim,{operations:true});if(claim.contact.channel!=='email')throw new ApiError('EMAIL_REQUIRED');const hash=await this.fingerprint(campaign,claim),verified=await this.email.verify({campaign,challengeId,code,purpose:'adopt',hash});if(!verified?.verified||verified.email!==claim.contact.address)throw new ApiError('EMAIL_NOT_VERIFIED',403);const portalId=await this.portal(campaign,verified.email),row=await this.core.claim(campaign,claim,{verified:true,method:'email',expiresAt:now()+60,requestHash:hash},{source:'online',portalId});const portal=await this.issueAccess(portalId,portalSecret);let notificationSent=false;try{const emailToken=privateLinkToken();if(!this.caseMode)await this.core.statement('INSERT INTO OwnerRecoveryLinks(token_hash,portal_id,expires_at) VALUES(?,?,?)',await digest(emailToken),portalId,now()+600).run();notificationSent=await this.email.sendConfirmation({email:verified.email,claimId:row.claimId,managementRoute:this.caseMode?'/#christmas/manage':'/#christmas/manage/verify/'+emailToken,wishCode:claim.wishId,giftDueAt:row.giftDueAt,deliveryDate:row.giftDueAt===null?null:new Date(row.giftDueAt*1000).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}),collectionSites:(await this.core.statement("SELECT label FROM Organisations WHERE campaign_id=? AND unit_kind='collection' AND active=1",campaign).all()).results.map(r=>r.label)})===true;}catch{/* Claim already committed: never claim notification succeeded. */}return {...row,portal,notificationSent};}
  async loginOwner(campaign,{email,challengeId,code,portalSecret}){if(this.directMode)throw new ApiError('NOTIFICATIONS_DISABLED',403);if(!/^[\w-]{43}$/.test(portalSecret||''))throw new ApiError('INVALID_CREDENTIAL');if(!this.email?.verify)throw new ApiError('EMAIL_UNCONFIGURED',503);email=text(email,160,6).toLowerCase();const hash=await this.core.crypto.fingerprint({email,purpose:'manage'}),v=await this.email.verify({campaign,challengeId,code,purpose:'manage',hash});if(!v?.verified||v.email!==email)throw new ApiError('EMAIL_NOT_VERIFIED',403);return this.issueAccess(await this.portal(campaign,email),portalSecret);}
  async owner(campaign,credentials,allowPasswordChange=false){only(credentials,['accessId','secret']);const r=await this.core.statement(`SELECT a.*,p.campaign_id FROM OwnerAccess a JOIN DonorPortals p ON p.id=a.portal_id WHERE a.id=? AND p.campaign_id=? AND a.revoked_at IS NULL AND a.expires_at>unixepoch()`,credentials.accessId,campaign).first();if(!r||!equalDigest(r.capability_hash,await digest(credentials.secret||'')))throw new ApiError('OWNER_UNAUTHORIZED',403);if(this.directMode&&r.auth_method!=='pin')throw new ApiError('OWNER_UNAUTHORIZED',403);if(this.caseMode&&!this.directMode&&!allowPasswordChange&&(await this.core.statement('SELECT must_change FROM DonorPasswords WHERE portal_id=?',r.portal_id).first())?.must_change)throw new ApiError('PASSWORD_CHANGE_REQUIRED',403);return r;}
  async progressRow(c){const f=await this.core.statement('SELECT * FROM CaseFiles WHERE claim_id=?',c.id||c.claimId).first(),batch=await this.core.statement('SELECT batch_id FROM HandoffBatchItems WHERE claim_id=?',c.id||c.claimId).first();return {claimedAt:c.claimed_at||null,claimId:c.id||c.claimId,status:c.status,version:c.version,giftDueAt:c.gift_due_at??c.giftDueAt??null,thankStatus:f?.thank_status||'not_required',proofStatus:f?.proof_status||'not_required',caseClosed:this.acceptanceMode?c.status==='delivered':Boolean(f?.closed_at),caseVersion:f?.version||0,displayStage:c.status==='gift_received'&&batch?'handoff_pending':c.status};}
  async ownerClaims(campaign,credentials){const owner=await this.owner(campaign,credentials),rows=(await this.core.statement('SELECT c.*,w.public_code,w.gift_name FROM Claims c JOIN Wishes w ON w.id=c.wish_id WHERE c.portal_id=? AND c.campaign_id=?',owner.portal_id,campaign).all()).results;return Promise.all(rows.map(async c=>({...await this.progressRow(c),publicCode:c.public_code,giftName:c.gift_name})));}
  async ownerMedia(campaign,{credentials,claimId,mediaId=null}){const owner=await this.owner(campaign,credentials);if(!await this.core.statement('SELECT id FROM Claims WHERE id=? AND campaign_id=? AND portal_id=?',claimId,campaign,owner.portal_id).first())throw new ApiError('OWNER_SCOPE',403);if(!mediaId)return (await this.core.statement("SELECT id,kind,content_type FROM WishMedia WHERE campaign_id=? AND claim_id=? AND visibility='donor' AND review_status='approved' AND retention_until>unixepoch()",campaign,claimId).all()).results;const row=await this.core.statement("SELECT id,kind,content_type,object_key FROM WishMedia WHERE id=? AND campaign_id=? AND claim_id=? AND visibility='donor' AND review_status='approved' AND retention_until>unixepoch()",mediaId,campaign,claimId).first();if(!row)throw new ApiError('NOT_FOUND',404);if(!this.experience.store?.get)throw new ApiError('PRIVATE_STORAGE_UNAVAILABLE',503);await this.core.statement("INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code) VALUES(?,'media',?,'media.owner_read','donor',?,'owner_portal')",campaign,row.id,owner.id).run();const object=await this.experience.store.get(row.object_key);if(!object?.bytes)throw new ApiError('MEDIA_UNAVAILABLE',503);return {id:row.id,kind:row.kind,contentType:row.content_type,dataBase64:btoa(String.fromCharCode(...object.bytes)),taxDeductible:false};}
  async contactProfile(campaign,input,actor=null,write=false){
    let ctx=null,owner=null,c;if(actor){ctx=await this.context(campaign,actor,'contact.read');input={...input,handler:ctx.label,reason:!write&&ctx.kind==='admin'?'operational_task':input.reason||'operational_task'};text(input.reason);c=(await this.claimScope(campaign,input.claimId,actor)).claim;}else{owner=await this.owner(campaign,input.credentials);c=await this.core.statement('SELECT * FROM Claims WHERE id=? AND campaign_id=? AND portal_id=?',input.claimId,campaign,owner.portal_id).first();if(!c)throw new ApiError('OWNER_SCOPE',403);}
    const d=await this.core.statement('SELECT * FROM DonorContacts WHERE id=? AND erased_at IS NULL AND retention_until>unixepoch()',c.donor_contact_id).first();if(!d)throw new ApiError('NOT_FOUND',404);const data=await this.core.crypto.decrypt(d.ciphertext,`${campaign}:${d.id}:${d.key_version}`,d.key_version);
    if(write&&this.caseMode&&ctx?.kind==='admin')throw new ApiError('BOOKHOUSE_DOCUMENT_PROFILE_ONLY',403);if(!write){if(ctx)await this.action(campaign,ctx,input.handler,'contact.business_read',c.id,input.reason).run();else await this.core.statement(`INSERT INTO AuditLogs(campaign_id,resource_type,resource_id,action,actor_type,actor_ref,reason_code) VALUES(?,'contact',?,'contact.owner_read','donor',?,'owner_profile')`,campaign,d.id,owner.id).run();return {profileVersion:d.profile_version,donorName:data.parties?.donor||data.displayName,contactName:data.parties?.contact||data.displayName,...(this.caseMode&&!this.acceptanceMode&&ctx?.kind==='admin'?{}:{recipientName:data.parties?.recipient||''}),phone:data.phone||(data.channel==='phone'?data.address:''),email:data.channel==='email'?data.address:data.email||'',...(this.caseMode&&!this.acceptanceMode&&ctx?.kind==='admin'?{}:{postalAddress:data.postalAddress||'',postalCode:data.postalCode||''}),documentPreferences:booleanPrefs(data.documentPreferences),deliveryMethod:data.deliveryMethod||'to_be_confirmed'};}
    const f=await this.core.statement('SELECT * FROM CaseFiles WHERE claim_id=?',c.id).first();if(f.closed_at||f.thank_status==='sent')throw new ApiError('CASE_PROFILE_LOCKED',409);const p=input.profile;only(p,['donorName','contactName','recipientName','phone','postalAddress','postalCode','documentPreferences','deliveryMethod']);const prefs=booleanPrefs(p.documentPreferences);if(p.postalCode&&(typeof p.postalCode!=='string'||!/^\d{3}(?:\d{2,3})?$/.test(p.postalCode)))throw new ApiError('INVALID_POSTAL_CODE');for(const k of ['donorName','contactName','recipientName'])text(p[k]||'',80,0);if(p.phone&&!/^\+?[0-9]{8,15}$/.test(p.phone))throw new ApiError('INVALID_PHONE');if((p.postalAddress||p.postalCode)&&!(prefs.paperThankYou||(prefs.materialProof&&!prefs.electronicProof)))throw new ApiError('ADDRESS_NOT_NEEDED');text(p.postalAddress||'',300,0);if(!['dropoff','shipping','to_be_confirmed'].includes(p.deliveryMethod))throw new ApiError('INVALID_DELIVERY_METHOD');
    const value={...data,parties:{donor:p.donorName||'',contact:p.contactName||'',recipient:p.recipientName||''},phone:p.phone||'',postalAddress:p.postalAddress||'',postalCode:(prefs.paperThankYou||prefs.materialProof&&!prefs.electronicProof)?(p.postalCode??data.postalCode??''):'',documentPreferences:prefs,deliveryMethod:p.deliveryMethod},v=this.core.crypto.keyVersion,cipher=await this.core.crypto.encrypt(value,`${campaign}:${d.id}:${v}`);
    const row=await this.core.statement(`UPDATE DonorContacts SET ciphertext=?,key_version=?,phone_lookup_hash=?,phone_lookup_version=?,profile_version=profile_version+1,protection_actor=?,owner_access_id=?,protection_reason='operational_profile',preference_patch=?,edit_unit_id=?,edit_handler=?,edit_reference=? WHERE id=? AND profile_version=? AND erased_at IS NULL RETURNING id`,cipher,v,(p.phone||(data.channel==='phone'?data.address:null))?await this.core.crypto.fingerprint({phone:p.phone||data.address}):null,this.core.crypto.requestKeyVersion||'legacy',ctx?.id||null,owner?.id||null,JSON.stringify(prefs)===JSON.stringify(booleanPrefs(data.documentPreferences))?null:JSON.stringify(prefs),ctx?.unit_id||null,ctx?input.handler:null,ctx?input.reason:null,d.id,input.expectedVersion).first();if(!row)throw new ApiError('PROFILE_CONFLICT',409);return {updated:true};
  }
  async requestCancel(campaign,input){const claim=await this.core.recover(campaign,input.credentials);if(claim.status!=='claimed')throw new ApiError('CANCELLATION_NOT_ALLOWED',409);const id=crypto.randomUUID();await this.core.statement("INSERT INTO CancellationRequests(id,claim_id,reason_code) VALUES(?,?,'donor_request')",id,claim.claimId).run();return {requestId:id,status:'pending'};}
  async ownerCancel(campaign,{credentials,claimId}){const s=await this.owner(campaign,credentials),row=await this.core.statement("SELECT id,status FROM Claims WHERE id=? AND portal_id=?",claimId,s.portal_id).first();if(!row||row.status!=='claimed')throw new ApiError('CANCELLATION_NOT_ALLOWED',409);const id=crypto.randomUUID();await this.core.statement("INSERT INTO CancellationRequests(id,claim_id,reason_code) VALUES(?,?,'verified_owner_request')",id,claimId).run();return {requestId:id,status:'pending'};}
  async cancellations(campaign,actor){await this.context(campaign,actor,'claim.cancel');return (await this.core.statement('SELECT r.id,r.claim_id,r.status,w.public_code FROM CancellationRequests r JOIN Claims c ON c.id=r.claim_id JOIN Wishes w ON w.id=c.wish_id WHERE c.campaign_id=? ORDER BY r.created_at DESC',campaign).all()).results;}
  async reviewCancellation(campaign,{requestId,decision,handler},actor){const ctx=await this.context(campaign,actor,'claim.cancel');if(!['approved','rejected'].includes(decision))throw new ApiError('INVALID_FIELDS');const r=await this.core.statement('UPDATE CancellationRequests SET status=?,reviewed_by=?,review_handler=?,reviewed_at=unixepoch() WHERE id=? AND claim_id IN (SELECT id FROM Claims WHERE campaign_id=?) AND status=\'pending\' RETURNING id',decision,ctx.id,text(handler||ctx.label),requestId,campaign).first();if(!r)throw new ApiError('CONFLICT',409);if(decision==='approved'){const request=await this.core.statement('SELECT claim_id FROM CancellationRequests WHERE id=?',requestId).first();await this.notifyClaim(campaign,request.claim_id,'cancellation',requestId);}return {decision};}
  async reopen(campaign,{wishId,expectedVersion,handler},actor){const ctx=await this.context(campaign,actor,'wish.reopen');handler=ctx.label;await this.wishAccess(campaign,wishId,actor);const r=await this.core.statement("UPDATE Wishes SET status='available',version=version+1,reopened_by=?,reopen_reason='reviewed_reopen',reopen_handler=?,updated_at=unixepoch() WHERE id=? AND campaign_id=? AND version=? AND status IN ('cancelled','expired') RETURNING id",ctx.id,handler,wishId,campaign,expectedVersion).first();if(!r)throw new ApiError('REOPEN_CONFLICT',409);return {reopened:true};}
  async caseOperation(campaign,{claimId,handler,expectedVersion,kind,nextStatus,documentType='thanks',reference=''},actor,key){const ctx=await this.context(campaign,actor,'case.manage');handler=ctx.label;if(this.directMode&&kind==='thanks')throw new ApiError('USE_DOCUMENT_WORKSPACE',403);if(this.caseMode&&ctx.kind!=='bookhouse')throw new ApiError('BOOKHOUSE_ONLY',403);if(!['thanks','proof'].includes(documentType))throw new ApiError('INVALID_DOCUMENT_TYPE');reference=reference||'unit_action:'+key;await this.claimScope(campaign,claimId,actor);if(!isRequestKey(key))throw new ApiError('IDEMPOTENCY_KEY_REQUIRED');if(kind==='thanks'&&nextStatus==='sent'){const p=await this.contactProfile(campaign,{claimId,handler,reason:'document_dispatch'},actor);if(((documentType==='thanks'&&p.documentPreferences.paperThankYou)||(documentType==='proof'&&p.documentPreferences.materialProof&&!p.documentPreferences.electronicProof))&&(!p.recipientName||!p.postalAddress))throw new ApiError('POSTAL_DETAILS_REQUIRED');if(((documentType==='thanks'&&p.documentPreferences.electronicThankYou)||(documentType==='proof'&&p.documentPreferences.electronicProof))&&!p.email)throw new ApiError('EMAIL_REQUIRED');}await this.core.statement('INSERT INTO CaseOperations(id,claim_id,actor_id,handler,expected_version,kind,next_status,reference,document_type) VALUES(?,?,?,?,?,?,?,?,?)',key,claimId,ctx.id,text(handler||ctx.label),expectedVersion,kind,nextStatus||null,reference,documentType).run();return {recorded:true};}
  async overdue(campaign,actor){const ctx=await this.context(campaign,actor,'claim.cancel'),rule=await this.rule(campaign),rows=(await this.core.statement(`SELECT c.id,c.version,w.id AS wish_id,w.version AS wish_version,w.public_code,c.status,c.gift_due_at FROM Claims c JOIN Wishes w ON w.id=c.wish_id WHERE c.campaign_id=? AND c.status='claimed' AND (?='admin' OR w.organisation_id=?)`,campaign,ctx.kind,rule.bookhouse_id).all()).results;return pendingTasks(rows,now(),rule.reminder_days);}
  async accounts(campaign,actor){await this.context(campaign,actor,'staff.manage');return (await this.core.statement('SELECT a.user_id,a.organisation_id,a.kind,o.label,u.status,a.revoked_at FROM OperatingAccounts a JOIN Organisations o ON o.id=a.organisation_id JOIN AdminUsers u ON u.id=a.user_id WHERE a.campaign_id=?',campaign).all()).results;}
  async mediaList(campaign,actor){const ctx=await this.context(campaign,actor);return (await this.core.statement(`SELECT m.id,m.wish_id,m.claim_id,m.kind,m.evidence_id,m.visibility,m.review_status,m.version FROM WishMedia m JOIN Wishes w ON w.id=m.wish_id WHERE m.campaign_id=? AND (?<>'collection' OR m.unit_id=?) AND (?='admin' OR w.organisation_id=(SELECT bookhouse_id FROM CampaignOperatingRules WHERE campaign_id=?)) ORDER BY m.created_at DESC`,campaign,ctx.kind,ctx.unit_id,ctx.kind,campaign).all()).results;}
  async upload(campaign,{handler,media},actor){const ctx=await this.context(campaign,actor);handler=ctx.label;return this.experience.upload(campaign,media,actor,{...ctx,handler});}
  async reviewMedia(campaign,id,input,actor){const ctx=await this.context(campaign,actor,input.visibility==='public'?'staff.manage':'case.manage');input={...input,handler:ctx.label,reason:input.reason||'operational_task'};text(input.reason);const m=await this.core.statement('SELECT wish_id,claim_id FROM WishMedia WHERE id=? AND campaign_id=?',id,campaign).first();if(!m)throw new ApiError('NOT_FOUND',404);await this.wishAccess(campaign,m.wish_id,actor);if(input.privacyConfirmed!==true||!['public','staff','donor'].includes(input.visibility)||!['pending','approved','rejected'].includes(input.reviewStatus)||input.visibility==='donor'&&!m.claim_id)throw new ApiError('PRIVACY_REVIEW_REQUIRED');const row=await this.core.statement('UPDATE WishMedia SET visibility=?,review_status=?,reviewed_by=?,review_reason=?,review_unit_id=?,review_handler=?,version=version+1 WHERE id=? AND campaign_id=? AND version=? RETURNING id,version',input.visibility,input.reviewStatus,ctx.id,input.reason,ctx.unit_id,input.handler,id,campaign,input.expectedVersion).first();if(!row)throw new ApiError('CONFLICT',409);return row;}
  async revoke(campaign,{userId,handler},actor){const ctx=await this.context(campaign,actor,'staff.manage');if(userId===ctx.id)throw new ApiError('SELF_REVOCATION_BLOCKED',409);handler=ctx.label;const a=await this.core.statement('SELECT user_id FROM OperatingAccounts WHERE user_id=? AND campaign_id=?',userId,campaign).first();if(!a)throw new ApiError('NOT_FOUND',404);await this.core.db.batch([this.action(campaign,ctx,handler,'account.revoked',userId),this.core.statement("UPDATE AdminUsers SET status='disabled' WHERE id=?",userId),this.core.statement('UPDATE OperatingAccounts SET revoked_at=unixepoch() WHERE user_id=? AND campaign_id=?',userId,campaign)]);return {revoked:true};}
}
