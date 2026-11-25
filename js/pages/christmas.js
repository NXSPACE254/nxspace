import {christmasContent,participationSteps,donationInvoiceQuestion,donationInvoiceAnswer} from '../data/christmas-content.js';
import {initializeEmailAdoption,donorProgress} from './christmas-donor.js';
import { createChristmasApi, createClaimCredentials, confirmedClaim } from '../services/christmas-api.js';
import { escapeChristmas, christmasDate, christmasTime } from '../components/christmas-controls.js';

export { escapeChristmas, christmasDate, christmasTime };
// Display stages project the 21B state machine; they are not writable states.
export function collectionSiteMarkup(content={}){if(Array.isArray(content.collectionSites))return content.collectionSites.map(s=>'<section class="christmas-site"><h4>'+escapeChristmas(s.label)+'</h4><p>'+escapeChristmas(s.canVisit?[s.address,s.phone,campaignDateRange(s.from,s.until),s.businessHours&&"一般營業："+s.businessHours,s.hours&&"公益收件："+s.hours,s.notes].filter(Boolean).join('｜'):s.confirmed?(s.open?'目前不在開放收件日期，請先聯絡 NXSPACE。':'目前暫停收件，請勿直接前往。'):'收件資訊尚未確認，請勿直接前往；請先聯絡 NXSPACE。')+'</p></section>').join('');return ['miller','tree','cama'].map(k=>'<p>'+escapeChristmas(content[k]||'收件資訊尚未確認，請先聯絡 NXSPACE。')+'</p>').join('');}
export const christmasStages=Object.freeze({available:'待認領',claimed:'已認領，等待準備禮物／待交件',gift_received:'據點已收到禮物',handoff_pending:'正在整理及交接（待交接）',handed_over:'書屋保管中',delivered:'禮物已送達孩子手中',exception:'需要協助',cancelled:'已取消',expired:'已逾期',draft:'待簽收',accepted:'已簽收'});
export const christmasStatus=value=>christmasStages[value]||'尚未確認';
export const christmasWishStatus=w=>w.status==='gift_received'&&w.receivedLabel?w.receivedLabel+'已收件':christmasStatus(w.status);
export function recommendWish(wishes,previous='',{displayOnly=false}={}){const available=displayOnly?wishes:wishes.filter(w=>w.status==='available'&&w.canAdopt===true),other=available.filter(w=>w.public_code!==previous),pool=other.length?other:available;return pool.length?pool[crypto.getRandomValues(new Uint32Array(1))[0]%pool.length]:null;}
const esc=escapeChristmas;
export const campaignDateLabel=value=>String(value||'').replace(/(\d{4})-(\d{2})-(\d{2})/g,'$1/$2/$3');
export const campaignDateRange=(from,until)=>[from,until].filter(Boolean).map(campaignDateLabel).join(' – ');
export function campaignTitleMarkup(value){
 const title=String(value||'');
 const lines=title.includes('\n')?title.split(/\r?\n/):title.match(/^(.{1,7}?的)(.{2,10})$/u)?.slice(1)||[title];
 return lines.filter(line=>line.trim()).map(line=>esc(line.trim())).join('<br>');
}
const notice='<p class="christmas-notice"><strong>測試環境，所有認領及資料均不代表正式活動紀錄。</strong>所有資料皆為模擬資料，正式認領尚未開放。</p>';
const rules='<section class="christmas-panel"><h2>一份心願，一份親手準備的心意。</h2><p>選一張想為孩子完成的心願卡，親自準備卡片上的禮物，再交到我們的合作收件據點。接下來，孩子的書屋會協助將禮物送到孩子手中。</p></section>';
function announcementMarkup(copy){
 const {start,end,giftDeadline}=copy.announcementDates||{};
 const dates=[['活動開始',start],['活動結束',end],['禮物收件截止',giftDeadline]].filter(([,value])=>value);
 if(!copy.announcement&&!dates.length)return '';
 return '<section class="christmas-panel"><h2>活動公告</h2>'+
  (copy.announcement?'<p class="christmas-preserve">'+esc(copy.announcement)+'</p>':'')+
  (dates.length?'<dl>'+dates.map(([label,value])=>'<dt>'+label+'</dt><dd>'+esc(campaignDateLabel(value))+'</dd>').join('')+'</dl>':'')+'</section>';
}
function activityFaq(copy){
 const entries=copy.faq||[];
 const hasProof=entries.some(([question])=>question===donationInvoiceQuestion);
 return [...entries.map(([question,answer])=>[question,question===donationInvoiceQuestion?donationInvoiceAnswer:answer]),...(hasProof?[]:[[donationInvoiceQuestion,donationInvoiceAnswer]])];
}
const partnerGroups = [['organizer','主辦單位'],['co-organizer','協辦單位'],['partner','活動協力廠商']];
export function brandImageMarkup(image,base,{eager=false,className='',mobile=null}={}){
 if(!base||!image?.id)return '';
 const url=id=>esc(base+'/'+encodeURIComponent(id));
 const source=mobile?.id?`<source media="(max-width: 640px)" srcset="${url(mobile.id)}" width="${mobile.width}" height="${mobile.height}">`:'';
 const img=`<img class="${className}" src="${url(image.id)}" alt="${esc(image.alt)}" width="${image.width}" height="${image.height}" ${eager?'fetchpriority="high"':'loading="lazy" decoding="async"'} data-brand-image>`;
 return source?`<picture>${source}${img}</picture>`:img;
}
function organizationMarkup(organizations,base){
 return partnerGroups.map(([category,title])=>{
  const items=organizations.filter(org=>org.category===category&&org.enabled);
  if(!items.length)return '';
  return `<section class="p31-section p31-organizations p31-${category}"><h2>${title}</h2><div class="p31-organization-grid">${items.map(org=>{
   const links=[['官方網站',org.website],['社群',org.social]].filter(([,url])=>/^https?:\/\//i.test(url||''));
   const phone=(org.phone||'').replace(/[^0-9+]/g,'');
   return `<article>${brandImageMarkup(org.logo,base,{className:'p31-brand-logo'})}<h3>${esc(org.name)}</h3>${brandImageMarkup(org.image,base,{className:'p31-brand-photo'})}${org.description?`<p class="christmas-preserve">${esc(org.description)}</p>`:''}${org.role?`<p class="christmas-preserve">${esc(org.role)}</p>`:''}${org.contact?`<p class="christmas-preserve">${esc(org.contact)}</p>`:''}<div class="p31-site-links p31-contact-links">${links.map(([label,url])=>`<a href="${esc(url)}">${label}</a>`).join('')}${/^\+?\d{3,}$/.test(phone)?`<a href="tel:${esc(phone)}">${esc(org.phone)}</a>`:''}${org.email?`<a href="mailto:${esc(org.email)}">${esc(org.email)}</a>`:''}</div></article>`;
  }).join('')}</div></section>`;
 }).join('');
}
function seasonalInformation(copy,launch){
 const steps=[
  ['挑選心願','翻開一張卡，或瀏覽公開心願。翻卡不會保留名額。'],
  ['完成認領','填寫聯絡資料及四位數 PIN，確認送出後以系統結果為準。'],
  ['準備禮物','依心願規格準備實體禮物，並核對認領紀錄上的交件期限。'],
  ['送至合作據點','確認收件時間，出示心願編號交件；孩子的書屋會協助送達。']
 ];
 const sites=copy.collectionSites??[];
 return announcementMarkup(copy)+`<section class="p31-section"><h2>一起完成這份心意</h2><ol class="p31-steps">${steps.map(([title,body])=>`<li><h3>${title}</h3><p>${body}</p></li>`).join('')}</ol></section>
 <section class="p31-section"><h2>合作收件據點</h2><p>出發前請核對公益收件時間，並備妥心願編號。</p><div class="p31-sites">${sites.length?sites.map(site=>{
  const address=site.canVisit&&site.address;
  const phone=site.canVisit&&site.phone;
  const tel=phone&&phone.replace(/[^+0-9]/g,'');
  const detail=site.canVisit?`<dl>${site.hours?`<dt>公益收件時間</dt><dd>${esc(site.hours)}</dd>`:'<dt>公益收件時間</dt><dd>尚未公告，出發前請聯絡 NXSPACE。</dd>'}${address?`<dt>地址</dt><dd>${esc(address)}</dd>`:''}${site.businessHours?`<dt>一般營業時間</dt><dd>${esc(site.businessHours)}</dd>`:''}${site.from&&site.until?`<dt>收件期間</dt><dd>${esc(campaignDateRange(site.from,site.until))}</dd>`:''}</dl>${site.notes?`<p>${esc(site.notes)}</p>`:''}`:
   `<p>${site.confirmed&&site.open?'目前不在收件期間，請先聯絡 NXSPACE。':'目前未開放收件，請先聯絡 NXSPACE。'}</p>`;
  return `<article class="christmas-panel"><h3>${esc(site.label)}</h3>${detail}
    <div class="p31-site-links">${address?`<a href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(address)}">查看地圖</a>`:''}
    ${tel?`<a href="tel:${esc(tel)}">${esc(phone)}</a>`:site.canVisit?'<span>據點聯絡電話尚未公告</span>':''}</div></article>`;
 }).join(''):'<p>收件資訊尚未確認，請先聯絡 NXSPACE。</p>'}</div></section>
 <section class="p31-story"><h2>${esc(copy.brand?.storyTitle||'在台東，把心意送到孩子手中')}</h2><p class="christmas-preserve">${esc(copy.brand?.story||copy.partnership)}</p>${copy.brand?.slogan?`<p class="p31-partners">${esc(copy.brand.slogan)}</p>`:''}<div class="p31-story-photos">${['storyImage','treeImage','brandImage'].map(field=>brandImageMarkup(copy.brand?.[field],copy.mediaBase,{className:'p31-brand-photo'})).join('')}</div></section>
 ${organizationMarkup(copy.brand?.organizations||[],copy.mediaBase)}
 <section class="p31-section p31-faq"><h2>參與前，想先了解</h2><p>${esc(copy.attention||'請依心願規格準備禮物；本網站不提供捐款或代購。')}</p>${activityFaq(copy).map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}<p><a href="${launch?'/privacy/':'#contact'}">公益政策與聯絡資訊</a></p></section>`;
}
export function information(copy,{launch=false,seasonal=false}={}){if(seasonal)return seasonalInformation(copy,launch);return announcementMarkup(copy)+'<section class="christmas-panel"><h2>一起完成這份心意</h2><p>活動主辦：馜享空間 NXSPACE<br>公益合作：孩子的書屋<br>禮物收件合作：米勒 AVEDA、大樹 AVEDA、CAMA CAFE 台東鐵花村店</p><p>'+esc(copy.partnership)+'</p><ol class="christmas-steps">'+(copy.steps||participationSteps).map(([title,body])=>'<li><h3>'+esc(title)+'</h3><p>'+esc(body)+'</p></li>').join('')+'</ol></section><section class="christmas-panel"><h2>合作收件據點</h2>'+collectionSiteMarkup(copy)+'<p>交件時請提供認領編號，方便核對禮物。實際收件與書屋接收、交付孩子會分別記錄。</p></section><section class="christmas-panel"><h2>參與前，想先了解</h2><p>'+esc(copy.attention||'請依心願規格準備禮物，交件時提供心願編號；不收現金、不提供代購。')+'</p>'+activityFaq(copy).map(([q,a])=>'<details><summary>'+esc(q)+'</summary><p>'+esc(a)+'</p></details>').join('')+'<p>活動規則及窗口以 NXSPACE 正式公告為準。<a href="'+(launch?'/privacy/':'#contact')+'">'+(launch?'公益政策與聯絡資訊':'聯絡 NXSPACE')+'</a></p></section>';}
export function createChristmasPage({production=false}={}){return `<section class="container christmas" data-christmas><header class="christmas-hero"><p>馜享空間 NXSPACE · 聖誕心願</p><h1 data-campaign-headline>${esc(christmasContent.headline)}</h1><p data-campaign-introduction>${esc(christmasContent.introduction)}</p><button class="btn btn-primary" type="button" data-hero-random>翻開一張心願卡</button><button class="btn btn-secondary" type="button" data-hero-list>瀏覽全部心願</button><a class="btn btn-secondary" href="#christmas/manage">查詢我的認領</a></header>${production?'':notice}<div data-christmas-content role="status">正在取得活動資料…</div><div data-campaign-information>${information({...christmasContent,collectionSites:[]},{launch:production})}</div></section>`;}
export function createChristmasLookupPage(){return '<section class="container christmas" data-christmas data-owner-redirect><h1>查詢我的認領</h1><p>請使用 Email 與四位數字 PIN 查詢進度。忘記 PIN 請聯絡 NXSPACE 協助核對。</p><a class="btn btn-primary" href="#christmas/manage">前往查詢</a></section>';}
export async function displayChristmasMedia(api,container,items,{credentials=null,admin=false}={}){
  const urls=[];container.replaceChildren();
  for(const item of items){const panel=document.createElement('div');panel.className='christmas-media';const button=document.createElement('button');button.className='btn btn-secondary';button.textContent=`查看${{wish_card:'手寫心願卡',wish_image:'心願圖片',thank_you:'感謝卡',receipt_record:'物資收件紀錄',delivery_proof:'交付證明',activity_photo:'活動照片'}[item.kind]||'文件'}`;button.type='button';panel.append(button);container.append(panel);
    button.addEventListener('click',async()=>{button.disabled=true;try{const data=admin?await api.admin(`/media/${encodeURIComponent(item.id)}/content`,{}):await api.public(`/media/${encodeURIComponent(item.id)}`,credentials||undefined);if(!['image/png','image/jpeg','application/pdf'].includes(data.contentType))throw Error('附件格式不支援');const bytes=Uint8Array.from(atob(data.dataBase64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:data.contentType}));urls.push(url);if(data.contentType.startsWith('image/')){const img=document.createElement('img');img.src=url;img.alt=button.textContent;panel.append(img);}else{const link=document.createElement('a');link.href=url;link.download='nxspace-document.pdf';link.textContent='下載核准文件（物資證明不代表報稅收據）';panel.append(link);}}catch(error){const message=document.createElement('p');message.textContent=error.message||'附件不可存取';panel.append(message);}finally{button.disabled=false;}});
  }
  window.addEventListener('hashchange',()=>urls.forEach(url=>URL.revokeObjectURL(url)),{once:true});
}
function wishCard(w,c,detail=false){return `<article class="christmas-panel"><p class="christmas-code">${esc(w.public_code)} · ${esc(w.public_nickname||'匿名心願')}</p><h2>${esc(w.gift_name)}</h2><p class="wish-description">${esc(w.description)}</p><p><strong>${esc(christmasWishStatus(w))}</strong></p><p>認領期限：${esc(christmasDate(w.claim_due_at||c.claim_deadline_at))}<br>${c.delivery_days?'交件：認領後'+c.delivery_days+'個日曆日內；最終收件日：':'交件期限：'}${esc(christmasDate(w.gift_due_at||c.gift_due_at))}</p>${detail?`<h3>禮物規格與補充</h3><p>${esc(w.specifications||'請依禮物名稱準備')}</p><div data-wish-media></div>${(w.messages||[]).map(m=>`<blockquote><strong>${esc(m.nickname)}的祝福</strong><p>${esc(m.message)}</p></blockquote>`).join('')}`:`<a class="btn btn-secondary" href="#christmas/wishes/${encodeURIComponent(w.public_code)}">查看心願詳情</a>`}</article>`;}
function claimForm(){return `<button class="btn btn-primary" type="button" data-open-claim>我要認領</button><form data-claim class="christmas-panel" hidden><h2>認領這份心願</h2>${rules}<p>後端確認後才成立。請先安全保管以下私人憑證；交件方式與期限以正式公告為準。</p><label>私人憑證<textarea data-credentials readonly spellcheck="false"></textarea></label><label>姓名或稱呼<input name="displayName" required maxlength="80" autocomplete="off"></label><label>手機（本機限0900000000）<input name="address" type="tel" required pattern="[+]?[0-9]{8,15}" autocomplete="off"></label><label>Email（選填；本機使用example.invalid）<input name="email" type="email" maxlength="160" autocomplete="off"></label><label>願意公開的認領者暱稱（選填）<input name="publicNickname" maxlength="40" autocomplete="off"></label><label>給孩子的祝福（選填，請勿留個資）<textarea name="blessing" maxlength="500"></textarea></label><label><input name="publicConsent" type="checkbox">同意經人工審核後公開上述暱稱與祝福</label><label>預計交件方式<select name="deliveryMethod" required><option value="">請選擇</option><option value="dropoff">親送（地點待公告）</option><option value="shipping">寄送禮物（規則待公告）</option><option value="to_be_confirmed">待主辦單位確認</option></select></label><fieldset><legend>後續文件需求（選填，僅記錄意願，不會寄送或開立）</legend><label><input type="checkbox" name="materialProof">實物捐贈證明（不宣稱可扣抵稅額）</label><label><input type="checkbox" name="paperThankYou">紙本感謝卡</label><label><input type="checkbox" name="electronicThankYou">電子感謝卡</label><label><input type="checkbox" name="electronicProof">電子實物捐贈證明</label><p>未確認郵寄作業前不蒐集地址；捐贈人、聯絡人與收件人可不同，後續另依需要確認。</p></fieldset><label><input name="consent" type="checkbox" required>我已閱讀自行採購、不收現金、不代購、交件規則及個資使用／保存告知，僅使用合成資料測試。</label><button class="btn btn-primary">確認送出認領</button><button class="btn btn-secondary" type="button" data-recover>查詢原請求結果</button><p data-claim-result role="status" aria-live="polite"></p></form>`;}
export async function initializeChristmasPage({code}={}){
  const root=document.querySelector('[data-christmas]');if(!root||root.hasAttribute('data-owner-redirect'))return;const content=root.querySelector('[data-christmas-content]'),result=root.querySelector('[data-result]');let api;
  try{api=await createChristmasApi();}catch{if(content)content.textContent='公益服務尚未開放。';return;}if(!root.isConnected)return;
  if(api.config.caseMode){const {initializeChristmasBrowse}=await import('./christmas-browse.js');await initializeChristmasBrowse({root,api,code});return;}
  const lookup=root.querySelector('[data-lookup]');if(lookup){
    if(api.config.operatingMode){const recovery=root.querySelector('[data-recovery-request]')?.closest('details');if(recovery){recovery.hidden=true;recovery.insertAdjacentHTML('beforebegin','<p>線上認領請至<a href="#christmas/manage">Email驗證管理入口</a>。協助認領請提供私人查詢碼及另行保管的第二驗證資料（JSON的secondFactor），或洽原協助單位依核身程序查詢。</p>');}}

    lookup.addEventListener('submit',async event=>{event.preventDefault();const button=lookup.querySelector('button');button.disabled=true;result.textContent='正在查詢，尚未確認…';try{const raw=JSON.parse(new FormData(lookup).get('credentials')),credentials=raw.claimId?{claimId:raw.claimId,claimSecret:raw.claimSecret}:{idempotencyKey:raw.idempotencyKey,claimSecret:raw.claimSecret};if(raw.secondFactor)credentials.secondFactor=raw.secondFactor;const row=await api.public('/claim-results',credentials);if(!confirmedClaim(row))throw Error();result.textContent=`${christmasStatus(row.displayStage||row.status)}；交件期限：${christmasDate(row.giftDueAt)}；NX收件：${christmasTime(row.receivedAt)}；機構簽收：${christmasTime(row.handedOverAt)}；送達：${christmasTime(row.deliveredAt)}。未寄送通知。`;if(api.config.operatingMode){result.textContent=donorProgress(row);root.querySelector('[data-private-cancel]')?.remove();if(row.status==='claimed'){const cancel=document.createElement('button');cancel.type='button';cancel.dataset.privateCancel='';cancel.textContent='申請取消本次認領';result.after(cancel);cancel.addEventListener('click',async()=>{cancel.disabled=true;try{await api.public('/cancel-request',{credentials});result.textContent='已提出取消申請，須由授權人員確認；心願尚未重新開放。';}catch(e){result.textContent=e.message;cancel.disabled=false;}});}}const media=await api.public('/donor-media',credentials);await displayChristmasMedia(api,root.querySelector('[data-private-media]'),media,{credentials});}catch(error){result.textContent=error.status!==undefined?error.message:'憑證格式或結果無法確認。';}finally{button.disabled=false;}});
    let challenge=null;const request=root.querySelector('[data-recovery-request]'),complete=root.querySelector('[data-recovery-complete]'),status=root.querySelector('[data-recovery-result]');
    request.addEventListener('submit',async event=>{event.preventDefault();const b=request.querySelector('button');b.disabled=true;try{challenge=await api.public('/recovery/request',Object.fromEntries(new FormData(request)));complete.hidden=false;complete.querySelector('input').focus();status.textContent='挑戰已建立，請透過獨立驗證通道取得驗證碼。這不代表認領成功。挑戰編號：'+challenge.challengeId;}catch(error){status.textContent=error.message;}finally{b.disabled=false;}});
    complete.addEventListener('submit',async event=>{event.preventDefault();const b=complete.querySelector('button');b.disabled=true;try{const credentials=createClaimCredentials(),restored=await api.public('/recovery/complete',{challengeId:challenge.challengeId,code:new FormData(complete).get('code'),claimSecret:credentials.claimSecret});if(!restored.claimId||restored.claimSecret!==credentials.claimSecret)throw Error('恢復結果尚未確認');lookup.elements.credentials.value=JSON.stringify(restored);complete.reset();complete.hidden=true;status.textContent='驗證通過，已換發私人憑證；舊憑證失效。請自行安全保管新憑證後查詢。';}catch(error){status.textContent=error.status!==undefined?error.message:'恢復結果尚未確認。';}finally{b.disabled=false;}});return;
  }
  if(api.config.operatingMode){root.querySelector('a[href="#christmas/lookup"]')?.setAttribute('href','#christmas/manage');for(const detail of root.querySelectorAll('details'))if(detail.querySelector('summary')?.textContent.includes('逾時或遺失'))detail.querySelector('p').textContent='逾時請用原憑證查詢，不要重新認領。線上認領可由Email一次性驗證恢復私人管理入口；現場協助認領須使用私人查詢碼及第二驗證資料，或洽原協助單位依核身程序查詢。Email、電話或公開編號均不能單獨取得私人資料。';}
  if(!api.config.enabled){content.textContent='活動準備中，正式認領尚未開放。';return;}
  try{
    const [campaign,wishes,copyResult]=await Promise.all([api.public(''),api.public(`/wishes${code?'/'+encodeURIComponent(code):''}`),api.config.operatingMode?api.public('/content'):Promise.resolve(null)]);if(!root.isConnected)return;
    const copy=copyResult?.content||christmasContent;root.querySelector('[data-campaign-headline]').textContent=copy.headline;root.querySelector('[data-campaign-introduction]').textContent=copy.introduction;root.querySelector('[data-campaign-information]').innerHTML=information(copy);
    content.innerHTML=`<section class="christmas-panel"><h2>${esc(campaign.title)}</h2><p>主辦：馜享空間 NXSPACE（本機測試）｜合作資訊：${esc(campaign.partner_label)}</p></section>${code?'':`<section class="christmas-stats" aria-label="公開心願統計"><p>心願總數<strong>${wishes.length}</strong></p><p>已認領<strong>${wishes.filter(w=>!['available','cancelled','expired'].includes(w.status)).length}</strong></p><p>待認領<strong>${wishes.filter(w=>w.canAdopt).length}</strong></p></section><section class="christmas-panel"><h2>隨機遇見一個心願</h2><p>讓一份還在等待的心願，與你相遇。推薦不代表認領，也不保留名額。</p><button class="btn btn-primary" type="button" data-random>翻開一張心願卡</button><button class="btn btn-secondary" type="button" data-skip-random>略過，查看全部心願</button><div data-recommendation aria-live="polite"></div></section><section class="christmas-panel"><h2 tabindex="-1" data-list-heading>全部心願</h2><label>搜尋心願編號、禮物或公開暱稱<input type="search" data-public-search></label><label>認領狀態<select data-public-filter><option value="all">全部</option><option value="available">待認領</option><option value="claimed">已認領</option><option value="gift_received">已收件</option><option value="handed_over">機構已簽收</option><option value="delivered">已送達</option><option value="exception">異常處理中</option></select></label></section>`}<div class="christmas-grid">${wishes.map(w=>wishCard(w,campaign,Boolean(code))).join('')}</div>${code?`<p><a href="#christmas">返回列表／查看其他心願</a></p>${wishes[0]?.canAdopt?claimForm():''}`:''}`;
    root.querySelector('[data-hero-random]').addEventListener('click',()=>{if(code){location.hash='#christmas';return;}root.querySelector('[data-random]').click();root.querySelector('[data-recommendation]').scrollIntoView({block:'center'});});
    root.querySelector('[data-hero-list]').addEventListener('click',()=>{if(code){location.hash='#christmas';return;}root.querySelector('[data-list-heading]').focus();});
    if(!code){
      let previous='',recommending=false;
      root.querySelector('[data-random]').addEventListener('click',async event=>{
        if(recommending)return;recommending=true;
        const button=event.target,target=root.querySelector('[data-recommendation]');button.setAttribute('aria-busy','true');button.setAttribute('aria-disabled','true');
        try{const latest=await api.public('/wishes'),wish=recommendWish(latest,previous);if(!root.isConnected)return;previous=wish?.public_code||'';
          target.innerHTML=wish?`${wishCard(wish,campaign)}<a class="btn btn-primary" href="#christmas/wishes/${encodeURIComponent(wish.public_code)}">我要認領：先看詳情</a><p>可再看看其他心願，或略過返回列表。</p>`:'目前沒有可認領的心願。';button.textContent='再看看其他心願';target.classList.remove('is-opening');requestAnimationFrame(()=>target.classList.add('is-opening'));
        }catch(error){target.textContent=error.message||'目前無法確認可認領心願，請稍後查詢。';}finally{recommending=false;button.removeAttribute('aria-busy');button.removeAttribute('aria-disabled');}
      });
      root.querySelector('[data-skip-random]').addEventListener('click',()=>root.querySelector('[data-list-heading]').focus());
      const filter=()=>{const search=root.querySelector('[data-public-search]').value.toLowerCase(),status=root.querySelector('[data-public-filter]').value;content.querySelector('.christmas-grid').innerHTML=wishes.filter(w=>(status==='all'||w.status===status)&&`${w.public_code} ${w.public_nickname} ${w.gift_name}`.toLowerCase().includes(search)).map(w=>wishCard(w,campaign)).join('')||'<p>沒有符合條件的心願。</p>';};
      root.querySelector('[data-public-search]').addEventListener('input',filter);root.querySelector('[data-public-filter]').addEventListener('change',filter);return;
    }
    await displayChristmasMedia(api,root.querySelector('[data-wish-media]'),wishes[0]?.media||[]);
    if(api.config.operatingMode){initializeEmailAdoption({root,api,code,campaign});return;}
    const form=root.querySelector('[data-claim]');if(!form)return;root.querySelector('[data-open-claim]').addEventListener('click',()=>{form.hidden=false;form.elements.displayName.focus();});const credentials=createClaimCredentials(),output=form.querySelector('[data-claim-result]');let sent=false;form.querySelector('[data-credentials]').value=JSON.stringify(credentials);
    const show=row=>{if(!confirmedClaim(row))throw Error('INVALID_RESULT');output.textContent=`後端已確認：${christmasStatus(row.status)}。認領編號：${row.claimId}。請安全保管私人憑證；未寄送通知。`;};
    form.addEventListener('submit',async event=>{event.preventDefault();if(sent)return;const fields=new FormData(form);if(api.config.testMode&&(fields.get('address')!=='0900000000'||(fields.get('email')&&!String(fields.get('email')).endsWith('@example.invalid')))){output.textContent='本機只接受0900000000與example.invalid合成聯絡資料。';return;}sent=true;form.querySelector('button').disabled=true;output.textContent='正在送出，尚未確認認領…';try{const body={wishId:code,...credentials,contact:{channel:'phone',address:fields.get('address'),displayName:fields.get('displayName'),phone:fields.get('address'),email:fields.get('email'),publicNickname:fields.get('publicNickname'),blessing:fields.get('blessing'),publicConsent:fields.has('publicConsent'),deliveryMethod:fields.get('deliveryMethod'),documentPreferences:Object.fromEntries(['materialProof','paperThankYou','electronicThankYou','electronicProof'].map(k=>[k,fields.has(k)]))},consentVersion:api.config.consentVersion,verificationProof:api.config.verificationProof,challengeToken:api.config.challengeToken};show(await api.public('/claims',body));}catch(error){output.textContent=error.status!==undefined?error.message:'結果尚未確認，請使用原憑證查詢。';}});
    form.querySelector('[data-recover]').addEventListener('click',async event=>{event.target.disabled=true;try{show(await api.public('/claim-results',credentials));}catch(error){output.textContent=error.message;}finally{event.target.disabled=false;}});
  }catch(error){content.textContent=error.message||'活動載入失敗。';}
}
