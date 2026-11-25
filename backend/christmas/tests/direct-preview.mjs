// Local-only preview fixtures. Never imported by a production entry point.
import {christmasContent,participationSteps} from '../../../js/data/christmas-content.js';
import {contentEditor} from '../src/case-workspace.mjs';
import {admin,units} from './unit-fixture.mjs';
export async function seedDirectPreview(f,wish=null){
 const campaign='campaign1',o=f.operations;
 if(!o.directMode)throw Error('Direct preview required');
 const content={...structuredClone(christmasContent),steps:structuredClone(participationSteps),privacyStatement:{title:'NXSPACE 本機驗收用隱私權聲明',body:'此為本機合成測試聲明，僅供驗證認領、禮物交接、必要聯繫及紙本寄送功能；請勿輸入真實個人資料。正式活動的資料使用、保存期間、當事人權利及聯絡窗口，須由 NXSPACE 審閱後於後台正式發布。這份測試文字不代表正式活動聲明。'}};
 await contentEditor(o,campaign,{action:'save',expectedVersion:0,content},admin);await contentEditor(o,campaign,{action:'publish',expectedVersion:1,expectedPublishedVersion:0},admin);
 if(wish){
  const c=await f.core.campaign(campaign),created=await o.saveWish(campaign,{expectedVersion:0,organisationId:'org00001',publicCode:wish.public_code,publicNickname:wish.public_nickname,ageBand:wish.age_band,title:wish.title,giftName:wish.gift_name,description:wish.description,specifications:wish.specifications,claimDueAt:wish.claim_due_at||c.claim_deadline_at,giftDueAt:wish.gift_due_at||c.gift_due_at,publicationStatus:'draft'},units.bookhouse,crypto.randomUUID());
  await o.submitWish(campaign,{wishId:created.wishId,expectedVersion:created.version},units.bookhouse,crypto.randomUUID());const proposal=(await o.proposals(campaign,admin)).find(p=>p.wish_id===created.wishId&&p.status==='pending');await o.reviewProposal(campaign,{proposalId:proposal.id,decision:'approved'},admin,crypto.randomUUID());return created.wishId;
 }
 return null;
}
