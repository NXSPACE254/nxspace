import {escapeChristmas as esc,christmasDate,recommendWish,information,brandImageMarkup,campaignDateLabel,campaignDateRange,campaignTitleMarkup} from './christmas.js';
import {christmasContent} from '../data/christmas-content.js';
import {pageSlice,pagination,openChristmasDialog} from '../components/christmas-controls.js';
import {initializeEmailAdoption} from './christmas-donor.js';

export function progressMarkup(p){return `<section class="christmas-panel christmas-progress" aria-labelledby="christmas-progress-title"><h2 id="christmas-progress-title">陪孩子的心願，慢慢長成。</h2><p>已有 <strong>${p.claimed}</strong> 份心願被認領<br>還有 <strong>${p.remaining}</strong> 份心願等待被看見</p><label>已認領 ${p.claimed}／全部已公開 ${p.total} 份 · ${p.percentage}%<progress max="100" value="${p.percentage}">${p.percentage}%</progress></label><small>禮物將由孩子的書屋依實際安排，分批送達孩子手中。</small></section>`;}

export async function initializeChristmasBrowse({root,api,code}){
 const content=root.querySelector('[data-christmas-content]');
 if(!content){root.innerHTML='<h1>查詢我的認領</h1><p>請使用 Email 與自訂登入密碼查詢。</p><a class="btn btn-primary" href="#christmas/manage">前往查詢</a>';return;}
 const drawButton=root.querySelector('[data-hero-random]'),listButton=root.querySelector('[data-hero-list]');
 const adoptionOpen=api.config.adoption!==false;
 const adoptionNotice='民眾認領尚未開放。';
 drawButton.hidden=true;
 listButton.hidden=true;
 try{
  const [campaign,initialWishes,result,initialProgress]=await Promise.all([api.public(''),api.public('/wishes'),api.public('/content'),adoptionOpen?api.public('/progress').catch(()=>null):null]);if(!root.isConnected)return;
  let wishes=initialWishes;
  const seasonal=root.querySelector('.p31-hero');
  const dates=root.querySelector('[data-campaign-dates]');
  const currentTime=Date.now()/1000;
  const deadline=campaign.claim_deadline_at??campaign.closes_at;
  const copy={...christmasContent,...(result.collectionSites?{collectionSites:result.collectionSites}:{}),...result.content,brand:result.content?.brand||result.brand,mediaBase:api.config.baseUrl+'/public/campaigns/'+encodeURIComponent(api.config.campaignId)+'/brand-media'};
  const brand=seasonal&&copy.brand;
  const headline=root.querySelector('[data-campaign-headline]');
  headline.textContent=copy.headline;
  headline.hidden=Boolean(brand);
  root.querySelector('[data-campaign-introduction]').textContent=brand?.subtitle||copy.introduction;
  if(brand){
    const title=root.querySelector('[data-campaign-brand-title]');
    if(title)title.innerHTML=campaignTitleMarkup(brand.title);
    const tagline=root.querySelector('[data-campaign-tagline]');
    if(tagline){tagline.textContent=brand.tagline;tagline.hidden=!brand.tagline;}
    const organizers=root.querySelector('[data-campaign-organizers]');
    if(organizers){
      organizers.textContent=brand.organizations.filter(org=>org.category==='organizer'&&org.enabled).map(org=>org.name).join(' × ');
      organizers.hidden=!organizers.textContent;
    }
    const fallback=seasonal.querySelector('.p31-tree');
    const hero=brand.hero||brand.mobileHero;
    if(fallback&&hero){
      const replacement=document.createElement('div');
      replacement.className='p31-managed-hero';
      replacement.hidden=true;
      replacement.innerHTML=brandImageMarkup(hero,copy.mediaBase,{eager:true,mobile:brand.mobileHero});
      const img=replacement.querySelector('img');
      img.addEventListener('load',()=>{replacement.hidden=false;fallback.hidden=true;},{once:true});
      img.addEventListener('error',()=>replacement.remove(),{once:true});
      fallback.after(replacement);
    }
  }
  root.querySelector('[data-campaign-information]').innerHTML=information(copy,{launch:api.config.launchMode,seasonal:Boolean(seasonal)});
  root.querySelectorAll('[data-campaign-information] [data-brand-image]').forEach(img=>img.addEventListener('error',()=>img.remove(),{once:true}));
  const publicDates=copy.announcementDates;
  if(dates&&publicDates?.start&&publicDates?.end){
    dates.textContent='活動公告期間｜'+campaignDateRange(publicDates.start,publicDates.end)+(publicDates.giftDeadline?' · 公告收件截止 '+campaignDateLabel(publicDates.giftDeadline):'');
    dates.hidden=false;
  }else if(dates&&Number.isFinite(campaign.opens_at)&&Number.isFinite(campaign.closes_at)){
    dates.textContent='平台開放期間｜'+campaignDateRange(christmasDate(campaign.opens_at),christmasDate(campaign.closes_at))+(Number.isFinite(deadline)&&deadline<campaign.closes_at?' · 認領截止 '+campaignDateLabel(christmasDate(deadline)):'');
    dates.hidden=false;
  }
  const stateMessage=currentTime<campaign.opens_at?'活動尚未開始。':currentTime>=campaign.closes_at?'活動已結束，感謝每一份心意。':campaign.status!=='open'?'活動目前暫停認領。':currentTime>=deadline?'本次認領已截止。':!adoptionOpen?'目前暫停新增認領，仍可瀏覽心願。':'';
  if(stateMessage)content.insertAdjacentHTML('beforebegin','<p class="christmas-notice" role="status">'+stateMessage+'</p>');
  if(seasonal){
    listButton.textContent='瀏覽心願卡';
    drawButton.textContent=adoptionOpen?'認領一張心願卡':'翻開一張心願卡';
  }
  if(!wishes.length){
    content.removeAttribute('role');
    content.innerHTML='<section class="christmas-panel" data-list-panel><h2 tabindex="-1" data-list-heading>孩子的心願</h2><div class="p31-empty" role="status"><span aria-hidden="true">✧</span><h3>目前尚無心願卡</h3><p>等孩子的心願準備好，就會在這裡公開。謝謝你先來看看。</p></div></section>';
    drawButton.hidden=Boolean(seasonal);
    drawButton.disabled=true;
    listButton.hidden=false;
    listButton.addEventListener('click',()=>content.querySelector('[data-list-heading]').focus());
    return;
  }
  content.removeAttribute('role');content.innerHTML=`<section class="christmas-panel" data-list-panel><h2 tabindex="-1" data-list-heading>孩子的心願</h2><div class="christmas-list-tools"><label>搜尋心願編號、暱稱或禮物<input type="search" data-public-search placeholder="例如 NX-023"></label><label>認領狀態<select data-public-filter><option value="all">全部狀態</option><option value="available">尚未認領</option><option value="claimed">已認領</option></select></label></div><p role="status" data-list-count></p><div class="christmas-grid" data-wish-grid></div><div data-pagination></div></section>`;
  const progress=document.createElement('div');progress.dataset.publicProgress='';
  if(adoptionOpen){
    progress.innerHTML=initialProgress?progressMarkup(initialProgress):'<p>目前無法取得心願進度，請稍後重新整理。</p>';
    content.prepend(progress);
  }
  const refreshProgress=async()=>{if(!progress.isConnected)return;try{const p=await api.public('/progress');if(progress.isConnected)progress.innerHTML=progressMarkup(p);}catch{progress.textContent='目前無法取得心願進度，請稍後重新整理。';}};
  let page=1,previous='';const search=content.querySelector('[data-public-search]'),filter=content.querySelector('[data-public-filter]');
  const claimed=w=>['claimed','gift_received','handed_over','delivered','exception'].includes(w.status);const status=w=>claimed(w)?'已認領':w.status==='cancelled'?'已取消':w.status==='expired'?'認領已逾期':w.claim_due_at<=Date.now()/1000?'認領期限已過':w.canAdopt?'尚未認領':'目前未開放認領';
  if(!adoptionOpen)filter.closest('label').hidden=true;
  if(!seasonal)filter.value='available';
  const card=w=>`<article class="christmas-panel p31-wish"><div class="p31-wish-meta"><p class="christmas-code">${esc(w.public_code)} · ${esc(w.public_nickname||'孩子的心願')}</p><p class="p31-badge" data-available="${adoptionOpen&&w.canAdopt===true}">${esc(status(w))}</p></div><h3>${esc(w.gift_name)}</h3><p class="wish-description">${esc(w.description)}</p>${w.specifications?`<p class="p31-spec"><strong>禮物規格</strong> ${esc(w.specifications)}</p>`:''}<button class="btn ${adoptionOpen&&w.canAdopt?'btn-primary':'btn-secondary'}" type="button" data-view-wish="${esc(w.public_code)}">${adoptionOpen&&w.canAdopt?'查看並認領':'查看心願'}</button></article>`;
  const redraw=()=>{const q=search.value.trim().toLowerCase(),numeric=/^(?:nx-)?[0-9]{1,12}$/.test(q),exact=numeric&&Number(q.replace(/^nx-/,''))>0?'NX-'+String(Number(q.replace(/^nx-/,''))).padStart(3,'0'):null,rows=wishes.filter(w=>numeric?w.public_code===exact:(!adoptionOpen||filter.value==='all'||(filter.value==='available'?w.status==='available':claimed(w)))&&`${w.public_code} ${w.public_nickname} ${w.gift_name}`.toLowerCase().includes(q)),slice=pageSlice(rows,page);page=slice.page;content.querySelector('[data-wish-grid]').innerHTML=slice.rows.map(card).join('')||'<p>沒有符合條件的心願，試試其他編號或狀態。</p>';content.querySelector('[data-list-count]').textContent=(exact&&rows.some(claimed)?'已找到這份心願，目前已有愛心朋友認領。精確編號查詢不受認領篩選限制。 ':exact?'精確編號查詢不受認領篩選限制。 ':'')+`找到 ${rows.length} 份心願，每頁顯示12份。`;content.querySelector('[data-pagination]').innerHTML=pagination(slice);content.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{page=Number(b.dataset.page);redraw();content.querySelector('[data-list-heading]').focus({preventScroll:true});}));content.querySelectorAll('[data-view-wish]').forEach(b=>b.addEventListener('click',()=>showWish(b.dataset.viewWish)));};
  const allClaimed=document.createElement('p');
  allClaimed.className='p31-complete';
  allClaimed.textContent='公開的心願已全數認領。謝謝你，讓每一份期待都有了回應。';
  if(seasonal)content.querySelector('[data-list-panel]').prepend(allClaimed);
  const showCompletion=()=>{allClaimed.hidden=!(wishes.length&&wishes.every(claimed));};
  showCompletion();
  let searchTimer,searchRevision=0;
  function refreshSearch(){
   page=1;
   if(!api.config.launchMode){redraw();return;}
   const revision=++searchRevision;
   clearTimeout(searchTimer);
   content.querySelector('[data-wish-grid]').replaceChildren();
   content.querySelector('[data-pagination]').replaceChildren();
   content.querySelector('[data-list-count]').textContent='正在查詢公開心願…';
   searchTimer=setTimeout(async()=>{
    try{
     const latest=await api.public('/wishes');
     if(!root.isConnected||revision!==searchRevision)return;
     wishes=latest;
     showCompletion();
     drawButton.hidden=!drawPool(wishes).length;
     redraw();
    }catch{
     if(root.isConnected&&revision===searchRevision)content.querySelector('[data-list-count]').textContent='目前無法查詢公開心願，請稍後再試。';
    }
   },200);
  }
  search.addEventListener('input',refreshSearch);
  filter.addEventListener('change',refreshSearch);
  redraw();
  async function renderDetail(modal,w){
   modal.body.innerHTML=`<header data-wish-detail-intro><p class="christmas-code">${esc(w.public_code)} · ${esc(w.public_nickname||'孩子的心願')}</p><h2>${esc(w.gift_name)}</h2><div class="p31-detail"><p class="christmas-preserve" data-public-wish-description>${esc(w.description)}</p><p class="christmas-preserve"><strong>禮物規格</strong> ${esc(w.specifications||'請依心願內容準備禮物。')}</p><p class="p31-badge" data-available="${adoptionOpen&&w.canAdopt===true}" data-wish-detail-status>${esc(status(w))}</p><p class="p31-deadline">${Number.isSafeInteger(campaign.delivery_days)?'通常於認領後 '+esc(campaign.delivery_days)+' 日內交件。':''}${Number.isSafeInteger(campaign.gift_due_at)?' 活動收件總截止日：'+esc(christmasDate(campaign.gift_due_at))+'。':''} 個別交件期限以認領成功畫面為準。</p></div></header><div data-claim-slot>${!adoptionOpen?'<p>'+adoptionNotice+'</p>':w.canAdopt?'<button class="btn btn-primary" type="button" data-open-claim>我想認領這份心願</button><form data-claim hidden></form>':claimed(w)?'<h3>這份心願已經被認領囉！</h3><p>還有其他孩子的心願，正等待你的溫暖支持。一起讓更多聖誕心願實現吧！🎄</p><button type="button" class="btn btn-primary" data-other-wishes>看看其他心願</button>':'<p>'+esc(status(w))+'，請聯絡 NXSPACE 確認。</p>'}</div><p role="status" data-modal-status></p>`;
   modal.body.querySelector('[data-other-wishes]')?.addEventListener('click',()=>{search.value='';filter.value='available';page=1;redraw();modal.close();content.querySelector('[data-list-heading]').focus({preventScroll:true});});
   modal.body.querySelector('[data-open-claim]')?.addEventListener('click',async e=>{e.target.disabled=true;try{const latest=(await api.public('/wishes/'+encodeURIComponent(w.public_code)))[0];if(!latest?.canAdopt)throw Error('這張心願剛剛有了新的進度，請關閉視窗後再看看其他心願。');await initializeEmailAdoption({root:modal.body,api,code:w.public_code,campaign});modal.body.querySelector('[data-direct-adopt] input, [data-email-adopt] input')?.focus();}catch(error){modal.body.querySelector('[data-modal-status]').textContent=error.message;e.target.disabled=false;}});
  }
  const updateClaimed=({code})=>{const w=wishes.find(w=>w.public_code===code);if(w){w.status='claimed';w.canAdopt=false;showCompletion();drawButton.hidden=!drawPool(wishes).length;redraw();refreshProgress();}};
  async function showWish(wishCode){const modal=openChristmasDialog({title:'心願內容',onClaimed:updateClaimed,onClose:()=>content.querySelector('[data-list-heading]').focus({preventScroll:true})});modal.body.textContent='正在翻開心願…';try{const w=(await api.public('/wishes/'+encodeURIComponent(wishCode)))[0];if(!w)throw Error('找不到這張心願。');if(modal.dialog.open)await renderDetail(modal,w);}catch(error){modal.body.textContent=error.status===404?'這份心願尚未公開或已停止公開，請看看其他心願。':error.message;}}
  function flip(){const modal=openChristmasDialog({title:'翻開一張心願卡',onClaimed:updateClaimed});const back=()=>{modal.body.innerHTML='<div class="christmas-paper-back"><p>NXSPACE · 聖誕心願</p><span aria-hidden="true">✧</span><h2>一張心願，一份心意</h2><button class="btn btn-primary" type="button" data-reveal>翻開這張卡片</button></div><p>抽卡不代表完成認領，也不會保留名額。</p>';modal.body.querySelector('[data-reveal]').addEventListener('click',async e=>{e.target.disabled=true;try{const latest=await api.public('/wishes');const pool=drawPool(latest),w=recommendWish(pool,previous,{displayOnly:!adoptionOpen});if(!w){modal.body.textContent='目前沒有可翻閱的心願卡。';return;}previous=w.public_code;await renderDetail(modal,w);modal.body.classList.remove('christmas-flip-reveal');requestAnimationFrame(()=>modal.body.classList.add('christmas-flip-reveal'));const again=document.createElement('button');again.type='button';again.className='btn btn-secondary';again.textContent='再翻一張心願卡';again.dataset.flipAgain='';again.addEventListener('click',back);if(pool.some(card=>card.public_code!==w.public_code))modal.body.append(again);}catch(error){modal.body.textContent=error.message;}});};back();}
  function drawPool(rows){return adoptionOpen?rows.filter(w=>w.status==='available'&&w.canAdopt===true):rows;}
  drawButton.hidden=!drawPool(wishes).length;listButton.hidden=false;
  drawButton.addEventListener('click',flip);listButton.addEventListener('click',()=>content.querySelector('[data-list-heading]').focus());if(code)await showWish(code);
 }catch(error){content.textContent=error.message||'暫時無法載入心願，請稍後再試。';}
}
