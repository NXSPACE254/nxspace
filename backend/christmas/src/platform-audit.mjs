import {ApiError} from './validation.mjs';

// Call only from a trusted server adapter. Principal is resolved from the server's
// authenticated identity, never from a submitted actor/name/unit field.
export async function recordPlatformEvent(core,campaign,principal,event){
 const allowed=['count','groups','documentType','dispatch','merged','code','route','removed'];
 const details=Object.fromEntries(Object.entries(event.details||{}).filter(([k,v])=>allowed.includes(k)&&['string','number','boolean'].includes(typeof v)));
 const module=event.module||(campaign?'christmas':'platform');if(!/^[a-z][a-z_-]{1,30}$/.test(module))throw new ApiError('INVALID_AUDIT_MODULE');
 await core.statement('INSERT INTO PlatformAudit(id,campaign_id,module,actor_id,actor_name,unit_id,action,resource_id,result,details) VALUES(?,?,?,?,?,?,?,?,?,?)',crypto.randomUUID(),campaign||null,module,principal.id,principal.displayName||principal.label,principal.unit_id,event.action,event.resourceId||campaign||module,event.result||'success',JSON.stringify(details)).run();
}
export async function recordRequest(ops,campaign,actor,route,result,code=''){
 const known=['/workspace/sites','/workspace/bulk','/workspace/sites','/workspace/bulk','/workspace/pin-reset','/workspace/mailing','/workspace/case','/workspace/support','/workspace/phone','/workspace/password-reset','/workspace/settings','/workspace/content','/workspace/documents','/workspace/export','/workspace/export-access','/platform-audit/page','/platform-audit/cleanup','/ops/fulfillment','/ops/profile','/ops/profile/save','/ops/child','/ops/child/save','/ops/release','/ops/reopen','/ops/deadline','/ops/correct-location','/ops/wish-submit','/ops/proposal-review','/wish-editor'];
 route=known.includes(route)?route:'/unrecognized';
 let ctx;try{ctx=await ops.context(campaign,actor);}catch{
  const row=await ops.core.statement('SELECT u.id,o.label,a.organisation_id AS unit_id FROM AdminUsers u JOIN OperatingAccounts a ON a.user_id=u.id JOIN Organisations o ON o.id=a.organisation_id WHERE u.issuer=? AND u.subject=? AND a.campaign_id=?',actor.issuer,actor.subject,campaign).first();
  ctx=row||{id:'unprovisioned',label:'未授權帳號',unit_id:'unassigned'};
 }
 await recordPlatformEvent(ops.core,campaign,ctx,{action:'request.'+route.replaceAll('/','.'),result,details:{route,code}});
}
export async function listPlatformAudit(ops,campaign,actor,{limit=100,before=null}={}){
 await ops.context(campaign,actor,'staff.manage');
 if(!Number.isSafeInteger(limit)||limit<1||limit>200||(before!==null&&(!Number.isSafeInteger(before)||before<1)))throw new ApiError('INVALID_FILTER');
 const rows=(await ops.core.statement(`SELECT rowid AS cursor,id,module,actor_id,actor_name,unit_id,action,resource_id,result,details,before_json,after_json,occurred_at,retention_until,COALESCE((SELECT public_code FROM Wishes WHERE id=a.resource_id),(SELECT w.public_code FROM Claims c JOIN Wishes w ON w.id=c.wish_id WHERE c.id=a.resource_id),(SELECT reason_code FROM AuditLogs WHERE resource_id=a.resource_id AND action='test_case.archived' ORDER BY id DESC LIMIT 1),'聖誕公益作業') AS resource_label,COALESCE((SELECT label FROM Organisations WHERE id=a.unit_id),'系統') AS unit_label,COALESCE((SELECT kind FROM OperatingAccounts WHERE user_id=a.actor_id AND campaign_id=a.campaign_id),'system') AS actor_role FROM PlatformAudit a WHERE (campaign_id=? OR campaign_id IS NULL) AND (? IS NULL OR rowid<?) ORDER BY rowid DESC LIMIT ?`,campaign,before,before,limit+1).all()).results;
 const page=rows.slice(0,limit);
 return {rows:page,nextCursor:rows.length>limit?page.at(-1).cursor:null,retentionDays:365,timeZone:'Asia/Taipei'};
}
export async function purgeExpiredAudit(ops,campaign,actor){
 const ctx=await ops.context(campaign,actor,'staff.manage');
 const result=await ops.core.db.batch([ops.core.statement('DELETE FROM PlatformAudit WHERE campaign_id=? AND retention_until<=unixepoch()',campaign),ops.core.statement("INSERT INTO PlatformAudit(id,campaign_id,actor_id,actor_name,unit_id,action,resource_id,result,details) VALUES(?,?,?,?,?,'audit.retention_cleanup',?,'success',json_object('removed',changes()))",crypto.randomUUID(),campaign,ctx.id,ctx.label,ctx.unit_id,campaign)]);
 return {removed:result[0].meta.changes};
}
