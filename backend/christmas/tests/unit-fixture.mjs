import {christmasEmail} from '../src/email-templates.mjs';
import {readFile} from 'node:fs/promises';
import {experienceFixture,admin} from './experience-fixture.mjs';
import {migrationStatements} from './migration-loader.mjs';
import {UnitOperations} from '../src/unit-operations.mjs';
import {ApiError} from '../src/validation.mjs';
export {admin};
export const units=Object.fromEntries(['bookhouse','miller','tree','cama'].map(name=>[name,{verified:true,issuer:'urn:synthetic',subject:`synthetic-${name}`} ]));
export async function unitFixture(engine='SQLite',number=8,options={}){
 const f=await experienceFixture(engine,number,options);
 try{
 for(const file of ['0006_unit_operations.sql','0007_simplified_operations.sql','0008_donor_password.sql','0009_manual_attestation.sql','0010_public_content.sql','0011_deadline_extension.sql','0012_case_workspace.sql','0013_campaign_workspace.sql','0014_exports_audit.sql','0015_review_workflow.sql','0016_direct_claims.sql','0017_operational_readiness.sql']){if(file==='0009_manual_attestation.sql'&&options.skipManualMigration)continue;const sql=await readFile(new URL('../migrations/'+file,import.meta.url),'utf8');if(f.db.db?.exec&&file!=='0009_manual_attestation.sql')f.db.db.exec(sql);else await f.db.batch(migrationStatements(sql).map(s=>f.db.prepare(s).bind()));}
 await f.db.batch([
 f.db.prepare("UPDATE Campaigns SET title='NXSPACE聖誕公益｜合成測試',partner_label='孩子的書屋、米勒髮廊、大樹髮廊、NX SPACE；CAMA台東鐵花村店收件據點' WHERE id='campaign1'").bind(),
 f.db.prepare("UPDATE Organisations SET label='孩子的書屋',unit_kind='bookhouse' WHERE id='org00001'").bind(),
 ...[['unit_admin','NX SPACE','admin'],['site_miller','米勒髮廊','collection'],['site_tree','大樹髮廊','collection'],['site_cama','CAMA台東鐵花村店','collection']].map(r=>f.db.prepare('INSERT INTO Organisations(id,campaign_id,label,unit_kind) VALUES(?,\'campaign1\',?,?)').bind(...r)),
 f.db.prepare("INSERT INTO CampaignOperatingRules(campaign_id,bookhouse_id,delivery_days,reminder_days) VALUES('campaign1','org00001',5,3)").bind(),
 f.db.prepare("INSERT INTO OperatingAccounts(user_id,campaign_id,organisation_id,kind) VALUES('admin001','campaign1','unit_admin','admin')").bind(),
 ...Object.keys(units).flatMap(name=>{const user=`user_${name}`,site=name==='bookhouse'?'org00001':`site_${name}`;return [f.db.prepare("INSERT INTO AdminUsers(id,issuer,subject) VALUES(?,'urn:synthetic',?)").bind(user,units[name].subject),f.db.prepare("INSERT INTO UserRoles VALUES(?,'nx_staff','campaign1')").bind(user),f.db.prepare("INSERT INTO OrganisationMembers VALUES(?,?,'campaign1')").bind(user,site),f.db.prepare("INSERT INTO OperatingAccounts(user_id,campaign_id,organisation_id,kind) VALUES(?,'campaign1',?,?)").bind(user,site,name==='bookhouse'?'bookhouse':'collection')];}),
 f.db.prepare("INSERT INTO OrganisationMembers VALUES('admin001','org00001','campaign1')").bind(),
 f.db.prepare("INSERT INTO UserRoles VALUES('admin001','partner_staff','campaign1')").bind(),
 f.db.prepare("INSERT INTO UserRoles VALUES('user_bookhouse','partner_staff','campaign1')").bind()
 ]);
 await f.db.prepare("UPDATE Campaigns SET closes_at=unixepoch()+1209600,claim_deadline_at=unixepoch()+1209600,gift_due_at=(CAST((unixepoch()+28800)/86400 AS INTEGER)+22)*86400-28801 WHERE id='campaign1'").bind().run();
 await f.db.prepare("UPDATE OperatingAccounts SET documents_export=1 WHERE kind='bookhouse'").bind().run();
 await f.db.prepare("UPDATE OperatingAccounts SET display_name='公益模擬測試'").bind().run();
 const codes=new Map(),challenges=new Map(),outbox=[],links=new Map();
 const email={codes,outbox,links,async sendLink(input){if(!input.email.endsWith('@example.invalid'))throw new ApiError('SYNTHETIC_ONLY',403);links.set(input.requestId,input.managementRoute);return true;},async challenge(input){if(!input.email.endsWith('@example.invalid'))throw new ApiError('SYNTHETIC_ONLY',403);const challengeId=crypto.randomUUID(),code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');challenges.set(challengeId,{...input,code,until:Date.now()+120000,attempts:0});codes.set(challengeId,code);return {challengeId};},async verify(input){const r=challenges.get(input.challengeId);if(!r||r.until<Date.now()||++r.attempts>5||['campaign','purpose','hash','code'].some(k=>r[k]!==input[k]))throw new ApiError('EMAIL_NOT_VERIFIED',403);challenges.delete(input.challengeId);codes.delete(input.challengeId);return {verified:true,email:r.email};},async sendConfirmation(input){outbox.push(input);return true;}};
 const previews=[],notificationKeys=new Set();
 const record=(kind,input)=>{if(!input.email.endsWith('@example.invalid'))throw new ApiError('SYNTHETIC_ONLY',403);previews.push({kind,to:input.email,...christmasEmail(kind,input),testOnly:true});};
 const challenge=email.challenge.bind(email),sendLink=email.sendLink.bind(email),confirmation=email.sendConfirmation.bind(email);
 email.previews=previews;
 email.challenge=async input=>{const r=await challenge(input);record('verification',{...input,code:codes.get(r.challengeId)});return r;};
 email.sendLink=async input=>{const r=await sendLink(input);record('recovery',input);return r;};
 email.sendConfirmation=async input=>{const r=await confirmation(input);record('confirmation',input);return r;};
 email.notify=async(kind,input,key)=>{if(notificationKeys.has(key))return false;record(kind,input);notificationKeys.add(key);return true;};
 const operations=new UnitOperations({core:f.core,management:f.management,experience:f.experience,fulfillment:f.fulfillment,email});
 return {...f,operations,email};
 }catch(error){await f.close();throw error;}
}
