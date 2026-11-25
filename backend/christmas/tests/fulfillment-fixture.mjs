import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { SQLiteAdapter } from './sqlite-adapter.mjs';
import { migrationStatements } from './migration-loader.mjs';
import { ChristmasRepository } from '../src/repository.mjs';
import { createCrypto, digest, generateClaimSecret } from '../src/crypto.mjs';
import { FulfillmentRepository, createPrivateEvidenceService } from '../src/fulfillment.mjs';

export const nx = { verified: true, issuer: 'urn:synthetic', subject: 'synthetic-staff' };
export const partner = { verified: true, issuer: 'urn:synthetic', subject: 'synthetic-partner-one' };
export const otherPartner = { verified: true, issuer: 'urn:synthetic', subject: 'synthetic-partner-two' };
export async function fulfillmentFixture(engine, number = 2, inWorker = false, publicCodePrefix = 'SYNTH-') {
  let native, runtime;
  if (engine === 'D1') {
    const { Miniflare, convertV4MiniflareOptions } = createRequire(import.meta.url)(process.env.NXSPACE_MINIFLARE_MODULE);
    const root=fileURLToPath(new URL('../src/',import.meta.url));
    // Test-only identity/intent adapters; Access JWT was independently tested
    // in 21B-2. This virtual entry is never saved as a deployment source.
    const entry=`import {ChristmasRepository} from './repository.mjs';import {FulfillmentRepository} from './fulfillment.mjs';import {createCrypto,digest} from './crypto.mjs';import {createSecuredLocalApi} from './security.mjs';
      let crypt;
      export default {async fetch(request,env){crypt ||= createCrypto({encryptionKey:crypto.getRandomValues(new Uint8Array(32)),requestKey:crypto.getRandomValues(new Uint8Array(32)),keyVersion:'synthetic-worker'});
      const service=await crypt,repository=new ChristmasRepository(env.DB,service),fulfillment=new FulfillmentRepository(repository);
      return createSecuredLocalApi({repository,fulfillment,rateLimit:async()=>true,verifyAccess:async req=>({'synthetic-nx':{verified:true,issuer:'urn:synthetic',subject:'synthetic-staff'},'synthetic-partner':{verified:true,issuer:'urn:synthetic',subject:'synthetic-partner-one'}}[req.headers.get('Cf-Access-Jwt-Assertion')]||null),
      verifyIntent:async(campaignId,body)=>({verified:true,expiresAt:Math.floor(Date.now()/1000)+100,requestHash:await service.fingerprint({campaignId,wishId:body.wishId,contact:body.contact,consentVersion:body.consentVersion,secretHash:await digest(body.claimSecret)})})}).fetch(request);}};`;
    const code=inWorker?{modulesRoot:root,modules:[{type:'ESModule',path:join(root,'__virtual_fulfillment_test.mjs'),contents:entry},...['operational-policy.mjs','direct-claims.mjs','contact-rules.mjs','postal-areas.mjs','repository.mjs','fulfillment.mjs','crypto.mjs','domain.mjs','validation.mjs','security.mjs','local-api.mjs','donor-password.mjs','case-workspace.mjs','platform-audit.mjs','xlsx.mjs'].map(name=>({type:'ESModule',path:join(root,name),contents:readFileSync(join(root,name),'utf8')}))]}:{modules:true,script:'export default {fetch(){return new Response(null,{status:404})}}'};
    const options = { ...code, cf: false, outboundService: () => new Response(null,{status:403}), host: '127.0.0.1', port: 0, compatibilityDate: '2026-07-30', d1Databases: ['DB'] };
    runtime = new Miniflare(convertV4MiniflareOptions?.(options) ?? options);
  } else native = new DatabaseSync(':memory:');
  const db = runtime ? await runtime.getD1Database('DB') : new SQLiteAdapter(native);
  try {
    for (const file of ['0001_initial.sql','0002_capability_rotation.sql','0003_security.sql','0004_fulfillment.sql']) {
      const sql = readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8');
      if (native) native.exec(sql); else await db.batch(migrationStatements(sql).map(s => db.prepare(s)));
    }
    await db.batch([
      db.prepare(`INSERT INTO Campaigns(id,slug,title,partner_label,status,collaboration_confirmed,privacy_version,opens_at,closes_at,claim_deadline_at,gift_due_at) VALUES('campaign1','synthetic','Synthetic','Synthetic','open',1,'test-v1',unixepoch()-100,unixepoch()+30000,unixepoch()+40000,unixepoch()+50000)`).bind(),
      db.prepare(`INSERT INTO AdminUsers(id,issuer,subject) VALUES('staff001','urn:synthetic','synthetic-staff'),('partner1','urn:synthetic','synthetic-partner-one'),('partner2','urn:synthetic','synthetic-partner-two')`).bind(),
      db.prepare(`INSERT INTO UserRoles VALUES('staff001','nx_staff','campaign1'),('partner1','partner_staff','campaign1'),('partner2','partner_staff','campaign1')`).bind(),
      db.prepare(`INSERT INTO Organisations(id,campaign_id,label) VALUES('org00001','campaign1','Synthetic one'),('org00002','campaign1','Synthetic two')`).bind(),
      db.prepare(`INSERT INTO OrganisationMembers VALUES('partner1','org00001','campaign1'),('partner2','org00002','campaign1')`).bind()
    ]);
    const crypt = await createCrypto({ encryptionKey: crypto.getRandomValues(new Uint8Array(32)), requestKey: crypto.getRandomValues(new Uint8Array(32)), keyVersion: 'synthetic-only' });
    const core = new ChristmasRepository(db, crypt), fulfillment = new FulfillmentRepository(core);
    await core.importWishes('campaign1', Array.from({length:number},(_,i) => ({publicCode:`${publicCodePrefix}${String(i+1).padStart(publicCodePrefix==='NX-'?3:4,'0')}`,childAlias:`anon-${String(i+1).padStart(4,'0')}`,ageBand:'6-9',title:'Synthetic',description:'Synthetic',giftName:'Book',category:'book',referenceAmount:500,specifications:''})), nx);
    await db.prepare("UPDATE Wishes SET publication_status='approved',organisation_id='org00001'").bind().run();
    const objects = new Map();
    const store = { async put(key,bytes,metadata) { if(objects.has(key))throw Error('No overwrite'); objects.set(key,{bytes:bytes.slice(),metadata}); }, async delete(key) { objects.delete(key); } };
    const evidence = createPrivateEvidenceService({fulfillment,store,scan:async()=> 'clean'});
    const input = (i=1) => ({wishId:`${publicCodePrefix}${String(i).padStart(publicCodePrefix==='NX-'?3:4,'0')}`,idempotencyKey:crypto.randomUUID(),claimSecret:generateClaimSecret(),contact:{channel:'email',address:'synthetic@example.invalid',displayName:'Synthetic'},consentVersion:'test-v1',verificationProof:'synthetic-proof-0000',challengeToken:'synthetic-challenge-0000'});
    const intent = async body => ({verified:true,expiresAt:Math.floor(Date.now()/1000)+100,requestHash:await crypt.fingerprint({campaignId:'campaign1',wishId:body.wishId,contact:body.contact,consentVersion:body.consentVersion,secretHash:await digest(body.claimSecret)})});
    const claim = async (i=1) => {const body=input(i);return {body,row:await core.claim('campaign1',body,await intent(body))};};
    const proof = async (claimId, actor=nx) => (await evidence.ingest('campaign1',claimId,actor,{bytes:new TextEncoder().encode('%PDF-1.4\nSynthetic non-identifying gift attestation\n%%EOF'),contentType:'application/pdf',retentionUntil:Math.floor(Date.now()/1000)+86400})).evidenceId;
    const receiptPayload = async c => ({claimId:c.row.claimId,wishCode:c.body.wishId,expectedVersion:0,evidenceId:await proof(c.row.claimId),locationCode:'test-site',quantity:1,note:''});
    const receive = async c => {const payload=await receiptPayload(c);const row=await fulfillment.execute('campaign1','receipt',payload,nx,crypto.randomUUID());return {...c,evidenceId:payload.evidenceId,receipt:row};};
    const batchPayload = claims => ({organisationId:'org00001',items:claims.map(c=>({claimId:c.row.claimId,expectedVersion:1})),plannedAt:Math.floor(Date.now()/1000)+86400,locationCode:'test-site',note:''});
    const batch = claims => fulfillment.execute('campaign1','batch',batchPayload(claims),nx,crypto.randomUUID());
    const acceptPayload = (id,quantity) => ({batchId:id,expectedVersion:0,handedAt:Math.floor(Date.now()/1000),receivedQuantity:quantity,acceptanceReference:'synthetic-acknowledgement'});
    const accept = (b,quantity=1,actor=partner) => fulfillment.execute('campaign1','accept',acceptPayload(b.resourceId,quantity),actor,crypto.randomUUID());
    const deliveryPayload = (c,b) => ({claimId:c.row.claimId,expectedVersion:2,handoffId:b.resourceId,deliveredAt:Math.floor(Date.now()/1000),evidenceId:c.evidenceId});
    const count = async table => (await db.prepare(`SELECT count(*) n FROM ${table}`).bind().first()).n;
    const failAudit = () => db.prepare("CREATE TRIGGER synthetic_audit_failure BEFORE INSERT ON AuditLogs BEGIN SELECT RAISE(ABORT,'INJECTED_AUDIT_FAILURE'); END;").bind().run();
    // Bulk TEST fixture only: prepared SQL creates synthetic claims/evidence,
    // then the exact operation INSERT runs real receipt/state/audit triggers.
    // The 150-item batch itself is created/accepted through the Repository.
    const bulkReceived = async () => {
      const campaign=await core.campaign('campaign1'),wishes=(await db.prepare('SELECT id,public_code FROM Wishes ORDER BY public_code').bind().all()).results;
      const statements=[],claims=[],bytes=new TextEncoder().encode('%PDF-1.4\nSynthetic bulk fixture attestation\n%%EOF');
      const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
      for(const wish of wishes){
        const claimId=crypto.randomUUID(),contactId=crypto.randomUUID(),attachmentId=crypto.randomUUID(),operationId=crypto.randomUUID(),objectKey=`private/${crypto.randomUUID()}`;
        const ciphertext=await crypt.encrypt({channel:'email',address:'synthetic@example.invalid',displayName:'Synthetic'},`campaign1:${contactId}:synthetic-only`);
        await store.put(objectKey,bytes,{contentType:'application/pdf',private:true});
        statements.push(db.prepare(`INSERT INTO DonorContacts(id,campaign_id,ciphertext,key_version,verified_at,consent_version,retention_until) VALUES(?,'campaign1',?,'synthetic-only',unixepoch(),'test-v1',?)`).bind(contactId,ciphertext,campaign.gift_due_at+90*86400));
        statements.push(db.prepare(`INSERT INTO Claims(id,campaign_id,wish_id,donor_contact_id,source,idempotency_hash,request_hash,capability_hash,expires_at,gift_due_at,actor_type,actor_ref,last_reason,request_key_version,capability_expires_at) VALUES(?,'campaign1',?,?,'online',?,?,?,?,?,'donor',?,'synthetic_fixture','legacy',?)`).bind(claimId,wish.id,contactId,await digest(crypto.randomUUID()),await digest(crypto.randomUUID()),await digest(generateClaimSecret()),campaign.claim_deadline_at,campaign.gift_due_at,claimId,campaign.gift_due_at+90*86400));
        statements.push(db.prepare(`INSERT INTO Attachments(id,campaign_id,claim_id,object_key,sha256,content_type,byte_size,verified_at,retention_until) VALUES(?,'campaign1',?,?,?,'application/pdf',?,unixepoch(),?)`).bind(attachmentId,claimId,objectKey,sha,bytes.length,campaign.gift_due_at+90*86400));
        const payload={claimId,wishCode:wish.public_code,expectedVersion:0,evidenceId:attachmentId,locationCode:'test-site',quantity:1,note:''};
        statements.push(db.prepare(`INSERT INTO FulfillmentOperations(id,campaign_id,actor_id,kind,idempotency_hash,request_hash,payload,result_json) VALUES(?,'campaign1','staff001','receipt',?,?,?,?)`).bind(operationId,await digest(crypto.randomUUID()),await digest(JSON.stringify({kind:'receipt',payload})),JSON.stringify(payload),JSON.stringify({operationId,resourceId:claimId,status:'gift_received'})));
        claims.push({row:{claimId},body:{wishId:wish.public_code},evidenceId:attachmentId});
      }
      await db.batch(statements);return claims;
    };
    return {db,runtime,core,fulfillment,crypt,evidence,store,objects,input,intent,claim,proof,receiptPayload,receive,batchPayload,batch,acceptPayload,accept,deliveryPayload,count,failAudit,bulkReceived,close:async()=>{if(runtime)await runtime.dispose();else native.close();}};
  } catch(error) {if(runtime)await runtime.dispose();else native.close();throw error;}
}
