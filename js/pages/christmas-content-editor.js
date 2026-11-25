import {mountSiteManager} from './christmas-management-tools.js';
import {rentalRules} from '../data/venue-data.js';
import {christmasContent,participationSteps} from '../data/christmas-content.js';
import {escapeChristmas as esc,information,brandImageMarkup,campaignTitleMarkup} from './christmas.js';
import {openChristmasDialog} from '../components/christmas-controls.js';
import {compressBrandImage} from '../components/brand-image-upload.js';

const brandLabels={title:'首頁品牌主標題（可按 Enter 換行）',subtitle:'副標題',tagline:'活動標語',slogan:'馜享品牌標語',storyTitle:'活動故事標題',story:'活動故事內文'};
const organizationLabels={name:'單位名稱',description:'簡介',role:'活動分工',website:'官方網站',social:'社群網站',phone:'電話',email:'電子郵件',contact:'其他公開聯絡資訊'};
const organizationGroups={'organizer':'主辦','co-organizer':'協辦','partner':'活動協力'};
const brandImages={hero:'主視覺',mobileHero:'手機版主視覺',storyImage:'活動故事照片',treeImage:'聖誕樹實景照片',brandImage:'品牌介紹圖片'};
const organizationImages={logo:'LOGO',image:'介紹圖片'};
function brandField(key,label,value){
 const maximum={story:4000,description:1200,role:1200,contact:1200,name:120,website:500,social:500,phone:60,email:160}[key]||240;
 const name=esc(key),safe=esc(value||'');
 if(['title','story','description','role','contact'].includes(key))return `<label>${label}<textarea name="${name}" maxlength="${maximum}" ${key==='title'?'required rows="2"':''}>${safe}</textarea></label>`;
 const type={website:'url',social:'url',phone:'tel',email:'email'}[key]||'text';
 return `<label>${label}<input type="${type}" name="${name}" maxlength="${maximum}" value="${safe}" ${['title','name'].includes(key)?'required':''}></label>`;
}
function mediaFields(images,record,base){
 if(!base)return '';
 return Object.entries(images).map(([key,label])=>{
  const image=record[key];
  return `<fieldset data-brand-image-field="${key}" data-image-id="${esc(image?.id||'')}" data-image-width="${image?.width||0}" data-image-height="${image?.height||0}"><legend>${label}</legend><p class="p31-field-note">${({hero:'首頁封面，建議 1:1。未設定沿用樹景。',mobileHero:'手機封面，建議 1:1。未設定沿用桌機圖片。',storyImage:'故事區，建議 4:3。',treeImage:'故事區的聖誕樹照片，建議 4:3。',brandImage:'故事區的品牌形象，建議 4:3。',logo:'單位名稱上方，保留原始比例與透明背景。',image:'單位介紹內，建議 4:3。'})[key]} JPG、PNG、WebP 原檔最多 12 MiB，壓縮後最多 2 MiB。未設定的選填圖片不顯示。</p>
  <div data-brand-image-preview>${brandImageMarkup(image,base,{className:'p31-brand-logo'})}</div>
  <label>選擇圖片<input type="file" accept="image/jpeg,image/png,image/webp" data-brand-file></label>
  <label>替代文字<input type="text" maxlength="240" value="${esc(image?.alt||'')}" data-brand-alt></label>
  <button type="button" data-brand-upload>上傳圖片</button> <button type="button" data-brand-image-remove ${image?'':'disabled'}>移除圖片</button></fieldset>`;
 }).join('');
}
function brandMarkup(brand,mediaBase){
 if(!brand)return '';
 return `<section data-copy-section="brand"><fieldset data-brand-copy><legend>活動與品牌</legend>${Object.entries(brandLabels).map(([key,label])=>brandField(key,label,brand[key])).join('')}${mediaFields(brandImages,brand,mediaBase)}</fieldset><h3>主辦、協辦與活動協力單位</h3>${brand.organizations.map((org,index)=>`<details data-org-row><summary>${brandImageMarkup(org.logo,mediaBase,{className:'p31-org-thumb'})}<span><strong>${esc(org.name||'新增單位')}</strong><small>${organizationGroups[org.category]} · ${org.enabled?'顯示中':'停用'}</small></span><span class="p31-org-edit">編輯</span></summary><fieldset data-brand-organization><label>分類<select name="category">${Object.entries(organizationGroups).map(([key,label])=>`<option value="${key}" ${org.category===key?'selected':''}>${label}</option>`).join('')}</select></label>${Object.entries(organizationLabels).map(([key,label])=>brandField(key,label,org[key])).join('')}${mediaFields(organizationImages,org,mediaBase)}<label><input name="enabled" type="checkbox" ${org.enabled?'checked':''}>顯示在前台</label><div class="christmas-actions"><button type="button" data-brand-action="up" data-brand-index="${index}" ${index===0?'disabled':''}>上移</button><button type="button" data-brand-action="down" data-brand-index="${index}" ${index===brand.organizations.length-1?'disabled':''}>下移</button><button type="button" data-brand-action="remove" data-brand-index="${index}">移除介紹</button></div></fieldset></details>`).join('')}<button type="button" data-brand-action="add" ${brand.organizations.length>=24?'disabled':''}>新增單位</button></section>`;
}
function captureBrand(form,brand,mediaBase){
 if(!brand)return undefined;
 const read=(container,labels)=>Object.fromEntries(Object.keys(labels).map(key=>[key,container.querySelector(`[name="${key}"]`).value.trim()]));
 const readMedia=(container,fields,current)=>mediaBase?Object.fromEntries(Object.keys(fields).map(key=>{
  const row=container.querySelector(`[data-brand-image-field="${key}"]`);
  return [key,row.dataset.imageId?{id:row.dataset.imageId,width:Number(row.dataset.imageWidth),height:Number(row.dataset.imageHeight),alt:row.querySelector('[data-brand-alt]').value.trim()}:null];
 })):Object.fromEntries(Object.keys(fields).filter(key=>current?.[key]).map(key=>[key,current[key]]));
 const brandCopy=form.querySelector('[data-brand-copy]');
 return {...read(brandCopy,brandLabels),...readMedia(brandCopy,brandImages,brand),organizations:[...form.querySelectorAll('[data-brand-organization]')].map((row,index)=>({
  ...read(row,organizationLabels),...readMedia(row,organizationImages,brand.organizations[index]),category:row.querySelector('[name=category]').value,enabled:row.querySelector('[name=enabled]').checked
 }))};
}

function contentSignature(value) {
 return JSON.stringify(value, (_, item)=>item && typeof item==='object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]]))
  : item);
}

function collapseEditorFields(fields,title) {
 const section=document.createElement('details'),summary=document.createElement('summary');
 section.className='christmas-editor-section';
 summary.textContent=title;
 fields[0].before(section);
 section.append(summary,...fields);
 return section;
}
function mediaUsageMarkup(usage){
 if(!usage?.limit)return '';
 const ratio=Math.round(usage.used/usage.limit*1000)/10;
 const mb=value=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(value/1_000_000);
 return `<p><strong>公益媒體容量</strong> ${mb(usage.used)} MB / ${mb(usage.limit)} MB（${ratio}%）</p><meter min="0" max="${usage.limit}" low="${usage.limit*.7}" high="${usage.limit*.9}" optimum="0" value="${usage.used}" aria-label="公益媒體容量"></meter><p>${ratio>=90?'容量接近上限。':ratio>=70?'已達容量提醒門檻。':''} 含草稿及保留版本，和 Cloudflare 帳單計量分開。${usage.pending?' 未完成登記 '+mb(usage.pending)+' MB。':''}</p>`;
}
export async function mountContentEditor(container,api,output,signal){
 const stagingPreview=api.config.contentEditorPreview===true, editPolicy=api.config.directMode&&!stagingPreview;
 const mediaBase=api.config.brandMedia?api.config.baseUrl+'/admin/campaigns/'+encodeURIComponent(api.config.campaignId)+'/workspace/brand-media':'';
 const tabs=document.createElement('nav'),settings=document.createElement('section'),editor=document.createElement('section');tabs.className='christmas-actions';tabs.setAttribute('aria-label','活動內容分類');
 tabs.innerHTML=[['settings','活動基本設定'],['copy','網站內容與合作資訊'],['brand','活動單位與品牌內容'],['faq','常見問題 FAQ']].map(([id,label])=>'<button class="btn btn-secondary" type="button" data-content-tab="'+id+'">'+label+'</button>').join('');container.replaceChildren(tabs,settings,editor);let selected='settings',dirty=false;
 const switchTab=id=>{selected=id;settings.hidden=id!=='settings';editor.hidden=id==='settings';editor.querySelectorAll('[data-copy-section]').forEach(el=>el.hidden=el.dataset.copySection!==id);tabs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.contentTab===id)));};tabs.addEventListener('click',e=>{const b=e.target.closest('[data-content-tab]');if(b){switchTab(b.dataset.contentTab);if(dirty)editor.querySelector('[data-copy-result]').textContent='有未儲存變更，切換分類已保留變更。';}});switchTab(selected);
 // Load independently: a slow or invalid date setting cannot hide the content editor.
 const settingTask=mountCampaignSettings(settings,api,signal).then(()=>{if(!signal?.aborted&&(api.config.acceptanceMode||api.config.contentEditor&&!stagingPreview))return mountSiteManager(settings,api);});
 if(api.config.heroEditor) {
  const hero = document.createElement('section');
  settings.after(hero);
  tabs.addEventListener('click', () => { hero.hidden = selected !== 'settings'; });
  void mountHeroEditor(hero,api.config,signal);
 }
 try{
  let record=await api.admin('/workspace/content',undefined,undefined,signal),copy=structuredClone(record.draft?.content||record.published.content||christmasContent),previewed='';
  if(signal?.aborted)return;
  copy.brand||=structuredClone(record.brandDefaults);
  if(!copy.brand)tabs.querySelector('[data-content-tab=brand]').hidden=true;
  copy.steps||=structuredClone(participationSteps);copy.attention||='請依心願規格準備禮物，交件時提供心願編號。';copy.hiddenFaq||=[];copy.scopedFaq||={};let faqScope='christmas';const activeFaq=()=>faqScope==='christmas'?copy.faq:copy.scopedFaq[faqScope]||[];const updateFaq=rows=>{if(faqScope==='christmas')copy.faq=rows;else copy.scopedFaq[faqScope]=rows;};
  const labels={headline:'一般活動標題（首頁品牌標題優先）',introduction:'一般活動介紹（首頁品牌副標題優先）',attention:'注意事項',partnership:'一般合作介紹（品牌故事未設定時使用）',miller:'米勒公告文字',tree:'大樹公告文字',cama:'CAMA 公告文字'};
  let usage=record.mediaUsage;
  const updateUsage=value=>{if(!value)return;usage=value;const panel=editor.querySelector('[data-brand-usage]');if(panel)panel.innerHTML=mediaUsageMarkup(usage);};
  const navigation=new AbortController();
  signal?.addEventListener('abort',()=>navigation.abort(),{once:true});
  window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}},{signal:navigation.signal});
  document.addEventListener('click',event=>{
   if(!container.isConnected){navigation.abort();return;}
   const link=event.target.closest('a[href]');
   if(dirty&&link&&!container.contains(link)&&!window.confirm('仍有未儲存變更，確定離開活動設定？')){
    event.preventDefault();
    event.stopImmediatePropagation();
   }
  },{capture:true,signal:navigation.signal});
  const announcementDates={start:'公告顯示開始日',end:'公告顯示結束日',giftDeadline:'公告顯示收件截止日'};
  function capture(){const f=new FormData(editor.querySelector('form'));const base={...copy};if(api.config.directMode)delete base.privacyStatement;const brand=captureBrand(editor.querySelector('form'),copy.brand,mediaBase);return {...base,...(brand?{brand}:{}),announcement:String(f.get('announcement')||'').trim(),announcementDates:Object.fromEntries(Object.keys(announcementDates).map(k=>[k,String(f.get(k)||'')])),...Object.fromEntries(Object.keys(labels).map(k=>[k,String(f.get(k)).trim()])),steps:copy.steps.map((_,i)=>[String(f.get('stepTitle'+i)).trim(),String(f.get('stepBody'+i)).trim()]),faq:faqScope==='christmas'?activeFaq().map((_,i)=>[String(f.get('question'+i)).trim(),String(f.get('answer'+i)).trim()]):copy.faq,scopedFaq:{...copy.scopedFaq,...(faqScope!=='christmas'?{[faqScope]:activeFaq().map((_,i)=>[String(f.get('question'+i)).trim(),String(f.get('answer'+i)).trim()])}:{})},...(editPolicy&&(f.get('privacyTitle')||f.get('privacyBody'))?{privacyStatement:{title:String(f.get('privacyTitle')).trim(),body:String(f.get('privacyBody')).trim()}}:{})};}
  function render(){
   editor.innerHTML='<p>先儲存草稿並預覽，再正式發布；活動日期與既有認領不受文字修改影響。</p><form novalidate data-public-content><div data-copy-section="copy">'+Object.entries(labels).map(([k,label])=>'<label>'+label+'<textarea name="'+k+'" required maxlength="2000">'+esc(copy[k]||'')+'</textarea></label>').join('')+'<h3>參與方式</h3>'+copy.steps.map(([a,b],i)=>'<fieldset><legend>步驟'+(i+1)+'</legend><label>步驟名稱<input name="stepTitle'+i+'" required maxlength="1500" value="'+esc(a)+'"></label><label>步驟說明<textarea name="stepBody'+i+'" required maxlength="1500">'+esc(b)+'</textarea></label></fieldset>').join('')+(editPolicy?'<fieldset><legend>NXSPACE 隱私權聲明</legend><label>聲明標題<input name="privacyTitle" maxlength="120" value="'+esc(copy.privacyStatement?.title||'')+'"></label><label>聲明內容<textarea name="privacyBody" maxlength="12000" rows="12">'+esc(copy.privacyStatement?.body||'')+'</textarea></label><p>發布後產生獨立版本與發布日期，既有認領者同意紀錄不會被覆蓋。請由 NXSPACE 審閱內容後發布。</p></fieldset>':'')+'</div><div data-copy-section="faq"><h3>常見問題</h3><label>適用頁面<select data-faq-scope><option value="christmas">聖誕公益</option><option value="venue">場地租借</option><option value="activities">一般活動</option></select></label>'+activeFaq().map(([q,a],i)=>'<fieldset><legend>常見問題'+(i+1)+'</legend><label>問題<input name="question'+i+'" required maxlength="1500" value="'+esc(q)+'"></label><label>回答<textarea name="answer'+i+'" required maxlength="1500">'+esc(a)+'</textarea></label><button type="button" data-faq-up="'+i+'" '+(i===0?'disabled':'')+'>上移</button><button type="button" data-faq-down="'+i+'" '+(i===activeFaq().length-1?'disabled':'')+'>下移</button><button type="button" data-faq-hide="'+i+'">隱藏</button><button type="button" data-faq-remove="'+i+'">刪除這題</button></fieldset>').join('')+'<button type="button" data-faq-add>新增常見問題</button><h4>已隱藏的問題</h4>'+copy.hiddenFaq.map(([q],i)=>'<p>'+esc(q)+' <button type="button" data-faq-restore="'+i+'">恢復顯示</button><button type="button" data-hidden-remove="'+i+'">刪除</button></p>').join('')+'</div><div class="christmas-actions p31-editor-actions"><button type="submit">儲存草稿</button><button type="button" data-content-preview>預覽內容</button><button type="button" data-content-publish>確認發布</button></div><p role="status" data-copy-result></p></form><details data-content-history><summary>版本與發布紀錄</summary>'+record.revisions.map(r=>'<p>版本 '+r.version+' · '+({published:'正式發布',brand_published:'活動品牌發布',draft:'草稿'}[r.kind]||'草稿')+' · '+new Date(r.created_at*1000).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})+'</p>').join('')+'</details>'+(api.config.acceptanceMode?'<details><summary>隱私權聲明發布版本（目前：'+esc(record.activePrivacyVersion==='unpublished'?'尚未發布':record.activePrivacyVersion||'尚未發布')+'）</summary>'+(record.privacyHistory||[]).map(p=>'<details><summary>'+esc(p.version)+' · '+new Date(p.published_at*1000).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})+'</summary><h4>'+esc(p.title)+'</h4><p class="christmas-preserve">'+esc(p.body)+'</p></details>').join('')+'</details>':'');
   const form=editor.querySelector('form'),status=form.querySelector('[data-copy-result]');
   form.querySelector('[data-copy-section=faq]').insertAdjacentHTML('beforebegin',brandMarkup(copy.brand,mediaBase));
   const brandSection=form.querySelector('[data-copy-section=brand]');
   const lastDraft=record.revisions.find(revision=>revision.kind==='draft');
   const lastRelease=record.revisions.find(revision=>['published','brand_published'].includes(revision.kind));
   const time=revision=>revision?new Date(revision.created_at*1000).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'無紀錄';
   form.insertAdjacentHTML('afterbegin',`<p class="p31-field-note">正式版本 ${record.published.version||'未發布'} · 最後發布 ${time(lastRelease)}<br>草稿版本 ${record.draft?.version||'無'} · 最後儲存 ${time(lastDraft)}</p>`);
   if(brandSection){
    brandSection.insertAdjacentHTML('afterbegin','<div class="p31-media-usage" data-brand-usage></div>');
    updateUsage(usage);
    brandSection.querySelectorAll('[data-org-row]').forEach(row=>row.name='p31-organization-editor');
   }
   if(brandSection&&!stagingPreview)brandSection.insertAdjacentHTML('beforeend','<p>儲存草稿並預覽後，可更新公益首頁的活動品牌內容。</p><button type="button" data-publish-brand>發布活動品牌內容</button>');
   switchTab(selected);editor.querySelectorAll('button').forEach(b=>b.className='btn '+(b.type==='submit'?'btn-primary':'btn-secondary'));
   brandSection?.addEventListener('click',async e=>{
    const button=e.target.closest('[data-brand-upload],[data-brand-image-remove]');
    if(!button)return;
    const field=button.closest('[data-brand-image-field]');
    const maximum={mobileHero:960,logo:640,image:1280}[field.dataset.brandImageField]||1920;
    button.disabled=true;
    status.textContent=button.hasAttribute('data-brand-upload')?'正在壓縮並上傳圖片…':'正在移除草稿圖片…';
    try{
     let image=null;
     if(button.hasAttribute('data-brand-upload')){
      const blob=await compressBrandImage(field.querySelector('[data-brand-file]').files[0],maximum);
      const response=await fetch(mediaBase,{method:'POST',headers:{'Content-Type':blob.type,'X-Requested-With':'XMLHttpRequest'},body:blob,signal});
      const result=await response.json();
      if(!response.ok)throw Error(result.error?.code==='BRAND_MEDIA_LIMIT'?'已達圖片容量或上傳頻率限制。':'圖片上傳失敗，請確認檔案或稍後再試。');
      image={...result,alt:field.querySelector('[data-brand-alt]').value.trim()};
     }
     if(!field.isConnected)return;
     field.dataset.imageId=image?.id||'';
     field.dataset.imageWidth=image?.width||0;
     field.dataset.imageHeight=image?.height||0;
     field.querySelector('[data-brand-file]').value='';
     field.querySelector('[data-brand-image-preview]').innerHTML=brandImageMarkup(image,mediaBase,{className:'p31-brand-logo'});
     field.querySelector('[data-brand-image-remove]').disabled=!image;
     previewed='';dirty=true;
     if(image)void api.admin('/workspace/content',undefined,undefined,signal).then(result=>updateUsage(result.mediaUsage)).catch(()=>{});
     status.textContent=image?'圖片已上傳，請儲存草稿。':'已移除這個圖片位置，請儲存草稿。';
    }catch(error){if(!signal?.aborted)status.textContent=error.message;}
    finally{if(button.hasAttribute('data-brand-upload'))button.disabled=false;}
   });
   form.querySelector('[data-copy-section=brand]')?.addEventListener('click',e=>{
    const button=e.target.closest('[data-brand-action]');
    if(!button)return;
    const action=button.dataset.brandAction,index=Number(button.dataset.brandIndex);
    if(action==='remove'&&!window.confirm('確定移除此單位的活動介紹？'))return;
    copy=capture();
    const rows=copy.brand.organizations;
    if(action==='add')rows.push({name:'',category:'partner',enabled:true});
    else if(action==='remove')rows.splice(index,1);
    else {const other=index+(action==='up'?-1:1);[rows[index],rows[other]]=[rows[other],rows[index]];}
    previewed='';dirty=true;render();
    const fields=editor.querySelectorAll('[data-brand-organization]');
    const focus=action==='add'?fields.length-1:action==='up'?index-1:action==='down'?index+1:-1;
    if(fields[focus]){fields[focus].closest('details').open=true;fields[focus].querySelector('[name=name]').focus();}
   });
   form.querySelector('[data-copy-section=copy]').insertAdjacentHTML('afterbegin','<label>活動公告<textarea name="announcement" maxlength="2000">'+esc(copy.announcement||'')+'</textarea></label>'+Object.entries(announcementDates).map(([key,label])=>'<label>'+label+'<input type="date" name="'+key+'" value="'+esc(copy.announcementDates?.[key]||'')+'"></label>').join(''));
   const copySection=form.querySelector('[data-copy-section=copy]');
   const fields=[...copySection.querySelectorAll(':scope > label')];
   collapseEditorFields(fields.slice(0,6),'活動公告與介紹').open=true;
   collapseEditorFields(fields.slice(6),'注意事項與合作資訊');
   const steps=[...copySection.querySelectorAll(':scope > fieldset')].filter(field=>field.querySelector('[name^="stepTitle"]'));
   if(steps.length)collapseEditorFields(steps,'參與方式');
   for(const field of form.querySelectorAll('[data-copy-section=faq] fieldset')){
    const question=field.querySelector('[name^=question]');
    const section=collapseEditorFields([field],question.value||'新增問題');
    section.name='p31-faq-editor';
    question.addEventListener('input',()=>{section.firstElementChild.textContent=question.value||'新增問題';});
   }
   form.addEventListener('input',()=>{
    previewed='';dirty=true;
    status.textContent='目前有未儲存的變更。';
   });
   if(stagingPreview||api.config.contentEditor&&!api.config.websiteContentPublish){form.querySelector('[data-content-publish]').disabled=true;status.textContent='可儲存草稿及預覽。網站內容發布須另行授權。';}
   if(api.config.contentEditor&&api.config.websiteContentPublish)form.querySelector('[data-content-publish]').textContent='發布網站內容';
   const valid=()=>{if(editPolicy){const a=form.elements.privacyTitle,b=form.elements.privacyBody;if(Boolean(a.value.trim())!==Boolean(b.value.trim())){switchTab('copy');status.textContent='隱私權聲明的標題與內容需一併填寫；尚未核定時可同時留白。';return false;}}const invalid=[...form.querySelectorAll('input,textarea')].find(el=>!el.checkValidity());if(invalid){switchTab(invalid.closest('[data-copy-section]').dataset.copySection);const section=invalid.closest('details');if(section)section.open=true;invalid.reportValidity();return false;}return true;};
   brandSection?.querySelector('[data-publish-brand]')?.addEventListener('click',async e=>{
    if(!valid())return;
    const current=capture();
    if(!record.draft||record.draft.status!=='draft'||contentSignature(current)!==contentSignature(record.draft.content)){status.textContent='請先儲存目前草稿。';return;}
    if(previewed!==contentSignature(current)){status.textContent='請先預覽目前草稿。';return;}
    e.target.disabled=true;
    try{
     record=await api.admin('/workspace/content',{action:'publishBrand',expectedVersion:record.draft.version,expectedPublishedVersion:record.published.version});
     render();
     editor.querySelector('[data-copy-result]').textContent='公益活動品牌內容已發布。';
    }catch(error){status.textContent=error.message;e.target.disabled=false;}
   });
   for(const op of ['up','down','remove','hide','restore'])form.querySelectorAll('[data-faq-'+op+']').forEach(b=>b.addEventListener('click',()=>{copy=capture();const rows=activeFaq(),i=Number(b.getAttribute('data-faq-'+op));if(op==='restore')copy.faq.push(...copy.hiddenFaq.splice(i,1));else if(op==='hide'){if(faqScope!=='christmas')return;copy.hiddenFaq.push(...rows.splice(i,1));}else if(op==='remove'){if(!window.confirm('確定刪除這項問題？'))return;rows.splice(i,1);}else{const j=i+(op==='up'?-1:1);[rows[i],rows[j]]=[rows[j],rows[i]];}updateFaq(rows);previewed='';render();}));
   form.querySelector('[data-faq-scope]').value=faqScope;form.querySelector('[data-faq-scope]').addEventListener('change',e=>{copy=capture();faqScope=e.target.value;if(faqScope==='venue'&&!Array.isArray(copy.scopedFaq.venue))copy.scopedFaq.venue=rentalRules.faqs.map(r=>[r.question,r.answer]);previewed='';render();});if(faqScope!=='christmas')form.querySelectorAll('[data-faq-hide],[data-faq-restore],[data-hidden-remove]').forEach(b=>b.hidden=true);
   form.querySelectorAll('[data-hidden-remove]').forEach(b=>b.addEventListener('click',()=>{if(!window.confirm('確定刪除這項隱藏問題？'))return;copy=capture();copy.hiddenFaq.splice(Number(b.dataset.hiddenRemove),1);previewed='';render();}));
   form.querySelector('[data-faq-add]').addEventListener('click',()=>{copy=capture();if(activeFaq().length+(faqScope==='christmas'?copy.hiddenFaq.length:0)>=40){status.textContent='最多40題，包含隱藏題目。';return;}const rows=activeFaq();rows.push(['','']);updateFaq(rows);previewed='';render();});
   form.addEventListener('submit',async e=>{e.preventDefault();if(!valid())return;const b=form.querySelector('[type=submit]');b.disabled=true;try{copy=capture();record=await api.admin('/workspace/content',{action:'save',expectedVersion:record.draft?.version||0,content:copy});dirty=false;render();editor.querySelector('[data-copy-result]').textContent=stagingPreview?'草稿已儲存，可重新載入或預覽。':'草稿已儲存，請預覽後發布。';}catch(error){status.textContent=error.code==='REAUTH_REQUIRED'?'請先至系統管理完成高權限重新驗證，再回到此處儲存。':error.message;b.disabled=false;}});
   form.querySelector('[data-content-preview]').addEventListener('click',()=>{
    if(!valid())return;
    copy=capture();previewed=contentSignature(copy);
    const modal=openChristmasDialog({title:'公益內容預覽'});
    modal.body.innerHTML='<p>草稿預覽，尚未發布</p><div class="christmas-actions"><button type="button" data-size="desktop" aria-pressed="true">桌機版</button><button type="button" data-size="mobile" aria-pressed="false">手機版</button></div><div class="p31-preview-page"></div>';
    const page=modal.body.querySelector('.p31-preview-page');
    const draw=size=>{
     page.dataset.size=size;
     modal.body.querySelectorAll('button[data-size]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.size===size)));
     const brand=copy.brand;
     const hero=(size==='mobile'?brand?.mobileHero:brand?.hero)||brand?.hero||brand?.mobileHero;
     page.innerHTML='<h1>'+campaignTitleMarkup(brand?.title||copy.headline)+'</h1><p>'+esc(brand?.subtitle||copy.introduction)+'</p>'+brandImageMarkup(hero,mediaBase)+information({...copy,mediaBase},{seasonal:Boolean(brand)})+(copy.privacyStatement?'<h2>'+esc(copy.privacyStatement.title)+'</h2><p class="christmas-preserve">'+esc(copy.privacyStatement.body)+'</p>':'');
    };
    modal.body.querySelectorAll('button[data-size]').forEach(button=>button.addEventListener('click',()=>draw(button.dataset.size)));
    draw('desktop');
   });
   form.querySelector('[data-content-publish]').addEventListener('click',async e=>{if(!valid())return;const current=capture();if(!record.draft||record.draft.status!=='draft'||contentSignature(current)!==contentSignature(record.draft.content)){status.textContent='請先儲存目前草稿。';return;}if(previewed!==contentSignature(current)){status.textContent='請先預覽目前草稿。';return;}e.target.disabled=true;try{record=await api.admin('/workspace/content',{action:'publish',expectedVersion:record.draft.version,expectedPublishedVersion:record.published.version});render();editor.querySelector('[data-copy-result]').textContent='已正式發布，包含版本與發布時間紀錄。';}catch(error){status.textContent=error.message;e.target.disabled=false;}});
  }
  render();
 }catch(error){if(!signal?.aborted){editor.textContent='網站內容載入失敗：'+error.message;output.textContent=error.message;}}await settingTask;
}

async function mountHeroEditor(container,config,signal){
 const base = config.baseUrl + '/admin/campaigns/' + encodeURIComponent(config.campaignId) + '/workspace/hero';
 container.innerHTML = '<h3>首頁主視覺圖片</h3><p>建議 1920 × 800。支援 JPG、PNG、WebP，最多 2 MiB。</p><label>選取圖片<input type="file" accept="image/jpeg,image/png,image/webp"></label><button type="button" data-hero-upload>上傳至草稿</button> <button type="button" data-hero-reset>恢復預設草稿</button> <button type="button" data-hero-publish>發布主視覺</button><div data-hero-preview></div><p role="status">載入設定中…</p>';
 const status = container.querySelector('[role=status]');
 const input = container.querySelector('input');
 const buttons = [...container.querySelectorAll('button')];
 const preview = container.querySelector('[data-hero-preview]');
 let record;
 async function request(action, file) {
  const response = await fetch(base + (action ? '/' + action : ''), action ? {
   method:'POST', cache:'no-store', headers:{'X-Hero-Version':String(record.version),
    'X-Requested-With':'XMLHttpRequest', ...(file ? {'Content-Type':file.type} : {})}, body:file
  } : {cache:'no-store',signal});
  const payload = await response.json();
  if(!response.ok) {
   const messages = {HERO_CONFLICT:'圖片設定已變更，請重新整理後再試。',HERO_FORMAT:'圖片格式或檔案內容無效。',HERO_TOO_LARGE:'圖片超過 2 MiB。',REAUTH_REQUIRED:'請先完成高權限重新驗證。'};
   throw Error(messages[payload.error?.code] || '圖片設定操作失敗。');
  }
  return payload;
 }
 function render(){
  preview.replaceChildren();
  if(record.draft_key) {
   const image = document.createElement('img');
   image.className = 'christmas-hero-image';
   image.alt = '首頁圖片草稿預覽';
   image.addEventListener('error',()=>{image.remove();status.textContent='圖片無法載入，保留預設版面。';},{once:true});
   image.src = base + '/preview';
   preview.append(image);
  } else preview.textContent = '使用現有首頁版面。';
  for(const button of buttons)button.disabled = button.hasAttribute('data-hero-publish') && !config.heroPublish;
 }
 for(const action of ['upload','reset','publish']){
  container.querySelector('[data-hero-'+action+']').addEventListener('click',async()=>{
   const file = action === 'upload' ? input.files[0] : undefined;
   if(action === 'upload' && (!file || file.size > 2*1024*1024)) {
    status.textContent = '請選擇一張不超過 2 MiB 的圖片。';
    return;
   }
   if(action === 'publish' && !window.confirm('確認公開目前的主視覺草稿？'))return;
   buttons.forEach(button=>button.disabled=true);
   try {
    record = await request(action,file);
    input.value = '';
    status.textContent = action === 'publish' ? '已發布主視覺。' : '草稿已儲存。';
   } catch(error) { status.textContent=error.message; }
   render();
  });
 }
 buttons.forEach(button=>button.disabled=true);
 try {
  record=await request();
  if(!signal?.aborted) {
   status.textContent=config.heroPublish?'':'圖片發布尚未開放。';
   render();
  }
 } catch(error) { if(!signal?.aborted)status.textContent=error.message; }
}

async function mountCampaignSettings(container,api,signal){
 try{
  let record=await api.admin('/workspace/settings',undefined,undefined,signal),previewed='';
  if(signal?.aborted)return;
  const date=n=>Number.isSafeInteger(n)?new Date(n*1000+28800000).toISOString().slice(0,10):'';
  const fields={title:'活動名稱',opensAt:'內部營運開始日期',closesAt:'內部營運結束日期',claimDeadlineAt:'最後認領日期上限',giftDueAt:'內部最終收件期限',deliveryDays:'認領後交件天數（留空表示未設定）',expectedDeliveryAt:'書屋內部預計完成發送日期'};
  container.innerHTML='<h3>活動設定</h3><p>設定確認後立即生效；下方網站文字則須先儲存草稿、預覽及發布。既有認領的交件期限一律保留。</p><form data-campaign-settings>'+Object.entries(fields).map(([key,label])=>`<label>${label}<input name="${key}" type="${key==='title'?'text':key==='deliveryDays'?'number':'date'}" value="${esc(key==='title'||key==='deliveryDays'?record.settings[key]??'':date(record.settings[key]))}" ></label>`).join('')+'<p>新增心願預設最後認領日期為建立當日後5日；如超出活動允許範圍，須先調整日期。最後認領日期與認領後交件期限分開計算。</p><button type="button" data-settings-preview>檢查調整影響</button><label><input type="checkbox" name="confirmed" required>我已確認影響，既有案件期限不變</label><button type="submit">確認儲存活動設定</button><p role="status" data-settings-status></p></form><details><summary>設定修改紀錄</summary><div data-settings-history></div></details><h3>網站內容與常見問題</h3>';
  if(api.config.directMode){container.querySelector('[data-settings-preview]')?.remove();container.querySelector('[name=confirmed]')?.closest('label').remove();}
  container.querySelectorAll('button:not([class])').forEach(b=>b.className=b.type==='submit'?'btn btn-primary':'btn btn-secondary');const form=container.querySelector('form'),status=form.querySelector('[data-settings-status]');
  for (const [title, keys] of [
   ['內部營運期間',['opensAt','closesAt']],
   ['認領規則',['claimDeadlineAt','deliveryDays']],
   ['收件與送達期限',['giftDueAt','expectedDeliveryAt']]
  ]) {
   const labels=keys.map(key=>form.elements[key].closest('label'));
   collapseEditorFields(labels,title).open=true;
  }
  form.elements.title.required=true;
  form.elements.opensAt.required=true;
  form.elements.closesAt.required=true;
  form.insertAdjacentHTML('afterbegin','<p>這裡設定內部作業期限。民眾看到的公告日期請在網站內容中編輯，公開認領由功能開關控制。</p>');
  const capture=()=>Object.fromEntries(Object.keys(fields).map(key=>{
   const value=form.elements[key].value;
   if(key==='title')return [key,value.trim()];
   if(key==='deliveryDays')return [key,value?Number(value):null];
   if(value===date(record.settings[key]))return [key,record.settings[key]];
   return [key,value?Date.parse(value+(key==='opensAt'?'T00:00:00+08:00':'T23:59:59+08:00'))/1000:null];
  }));
  const validSettings=settings=>{
   if(Object.keys(fields).some(key=>!form.elements[key].reportValidity()))return false;
   const boundary=settings.claimDeadlineAt??settings.closesAt;
   if(settings.opensAt>=settings.closesAt||settings.opensAt>=boundary||boundary>settings.closesAt||
      settings.giftDueAt!==null&&boundary>settings.giftDueAt||
      settings.giftDueAt!==null&&settings.expectedDeliveryAt!==null&&settings.expectedDeliveryAt<settings.giftDueAt){
    status.textContent='請核對營運開始、結束、認領、收件及送達期限的先後順序。';
    return false;
   }
   return true;
  };
  const history=()=>container.querySelector('[data-settings-history]').innerHTML=record.history.map(r=>`<p>版本 ${r.version} · ${new Date(r.created_at*1000).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})} · 保留既有案件期限</p>`).join('')||'<p>尚無修改紀錄。</p>';history();
  form.addEventListener('input',e=>{if(e.target.name==='confirmed')return;previewed='';if(form.elements.confirmed)form.elements.confirmed.checked=false;});
  form.querySelector('[data-settings-preview]')?.addEventListener('click',async e=>{const settings=capture();if(!validSettings(settings))return;e.target.disabled=true;try{const r=await api.admin('/workspace/settings',{action:'preview',expectedVersion:record.version,settings});previewed=JSON.stringify(settings);status.textContent=`已有 ${r.affectedClaims} 筆認領，個別交件期限全部保留。請核對後勾選確認，再儲存。`;}catch(error){status.textContent=error.message;}finally{e.target.disabled=false;}});
  form.addEventListener('submit',async e=>{e.preventDefault();const settings=capture();if(!validSettings(settings))return;if(!api.config.directMode&&previewed!==JSON.stringify(settings)){status.textContent='請先檢查目前設定的影響。';return;}const b=form.querySelector('[type=submit]');b.disabled=true;try{record=await api.admin('/workspace/settings',{action:'save',expectedVersion:record.version,settings,...(!api.config.directMode?{impactConfirmed:form.elements.confirmed.checked}:{})});history();status.textContent='活動設定已儲存；既有案件期限沒有變更。';previewed='';if(form.elements.confirmed)form.elements.confirmed.checked=false;}catch(error){status.textContent=error.message;}finally{b.disabled=false;}});
 }catch(error){container.textContent='活動設定載入失敗：'+error.message;}
}
