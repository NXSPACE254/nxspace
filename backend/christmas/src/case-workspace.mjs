import {batchDisplay,operationalTasks} from './operational-policy.mjs';
import {normalizeContactPhone,mailingFromContact} from './contact-rules.mjs';
import {privacyPublicationStatements} from './direct-claims.mjs';
import {ApiError,isId,isRequestKey} from './validation.mjs';
import {equalDigest} from './crypto.mjs';
import {resetDonorPasswordByAdmin} from './donor-password.mjs';
import {createXlsx} from './xlsx.mjs';
import {recordPlatformEvent} from './platform-audit.mjs';
import {initialBrand,validateCampaignBrand} from './campaign-brand.mjs';
import {verifyBrandImageReferences} from './campaign-brand-media.mjs';

export async function campaignProgress(ops,campaign){
 await ops.core.campaign(campaign);
 const rows=await ops.core.statement("SELECT count(*) total,COALESCE(sum(EXISTS(SELECT 1 FROM Claims c WHERE c.wish_id=w.id AND c.status NOT IN ('cancelled','expired'))),0) claimed,COALESCE(sum(EXISTS(SELECT 1 FROM Claims c JOIN DeliveryConfirmations d ON d.claim_id=c.id WHERE c.wish_id=w.id AND c.status='delivered')),0) delivered FROM Wishes w WHERE w.campaign_id=? AND w.publication_status='approved'",campaign).first();
 return {...rows,remaining:rows.total-rows.claimed,percentage:rows.total?Math.round(rows.claimed/rows.total*100):0};
}

export async function setExportAccess(ops,campaign,input,actor){
 const ctx=await ops.context(campaign,actor,'staff.manage');fields(input,['userId','enabled']);
 if(!isId(input.userId)||typeof input.enabled!=='boolean')throw new ApiError('INVALID_PERMISSION');
 const account=await ops.core.statement("SELECT documents_export FROM OperatingAccounts WHERE campaign_id=? AND user_id=? AND kind='bookhouse' AND revoked_at IS NULL",campaign,input.userId).first();if(!account)throw new ApiError('NOT_FOUND',404);
 await ops.core.db.batch([ops.core.statement("UPDATE OperatingAccounts SET documents_export=? WHERE campaign_id=? AND user_id=? AND kind='bookhouse' AND revoked_at IS NULL",input.enabled?1:0,campaign,input.userId),ops.action(campaign,ctx,ctx.label,'permission.documents_export',input.userId,String(account.documents_export)+'>'+String(Number(input.enabled)))]);return {saved:true};
}

export async function exportMailingList(ops,campaign,input,actor){
 const ctx=await ops.context(campaign,actor,'case.manage');
 const account=await ops.core.statement('SELECT documents_export FROM OperatingAccounts WHERE user_id=? AND campaign_id=? AND revoked_at IS NULL',ctx.id,campaign).first();
 if(ctx.kind!=='bookhouse'||account?.documents_export!==1)throw new ApiError('DOCUMENT_EXPORT_FORBIDDEN',403);
 fields(input,['documentType','dispatch','merged','previewOnly']);if(input.previewOnly!==undefined&&typeof input.previewOnly!=='boolean')throw new ApiError('INVALID_FILTER');
 if(!['all','thanks','proof'].includes(input.documentType)||!['all','pending','sent'].includes(input.dispatch)||typeof input.merged!=='boolean')throw new ApiError('INVALID_FILTER');
 const headers=['心願編號','收件人姓名','聯絡電話','郵遞區號','完整寄送地址','是否需要感謝卡','是否需要實物捐贈證明','感謝卡辦理狀態','感謝卡寄送狀態','感謝卡寄送完成日期','實物捐贈證明辦理狀態','實物捐贈證明寄送狀態','實物捐贈證明寄送完成日期'];if(ops.directMode)headers.push('縣市','鄉鎮市區','詳細寄送地址','寄送資料來源','本列寄送文件');
 const candidates=(await ops.core.statement("SELECT c.id,w.public_code,d.id contact_id,d.ciphertext,d.key_version,f.thank_status,f.proof_status FROM Claims c JOIN Wishes w ON w.id=c.wish_id JOIN DonorContacts d ON d.id=c.donor_contact_id JOIN CaseFiles f ON f.claim_id=c.id WHERE c.campaign_id=? AND w.organisation_id=? AND c.status NOT IN ('cancelled','expired') AND d.erased_at IS NULL AND d.retention_until>unixepoch() ORDER BY w.public_code",campaign,ctx.bookhouseId).all()).results;
 const rows=[];let incomplete=0;
 const date=n=>n?new Date(n*1000).toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'}):'';
 for(const c of candidates){
  const types=['thanks','proof'].filter(k=>c[k==='thanks'?'thank_status':'proof_status']!=='not_required'&&(input.documentType==='all'||input.documentType===k));
  if(!types.some(k=>input.dispatch==='all'||(input.dispatch==='sent')===(c[k==='thanks'?'thank_status':'proof_status']==='sent')))continue;
  const p=await ops.core.crypto.decrypt(c.ciphertext,`${campaign}:${c.contact_id}:${c.key_version}`,c.key_version);
  if(!ops.directMode&&(!p.parties?.recipient||!p.phone||!/^\d{3}(?:\d{2,3})?$/.test(p.postalCode||'')||!p.postalAddress)){incomplete++;continue;}
  const events=(await ops.core.statement("SELECT p.id,p.document_type,p.ciphertext,p.key_version FROM PaperDocumentEvents p JOIN CaseOperations o ON o.id=p.id WHERE p.claim_id=? AND p.key_version<>'erased' ORDER BY o.created_at,o.rowid",c.id).all()).results,latest={};
  for(const e of events)latest[e.document_type]=await ops.core.crypto.decrypt(e.ciphertext,`${campaign}:${c.id}:${e.id}:${e.key_version}`,e.key_version);
  const document=k=>{const state=c[k==='thanks'?'thank_status':'proof_status'],e=latest[k];return [state==='not_required'?'不需要':state==='preparing'?'待製作／開立':'已製作／開立',state==='not_required'?'不需要':state==='sent'?(e?.deliveryMethod==='in_person'?'已當面交付':'已寄送'):'尚未寄送',state==='sent'?date(e?.completedAt):''];};
  if(ops.directMode){
   const packages=new Map();for(const type of types.filter(k=>input.dispatch==='all'||(input.dispatch==='sent')===(c[k==='thanks'?'thank_status':'proof_status']==='sent'))){
    const sent=c[type==='thanks'?'thank_status':'proof_status']==='sent',event=latest[type],mail=sent?event?.mailingSnapshot:{...mailingFromContact(p),phone:p.phone};
    if(!mail){incomplete++;continue;}if((!sent||event.deliveryMethod==='postal')&&(!mail.recipientName||!mail.phone||!mail.postalAddress||!mail.postalCode)){incomplete++;continue;}
    const addressKey=JSON.stringify([mail,sent]);if(!packages.has(addressKey))packages.set(addressKey,{mail,sent,types:[]});packages.get(addressKey).types.push(type);
   }
   for(const pack of packages.values()){const m=pack.mail;rows.push([c.public_code,m.recipientName,m.phone||'',m.postalCode||'',m.postalAddress||'',c.thank_status==='not_required'?'否':'是',c.proof_status==='not_required'?'否':'是',...document('thanks'),...document('proof'),m.postalCity||'',m.postalDistrict||'',m.postalStreet||'',pack.sent?'已交付時保存的寄送資料':'目前寄送資料',pack.types.map(t=>t==='thanks'?'孩子的感謝卡':'實物捐贈證明').join('、')]);}
   continue;
  }
  rows.push([c.public_code,p.parties.recipient,p.phone,p.postalCode,p.postalAddress,c.thank_status==='not_required'?'否':'是',c.proof_status==='not_required'?'否':'是',...document('thanks'),...document('proof')]);
 }
 if(incomplete){await recordPlatformEvent(ops.core,campaign,ctx,{action:'documents.export',result:'failure',details:{...input,count:rows.length,code:'MAILING_DETAILS_REQUIRED'}});throw new ApiError('MAILING_DETAILS_REQUIRED',409);}
 const groups=new Map();for(const row of rows){const key=JSON.stringify(row.slice(1));if(input.merged&&groups.has(key))groups.get(key)[0]+='、'+row[0];else groups.set(input.merged?key:row[0]+':'+groups.size,[...row]);}
 const summary={count:ops.acceptanceMode?new Set(rows.map(r=>r[0])).size:rows.length,groups:groups.size,...(ops.acceptanceMode?{thanks:rows.filter(r=>String(r.at(-1)).includes('孩子的感謝卡')).length,proof:rows.filter(r=>String(r.at(-1)).includes('實物捐贈證明')).length}:{})};if(input.previewOnly)return summary;
 const sheets=[{name:'寄送名單',rows:[headers,...groups.values()]},{name:'心願文件明細',rows:[headers,...rows]}];
 const bytes=createXlsx(sheets);
 // Commit the export audit before releasing any personally identifying data.
 await recordPlatformEvent(ops.core,campaign,ctx,{action:'documents.export',details:{...input,count:rows.length,groups:groups.size}});
 let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
 return {filename:'孩子的書屋_紙本文件寄送名單.xlsx',contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',dataBase64:btoa(binary),...summary};
}

const fields=(o,keys)=>{if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).some(k=>!keys.includes(k)))throw new ApiError('INVALID_FIELDS');};
const required=(value,max=1000)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const currentEvents=async(ops,campaign,wishId,ctx)=>(await ops.core.statement(`SELECT e.*,o.label AS handler FROM CaseSupportEvents e JOIN OperatingAccounts a ON a.user_id=e.actor_id AND a.campaign_id=e.campaign_id JOIN Organisations o ON o.id=a.organisation_id WHERE e.campaign_id=? AND e.wish_id=? AND (?<>'collection' OR e.unit_id=?) ORDER BY e.created_at,e.version,e.id`,campaign,wishId,ctx.kind,ctx.unit_id).all()).results;

export async function intakeCaseDetail(ops,campaign,{wishId},principal){
  const {kind,bookhouseId,permissions}=principal;
  if(!permissions.includes('wish.write'))throw new ApiError('UNIT_FORBIDDEN_OR_REVOKED',403);
  const {core}=ops;
  const [wishes,history,proposals]=await core.db.batch([
    core.statement(`SELECT id,public_code,public_nickname,gift_name,description,specifications,status,version,
      publication_status,age_band,claim_due_at,gift_due_at,organisation_id,created_unit_id
      FROM Wishes WHERE id=? AND campaign_id=?`,wishId,campaign),
    core.statement(`SELECT action,occurred_at AS created_at,handler,reference FROM UnitActions
      WHERE campaign_id=? AND (resource_id=? OR resource_id IN (SELECT id FROM Claims WHERE wish_id=?))
      ORDER BY occurred_at,id`,campaign,wishId,wishId),
    ops.proposalsStatement(campaign,principal,wishId)
  ]);
  const wish=wishes.results[0];
  if(!wish)throw new ApiError('NOT_FOUND',404);
  if(kind==='bookhouse'&&wish.organisation_id!==bookhouseId)throw new ApiError('UNIT_SCOPE',403);
  return {wish,history:history.results,proposals:proposals.results,claims:[],issues:[]};
}

export async function caseDetail(ops,campaign,{wishId},actor){
  const {ctx,row:w}=await ops.wishAccess(campaign,wishId,actor);
  const claims=(await ops.core.statement('SELECT id,status,version,claimed_at,gift_due_at FROM Claims WHERE wish_id=? AND campaign_id=? ORDER BY claimed_at DESC',wishId,campaign).all()).results;
  const active=claims.find(c=>!['cancelled','expired'].includes(c.status));
  if(ctx.kind==='collection'&&active)await ops.claimScope(campaign,active.id,actor,{allowUnreceived:true});
  const visibleClaims=ops.acceptanceMode&&!ctx.nx?(active?[active]:[]):ctx.kind==='collection'?claims.filter(c=>c.id===active?.id):claims;
  const scope=ctx.kind==='collection'?' AND unit_id=?':'';
  const history=ops.acceptanceMode&&!ctx.nx?[]:(await ops.core.statement(`SELECT action,occurred_at AS created_at,handler${ctx.kind==='collection'?'':',reference'} FROM UnitActions WHERE campaign_id=? AND (resource_id=? OR resource_id IN (SELECT id FROM Claims WHERE wish_id=?))${scope} ORDER BY occurred_at,id`,campaign,wishId,wishId,...(ctx.kind==='collection'?[ctx.unit_id]:[])).all()).results;
  const issues=[];for(const event of await currentEvents(ops,campaign,wishId,ctx)){const data=await ops.core.crypto.decrypt(event.ciphertext,`${campaign}:${wishId}:${event.id}:${event.key_version}`,event.key_version);issues.push({id:event.id,topicId:event.topic_id,version:event.version,status:event.status,createdAt:event.created_at,handler:event.handler,...data});}
  const proposals=ctx.kind==='collection'?[]:(await ops.proposals(campaign,actor)).filter(p=>p.wish_id===wishId);
  const receipts=active?(await ops.core.statement('SELECT effective_location FROM ReceiptLocations WHERE claim_id=?',active.id).first()):null;
  const batch=active?await ops.core.statement('SELECT b.id,b.status,b.version,b.collection_unit_id,b.planned_at FROM HandoffBatches b JOIN HandoffBatchItems i ON i.batch_id=b.id WHERE i.claim_id=?',active.id).first():null;
  if(batch&&ops.acceptanceMode)Object.assign(batch,await batchDisplay(ops,batch));
  if(batch)batch.items=(await ops.core.statement('SELECT i.claim_id,i.quantity,w.id wish_id,w.public_code,c.status,EXISTS(SELECT 1 FROM HandoffItems h WHERE h.claim_id=i.claim_id) accepted FROM HandoffBatchItems i JOIN Claims c ON c.id=i.claim_id JOIN Wishes w ON w.id=c.wish_id WHERE i.batch_id=?',batch.id).all()).results;
  if(batch)batch.quantity=(await ops.core.statement('SELECT sum(quantity) n FROM HandoffBatchItems WHERE batch_id=?',batch.id).first()).n;
  const documents=active?await ops.core.statement('SELECT thank_status,proof_status,closed_at,version FROM CaseFiles WHERE claim_id=?',active.id).first():null;
  const paperHistory=[];
  if(active&&(ctx.kind==='bookhouse'||ops.acceptanceMode&&ctx.nx))for(const e of (await ops.core.statement("SELECT p.*,o.handler,o.created_at FROM PaperDocumentEvents p JOIN CaseOperations o ON o.id=p.id WHERE p.claim_id=? AND p.key_version<>'erased' ORDER BY o.created_at,o.rowid",active.id).all()).results)paperHistory.push({documentType:e.document_type,handler:e.handler,createdAt:e.created_at,...await ops.core.crypto.decrypt(e.ciphertext,`${campaign}:${active.id}:${e.id}:${e.key_version}`,e.key_version)});
  const delivery=active?await ops.core.statement('SELECT d.delivered_at,d.confirmed_by,a.manual_record FROM DeliveryConfirmations d JOIN Attachments a ON a.id=d.evidence_id WHERE d.claim_id=?',active.id).first():null;
  if(delivery?.manual_record){const record=JSON.parse(delivery.manual_record);delivery.note=record.note||'';delivery.recordedAt=record.confirmedAt;delete delivery.manual_record;}return {wish:{...(ctx.kind!=='collection'?{age_band:w.age_band,claim_due_at:w.claim_due_at,gift_due_at:w.gift_due_at,organisation_id:w.organisation_id,created_unit_id:w.created_unit_id}:{}),id:w.id,public_code:w.public_code,public_nickname:w.public_nickname,gift_name:w.gift_name,description:w.description,specifications:w.specifications,status:w.status,version:w.version,publication_status:w.publication_status},claims:visibleClaims,active:active||null,locationCode:receipts?.effective_location||null,batch:batch||null,documents:ctx.kind==='collection'?null:documents||null,paperHistory:ops.acceptanceMode&&!ctx.nx?[...new Map(paperHistory.map(e=>[e.documentType,{documentType:e.documentType,nextStatus:e.nextStatus,completedAt:e.completedAt,deliveryMethod:e.deliveryMethod,mailingSnapshot:e.mailingSnapshot,note:e.note,createdAt:e.createdAt}])).values()]:paperHistory,delivery,issues:ops.acceptanceMode&&!ctx.nx?[...new Map(issues.map(e=>[e.topicId,e])).values()]:issues,history,proposals:ops.acceptanceMode&&!ctx.nx?proposals.slice(0,1):proposals,...(ops.acceptanceMode?{giftComplete:active?.status==='delivered'}:{})};
}

// Settings are immediate, versioned operations. Public copy keeps its own draft/publish flow.
export async function testCaseCleanupPreview(core, campaign, wishId) {
 const row=await core.statement(`WITH target AS (
   SELECT id,public_code,status,publication_status,version FROM Wishes WHERE campaign_id=? AND id=?
 ), scoped_claims AS (
   SELECT c.* FROM Claims c JOIN target t ON c.wish_id=t.id WHERE c.campaign_id=?
 )
 SELECT t.id,t.public_code,t.status,t.publication_status,t.version AS wishVersion,
   (SELECT max(version) FROM scoped_claims) AS claimVersion,
   (SELECT count(*) FROM WishPrivateProfiles WHERE wish_id=t.id) AS privateProfiles,
   (SELECT count(*) FROM scoped_claims) AS claims,
   (SELECT count(*) FROM GiftReceipts WHERE claim_id IN (SELECT id FROM scoped_claims)) AS receipts,
   (SELECT count(*) FROM HandoffBatchItems WHERE claim_id IN (SELECT id FROM scoped_claims)) AS handoffItems,
   (SELECT count(*) FROM DeliveryConfirmations WHERE claim_id IN (SELECT id FROM scoped_claims)) AS deliveries,
   (SELECT count(*) FROM PaperDocumentEvents WHERE claim_id IN (SELECT id FROM scoped_claims)) AS paperEvents,
   (SELECT count(*) FROM Attachments WHERE claim_id IN (SELECT id FROM scoped_claims)) AS evidence,
   (SELECT count(*) FROM WishMedia WHERE wish_id=t.id OR claim_id IN (SELECT id FROM scoped_claims)) AS media,
   (SELECT count(*) FROM OwnerAccess WHERE portal_id IN (SELECT portal_id FROM scoped_claims) AND revoked_at IS NULL AND expires_at>unixepoch()) AS validOwnerSessions,
   (SELECT count(*) FROM Claims other JOIN scoped_claims selected ON other.donor_contact_id=selected.donor_contact_id WHERE other.wish_id<>t.id) AS sharedContacts,
   (SELECT count(*) FROM Claims other JOIN scoped_claims selected ON other.portal_id=selected.portal_id WHERE other.wish_id<>t.id) AS sharedPortals,
   (SELECT count(*) FROM HandoffBatchItems selected JOIN scoped_claims c ON c.id=selected.claim_id
      JOIN HandoffBatchItems other ON other.batch_id=selected.batch_id
      JOIN Claims sibling ON sibling.id=other.claim_id WHERE sibling.wish_id<>t.id) AS sharedHandoffs,
   (SELECT count(*) FROM WishMedia other JOIN Attachments selected ON other.evidence_id=selected.id OR other.object_key=selected.object_key
      JOIN scoped_claims c ON c.id=selected.claim_id WHERE other.wish_id<>t.id) AS sharedEvidence
 FROM target t`,campaign,wishId,campaign).first();
 if(!row)throw new ApiError('NOT_FOUND',404);
 return {...row,deletionSupported:false,scopeCounts:[
  row.privateProfiles,row.claims,row.receipts,row.handoffItems,row.deliveries,row.paperEvents,row.evidence,row.media
 ]};
}

export async function cleanSingleTestCase(core,campaign,id,actorId,{publicCode,wishVersion,claimVersion,scopeCounts}) {
 if(publicCode!=='NX-001'||!Number.isSafeInteger(wishVersion)||!Number.isSafeInteger(claimVersion)||
    !Array.isArray(scopeCounts)||scopeCounts.length!==8||scopeCounts.some(n=>!Number.isSafeInteger(n)||n<0)){
  throw new ApiError('CONFIRMATION_REQUIRED',400);
 }
 const recorded=()=>core.statement('SELECT wish_id,public_code,completed FROM TestCaseCleanups WHERE campaign_id=? AND wish_id=?',campaign,id).first();
 if((await recorded())?.completed)return {cleared:true,id,publicCode};
 try {
  await core.statement(`INSERT INTO TestCaseCleanups(wish_id,campaign_id,public_code,actor_id,wish_version,claim_version,claim_id,contact_id,portal_id,batch_id)
   SELECT w.id,w.campaign_id,w.public_code,?,w.version,c.version,c.id,c.donor_contact_id,c.portal_id,h.batch_id
   FROM Wishes w JOIN Claims c ON c.wish_id=w.id AND c.campaign_id=w.campaign_id
   JOIN HandoffBatchItems h ON h.claim_id=c.id
   WHERE w.campaign_id=? AND w.id=? AND w.public_code=? AND w.version=? AND c.version=?
   AND json_array(
    (SELECT count(*) FROM WishPrivateProfiles WHERE wish_id=w.id),
    (SELECT count(*) FROM Claims WHERE wish_id=w.id),
    (SELECT count(*) FROM GiftReceipts WHERE claim_id=c.id),
    (SELECT count(*) FROM HandoffBatchItems WHERE claim_id=c.id),
    (SELECT count(*) FROM DeliveryConfirmations WHERE claim_id=c.id),
    (SELECT count(*) FROM PaperDocumentEvents WHERE claim_id=c.id),
    (SELECT count(*) FROM Attachments WHERE claim_id=c.id),
    (SELECT count(*) FROM WishMedia WHERE wish_id=w.id OR claim_id=c.id)
   )=?`,actorId,campaign,id,publicCode,wishVersion,claimVersion,JSON.stringify(scopeCounts)).run();
 }catch(error){
  if(!(await recorded())?.completed)throw new ApiError('TEST_CLEANUP_CONFLICT',409);
 }
 if(!(await recorded())?.completed)throw new ApiError('TEST_CLEANUP_CONFLICT',409);
 return {cleared:true,id,publicCode};
}

export async function campaignSettings(ops,campaign,input,actor,{preserveUnsetDeliveryDate=false,requireOperationalElevation}={}){
 const ctx=await ops.context(campaign,actor,'staff.manage'),c=await ops.core.campaign(campaign),rule=await ops.rule(campaign);
 const latest=await ops.core.statement('SELECT version FROM CampaignSettingChanges WHERE campaign_id=? ORDER BY version DESC LIMIT 1',campaign).first();
 const version=latest?.version||0;
 const deadlines=await ops.core.statement('SELECT claim_deadline_at FROM Campaigns WHERE id=?',campaign).first();
 const current={title:c.title,opensAt:c.opens_at,closesAt:c.closes_at,claimDeadlineAt:deadlines.claim_deadline_at,giftDueAt:c.gift_due_at,deliveryDays:rule.delivery_days,expectedDeliveryAt:preserveUnsetDeliveryDate?rule.expected_delivery_at:rule.expected_delivery_at??c.gift_due_at};
 const impact=(await ops.core.statement("SELECT count(*) n,max(gift_due_at) latest FROM Claims WHERE campaign_id=? AND status NOT IN ('cancelled','expired')",campaign).first());
 if(input){
  fields(input,['action','expectedVersion','settings','impactConfirmed']);fields(input.settings,Object.keys(current));const s={expectedDeliveryAt:current.expectedDeliveryAt,...input.settings};
  if(!['preview','save'].includes(input.action)||input.expectedVersion!==version)throw new ApiError('SETTINGS_CONFLICT',409);
  const claimBoundary=s.claimDeadlineAt??s.closesAt;
  if(!required(s.title,100)||!Number.isSafeInteger(s.opensAt)||!Number.isSafeInteger(s.closesAt)||
     ['claimDeadlineAt','giftDueAt','deliveryDays','expectedDeliveryAt'].some(k=>s[k]!==null&&!Number.isSafeInteger(s[k]))||
     s.opensAt>=s.closesAt||s.opensAt>=claimBoundary||claimBoundary>s.closesAt||
     s.giftDueAt!==null&&claimBoundary>s.giftDueAt||
     s.giftDueAt!==null&&s.expectedDeliveryAt!==null&&s.expectedDeliveryAt<s.giftDueAt||
     s.deliveryDays!==null&&(s.deliveryDays<1||s.deliveryDays>90))throw new ApiError('INVALID_DEADLINES');
  const changed=Object.keys(current).some(k=>current[k]!==s[k]);
  if(input.action==='save'&&Object.keys(current).some(k=>k!=='title'&&current[k]!==s[k]))requireOperationalElevation?.();
  const conflicting=(await ops.core.statement("SELECT count(*) n FROM Wishes WHERE campaign_id=? AND (claim_due_at>? OR gift_due_at>?)",campaign,claimBoundary,s.giftDueAt).first()).n;
  if(conflicting||s.giftDueAt!==null&&impact.latest>s.giftDueAt)throw new ApiError('EXISTING_DEADLINES_CONFLICT',409);
  if(input.action==='preview')return {current,proposed:s,version,affectedClaims:impact.n,existingDeadlinesPreserved:true};
  if(!ops.directMode&&changed&&impact.n&&input.impactConfirmed!==true)throw new ApiError('IMPACT_CONFIRMATION_REQUIRED',409);
  try{await ops.core.db.batch([
   ops.core.statement('INSERT INTO CampaignSettingChanges(id,campaign_id,version,payload,actor_id) VALUES(?,?,?,?,?)',crypto.randomUUID(),campaign,version+1,JSON.stringify({before:current,after:s,affectedClaims:impact.n}),ctx.id),
   ops.core.statement('UPDATE Campaigns SET title=?,opens_at=?,closes_at=?,claim_deadline_at=?,gift_due_at=? WHERE id=?',s.title,s.opensAt,s.closesAt,s.claimDeadlineAt,s.giftDueAt,campaign),
   ops.core.statement('UPDATE CampaignOperatingRules SET delivery_days=?,expected_delivery_at=? WHERE campaign_id=?',s.deliveryDays,s.expectedDeliveryAt,campaign),
   ops.action(campaign,ctx,ctx.label,'settings.campaign_updated',campaign,'existing_claim_dates_preserved')
  ]);}catch{throw new ApiError('SETTINGS_CONFLICT',409);}
  return campaignSettings(ops,campaign,null,actor,{preserveUnsetDeliveryDate});
 }
 const history=(await ops.core.statement('SELECT version,payload,created_at FROM CampaignSettingChanges WHERE campaign_id=? ORDER BY version DESC',campaign).all()).results;
 return {settings:current,version,affectedClaims:impact.n,history};
}

export async function paperDocuments(ops,campaign,input,actor,key){
 fields(input,['claimId','expectedVersion','documents','nextStatus','completedAt','deliveryMethod','note']);
 const ctx=await ops.context(campaign,actor,'case.manage');if(ctx.kind!=='bookhouse')throw new ApiError('BOOKHOUSE_ONLY',403);
 await ops.claimScope(campaign,input.claimId,actor);
 if(!isRequestKey(key)||!Array.isArray(input.documents)||!input.documents.length||input.documents.length>2||new Set(input.documents).size!==input.documents.length||input.documents.some(k=>!['thanks','proof'].includes(k))||!['ready_to_send','sent'].includes(input.nextStatus)||!['postal','in_person'].includes(input.deliveryMethod)||!Number.isSafeInteger(input.expectedVersion)||typeof input.note!=='string'||input.note.length>1000||!Number.isSafeInteger(input.completedAt)||input.completedAt>Math.floor(Date.now()/1000)||input.completedAt<0)throw new ApiError('INVALID_DOCUMENT');
 let mailingSnapshot=null;
 if(input.nextStatus==='sent'&&(input.deliveryMethod==='postal'||ops.directMode)){const p=await ops.contactProfile(campaign,{claimId:input.claimId,reason:'paper_document_dispatch'},actor);if(input.deliveryMethod==='postal'&&(!p.recipientName||!p.phone||!/^\d{3}(?:\d{2,3})?$/.test(p.postalCode||'')||!p.postalAddress))throw new ApiError('POSTAL_DETAILS_REQUIRED');if(ops.directMode){const {claim}=await ops.claimScope(campaign,input.claimId,actor),d=await ops.core.statement('SELECT * FROM DonorContacts WHERE id=?',claim.donor_contact_id).first(),contact=await ops.core.crypto.decrypt(d.ciphertext,`${campaign}:${d.id}:${d.key_version}`,d.key_version);mailingSnapshot={...mailingFromContact(contact),phone:contact.phone};}}
 const requestHash=await ops.core.crypto.fingerprint(input),prior=await ops.core.statement('SELECT ciphertext,key_version FROM PaperDocumentEvents WHERE id=?',key+'-0').first();
 if(prior?.key_version==='erased')throw new ApiError('RETENTION_ALREADY_ERASED',409);
 if(prior){const original=await ops.core.crypto.decrypt(prior.ciphertext,`${campaign}:${input.claimId}:${key}-0:${prior.key_version}`,prior.key_version);if(original.requestHash!==requestHash||original.actorId!==ctx.id)throw new ApiError('CONFLICT',409);return {recorded:true};}
 const statements=[],kv=ops.core.crypto.keyVersion;
 for(const [i,type]of input.documents.entries()){
  const id=key+'-'+i,cipher=await ops.core.crypto.encrypt({nextStatus:input.nextStatus,completedAt:input.nextStatus==='sent'?input.completedAt:null,deliveryMethod:input.deliveryMethod,note:input.note,actorId:ctx.id,requestHash,...(mailingSnapshot?{mailingSnapshot}:{})},`${campaign}:${input.claimId}:${id}:${kv}`);
  statements.push(ops.core.statement("INSERT INTO CaseOperations(id,claim_id,actor_id,handler,expected_version,kind,next_status,reference,document_type) VALUES(?,?,?,?,?,'thanks',?,?,?)",id,input.claimId,ctx.id,ctx.label,input.expectedVersion+i,input.nextStatus,'paper_record:'+id,type),ops.core.statement('INSERT INTO PaperDocumentEvents VALUES(?,?,?,?,?)',id,input.claimId,type,cipher,kv));
 }
 try{await ops.core.db.batch(statements);}catch{throw new ApiError('DOCUMENT_CONFLICT',409);}return {recorded:true};
}

export async function supportEvent(ops,campaign,input,actor,key){
  fields(input,['wishId','topicId','expectedVersion','status','type','description','contact','result']);
  const {ctx}=await ops.wishAccess(campaign,input.wishId,actor);if(!ctx.permissions.includes('gift.exception'))throw new ApiError('FORBIDDEN',403);
  if(!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0||(input.topicId&&!isId(input.topicId))||!isRequestKey(key)||!['open','resolved'].includes(input.status)||!required(input.type,80)||!required(input.description)||typeof input.contact!=='string'||input.contact.length>1000||typeof input.result!=='string'||input.result.length>1000||(input.status==='resolved'&&!input.result.trim()))throw new ApiError('INVALID_SUPPORT');
  const prior=await ops.core.statement('SELECT * FROM CaseSupportEvents WHERE id=?',key).first();if(prior){if(prior.campaign_id!==campaign||prior.wish_id!==input.wishId||prior.actor_id!==ctx.id||prior.topic_id!==(input.topicId||key)||prior.version!==input.expectedVersion+1||prior.status!==input.status)throw new ApiError('CONFLICT',409);const original=await ops.core.crypto.decrypt(prior.ciphertext,`${campaign}:${input.wishId}:${key}:${prior.key_version}`,prior.key_version);if(['type','description','contact','result'].some(k=>original[k]!==input[k]))throw new ApiError('CONFLICT',409);return {saved:true};}
  const topicId=input.topicId||key;const latest=(await currentEvents(ops,campaign,input.wishId,ctx)).filter(e=>e.topic_id===topicId).at(-1);
  if((latest?.version||0)!==input.expectedVersion||(!latest&&input.topicId))throw new ApiError('CONFLICT',409);
  const version=input.expectedVersion+1,kv=ops.core.crypto.keyVersion;
  const encrypted=await ops.core.crypto.encrypt({type:input.type,description:input.description,contact:input.contact,result:input.result},`${campaign}:${input.wishId}:${key}:${kv}`);
  try{await ops.core.db.batch([ops.core.statement('INSERT INTO CaseSupportEvents(id,campaign_id,wish_id,unit_id,actor_id,topic_id,version,status,ciphertext,key_version) VALUES(?,?,?,?,?,?,?,?,?,?)',key,campaign,input.wishId,latest?.unit_id||ctx.unit_id,ctx.id,topicId,version,input.status,encrypted,kv),ops.action(campaign,ctx,ctx.label,'case.support_'+input.status,input.wishId)]);}catch{throw new ApiError('SUPPORT_CONFLICT',409);}return {saved:true};
}

export async function workspaceCases(ops,campaign,actor){
  const ctx=await ops.context(campaign,actor),dashboard=await ops.dashboard(campaign,actor),claims=await ops.read(campaign,'/claims',actor),batches=await ops.read(campaign,'/batches',actor);
  const issues=(await ops.core.statement(`SELECT e.wish_id,e.topic_id,e.status FROM CaseSupportEvents e WHERE e.campaign_id=? AND (?<>'collection' OR e.unit_id=?) AND e.version=(SELECT max(n.version) FROM CaseSupportEvents n WHERE n.topic_id=e.topic_id)`,campaign,ctx.kind,ctx.unit_id).all()).results;
  const rows=dashboard.rows.filter(r=>ctx.kind!=='collection'||claims.some(c=>c.wish_id===r.id));
  const items=(await ops.core.statement('SELECT i.claim_id,i.batch_id,i.quantity,w.public_code,EXISTS(SELECT 1 FROM HandoffItems h WHERE h.claim_id=i.claim_id) accepted FROM HandoffBatchItems i JOIN Claims c ON c.id=i.claim_id JOIN Wishes w ON w.id=c.wish_id WHERE c.campaign_id=?',campaign).all()).results;
  if(ops.acceptanceMode)for(const batch of batches)Object.assign(batch,await batchDisplay(ops,batch));
  for(const claim of claims)claim.batchId=items.find(i=>i.claim_id===claim.id)?.batch_id||null;
  for(const batch of batches){batch.quantity=items.filter(i=>i.batch_id===batch.id).reduce((n,i)=>n+i.quantity,0);batch.codes=items.filter(i=>i.batch_id===batch.id).map(i=>i.public_code);batch.pendingCodes=items.filter(i=>i.batch_id===batch.id&&!i.accepted).map(i=>i.public_code);batch.issueCodes=batch.codes.filter(code=>rows.some(r=>r.public_code===code&&issues.some(e=>e.wish_id===r.id&&e.status==='open')));}
  const rule=await ops.rule(campaign),campaignInfo=await ops.core.campaign(campaign);
  return {...dashboard,...(ops.acceptanceMode?{workTasks:operationalTasks(rows,ctx.collectionSites)}:{}),expectedDeliveryAt:rule.expected_delivery_at||campaignInfo.gift_due_at,rows:rows.map(r=>({...r,needsHelp:issues.some(e=>e.wish_id===r.id&&e.status==='open')})),claims,batches,supportTasks:rows.filter(r=>issues.some(e=>e.wish_id===r.id&&e.status==='open')).map(r=>({id:r.id,public_code:r.public_code,gift_name:r.gift_name}))};
}

export async function phoneSearch(ops,campaign,input,actor){
  fields(input,['phone']);const ctx=await ops.context(campaign,actor,'gift.receive');
  const attempt=await ops.core.statement('INSERT INTO WorkspaceSearchLimits VALUES(?,?,unixepoch(),1) ON CONFLICT(campaign_id,actor_id) DO UPDATE SET window_start=CASE WHEN window_start<unixepoch()-900 THEN unixepoch() ELSE window_start END,attempts=CASE WHEN window_start<unixepoch()-900 THEN 1 ELSE attempts+1 END RETURNING attempts',campaign,ctx.id).first();
  if(attempt.attempts>10)throw new ApiError('SEARCH_RATE_LIMITED',429);
  const phone=ops.directMode?normalizeContactPhone(input.phone)?.base:String(input.phone||'').replace(/[ -]/g,'');if(!phone||!/^\+?[0-9]{7,15}$/.test(phone))throw new ApiError('INVALID_PHONE');
  const contacts=(await ops.core.statement('SELECT id,phone_lookup_hash,phone_lookup_version FROM DonorContacts WHERE campaign_id=? AND erased_at IS NULL AND retention_until>unixepoch() AND phone_lookup_hash IS NOT NULL',campaign).all()).results;
  const ids=[];for(const d of contacts)if(equalDigest(d.phone_lookup_hash,await ops.core.crypto.fingerprint({phone},d.phone_lookup_version)))ids.push(d.id);
  const matches=[];for(const id of ids){const claims=(await ops.core.statement("SELECT c.id,w.public_code FROM Claims c JOIN Wishes w ON w.id=c.wish_id WHERE c.campaign_id=? AND c.donor_contact_id=? AND c.status NOT IN ('cancelled','expired')",campaign,id).all()).results;for(const c of claims){try{await ops.claimScope(campaign,c.id,actor,{allowUnreceived:true});const row=await ops.search(campaign,{code:c.public_code},actor);if(row.claim&&!row.receipt?.crossSite)matches.push({id:row.id,public_code:row.public_code,gift_name:row.gift_name,status:row.claim.status,...(ctx.kind==='collection'?{claim:row.claim,receipt:row.receipt,specifications:row.specifications}:{})});}catch(error){if(error.status!==403)throw error;}}}
  await ops.action(campaign,ctx,ctx.label,'case.phone_search',campaign,'limited_receiving_lookup').run();return matches.slice(0,20);
}

export async function adminReset(ops,campaign,input,actor){
  fields(input,['claimId','temporaryPassword','identityMethod','reference']);const ctx=await ops.context(campaign,actor,'staff.manage');
  if(!['phone_and_record','in_person_and_record'].includes(input.identityMethod)||!required(input.reference,500))throw new ApiError('IDENTITY_CONFIRMATION_REQUIRED');
  const {claim}=await ops.claimScope(campaign,input.claimId,actor);if(!claim.portal_id)throw new ApiError('NO_EMAIL_ACCOUNT');
  await resetDonorPasswordByAdmin(ops,campaign,claim.portal_id,input.temporaryPassword,ctx,input.identityMethod+':'+input.reference);return {reset:true,mustChangePassword:true};
}

function validContent(c){
  if(c.privacyStatement!==undefined){fields(c.privacyStatement,['title','body']);if(!required(c.privacyStatement.title,120)||!required(c.privacyStatement.body,12000))throw new ApiError('INVALID_CONTENT');}
  if(c.hiddenFaq!==undefined&&(!Array.isArray(c.hiddenFaq)||c.hiddenFaq.length>40||c.hiddenFaq.some(r=>!Array.isArray(r)||r.length!==2||r.some(v=>!required(v,1500)))))throw new ApiError('INVALID_CONTENT');
  if(c.attention!==undefined&&(typeof c.attention!=='string'||c.attention.length>2000))throw new ApiError('INVALID_CONTENT');
  fields(c,['headline','introduction','partnership','miller','tree','cama','faq','steps','attention','scopedFaq','privacyStatement','hiddenFaq','announcement','announcementDates','brand']);
  if(c.brand!==undefined)validateCampaignBrand(c.brand);
  if(c.announcement!==undefined&&(typeof c.announcement!=='string'||c.announcement.length>2000))throw new ApiError('INVALID_CONTENT');
  if(c.announcementDates!==undefined){
    fields(c.announcementDates,['start','end','giftDeadline']);
    const {start,end,giftDeadline}=c.announcementDates;
    for(const date of [start,end,giftDeadline]){
      if(date==='')continue;
      if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new ApiError('INVALID_ANNOUNCEMENT_DATES');
    }
    if(start&&((end&&end<start)||(giftDeadline&&giftDeadline<start)))throw new ApiError('INVALID_ANNOUNCEMENT_DATES');
  }
  if(c.scopedFaq!==undefined){fields(c.scopedFaq,['venue','activities']);for(const rows of Object.values(c.scopedFaq))if(!Array.isArray(rows)||rows.length>40||rows.some(r=>!Array.isArray(r)||r.length!==2||r.some(v=>!required(v,1500))))throw new ApiError('INVALID_CONTENT');}
  if(['headline','introduction','partnership','miller','tree','cama'].some(k=>!required(c[k],2000))||!Array.isArray(c.faq)||c.faq.length>40||c.faq.some(r=>!Array.isArray(r)||r.length!==2||r.some(v=>!required(v,1500)))||(c.steps!==undefined&&(!Array.isArray(c.steps)||c.steps.length<1||c.steps.length>8||c.steps.some(r=>!Array.isArray(r)||r.length!==2||r.some(v=>!required(v,1500))))))throw new ApiError('INVALID_CONTENT');
}
export async function contentEditor(ops,campaign,input,actor,{websiteOnly=false,brandMediaBucket}={}){
  const ctx=await ops.context(campaign,actor,'staff.manage');
  if(input){fields(input,['action','expectedVersion','expectedPublishedVersion','content']);if(!['save','publish','publishBrand'].includes(input.action)||!Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<0)throw new ApiError('INVALID_CONTENT');
    if(input.action==='save'){validContent(input.content);await verifyBrandImageReferences(ops.core,campaign,input.content.brand,brandMediaBucket);const payload=JSON.stringify(input.content);const result=await ops.core.db.batch([
      ops.core.statement("INSERT INTO CampaignContentDrafts(campaign_id,payload,version,status) SELECT ?,?,1,'draft' WHERE ?=0 OR EXISTS(SELECT 1 FROM CampaignContentDrafts WHERE campaign_id=?) ON CONFLICT(campaign_id) DO UPDATE SET payload=excluded.payload,version=version+1,status='draft' WHERE version=? AND ?>0",campaign,payload,input.expectedVersion,campaign,input.expectedVersion,input.expectedVersion),
      ops.core.statement("INSERT INTO CampaignContentRevisions SELECT ?,?,?,?,'draft',?,unixepoch() WHERE changes()=1",crypto.randomUUID(),campaign,payload,input.expectedVersion+1,ctx.id),
      ops.core.statement("INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id) SELECT ?,?,?,?,?,'content.draft_saved',? WHERE changes()=1",crypto.randomUUID(),campaign,ctx.unit_id,ctx.id,ctx.label,campaign)
    ]);if(!result[0].meta.changes)throw new ApiError('CONTENT_CONFLICT',409);
    }else{
      const draft=await ops.core.statement('SELECT * FROM CampaignContentDrafts WHERE campaign_id=? AND version=?',campaign,input.expectedVersion).first();if(!draft||draft.status!=='draft'||!Number.isSafeInteger(input.expectedPublishedVersion)||input.expectedPublishedVersion<0)throw new ApiError('CONTENT_CONFLICT',409);
      const publication=JSON.parse(draft.payload);
      validContent(publication);
      await verifyBrandImageReferences(ops.core,campaign,publication.brand,brandMediaBucket);
      if(input.action==='publishBrand'){
        if(!publication.brand)throw new ApiError('INVALID_CAMPAIGN_BRAND');
        const result=await ops.core.db.batch([
          ops.core.statement(`INSERT INTO CampaignPublicContent(campaign_id,payload,version)
            SELECT ?,?,1 WHERE EXISTS(SELECT 1 FROM CampaignContentDrafts WHERE campaign_id=? AND version=? AND status='draft')
            AND (?=0 OR EXISTS(SELECT 1 FROM CampaignPublicContent WHERE campaign_id=?))
            ON CONFLICT(campaign_id) DO UPDATE SET payload=json_set(CampaignPublicContent.payload,'$.brand',json_extract(excluded.payload,'$.brand')),
            version=CampaignPublicContent.version+1,updated_at=unixepoch() WHERE CampaignPublicContent.version=? AND ?>0`,
            campaign,JSON.stringify({brand:publication.brand}),campaign,input.expectedVersion,input.expectedPublishedVersion,campaign,input.expectedPublishedVersion,input.expectedPublishedVersion),
          ops.core.statement(`INSERT INTO CampaignContentRevisions SELECT ?,?,?,?,'brand_published',?,unixepoch() WHERE changes()=1`,
            crypto.randomUUID(),campaign,JSON.stringify({brand:publication.brand}),input.expectedVersion,ctx.id),
          ops.core.statement(`INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id)
            SELECT ?,?,?,?,?,'content.brand_published',? WHERE changes()=1`,crypto.randomUUID(),campaign,ctx.unit_id,ctx.id,ctx.label,campaign)
        ]);
        if(!result[0].meta.changes)throw new ApiError('CONTENT_CONFLICT',409);
      }else{
      if(websiteOnly)delete publication.privacyStatement;
      const result=await ops.core.db.batch([
        ops.core.statement("INSERT INTO CampaignPublicContent(campaign_id,payload,version) SELECT ?,?,1 WHERE EXISTS(SELECT 1 FROM CampaignContentDrafts WHERE campaign_id=? AND version=? AND status='draft') AND (?=0 OR EXISTS(SELECT 1 FROM CampaignPublicContent WHERE campaign_id=?)) ON CONFLICT(campaign_id) DO UPDATE SET payload=excluded.payload,version=version+1,updated_at=unixepoch() WHERE version=? AND ?>0",campaign,JSON.stringify(publication),campaign,input.expectedVersion,input.expectedPublishedVersion,campaign,input.expectedPublishedVersion,input.expectedPublishedVersion),
        ops.core.statement("UPDATE CampaignContentDrafts SET status='published' WHERE campaign_id=? AND version=? AND changes()=1",campaign,input.expectedVersion),
        ops.core.statement("INSERT INTO CampaignContentRevisions SELECT ?,?,?,?,'published',?,unixepoch() WHERE changes()=1",crypto.randomUUID(),campaign,JSON.stringify(publication),input.expectedVersion,ctx.id),
        ops.core.statement("INSERT INTO UnitActions(id,campaign_id,unit_id,actor_id,handler,action,resource_id) SELECT ?,?,?,?,?,'content.published',? WHERE changes()=1",crypto.randomUUID(),campaign,ctx.unit_id,ctx.id,ctx.label,campaign),
        ...privacyPublicationStatements(ops,campaign,ctx,publication,input.expectedPublishedVersion+1,input.expectedVersion)
      ]);if(!result[0].meta.changes)throw new ApiError('CONTENT_CONFLICT',409);
      }
    }
  }
  const published=await ops.publicContent(campaign,null,actor),draft=await ops.core.statement('SELECT * FROM CampaignContentDrafts WHERE campaign_id=?',campaign).first();
  const revisions=(await ops.core.statement('SELECT version,kind,created_at FROM CampaignContentRevisions WHERE campaign_id=? ORDER BY created_at DESC,version DESC LIMIT 100',campaign).all()).results;
  return {...(ops.acceptanceMode?{privacyHistory:(await ops.core.statement('SELECT version,title,body,published_at FROM PrivacyStatements WHERE campaign_id=? ORDER BY published_at DESC,version DESC',campaign).all()).results,activePrivacyVersion:(await ops.core.statement('SELECT privacy_version FROM Campaigns WHERE id=?',campaign).first()).privacy_version}:{}),published,draft:draft?{content:JSON.parse(draft.payload),version:draft.version,status:draft.status}:null,revisions,brandDefaults:initialBrand};
}
