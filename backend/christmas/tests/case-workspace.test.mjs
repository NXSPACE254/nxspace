import test from 'node:test';
import assert from 'node:assert/strict';
import {unitFixture,units,admin} from './unit-fixture.mjs';
import {createLocalApi} from '../src/local-api.mjs';
import {workspaceCases,caseDetail,supportEvent,phoneSearch,adminReset,contentEditor} from '../src/case-workspace.mjs';
import {generateClaimSecret} from '../src/crypto.mjs';
import {setDonorPassword,loginDonorPassword} from '../src/donor-password.mjs';
import {christmasContent,participationSteps} from '../../../js/data/christmas-content.js';
const key=()=>crypto.randomUUID();
for(const engine of ['SQLite','D1'])test(engine+': Package24 case workspace and account policy',async t=>{
 const f=await unitFixture(engine,6,{publicCodes:true}),o=f.operations,c='campaign1';o.caseMode=true;o.manualMode=true;
 const adopt=async n=>{const claim=f.input(n);claim.contact.phone='0900000000';const challenge=await o.emailChallenge(c,{purpose:'adopt',claim});const row=await o.online(c,{claim,challengeId:challenge.challengeId,code:f.email.codes.get(challenge.challengeId),portalSecret:generateClaimSecret()});return {claim,row};};
 try{
  const a=await adopt(1),b=await adopt(2),wish=(await f.core.statement('SELECT id FROM Wishes WHERE public_code=?',a.claim.wishId).first()).id;
  await t.test('confirmation uses ordinary password page; no recovery token or secret in Email',async()=>{const message=f.email.outbox[0];assert.equal(message.managementRoute,'/#christmas/manage');assert.ok(!JSON.stringify(message).includes(a.claim.claimSecret));assert.equal((await f.core.statement('SELECT count(*) n FROM OwnerRecoveryLinks').first()).n,0);});
  await t.test('case projection, shared phone matches and receiving privacy',async()=>{
   const rows=await phoneSearch(o,c,{phone:'0900-000-000'},units.miller);
   assert.equal(rows.length,2);
   for(const row of rows){
    assert.deepEqual(Object.keys(row).sort(),['claim','gift_name','id','public_code','receipt','specifications','status']);
    assert.deepEqual(Object.keys(row.claim).sort(),['id','status','version']);
    assert.equal(row.status,row.claim.status);
    assert.equal(typeof row.specifications,'string');
    assert.deepEqual(Object.keys(row.receipt).sort(),['actualSite','crossSite','originalSite']);
    assert.equal(row.receipt.crossSite,false);
   }
   await assert.rejects(phoneSearch(o,c,{phone:'0900000000'},units.bookhouse));
   await assert.rejects(caseDetail(o,c,{wishId:wish},units.miller),error=>error.code==='COLLECTION_SCOPE');
  });
  await t.test('receipt remains atomic and cross-site detail and phone disclosure are denied',async()=>{
   await o.fulfill(c,{kind:'receipt',payload:{claimId:a.row.claimId,wishCode:a.claim.wishId,expectedVersion:0,quantity:1,manuallyConfirmed:true}},units.miller,key());
   const detail=await caseDetail(o,c,{wishId:wish},units.miller);
   assert.equal(detail.active.id,a.row.claimId);
   assert.ok(!JSON.stringify(detail).includes('donor_contact_id'));
   await assert.rejects(caseDetail(o,c,{wishId:wish},units.cama),e=>e.status===403);
   const other=await phoneSearch(o,c,{phone:'0900000000'},units.cama);
   assert.equal(other.length,1);
   assert.equal(other[0].public_code,b.claim.wishId);
  });
  let topic;
  await t.test('encrypted support events keep caller, contact, outcome and cross-role resolution',async()=>{topic=key();await supportEvent(o,c,{wishId:wish,expectedVersion:0,status:'open',type:'禮物需要確認',description:'模擬問題內容',contact:'模擬聯絡紀錄',result:''},units.miller,topic);const data=await workspaceCases(o,c,admin);assert.equal(data.supportTasks.length,1);const first=(await caseDetail(o,c,{wishId:wish},admin)).issues[0];assert.equal(first.description,'模擬問題內容');await supportEvent(o,c,{wishId:wish,topicId:topic,expectedVersion:1,status:'resolved',type:first.type,description:first.description,contact:'已聯繫確認',result:'已確認禮物規格'},admin,key());const detail=await caseDetail(o,c,{wishId:wish},units.miller);assert.equal(detail.issues.at(-1).status,'resolved');assert.equal((await workspaceCases(o,c,admin)).supportTasks.length,0);const raw=await f.core.statement('SELECT * FROM CaseSupportEvents LIMIT 1').first();assert.ok(!JSON.stringify(raw).includes('模擬問題內容'));await assert.rejects(f.core.statement('DELETE FROM CaseSupportEvents').run());});
  await t.test('support audit failure rolls event back; stale update cannot overwrite',async()=>{await f.core.statement("CREATE TRIGGER fail_support BEFORE INSERT ON UnitActions WHEN NEW.action='case.support_open' BEGIN SELECT RAISE(ABORT,'TEST_FAILURE'); END;").run();await assert.rejects(supportEvent(o,c,{wishId:wish,expectedVersion:0,status:'open',type:'測試',description:'不得殘留',contact:'',result:''},admin,key()));await f.core.statement('DROP TRIGGER fail_support').run();assert.equal((await caseDetail(o,c,{wishId:wish},admin)).issues.length,2);await assert.rejects(supportEvent(o,c,{wishId:wish,topicId:topic,expectedVersion:1,status:'resolved',type:'測試',description:'過期版本',contact:'',result:'完成'},admin,key()),e=>e.status===409);});
  await t.test('phone lookup throttles by actor and stores no phone',async()=>{for(let i=0;i<10;i++)await phoneSearch(o,c,{phone:'0911111111'},admin);await assert.rejects(phoneSearch(o,c,{phone:'0911111111'},admin),e=>e.status===429);const raw=await f.core.statement('SELECT * FROM WorkspaceSearchLimits').all();assert.ok(!JSON.stringify(raw).includes('0911111111'));});
  const copy={...structuredClone(christmasContent),steps:structuredClone(participationSteps),faq:[['問題一','回答一'],['問題二','回答二']]};let draft;
  await t.test('NX-only content drafts allow FAQ count changes and publish with CAS',async()=>{for(const actor of Object.values(units))await assert.rejects(contentEditor(o,c,null,actor),e=>e.status===403);draft=await contentEditor(o,c,{action:'save',expectedVersion:0,content:copy},admin);assert.equal((await o.publicContent(c)).content,null);await assert.rejects(contentEditor(o,c,{action:'save',expectedVersion:0,content:copy},admin),e=>e.status===409);const published=await contentEditor(o,c,{action:'publish',expectedVersion:1,expectedPublishedVersion:0},admin);assert.equal(published.published.content.faq.length,2);await contentEditor(o,c,{action:'save',expectedVersion:1,content:{...copy,faq:[]}},admin);assert.equal((await o.publicContent(c)).content.faq.length,2);await contentEditor(o,c,{action:'publish',expectedVersion:2,expectedPublishedVersion:1},admin);assert.equal((await o.publicContent(c)).content.faq.length,0);});
  await t.test('publication audit failure rolls published copy and draft state back',async()=>{const before=await o.publicContent(c);await contentEditor(o,c,{action:'save',expectedVersion:2,content:copy},admin);await f.core.statement("CREATE TRIGGER fail_publish BEFORE INSERT ON UnitActions WHEN NEW.action='content.published' BEGIN SELECT RAISE(ABORT,'TEST_FAILURE'); END;").run();await assert.rejects(contentEditor(o,c,{action:'publish',expectedVersion:3,expectedPublishedVersion:before.version},admin));assert.deepEqual(await o.publicContent(c),before);await f.core.statement('DROP TRIGGER fail_publish').run();});
  const password='Original-'+key(),temporary='Temporary-'+key(),replacement='Replacement-'+key();
  await t.test('no short PIN downgrade; only NX verified reset revokes every old session',async()=>{await assert.rejects(setDonorPassword(o,c,{credentials:a.row.portal,password:'1234'}));await setDonorPassword(o,c,{credentials:a.row.portal,password});await assert.rejects(adminReset(o,c,{claimId:a.row.claimId,temporaryPassword:temporary,identityMethod:'phone_and_record',reference:'核對模擬認領紀錄'},units.bookhouse));await adminReset(o,c,{claimId:a.row.claimId,temporaryPassword:temporary,identityMethod:'phone_and_record',reference:'核對模擬認領紀錄'},admin);await assert.rejects(o.ownerClaims(c,a.row.portal));});
  await t.test('temporary password cannot read records until changed; hashes never contain plaintext',async()=>{const access=await loginDonorPassword(o,c,{email:a.claim.contact.address,password:temporary,portalSecret:generateClaimSecret()});assert.equal(access.mustChangePassword,true);delete access.mustChangePassword;await assert.rejects(o.ownerClaims(c,access),e=>e.code==='PASSWORD_CHANGE_REQUIRED');await setDonorPassword(o,c,{credentials:access,password:replacement});assert.ok((await o.ownerClaims(c,access)).length);const raw=await f.core.statement('SELECT * FROM DonorPasswords').all();assert.ok(!JSON.stringify(raw).includes(replacement));assert.deepEqual((await f.core.statement('PRAGMA foreign_key_check').all()).results,[]);});
  await t.test('support retry checks payload instead of accepting a changed request',async()=>{
   const body={wishId:wish,expectedVersion:0,status:'open',type:'禮物需要確認',description:'模擬問題內容',contact:'模擬聯絡紀錄',result:''};assert.equal((await supportEvent(o,c,body,units.miller,topic)).saved,true);await assert.rejects(supportEvent(o,c,{...body,description:'不允許不同內容'},units.miller,topic),e=>e.status===409);
  });
  await t.test('editing contact phone updates the keyed lookup without stale-number disclosure',async()=>{
   const profile=await o.contactProfile(c,{claimId:a.row.claimId},units.bookhouse);const updated=Object.fromEntries(['donorName','contactName','recipientName','phone','postalAddress','documentPreferences','deliveryMethod'].map(k=>[k,profile[k]]));updated.phone='0922222222';await o.contactProfile(c,{claimId:a.row.claimId,expectedVersion:profile.profileVersion,profile:updated},units.bookhouse,true);const changed=await phoneSearch(o,c,{phone:'0922222222'},units.miller);assert.equal(changed[0].public_code,a.claim.wishId);const old=await phoneSearch(o,c,{phone:'0900000000'},units.miller);assert.ok(old.every(r=>r.public_code!==a.claim.wishId));
  });
  await t.test('cancellation reason, release and history commit or roll back together',async()=>{
   const w=await f.core.statement('SELECT w.id,w.version FROM Wishes w JOIN Claims c ON c.wish_id=w.id WHERE c.id=?',b.row.claimId).first(),request={claimId:b.row.claimId,expectedVersion:b.row.version,expectedWishVersion:w.version,reason:'donor_cancel',note:'認領者取消，已核對模擬紀錄'},requestKey=key(),before=(await f.core.statement('SELECT count(*) n FROM CaseSupportEvents').first()).n;
   await f.core.statement("CREATE TRIGGER fail_release_note BEFORE INSERT ON UnitActions WHEN NEW.action='claim.cancelled_and_reopened' BEGIN SELECT RAISE(ABORT,'TEST_FAILURE'); END;").run();await assert.rejects(o.release(c,request,admin,requestKey));assert.equal((await f.core.statement('SELECT count(*) n FROM CaseSupportEvents').first()).n,before);assert.equal((await f.core.statement('SELECT status FROM Claims WHERE id=?',b.row.claimId).first()).status,'claimed');await f.core.statement('DROP TRIGGER fail_release_note').run();await o.release(c,request,admin,requestKey);assert.equal((await f.core.statement('SELECT count(*) n FROM CaseSupportEvents').first()).n,before+1);assert.equal((await f.core.statement('SELECT status FROM Wishes WHERE id=?',w.id).first()).status,'available');
  });
  await t.test('temporary-password sessions can log out without changing first',async()=>{
   const next='Temporary2-'+key();await adminReset(o,c,{claimId:a.row.claimId,temporaryPassword:next,identityMethod:'in_person_and_record',reference:'第二次模擬核對'},admin);const access=await loginDonorPassword(o,c,{email:a.claim.contact.address,password:next,portalSecret:generateClaimSecret()});delete access.mustChangePassword;
   const origin='http://127.0.0.1:8998',api=createLocalApi({repository:f.core,origin,rateLimit:async()=>true});const response=await api.fetch(new Request(origin+'/public/campaigns/'+c+'/owner/logout',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({credentials:access})}));assert.equal(response.status,200);await assert.rejects(o.owner(c,access,true));
  });
  await t.test('case API permits email recovery acknowledgement, rejects unverified login, assisted claiming and electronic writes',async()=>{
   const origin='http://127.0.0.1:8999',api=createLocalApi({repository:f.core,experience:f.experience,management:f.management,fulfillment:f.fulfillment,origin,authenticate:async()=>admin,rateLimit:async()=>true});
   for(const [area,path,body,status]of [['public','/owner/recovery/request',{email:'test@example.invalid'},200],['public','/owner/login',{},403],['public','/email/challenge',{purpose:'manage'},403],['admin','/ops/assist',{},403],['public','/owner/profile/save',{profile:{documentPreferences:{electronicProof:true}}},400],['admin','/ops/profile/save',{profile:{documentPreferences:{electronicThankYou:true}}},400]]){const response=await api.fetch(new Request(origin+'/'+area+'/campaigns/'+c+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));assert.equal(response.status,status,path);}
  });
 }finally{await f.close();}
});
