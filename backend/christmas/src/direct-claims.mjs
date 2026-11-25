import {ApiError,isRequestKey,validateClaim} from './validation.mjs';
import {digest,equalDigest,generateClaimSecret} from './crypto.mjs';
import {normalizeContactPhone,validMailing,mailingFromContact} from './contact-rules.mjs';
import {postalAreas,postalMetadata} from './postal-areas.mjs';

const now=()=>Math.floor(Date.now()/1000);
const fields=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw new ApiError('INVALID_FIELDS');};
const text=(v,min,max)=>typeof v==='string'&&v.trim().length>=min&&v.length<=max&&!/[\u0000-\u001f]/.test(v);
const pinValid=pin=>typeof pin==='string'&&/^\d{4}$/.test(pin);
const emailValue=value=>{if(typeof value!=='string'||value.length>160||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))throw new ApiError('PIN_AUTH_FAILED',403);return value.trim().toLowerCase();};
const hex=a=>[...new Uint8Array(a)].map(v=>v.toString(16).padStart(2,'0')).join('');
// PIN hashing includes a server-held HMAC pepper. PBKDF2 cost stays within Workers limits;
// database-only disclosure cannot test the 10,000 PIN values without the request key.
async function pinHash(ops,pin,salt,version){
 const peppered=await ops.core.crypto.fingerprint({purpose:'charity-pin-v1',pin,salt},version);
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(peppered),'PBKDF2',false,['deriveBits']);
 return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:100000,salt:Uint8Array.from(salt.match(/../g),v=>parseInt(v,16))},key,256));
}
async function findPortal(ops,campaign,email){let match=null;for(const p of (await ops.core.statement('SELECT * FROM DonorPortals WHERE campaign_id=?',campaign).all()).results)if(equalDigest(p.email_hash,await ops.core.crypto.fingerprint({email},p.key_version))){if(match)throw new ApiError('PIN_AUTH_FAILED',403);match=p;}return match;}
async function reserve(ops,campaign,bucket,seconds,limit){
 const hash=await ops.core.crypto.fingerprint({directLimit:bucket});
 const r=await ops.core.statement('INSERT INTO PinAttemptWindows(campaign_id,bucket_hash,seconds,window_start,attempts) VALUES(?,?,?,unixepoch(),1) ON CONFLICT(campaign_id,bucket_hash,seconds) DO UPDATE SET attempts=CASE WHEN window_start<=unixepoch()-excluded.seconds THEN 1 ELSE attempts+1 END,window_start=CASE WHEN window_start<=unixepoch()-excluded.seconds THEN unixepoch() ELSE window_start END RETURNING attempts,window_start',campaign,hash,seconds).first();
 if(r.attempts>limit)throw new ApiError('PIN_LOGIN_UNAVAILABLE',429);return {hash,seconds,start:r.window_start};
}
async function authenticate(ops,campaign,email,pin,{register=false}={}){
 await reserve(ops,campaign,'auth-global',60,60);await reserve(ops,campaign,'auth-global',3600,300);
 const attempts=[];for(const [seconds,max]of [[900,5],[3600,10],[86400,20]])attempts.push(await reserve(ops,campaign,'email:'+email,seconds,max));
 const portal=await findPortal(ops,campaign,email),saved=portal?await ops.core.statement('SELECT * FROM DonorPins WHERE portal_id=?',portal.id).first():null;
 const salt=saved?.salt||'00000000000000000000000000000000',version=saved?.key_version||ops.core.crypto.requestKeyVersion||'legacy';
 const candidate=await pinHash(ops,pinValid(pin)?pin:'invalid-pin',salt,version);
 if(!pinValid(pin)||(portal&&!saved)||(!register&&!saved)||(saved&&!equalDigest(saved.pin_hash,candidate))){
  await ops.core.statement("INSERT INTO PlatformAudit(id,campaign_id,actor_id,actor_name,unit_id,action,resource_id,result) VALUES(?,?,?,'未登入帳號','public','auth.pin_login',?,'failure')",crypto.randomUUID(),campaign,await ops.core.crypto.fingerprint({failedPinEmail:email}),campaign).run();
  throw new ApiError('PIN_AUTH_FAILED',403);
 }
 // Only account failure windows are refunded; aggregate abuse limits remain.
 await ops.core.db.batch(attempts.map(a=>ops.core.statement('UPDATE PinAttemptWindows SET attempts=max(0,attempts-1) WHERE campaign_id=? AND bucket_hash=? AND seconds=? AND window_start=?',campaign,a.hash,a.seconds,a.start)));
 return {portal,saved};
}
async function issueSession(ops,campaign,portalId){
 const accessId=crypto.randomUUID(),secret=generateClaimSecret();
 await ops.core.statement("INSERT INTO OwnerAccess(id,portal_id,capability_hash,expires_at,auth_method) VALUES(?,?,?,unixepoch()+900,'pin')",accessId,portalId,await digest(secret)).run();
 return {accessId,secret};
}
export function ownerCookie(request,session=null,{scoped=false}={}){
 const url=new URL(request.url);
 const path=url.pathname.startsWith('/christmas/christmas-api/')?'/christmas/christmas-api/public':'/christmas-api';
 const name='nxspace_charity_owner'+(scoped?'_'+url.port:'');
 const value=session?session.accessId+'.'+session.secret:'';
 return `${name}=${value}; HttpOnly; SameSite=Strict; Path=${path}; Max-Age=${session?900:0}${url.protocol==='https:'?'; Secure':''}`;
}
export function cookieCredentials(request,scoped=false){const name='nxspace_charity_owner'+(scoped?'_'+new URL(request.url).port:'');const value=request.headers.get('Cookie')?.match(new RegExp('(?:^|;\\s*)'+name+'=([\\w-]{8,80})\\.([\\w-]{43})(?:;|$)'));if(!value)throw new ApiError('OWNER_UNAUTHORIZED',401);return {accessId:value[1],secret:value[2]};}
export async function getPrivacy(ops,campaign){
 const record=await ops.core.statement('SELECT p.version,p.title,p.body,p.published_at FROM PrivacyStatements p JOIN Campaigns c ON c.id=p.campaign_id AND c.privacy_version=p.version WHERE p.campaign_id=?',campaign).first();
 if(!record)throw new ApiError('PRIVACY_NOT_PUBLISHED',409);return {version:record.version,title:record.title,body:record.body,publishedAt:record.published_at};
}
export function privacyPublicationStatements(ops,campaign,ctx,content,publishedVersion,draftVersion){
 if(!ops.directMode||!content.privacyStatement?.body?.trim())return [];
 const p=content.privacyStatement,version='privacy-'+publishedVersion;
 return [ops.core.statement("INSERT INTO PrivacyStatements(campaign_id,version,title,body,actor_id) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM CampaignPublicContent c JOIN CampaignContentDrafts d ON d.campaign_id=c.campaign_id WHERE c.campaign_id=? AND c.version=? AND d.version=? AND d.status='published') AND NOT EXISTS(SELECT 1 FROM PrivacyStatements p JOIN Campaigns c ON c.id=p.campaign_id AND c.privacy_version=p.version WHERE p.campaign_id=? AND p.title=? AND p.body=?)",campaign,version,p.title.trim(),p.body.trim(),ctx.id,campaign,publishedVersion,draftVersion,campaign,p.title.trim(),p.body.trim()),ops.core.statement('UPDATE Campaigns SET privacy_version=? WHERE id=? AND EXISTS(SELECT 1 FROM PrivacyStatements WHERE campaign_id=? AND version=?)',version,campaign,campaign,version)];
}
export async function directAdopt(ops,campaign,input){
 fields(input,['claim','pin','pinConfirm']);if(!pinValid(input.pin)||input.pin!==input.pinConfirm)throw new ApiError('PIN_FOUR_DIGITS');
 validateClaim(input.claim,{operations:true,direct:true});const claim=input.claim,email=emailValue(claim.contact.address);
 if(email!==claim.contact.address)throw new ApiError('NORMALIZED_EMAIL_REQUIRED');
 await reserve(ops,campaign,'claim-global',60,20);await reserve(ops,campaign,'claim-global',3600,50);
 const {portal,saved}=await authenticate(ops,campaign,email,input.pin,{register:true}),privacy=await getPrivacy(ops,campaign);
 if(claim.consentVersion!==privacy.version)throw new ApiError('CONSENT_VERSION_MISMATCH',409);
 const portalId=portal?.id||crypto.randomUUID(),prefix=[];
 if(!portal){const salt=hex(crypto.getRandomValues(new Uint8Array(16))),version=ops.core.crypto.requestKeyVersion||'legacy';prefix.push(ops.core.statement('INSERT INTO DonorPortals(id,campaign_id,email_hash,key_version) VALUES(?,?,?,?)',portalId,campaign,await ops.core.crypto.fingerprint({email}),version),ops.core.statement('INSERT INTO DonorPins(portal_id,salt,pin_hash,key_version) VALUES(?,?,?,?)',portalId,salt,await pinHash(ops,input.pin,salt,version),version));}
 if(portal&&!saved)throw new ApiError('PIN_AUTH_FAILED',403);
 const phone=normalizeContactPhone(claim.contact.phone);claim.contact.phone=phone.display;
 const result=await ops.core.claim(campaign,claim,{verified:true,method:'direct',expiresAt:now()+60,requestHash:await ops.fingerprint(campaign,claim)},{source:'online',portalId,direct:true,beforeStatements:prefix});
 const session=await issueSession(ops,campaign,portalId),cards=await directOwnerClaims(ops,campaign,session);
 return {data:{...result,card:cards.find(c=>c.claimId===result.claimId)},session};
}
export async function directLogin(ops,campaign,input){fields(input,['email','pin']);const email=emailValue(input.email),{portal}=await authenticate(ops,campaign,email,input.pin);const session=await issueSession(ops,campaign,portal.id);await ops.core.statement("INSERT INTO PlatformAudit(id,campaign_id,actor_id,actor_name,unit_id,action,resource_id,result) VALUES(?,?,?,'認領者','public','auth.pin_login',?,'success')",crypto.randomUUID(),campaign,portal.id,portal.id).run();return {data:{authenticated:true},session};}
export async function directOwnerClaims(ops,campaign,credentials){
 const owner=await ops.owner(campaign,credentials),rows=(await ops.core.statement('SELECT c.*,s.payload,s.origin FROM Claims c JOIN ClaimPublicSnapshots s ON s.claim_id=c.id WHERE c.campaign_id=? AND c.portal_id=? ORDER BY c.claimed_at DESC,c.id',campaign,owner.portal_id).all()).results;
 return Promise.all(rows.map(async c=>{const snapshot=JSON.parse(c.payload);return {...snapshot,...await ops.progressRow(c),originalGiftDueAt:snapshot.giftDueAt,snapshotOrigin:c.origin};}));
}
export async function resetPin(ops,campaign,input,actor,key){
 fields(input,['claimId','pin','pinConfirm','identityMethod','reference','identityConfirmed']);const ctx=await ops.context(campaign,actor,'staff.manage');
 if(!isRequestKey(key)||!pinValid(input.pin)||input.pin!==input.pinConfirm||input.identityConfirmed!==true||!['phone_and_record','in_person_and_record'].includes(input.identityMethod)||!text(input.reference,8,500))throw new ApiError('IDENTITY_CONFIRMATION_REQUIRED');
 const {claim}=await ops.claimScope(campaign,input.claimId,actor);if(!claim.portal_id)throw new ApiError('PIN_AUTH_FAILED',403);
 const old=await ops.core.statement('SELECT * FROM DonorPins WHERE portal_id=?',claim.portal_id).first();if(old&&equalDigest(old.pin_hash,await pinHash(ops,input.pin,old.salt,old.key_version)))throw new ApiError('PIN_UNCHANGED');
 const salt=hex(crypto.getRandomValues(new Uint8Array(16))),version=ops.core.crypto.requestKeyVersion||'legacy';
 const kv=ops.core.crypto.keyVersion,reference=await ops.core.crypto.encrypt({reference:input.reference},`${campaign}:${key}:pin-reset:${kv}`);
 const d=await ops.core.statement('SELECT ciphertext,key_version FROM DonorContacts WHERE id=? AND erased_at IS NULL',claim.donor_contact_id).first();
 const contact=d?await ops.core.crypto.decrypt(d.ciphertext,`${campaign}:${claim.donor_contact_id}:${d.key_version}`,d.key_version):null;
 const email=contact?.channel==='email'?contact.address:contact?.email;
 const unlock=email?[ops.core.statement('UPDATE PinAttemptWindows SET attempts=0,window_start=unixepoch() WHERE campaign_id=? AND bucket_hash=?',campaign,await ops.core.crypto.fingerprint({directLimit:'email:'+email.trim().toLowerCase()}))]:[];
 // Do not copy the PIN or identity-check notes into the global audit log.
 await ops.core.db.batch([ops.core.statement('INSERT INTO PinResetEvents(id,campaign_id,portal_id,actor_id,identity_method,reference_ciphertext,key_version) VALUES(?,?,?,?,?,?,?)',key,campaign,claim.portal_id,ctx.id,input.identityMethod,reference,kv),ops.core.statement('INSERT INTO DonorPins(portal_id,salt,pin_hash,key_version) VALUES(?,?,?,?) ON CONFLICT(portal_id) DO UPDATE SET salt=excluded.salt,pin_hash=excluded.pin_hash,key_version=excluded.key_version,updated_at=unixepoch()',claim.portal_id,salt,await pinHash(ops,input.pin,salt,version),version),ops.core.statement('UPDATE OwnerAccess SET revoked_at=unixepoch() WHERE portal_id=?',claim.portal_id),...unlock,ops.action(campaign,ctx,ctx.displayName,'account.pin_reset',input.claimId,'identity_verified:'+input.identityMethod)]);
 return {saved:true};
}
export async function mailingCorrection(ops,campaign,input,actor,key){
 fields(input,['action','claimId','expectedVersion','mailing','reason']);const ctx=await ops.context(campaign,actor,'contact.read');if(!['admin','bookhouse'].includes(ctx.kind))throw new ApiError('FORBIDDEN',403);
 const {claim}=await ops.claimScope(campaign,input.claimId,actor),d=await ops.core.statement('SELECT * FROM DonorContacts WHERE id=? AND erased_at IS NULL AND retention_until>unixepoch()',claim.donor_contact_id).first();if(!d)throw new ApiError('NOT_FOUND',404);
 const authorizedRead=input.action==='read'&&(ctx.kind==='admin'||ops.acceptanceMode);
 if(!authorizedRead&&!text(input.reason,2,500))throw new ApiError('BUSINESS_REASON_REQUIRED');const contact=await ops.core.crypto.decrypt(d.ciphertext,`${campaign}:${d.id}:${d.key_version}`,d.key_version);
 if(input.action==='save'){
  fields(input.mailing,['recipientName','postalCity','postalDistrict','postalCode','postalStreet']);if(!validMailing(input.mailing)||!isRequestKey(key)||!Number.isSafeInteger(input.expectedVersion))throw new ApiError('MAILING_DETAILS_REQUIRED');
  const mailing={...input.mailing,postalAddress:input.mailing.postalCity+input.mailing.postalDistrict+input.mailing.postalStreet.trim()},id=key,kv=ops.core.crypto.keyVersion,updated={...contact,...mailing,parties:{...contact.parties,recipient:mailing.recipientName.trim()}};delete updated.recipientName;
  const cipher=await ops.core.crypto.encrypt(updated,`${campaign}:${d.id}:${kv}`),difference=await ops.core.crypto.encrypt({before:mailingFromContact(contact),after:mailing,reason:input.reason},`${campaign}:${claim.id}:${id}:mailing:${kv}`);
  try{await ops.core.statement('INSERT INTO MailingCorrections(id,campaign_id,claim_id,contact_id,actor_id,unit_id,expected_version,new_ciphertext,difference_ciphertext,key_version) VALUES(?,?,?,?,?,?,?,?,?,?)',id,campaign,claim.id,d.id,ctx.id,ctx.unit_id,input.expectedVersion,cipher,difference,kv).run();}catch{throw new ApiError('PROFILE_CONFLICT',409);}return {saved:true};
 }
 if(input.action!=='read')throw new ApiError('INVALID_FIELDS');
 await ops.action(campaign,ctx,ctx.displayName,'contact.mailing_read',claim.id,'authorized_mailing_correction').run();
 const history=[];for(const r of (await ops.core.statement('SELECT id,actor_id,created_at,difference_ciphertext,key_version FROM MailingCorrections WHERE campaign_id=? AND claim_id=? ORDER BY created_at,id',campaign,claim.id).all()).results)history.push({actorId:r.actor_id,at:r.created_at,...await ops.core.crypto.decrypt(r.difference_ciphertext,`${campaign}:${claim.id}:${r.id}:mailing:${r.key_version}`,r.key_version)});
 return {mailing:mailingFromContact(contact),profileVersion:d.profile_version,needsPaper:Boolean(contact.documentPreferences?.paperThankYou||contact.documentPreferences?.materialProof),history:ops.acceptanceMode&&!ctx.nx?[]:history};
}
export async function directRoute(ops,campaign,path,body,request){
 if(path==='/direct/adopt')return directAdopt(ops,campaign,body);
 if(path==='/direct/login')return directLogin(ops,campaign,body);
 const credentials=cookieCredentials(request,Boolean(ops.acceptanceMode));
 if(path==='/direct/claims')return {data:await directOwnerClaims(ops,campaign,credentials)};
 if(path==='/direct/logout'){const owner=await ops.owner(campaign,credentials);await ops.core.statement('UPDATE OwnerAccess SET revoked_at=unixepoch() WHERE id=?',owner.id).run();await ops.core.statement("INSERT INTO PlatformAudit(id,campaign_id,actor_id,actor_name,unit_id,action,resource_id,result) VALUES(?,?,?,'認領者','public','auth.logout',?,'success')",crypto.randomUUID(),campaign,owner.portal_id,owner.portal_id).run();return {data:{revoked:true},session:null};}
 if(path==='/direct/cancel')return {data:await ops.ownerCancel(campaign,{credentials,claimId:body.claimId})};
 throw new ApiError('NOT_FOUND',404);
}
export const directPostalData=()=>({metadata:postalMetadata,areas:postalAreas});
