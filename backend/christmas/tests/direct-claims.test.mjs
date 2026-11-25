import test from 'node:test';
import assert from 'node:assert/strict';
import {unitFixture,admin,units} from './unit-fixture.mjs';
import {directAdopt,directLogin,directOwnerClaims,resetPin,mailingCorrection,getPrivacy} from '../src/direct-claims.mjs';
import {contentEditor,phoneSearch,campaignSettings,paperDocuments,caseDetail,exportMailingList} from '../src/case-workspace.mjs';
import {christmasContent,donationInvoiceNotice,participationSteps} from '../../../js/data/christmas-content.js';
import {wishCard} from '../../../js/pages/christmas-direct.js';
import {information} from '../../../js/pages/christmas.js';
import {createLocalApi} from '../src/local-api.mjs';
import {postalAreas} from '../src/postal-areas.mjs';
import {validateClaim} from '../src/validation.mjs';
import {normalizeContactPhone} from '../src/contact-rules.mjs';
const key=()=>crypto.randomUUID();
// Check the public contract, not incidental digit sequences in IDs or dates.
function assertPublicClaimCards(cards,contacts){
 const types={publicCode:'string',publicNickname:'string',giftName:'string',description:'string',specifications:'string',claimedAt:'number',giftDueAt:'number',claimId:'string',status:'string',version:'number',thankStatus:'string',proofStatus:'string',caseClosed:'boolean',caseVersion:'number',displayStage:'string',originalGiftDueAt:'number',snapshotOrigin:'string'};
 const forbidden=new Set(['contact','email','address','phone','displayName','parties','recipientName','postalAddress','postalStreet','postalCode','ciphertext','child_alias','pin','pin_hash','salt','secret','capability_hash']);
 const privateValues=contacts.flatMap(c=>Object.entries({email:c.address,donorName:c.displayName,phone:c.phone,phoneBase:normalizeContactPhone(c.phone)?.base,recipientName:c.parties?.recipient,postalStreet:c.postalStreet,postalAddress:c.postalAddress}).filter(([,value])=>typeof value==='string'&&value.length>0));
 assert.ok(Array.isArray(cards),'public claims: expected an array');
 for(const [index,card]of cards.entries()){
  assert.ok(card&&typeof card==='object'&&!Array.isArray(card),`card[${index}]: expected an object`);
  for(const field of Object.keys(card)){
   assert.ok(!forbidden.has(field),`card[${index}].${field}: forbidden private field`);
   assert.ok(Object.hasOwn(types,field),`card[${index}].${field}: field outside public allowlist`);
  }
  for(const [field,type]of Object.entries(types)){
   const value=card[field],where=`card[${index}].${field}`;
   assert.ok(typeof value===type,`${where}: public field type`);
   if(type==='string')for(const [check,privateValue]of privateValues)assert.ok(!value.includes(privateValue),`${where}: private ${check} value present`);
  }
 }
}
export async function directFixture(engine='SQLite',count=8){
 const f=await unitFixture(engine,count,{publicCodes:true}),o=f.operations;o.caseMode=true;o.manualMode=true;o.directMode=true;
 await f.core.statement("UPDATE CampaignOperatingRules SET direct_claims=1 WHERE campaign_id='campaign1'").run();
 const content={...structuredClone(christmasContent),steps:structuredClone(participationSteps),privacyStatement:{title:'本機測試隱私權聲明',body:'本機合成資料僅供測試認領、交接與紙本寄送功能，正式活動須由 NXSPACE 審閱及發布適用聲明。'}};
 await contentEditor(o,'campaign1',{action:'save',expectedVersion:0,content},admin);
 await contentEditor(o,'campaign1',{action:'publish',expectedVersion:1,expectedPublishedVersion:0},admin);
 return {...f,content};
}
export function directInput(f,n,email='donor@example.invalid',pin='0012',paper=false){
 const claim=f.input(n);delete claim.verificationProof;delete claim.challengeToken;
 claim.consentVersion='privacy-1';claim.contact={channel:'email',address:email,displayName:'合成測試認領者',phone:'(089) 123-456 分機 12',deliveryMethod:'dropoff',documentPreferences:{paperThankYou:paper,materialProof:paper,electronicThankYou:false,electronicProof:false},...(paper?{parties:{recipient:'合成測試收件人'},postalCity:'臺東縣',postalDistrict:'臺東市',postalCode:'950',postalStreet:'合成路一號',postalAddress:'臺東縣臺東市合成路一號'}:{})};return {claim,pin,pinConfirm:pin};
}
for(const engine of ['SQLite','D1'])test(engine+': Package28 direct claims',async t=>{
 const f=await directFixture(engine),o=f.operations,c='campaign1';let first,second;
 try{
  await t.test('official postal coverage and conditional mandatory data',()=>{
   assert.equal(new Set(postalAreas.map(a=>a.city)).size,22);assert.equal(postalAreas.length,371);assert.equal(postalAreas.filter(a=>a.special).length,3);
   for(const phone of ['089-123456','0912 345 678','+1 (202) 555-0123 ext 12']){const b=directInput(f,1);b.claim.contact.phone=phone;validateClaim(b.claim,{operations:true,direct:true});}
   for(const phone of ['', '---','11111111']){const b=directInput(f,1);b.claim.contact.phone=phone;assert.throws(()=>validateClaim(b.claim,{operations:true,direct:true}));}
   const b=directInput(f,1,undefined,undefined,true);for(const k of ['postalCity','postalDistrict','postalCode','postalStreet']){const x=structuredClone(b.claim);delete x.contact[k];assert.throws(()=>validateClaim(x,{operations:true,direct:true}));}
  });
  await t.test('direct adoption creates PIN and immutable consent without Email',async()=>{
   first=await directAdopt(o,c,directInput(f,1,undefined,undefined,true));assert.ok(first.data.card.description);assert.ok(first.data.card.specifications!==undefined);
   assert.equal(first.data.card.snapshotOrigin,'claim_time');assert.equal(f.email.outbox.length,0);assert.equal(f.email.previews.length,0);
   const d=await f.core.statement('SELECT verified_at,verification_method FROM DonorContacts').first();assert.equal(d.verified_at,0);assert.equal(d.verification_method,'self_reported');
   assert.equal((await f.core.statement('SELECT privacy_version FROM ClaimPrivacyAcceptances').first()).privacy_version,'privacy-1');
   const p=await f.core.statement('SELECT * FROM DonorPins').first();assert.equal(p.pin_hash.length,64);assert.equal(p.salt.length,32);assert.equal(p.iterations,100000);assert.notEqual(p.pin_hash,'0012');
  });
  await t.test('PIN leading zero, one email account, multiple claims and generic conflict',async()=>{
   const login=await directLogin(o,c,{email:'DONOR@example.invalid',pin:'0012'});assert.equal((await directOwnerClaims(o,c,login.session)).length,1);
   await assert.rejects(directAdopt(o,c,directInput(f,2,undefined,'9999')),e=>e.code==='PIN_AUTH_FAILED');
   second=await directAdopt(o,c,directInput(f,2));assert.equal((await directOwnerClaims(o,c,second.session)).length,2);
   assert.equal((await f.core.statement('SELECT count(*) n FROM DonorPortals').first()).n,1);
   const rows=await directOwnerClaims(o,c,second.session),contacts=[directInput(f,1,undefined,undefined,true).claim.contact,directInput(f,2).claim.contact];
   assertPublicClaimCards(rows,contacts);
   assert.ok(wishCard(first.data.card,{}, {success:true}).includes(donationInvoiceNotice));
   assert.ok(wishCard(rows.find(row=>row.claimId===first.data.claimId)).includes(donationInvoiceNotice));
   assert.ok(!wishCard(second.data.card,{}, {success:true}).includes(donationInvoiceNotice));
   assert.ok(!wishCard({...second.data.card,thankStatus:'preparing'}).includes(donationInvoiceNotice));
   assert.ok(information({...f.content,faq:[]},{seasonal:true}).includes(donationInvoiceNotice));
   // A legitimate UUID containing 089 must pass; leaked full values/fields must fail.
   const collision={...rows[0],claimId:'00000000-0089-4000-8000-000000000000'};
   assertPublicClaimCards([collision],contacts);
   for(const [field,value]of [['phone','089-123456'],['email',contacts[0].address],['pin','0012']])assert.throws(()=>assertPublicClaimCards([{...collision,[field]:value}],contacts),/forbidden private field/);
   for(const [check,value]of [['email',contacts[0].address],['phone',contacts[0].phone],['phoneBase','089123456'],['postalStreet',contacts[0].postalStreet]])assert.throws(()=>assertPublicClaimCards([{...collision,description:value}],contacts),new RegExp('private '+check+' value present'));
   const mobile={...contacts[0],phone:'0912 345 678'};
   assertPublicClaimCards([collision],[mobile]);
   assert.throws(()=>assertPublicClaimCards([{...collision,description:mobile.phone}],[mobile]),/private phone value present/);
   const stored=await f.core.statement('SELECT id,ciphertext,key_version FROM DonorContacts WHERE id=(SELECT donor_contact_id FROM Claims WHERE id=?)',first.data.claimId).first();
   const contact=await f.core.crypto.decrypt(stored.ciphertext,`${c}:${stored.id}:${stored.key_version}`,stored.key_version);
   assert.ok(typeof contact.phone==='string'&&contact.phone===contacts[0].phone,'stored phone: preserve original text including leading zero');
  });
  await t.test('duplicate wish and concurrent claims fail without orphan accounts',async()=>{
   await assert.rejects(directAdopt(o,c,directInput(f,1,'other@example.invalid')),e=>e.status===409);
   const race=await Promise.allSettled([directAdopt(o,c,directInput(f,3,'race-a@example.invalid')),directAdopt(o,c,directInput(f,3,'race-b@example.invalid'))]);assert.equal(race.filter(r=>r.status==='fulfilled').length,1);
   assert.equal((await f.core.statement('SELECT count(*) n FROM DonorPortals').first()).n,2);
  });
  await t.test('wish edits do not silently change adopted card',async()=>{
   const before=await directOwnerClaims(o,c,first.session);await assert.rejects(f.core.statement("UPDATE Wishes SET description='編輯後的公開敘述' WHERE public_code=?",first.data.card.publicCode).run(),/CLAIMED_CONTENT_IMMUTABLE/);assert.deepEqual(await directOwnerClaims(o,c,first.session),before);
   await assert.rejects(f.core.statement('UPDATE ClaimPublicSnapshots SET payload=payload').run());await assert.rejects(f.core.statement('DELETE FROM ClaimPrivacyAcceptances').run());
  });
  await t.test('mailing correction requires scoped staff, reason, CAS and encrypted history',async()=>{
   const read={action:'read',claimId:first.data.claimId,reason:'核對紙本寄送資料'};await assert.rejects(mailingCorrection(o,c,read,units.miller),e=>e.status===403);
   const request={action:'read',claimId:first.data.claimId};
   const current=await mailingCorrection(o,c,read,units.bookhouse),mailing={...current.mailing,postalStreet:'合成路二號'};delete mailing.postalAddress;
   assert.deepEqual((await mailingCorrection(o,c,request,admin)).mailing,current.mailing);
   assert.ok((await o.contactProfile(c,{claimId:request.claimId},admin)).contactName);
   const audit=(await f.core.statement("SELECT action,occurred_at,reference FROM UnitActions WHERE actor_id=? AND resource_id=? AND action IN ('contact.business_read','contact.mailing_read')",'admin001',request.claimId).all()).results;
   assert.deepEqual(audit.map(row=>row.action).sort(),['contact.business_read','contact.mailing_read']);
   assert.ok(audit.every(row=>row.occurred_at&&!row.reference.includes(current.mailing.recipientName)));
   await assert.rejects(mailingCorrection(o,c,request,units.bookhouse),e=>e.code==='BUSINESS_REASON_REQUIRED');
   await assert.rejects(mailingCorrection(o,c,request,units.miller),e=>e.status===403);
   await assert.rejects(mailingCorrection(o,c,{...request,action:'save',mailing,expectedVersion:current.profileVersion},admin,key()),e=>e.code==='BUSINESS_REASON_REQUIRED');
   await mailingCorrection(o,c,{...read,action:'save',mailing,expectedVersion:current.profileVersion},admin,key());
   await assert.rejects(mailingCorrection(o,c,{...read,action:'save',mailing,expectedVersion:current.profileVersion},admin,key()),e=>e.status===409);
   const updated=await mailingCorrection(o,c,read,units.bookhouse);assert.equal(updated.history.length,1);assert.equal(updated.history[0].actorId,'admin001');assert.equal(updated.history[0].after.postalStreet,'合成路二號');
   assert.ok(!JSON.stringify(await f.core.statement('SELECT * FROM MailingCorrections').all()).includes('合成路二號'));
   assert.equal((await phoneSearch(o,c,{phone:'089-123456'},units.miller)).length,3);
  });
  await t.test('API cookies, logout and no public profile or obsolete Email routes',async()=>{
   const origin='http://127.0.0.1:9997',api=createLocalApi({repository:f.core,origin,rateLimit:async()=>true});
   const request=(path,body,cookie)=>api.fetch(new Request(origin+'/public/campaigns/'+c+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)}));
   const response=await request('/direct/login',{email:'donor@example.invalid',pin:'0012'});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly; SameSite=Strict/);assert.ok(!JSON.stringify(await response.json()).includes('secret'));
   assert.equal((await request('/direct/claims',{},cookie)).status,200);assert.equal((await request('/direct/logout',{},cookie)).status,200);assert.equal((await request('/direct/claims',{},cookie)).status,403);
   for(const route of ['/email/challenge','/email/adopt','/owner/profile','/owner/profile/save','/owner/password/login','/owner/recovery/request'])assert.equal((await request(route,{})).status,403);
  });
  await t.test('unknown and wrong PIN generic; fifth failure locks; NX verified reset revokes sessions',async()=>{
   await f.core.statement('UPDATE PinAttemptWindows SET window_start=unixepoch()-90000').run();
   for(const email of ['missing@example.invalid','donor@example.invalid'])for(let i=0;i<5;i++)await assert.rejects(directLogin(o,c,{email,pin:'9876'}),e=>e.code==='PIN_AUTH_FAILED');
   await assert.rejects(directLogin(o,c,{email:'donor@example.invalid',pin:'0012'}),e=>e.status===429);
   const input={claimId:first.data.claimId,pin:'0042',pinConfirm:'0042',identityMethod:'phone_and_record',reference:'合成身分核對及認領記錄已確認',identityConfirmed:true};
   await assert.rejects(resetPin(o,c,input,units.bookhouse,key()),e=>e.status===403);await assert.rejects(resetPin(o,c,{...input,identityConfirmed:false},admin,key()));
   await resetPin(o,c,input,admin,key());await assert.rejects(directOwnerClaims(o,c,first.session));
   await assert.rejects(directLogin(o,c,{email:'donor@example.invalid',pin:'0012'}),e=>e.code==='PIN_AUTH_FAILED');assert.ok((await directLogin(o,c,{email:'donor@example.invalid',pin:'0042'})).session);
   const event=await f.core.statement('SELECT * FROM PinResetEvents').first();assert.equal(event.actor_id,'admin001');assert.ok(!JSON.stringify(event).includes(input.reference));
  });
  await t.test('privacy publication versions do not overwrite historical acceptance',async()=>{
   await contentEditor(o,c,{action:'save',expectedVersion:1,content:{...f.content,privacyStatement:{title:'新版聲明',body:'新版合成測試聲明內容'}}},admin);await contentEditor(o,c,{action:'publish',expectedVersion:2,expectedPublishedVersion:1},admin);
   assert.equal((await getPrivacy(o,c)).version,'privacy-2');assert.equal((await f.core.statement('SELECT privacy_version FROM ClaimPrivacyAcceptances WHERE claim_id=?',first.data.claimId).first()).privacy_version,'privacy-1');
   assert.equal((await f.core.statement('SELECT count(*) n FROM PrivacyStatements').first()).n,2);assert.deepEqual((await f.core.statement('PRAGMA foreign_key_check').all()).results,[]);
  });
  await t.test('NX-151 review, direct adoption, receipt, handoff, delivery and immutable postal dispatch',async()=>{
   const campaign=await f.core.campaign(c),wish=await o.saveWish(c,{expectedVersion:0,organisationId:'org00001',publicCode:'NX-151',publicNickname:'合成孩子',ageBand:'6-9',title:'棒球手套',giftName:'棒球手套',description:'希望可以獲得棒球手套。',specifications:'道奇隊的、藍色、L 號。',claimDueAt:campaign.claim_deadline_at,giftDueAt:campaign.gift_due_at,publicationStatus:'draft'},units.bookhouse,key());
   assert.ok(!(await f.experience.wishes(c)).some(w=>w.public_code==='NX-151'));await o.submitWish(c,{wishId:wish.wishId,expectedVersion:wish.version},units.bookhouse,key());const p=(await o.proposals(c,admin)).find(p=>p.wish_id===wish.wishId&&p.status==='pending');await o.reviewProposal(c,{proposalId:p.id,decision:'approved'},admin,key());assert.ok((await f.experience.wishes(c)).some(w=>w.public_code==='NX-151'));
   const input=directInput(f,1,'nx151@example.invalid','0098',true);input.claim.wishId='NX-151';input.claim.consentVersion=(await getPrivacy(o,c)).version;
   const adoption=await directAdopt(o,c,input),id=adoption.data.claimId;assert.equal(adoption.data.card.specifications,'道奇隊的、藍色、L 號。');
   await assert.rejects(o.fulfill(c,{kind:'receipt',payload:{claimId:id,wishCode:'NX-151',expectedVersion:0,quantity:1,manuallyConfirmed:true}},units.bookhouse,key()));
   await o.fulfill(c,{kind:'receipt',payload:{claimId:id,wishCode:'NX-151',expectedVersion:0,quantity:1,manuallyConfirmed:true}},units.miller,key());
   await assert.rejects(o.claimScope(c,id,units.cama));
   await o.fulfill(c,{kind:'batch',payload:{organisationId:'org00001',items:[{claimId:id,expectedVersion:1}],locationCode:'site_miller',plannedAt:0,note:''}},units.miller,key());const batch=await f.core.statement('SELECT b.* FROM HandoffBatches b JOIN HandoffBatchItems i ON i.batch_id=b.id WHERE i.claim_id=?',id).first();
   await o.fulfill(c,{kind:'accept',payload:{batchId:batch.id,expectedVersion:0,handedAt:Math.floor(Date.now()/1000),receivedQuantity:1,checkedItems:[id]}},units.bookhouse,key());
   await o.fulfill(c,{kind:'delivery',payload:{claimId:id,expectedVersion:2,handoffId:batch.id,deliveredAt:Math.floor(Date.now()/1000),manuallyConfirmed:true,note:'合成測試送達'}},units.bookhouse,key());
   let documents=await f.core.statement('SELECT version FROM CaseFiles WHERE claim_id=?',id).first();const dispatch={claimId:id,expectedVersion:documents.version,documents:['thanks','proof'],nextStatus:'ready_to_send',completedAt:Math.floor(Date.now()/1000),deliveryMethod:'postal',note:'合成文件'};
   await paperDocuments(o,c,dispatch,units.bookhouse,key());documents=await f.core.statement('SELECT version FROM CaseFiles WHERE claim_id=?',id).first();await paperDocuments(o,c,{...dispatch,expectedVersion:documents.version,nextStatus:'sent',documents:['thanks']},units.bookhouse,key());
   const read={action:'read',claimId:id,reason:'核對已寄送地址'},before=await mailingCorrection(o,c,read,admin),mailing={...before.mailing,postalStreet:'合成新地址三號'};delete mailing.postalAddress;await mailingCorrection(o,c,{...read,action:'save',expectedVersion:before.profileVersion,mailing},units.bookhouse,key());
   documents=await f.core.statement('SELECT version FROM CaseFiles WHERE claim_id=?',id).first();await paperDocuments(o,c,{...dispatch,expectedVersion:documents.version,nextStatus:'sent',documents:['proof']},units.bookhouse,key());
   const corrected=await mailingCorrection(o,c,read,admin);await mailingCorrection(o,c,{...read,action:'save',expectedVersion:corrected.profileVersion,mailing:{...mailing,postalStreet:'合成第三次地址四號'}},admin,key());
   const detail=await caseDetail(o,c,{wishId:wish.wishId},units.bookhouse);assert.equal(detail.paperHistory.filter(e=>e.nextStatus==='sent').length,2);assert.deepEqual(new Set(detail.paperHistory.filter(e=>e.nextStatus==='sent').map(e=>e.mailingSnapshot.postalStreet)),new Set(['合成路一號','合成新地址三號']));
   const exported=await exportMailingList(o,c,{documentType:'all',dispatch:'sent',merged:false},units.bookhouse),xlsx=Buffer.from(exported.dataBase64,'base64').toString('utf8');assert.ok(xlsx.includes('合成路一號'));assert.ok(xlsx.includes('合成新地址三號'));assert.ok(!xlsx.includes('合成第三次地址四號'));assert.equal(exported.count,2);assert.ok(xlsx.includes('本列寄送文件'));for(const label of ['縣市','鄉鎮市區','詳細寄送地址','950'])assert.ok(xlsx.includes(label));
   const bytes=Buffer.from(exported.dataBase64,'base64');let offset=0,sheet='';while(bytes.readUInt32LE(offset)===0x04034b50){const size=bytes.readUInt32LE(offset+18),nameLength=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28),name=bytes.subarray(offset+30,offset+30+nameLength).toString(),start=offset+30+nameLength+extra;if(name==='xl/worksheets/sheet1.xml')sheet=bytes.subarray(start,start+size).toString();offset=start+size;}for(const cell of ['F2','G2','F3','G3'])assert.match(sheet,new RegExp('<c r="'+cell+'"[^>]*>.*?<t[^>]*>是</t>'));
   const login=await directLogin(o,c,{email:'nx151@example.invalid',pin:'0098'}),cards=await directOwnerClaims(o,c,login.session);assert.equal(cards.length,1);assert.equal(cards[0].status,'delivered');assert.equal(cards[0].proofStatus,'sent');assert.equal(cards[0].giftDueAt,adoption.data.card.giftDueAt);assert.equal(f.email.previews.length,0);
  });
  await t.test('direct settings save needs no impact acknowledgement and retains existing deadlines',async()=>{
   const before=await campaignSettings(o,c,null,admin),promised=(await f.core.statement('SELECT id,gift_due_at FROM Claims ORDER BY id').all()).results;
   await assert.rejects(campaignSettings(o,c,{action:'save',expectedVersion:before.version,settings:{...before.settings,giftDueAt:before.settings.opensAt-1}},admin));
   await campaignSettings(o,c,{action:'save',expectedVersion:before.version,settings:{...before.settings,title:'合成活動日期調整',giftDueAt:before.settings.giftDueAt+86400,expectedDeliveryAt:before.settings.expectedDeliveryAt+86400}},admin);
   assert.deepEqual((await f.core.statement('SELECT id,gift_due_at FROM Claims ORDER BY id').all()).results,promised);const change=await f.core.statement('SELECT actor_id,payload FROM CampaignSettingChanges ORDER BY version DESC LIMIT 1').first();assert.equal(change.actor_id,'admin001');assert.ok(JSON.parse(change.payload).before&&JSON.parse(change.payload).after);
  });
  await t.test('new claims use changed final dates while the previous promise is retained',async()=>{
   const late=await directFixture(engine,2);try{
    const ops=late.operations,at=Math.floor(Date.now()/1000),final=at+2*86400;
    await late.core.statement('UPDATE Campaigns SET closes_at=?,claim_deadline_at=?,gift_due_at=? WHERE id=?',at+86400,at+86400,final,c).run();
    const first=await directAdopt(ops,c,directInput(late,1));assert.equal(first.data.card.giftDueAt,final);
    const record=await campaignSettings(ops,c,null,admin);await campaignSettings(ops,c,{action:'save',expectedVersion:record.version,settings:{...record.settings,closesAt:at+8*86400,claimDeadlineAt:at+8*86400,giftDueAt:at+9*86400,expectedDeliveryAt:at+10*86400}},admin);
    const next=await directAdopt(ops,c,directInput(late,2));assert.ok(next.data.card.giftDueAt>final);assert.equal((await directOwnerClaims(ops,c,first.session)).find(r=>r.claimId===first.data.claimId).giftDueAt,final);
   }finally{await late.close();}
  });
  await t.test('ambiguous historical email identities fail closed without merging records',async()=>{
   const crypt=f.core.crypto,collision='b'.repeat(64);
   await f.core.statement('INSERT INTO DonorPortals(id,campaign_id,email_hash,key_version) VALUES(?,?,?,?)',key(),c,collision,'collision-test').run();
   f.core.crypto={...crypt,fingerprint:(value,version)=>version==='collision-test'&&value.email?Promise.resolve(collision):crypt.fingerprint(value,version)};
   try{await assert.rejects(directLogin(o,c,{email:'donor@example.invalid',pin:'0042'}),e=>e.code==='PIN_AUTH_FAILED');}finally{f.core.crypto=crypt;}
  });
 }finally{await f.close();}
});
