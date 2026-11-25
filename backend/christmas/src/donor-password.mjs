import {ApiError} from './validation.mjs';
import {equalDigest} from './crypto.mjs';
const hex=a=>[...new Uint8Array(a)].map(v=>v.toString(16).padStart(2,'0')).join('');
async function hash(password,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',iterations:600000,salt:Uint8Array.from(salt.match(/../g),v=>parseInt(v,16))},key,256));}
function valid(password){if(typeof password!=='string'||password.length<12||password.length>128)throw new ApiError('PASSWORD_LENGTH_12_TO_128');}
export async function setDonorPassword(ops,campaign,{credentials,password}){
 valid(password);const owner=await ops.owner(campaign,credentials,true),salt=hex(crypto.getRandomValues(new Uint8Array(16))),passwordHash=await hash(password,salt),db=ops.core;
 await db.db.batch([db.statement('INSERT INTO DonorPasswords(portal_id,salt,password_hash,iterations) VALUES(?,?,?,600000) ON CONFLICT(portal_id) DO UPDATE SET salt=excluded.salt,password_hash=excluded.password_hash,updated_at=unixepoch()',owner.portal_id,salt,passwordHash),...(ops.caseMode?[db.statement('UPDATE DonorPasswords SET must_change=0 WHERE portal_id=?',owner.portal_id)]:[]),db.statement('UPDATE OwnerAccess SET revoked_at=unixepoch() WHERE portal_id=? AND id<>? AND revoked_at IS NULL',owner.portal_id,owner.id),db.statement("INSERT INTO DonorAuthEvents(id,portal_id,action) VALUES(?,?,'password_set')",crypto.randomUUID(),owner.portal_id)]);return {saved:true};
}
export async function loginDonorPassword(ops,campaign,{email,password,portalSecret}){
 valid(password);if(typeof email!=='string'||email.length>160||!email.includes('@'))throw new ApiError('INVALID_LOGIN',403);email=email.trim().toLowerCase();
 const db=ops.core,emailHash=await db.crypto.fingerprint({email,purpose:'password-login'});
 const attempt=await db.statement('INSERT INTO DonorLoginAttempts(campaign_id,email_hash,window_start,attempts) VALUES(?,?,unixepoch(),1) ON CONFLICT(campaign_id,email_hash) DO UPDATE SET window_start=CASE WHEN window_start<unixepoch()-900 THEN unixepoch() ELSE window_start END,attempts=CASE WHEN window_start<unixepoch()-900 THEN 1 ELSE attempts+1 END RETURNING attempts',campaign,emailHash).first();
 if(!attempt||attempt.attempts>5)throw new ApiError('LOGIN_RATE_LIMITED',429);
 const portals=(await db.statement('SELECT * FROM DonorPortals WHERE campaign_id=?',campaign).all()).results;let portal;
 for(const row of portals)if(equalDigest(row.email_hash,await db.crypto.fingerprint({email},row.key_version)))portal=row;
 const saved=portal?await db.statement('SELECT * FROM DonorPasswords WHERE portal_id=?',portal.id).first():null;
 const candidate=await hash(password,saved?.salt||'00000000000000000000000000000000');
 if(!saved||!equalDigest(saved.password_hash,candidate))throw new ApiError('INVALID_LOGIN',403);
 const access=await ops.issueAccess(portal.id,portalSecret);if(ops.caseMode)access.mustChangePassword=Boolean(saved.must_change);await db.statement("INSERT INTO DonorAuthEvents(id,portal_id,action) VALUES(?,?,'password_login')",crypto.randomUUID(),portal.id).run();return access;
}

export async function resetDonorPasswordByAdmin(ops,campaign,portalId,password,ctx,reference){
 valid(password);if(!ctx.nx)throw new ApiError('FORBIDDEN',403);const salt=hex(crypto.getRandomValues(new Uint8Array(16))),passwordHash=await hash(password,salt),db=ops.core;
 await db.db.batch([db.statement('INSERT INTO DonorPasswords(portal_id,salt,password_hash,iterations,must_change) VALUES(?,?,?,600000,1) ON CONFLICT(portal_id) DO UPDATE SET salt=excluded.salt,password_hash=excluded.password_hash,must_change=1,updated_at=unixepoch()',portalId,salt,passwordHash),db.statement('UPDATE OwnerAccess SET revoked_at=unixepoch() WHERE portal_id=?',portalId),ops.action(campaign,ctx,ctx.label,'account.password_reset',portalId,reference)]);
}
