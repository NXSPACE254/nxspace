import {operationLabel,mountBulkManager} from './christmas-management-tools.js';
import {escapeChristmas as esc,christmasDate,christmasTime,pageSlice,pagination,openChristmasDialog} from '../components/christmas-controls.js';
const input=(name,label,type='text',value='',required=true)=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} autocomplete="off"></label>`;
const area=(name,label,value='',required=true)=>`<label>${label}<textarea name="${name}" ${required?'required':''} maxlength="1000">${esc(value)}</textarea></label>`;
const select=(name,label,rows)=>`<label>${label}<select name="${name}">${rows.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label>`;
const form=(name,title,fields,button=title)=>`<form class="christmas-panel" data-case-action="${name}"><h3>${title}</h3>${fields}<button class="btn btn-primary">${button}</button><p role="status" data-form-status></p></form>`;
const statuses={available:'尚未認領',claimed:'等待交件',gift_received:'已收件',handed_over:'書屋已領取',delivered:'禮物已送達',exception:'需要協助',cancelled:'認領已取消',expired:'已逾期'};
const state=r=>r.claim_status==='delivered'?'已完成 · 已送達孩子':r.claim_status==='claimed'?'已認領 · 等待交件':statuses[r.claim_status||r.status]||'草稿';
export async function initializeCaseWorkspace({content,output,api,ctx,view='overview',filter='all',readOnly=false,signal,readCases=()=>api.admin('/workspace/cases')}){
 const intake=api.config.intakeMode===true;
 const production=api.config.fulfillmentMode===true;
 const fullMenu=api.config.v11Dashboard===true;
 const [donor,mailing,editor]=intake&&!fullMenu?[]:await Promise.all([
   intake||view==='content'?null:import('./christmas-donor.js'),
   view==='documents'?import('./christmas-mailing.js'):null,
   !readOnly&&view==='content'&&((!production&&!fullMenu)||api.config.contentEditorPreview||api.config.contentEditor)?import('./christmas-content-editor.js'):null
 ]);
 if(signal?.aborted)return;
 const {mountDonorProfile}=donor||{}, {mountMailingExport}=mailing||{}, {mountContentEditor}=editor||{};
 const intakeState=row=>row.pending_review?'待審核':row.publication_status==='approved'?'已核准':'草稿';
 const userButton=document.querySelector('[data-user-menu] span:last-child'),userPanel=document.querySelector('[data-user-menu-panel]');if(userButton&&!fullMenu)userButton.textContent=ctx.displayName+' · '+ctx.label;if(userPanel&&!fullMenu){const note=userPanel.querySelector('[data-account-note]');if(note)note.textContent='姓名：'+ctx.displayName+'；單位：'+ctx.label+'；角色：'+ctx.roleLabel+'。公益模擬身分由測試中心切換，沒有獨立密碼。正式帳號密碼須由已驗證的身分服務管理。';const passwordForm=userPanel.querySelector('[data-account-password]');if(passwordForm)passwordForm.hidden=api.config.testMode;userPanel.querySelector('strong').textContent=ctx.displayName;userPanel.querySelector('small').textContent=ctx.label+' · '+ctx.roleLabel;}
 const intakeOpen=api.config.launchMode ? api.config.intakeWrites===true : api.config.intakeWrites!==false;
 const intakePause='心願建檔、送審與審核目前尚未開放。';
 const limited=ctx.kind==='collection',can=p=>!readOnly&&ctx.permissions.includes(p)&&(p!=='wish.write'||intakeOpen)&&(!['gift.accept','gift.deliver'].includes(p)||ctx.kind==='bookhouse');let data,page=1,query='',category='all',siteFilter='all',stage=view==='documents'&&filter==='all'?'documents_pending':filter,revision=0,lookupState={method:'code',value:''};
 const navs=limited?[['receiving','禮物收件'],['handoff','禮物交接']]:intake&&!fullMenu?[['cases','心願案件']]:ctx.nx?[['overview','活動總覽'],['cases','心願案件'],['content','活動設定與網站內容']]:[['overview','工作總覽'],['cases','心願案件'],['handoff','禮物交接與送達'],['documents','紙本文件']];
 if(production&&ctx.nx&&!fullMenu)navs.pop();
 view=limited?(view==='handoff'?'handoff':'receiving'):intake&&!fullMenu?'cases':navs.some(([id])=>id===view)?view:'overview';
 const nav=document.querySelector('[data-christmas-subnav]');if(nav){nav.innerHTML=navs.map(([id,label])=>`<a class="admin-nav-link${id===view?' is-active':''}" href="#christmas?view=${id}" data-admin-link data-christmas-view="${id}" ${id===view?'aria-current="page"':''}>${label}</a>`).join('');nav.closest('details').open=true;}
 const root=content.closest('[data-christmas-admin]');if(root){root.querySelector('h1').textContent=limited?ctx.label+'｜禮物收件':ctx.nx?'聖誕公益管理':'孩子的書屋｜公益工作台';root.querySelector('.christmas-notice').textContent='本機測試，所有資料與操作都不會影響正式活動，也不會寄送真實通知。';}
 const deliveryPause='禮物收件、交接與送達目前尚未開放。';
 if(root&&(api.config.launchMode||intake)){
  const notice=root.querySelector('.christmas-notice');
  const messages=[
   !limited&&!intakeOpen&&view!=='cases'?intakePause:'',
   !limited&&api.config.publicAdoption===false?'民眾認領目前尚未開放。':''
  ].filter(Boolean);
  notice.textContent=messages.join(' ');
  notice.hidden=!messages.length;
 }
 if(production&&root)root.querySelector('.christmas-notice').textContent='公益作業後台。請依授權範圍處理案件及資料。';
 const post=(path,body,key=crypto.randomUUID())=>api.admin(path,body,key);
 async function load(refresh=true){if(view==='content'||limited&&intake){await render();return;}const id=++revision,lookup=content.querySelector('[data-case-action=lookup]');if(lookup)lookupState={method:lookup.elements.method.value,value:lookup.elements.value.value};const controls=[...content.querySelectorAll('input,select,button')].map(el=>[el,el.disabled]);controls.forEach(([el])=>el.disabled=true);content.setAttribute('aria-busy','true');try{const next=await readCases(refresh);if(signal?.aborted||id!==revision||!content.isConnected)return;data=intake&&fullMenu?{...next,counts:{total:next.rows.length},tasks:[],batches:[],claims:[],supportTasks:[]}:next;render();}finally{if(id===revision){content.removeAttribute('aria-busy');for(const[el,disabled]of controls)if(el.isConnected)el.disabled=disabled;}}}
 function render(){
  content.innerHTML='<section class="christmas-panel" data-workspace-view="'+view+'"><h2>'+esc(navs.find(n=>n[0]===view)[1])+'</h2><div data-workspace-body></div></section>';
  const body=content.querySelector('[data-workspace-body]');
  if(view==='content'){if(readOnly)body.textContent='目前為唯讀預覽，請離開預覽後再管理網站內容。';else if(mountContentEditor)return mountContentEditor(body,api,output,signal);else body.textContent='此帳號或環境未開放活動設定與網站內容編輯。';return;}
  if(view==='overview'){
   const summaries=[
     [data.supportTasks.length,'需要協助','help'],
     [ctx.nx?data.rows.filter(row=>row.pending_review).length:0,'待發布審核','review'],
     [data.tasks.filter(task=>task.remaining_days<0).length,'交件已逾期','overdue'],
     [data.tasks.filter(task=>task.remaining_days>=0).length,'交件日期將近','urgent']
   ];
   const taskLinks=[
     ...(data.workTasks||[]),
     ...summaries.filter(([count])=>count>0).map(([count,label,filter])=>({view:'cases',filter,label:count+' 筆'+label}))
   ];
   body.innerHTML=`<div class="christmas-primary-stats">${(ctx.nx?[['全部心願',data.counts.total,'all'],[(api.config.publicWishBrowse===false?'已核准（未公開）':'已公開心願'),data.rows.filter(r=>r.publication_status==='approved').length,'published'],['已認領',data.counts.claimed,'claimed_all'],['尚待認領',data.counts.available,'available'],['待發布審核',data.rows.filter(r=>r.pending_review).length,'review'],['即將／已逾期交件',data.counts.urgent,'urgent'],['需要協助',data.supportTasks.length,'help'],['據點待書屋領取',data.counts.received,'pickup'],['書屋待送達',data.counts.custody,'handed_over']]:[['據點待領取',data.counts.received,'pickup'],['已領取待送達',data.counts.custody,'handed_over'],['待處理紙本文件',data.rows.filter(r=>r.claim_status==='delivered').reduce((n,r)=>n+Number(!['sent','not_required'].includes(r.thank_status))+Number(!['sent','not_required'].includes(r.proof_status)),0),'documents'],['已送達孩子',data.counts.delivered,'delivered'],['全部心願',data.counts.total,'all']]).map(([l,n,f])=>`<a class="christmas-stat" href="#christmas?view=${f==='documents'?'documents':'cases'}&filter=${f==='documents'?'documents_pending':f}"><span>${l}</span><strong>${n}</strong></a>`).join('')}</div>${Number.isSafeInteger(data.expectedDeliveryAt)&&data.expectedDeliveryAt<Date.now()/1000&&(data.counts.received+data.counts.custody)>0?'<p class="christmas-notice">預計發送日期已過，仍有禮物等待領取或送達。<a href="#christmas?view=cases&filter=undelivered">查看尚未送達案件</a></p>':''}<h3>工作待辦</h3><div data-overview-tasks>${taskLinks.map(t=>'<p><a href="#christmas?view='+encodeURIComponent(t.view)+'&filter='+encodeURIComponent(t.filter)+'">'+esc(t.label)+'</a></p>').join('')||'<p>目前沒有待辦事項。</p>'}</div><a class="btn btn-primary" href="#christmas?view=cases">查看心願案件</a>`;

   if(ctx.nx){
     const grid=body.querySelector('.christmas-primary-stats');
     const cards=[...grid.querySelectorAll('.christmas-stat')];
     const addCard=(label,count,href)=>{
       const card=document.createElement('a'),name=document.createElement('span'),number=document.createElement('strong');
       card.className='christmas-stat';card.href=href;name.textContent=label;number.textContent=count;
       card.append(name,number);return card;
     };
     const pendingFiles=data.rows.filter(row=>row.claim_status==='delivered'&&
       [row.thank_status,row.proof_status].some(status=>status&&!['sent','not_required'].includes(status))).length;
     const group=(title,items)=>{
       const section=document.createElement('section'),heading=document.createElement('h3'),contents=document.createElement('div');
       section.className='christmas-stat-group';heading.textContent=title;contents.className='christmas-primary-stats';
       contents.append(...items);section.append(heading,contents);return section;
     };
     grid.replaceWith(
       group('核心統計',[...cards.slice(0,3),addCard('已送達孩子',data.counts.delivered,'#christmas?view=cases&filter=delivered')]),
       group('待處理工作',[cards[4],cards[3],cards[6],cards[5]]),
       group('物流與文件',[cards[7],cards[8],addCard('文件待處理',pendingFiles,'#christmas?view=cases&filter=documents_pending')])
     );
   }
   if(intake&&fullMenu){
     const available=new Set(ctx.nx?['全部心願','已公開心願','已核准（未公開）','待發布審核']:['全部心願']);
     for(const card of body.querySelectorAll('.christmas-stat'))if(!available.has(card.querySelector('span').textContent))card.querySelector('strong').textContent='—';
     body.querySelector('[data-overview-tasks]').insertAdjacentHTML('beforebegin','<p>'+deliveryPause+'</p>');
     if(!taskLinks.length)body.querySelector('[data-overview-tasks]').textContent='收件、交接與送達的待辦暫不顯示。';
   }
  }else if(view==='cases')renderList(body);
  else if(view==='receiving'){if(intake)body.textContent=deliveryPause;else renderReceiving(body);}
  else if(view==='handoff'){if(intake&&(fullMenu||limited))body.textContent=deliveryPause;else if(limited)renderReceiving(body);else renderHandoffs(body);}
  else if(view==='documents'){
    body.innerHTML='<p>請開啟心願案件，分別確認紙本感謝卡與紙本捐贈證明的進度。</p>';renderList(body,true);
    if(ctx.kind==='bookhouse'&&(fullMenu||ctx.documents_export===1&&!readOnly)){
      mountMailingExport(body,api);
      if(fullMenu&&(intake||ctx.documents_export!==1||readOnly)){
        const form=body.querySelector('[data-mailing-export]');
        form.querySelector('[data-export-status]').textContent=intake?'交接與送達功能開放後，才可匯出紙本文件寄送資料。':'此工作階段未取得匯出授權。';
        for(const field of form.elements)field.disabled=true;
      }
    }
  }
  if(!['cases','documents'].includes(view))wireCases(body);
 }
 function wireCases(container){container.querySelectorAll('[data-open-case]').forEach(b=>b.addEventListener('click',()=>openCase(b.dataset.openCase)));}
 function renderList(body,documentsOnly=false){let selection=new Set(),filteredRows=[];
  if(!documentsOnly&&!intakeOpen&&ctx.permissions.includes('wish.write')){
   body.insertAdjacentHTML('beforeend','<p class="christmas-notice" data-intake-paused>'+intakePause+'</p>');
  }
  body.insertAdjacentHTML('beforeend',`<div class="christmas-list-tools"><label>搜尋心願編號、暱稱或禮物<input data-case-search type="search" value="${esc(query)}"></label><label>案件分類<select data-case-category>${[['all','全部心願'],['active','進行中'],['completed','已完成'],['help','需要協助']].map(([v,l])=>`<option value="${v}" ${category===v?'selected':''}>${l}</option>`).join('')}</select></label><details><summary>進階篩選</summary><label>進一步篩選<select data-case-stage>${[['all','全部階段'],['undelivered','已收件但尚未送達'],['documents_pending','待處理紙本文件'],['published',api.config.publicWishBrowse===false?'已核准（未公開）':'已公開'],['claimed_all','全部有效認領'],['urgent','即將／已逾期'],['help','需要協助'],['available','尚未認領'],['claimed','等待交件'],['gift_received','已收件'],['pickup','待交接'],['handed_over','書屋已領取'],['delivered','禮物已送達'],['overdue','逾期'],['review','待發布審核'],['draft','草稿']].map(([v,l])=>`<option value="${v}" ${stage===v?'selected':''}>${l}</option>`).join('')}</select></label><label>實際收件據點<select data-case-site><option value="all">全部據點</option>${ctx.collectionSites.map(s=>'<option value="'+esc(s.id)+'" '+(siteFilter===s.id?'selected':'')+'>'+esc(s.label)+'</option>').join('')}</select></label></details></div>${can('wish.write')&&!documentsOnly?'<button class="btn btn-primary" type="button" data-create-wish>新增心願</button>':''}${api.config.acceptanceMode&&ctx.nx?'<section class="christmas-panel" data-bulk-manager></section>':''}<div data-case-rows></div><div data-case-pages></div>`);
  const rows=body.querySelector('[data-case-rows]'),redraw=()=>{const q=query.trim().toLowerCase();const list=data.rows.filter(r=>(siteFilter==='all'||r.location_code===siteFilter)&&`${r.public_code} ${r.public_nickname} ${r.gift_name}`.toLowerCase().includes(q)&&(!documentsOnly||r.claim_status==='delivered')&&(category==='all'||category==='completed'&&r.claim_status==='delivered'||category==='help'&&(r.needsHelp||r.claim_status==='exception')||category==='active'&&r.claim_status!=='delivered')&&(stage==='all'||stage==='undelivered'&&['gift_received','handed_over','exception'].includes(r.claim_status)||stage==='documents_pending'&&r.claim_status==='delivered'&&[r.thank_status,r.proof_status].some(s=>!['sent','not_required'].includes(s))||stage==='published'&&r.publication_status==='approved'||stage==='claimed_all'&&!!r.claim_id||stage==='urgent'&&data.tasks.some(t=>t.id===r.id)||stage==='help'&&(r.needsHelp||r.claim_status==='exception')||stage==='review'&&r.pending_review||stage==='pickup'&&r.claim_status==='gift_received'||stage==='overdue'&&r.claim_status==='claimed'&&Number.isSafeInteger(r.gift_due_at)&&r.gift_due_at<Date.now()/1000||stage==='draft'&&r.publication_status==='draft'||stage===(r.claim_status||r.status))),slice=pageSlice(list,page);filteredRows=list;page=slice.page;
   rows.innerHTML=slice.rows.map(r=>`<article class="christmas-case-row">${api.config.acceptanceMode&&ctx.nx?`<label><input type="checkbox" data-select-wish="${esc(r.id)}" ${selection.has(r.id)?'checked':''}>選取 ${esc(r.public_code)}</label>`:`<strong>${esc(r.public_code)}</strong>`}<span>${esc(r.public_nickname||'孩子的心願')} · ${esc(r.gift_name)}</span><span>${esc(intake?intakeState(r):state(r))}${r.needsHelp?' · 需要協助':''}${!intake&&r.pending_review?' · 待審核':''}${r.gift_due_at?' · '+christmasDate(r.gift_due_at)+(r.claim_status==='claimed'&&Number.isSafeInteger(r.gift_due_at)&&r.gift_due_at<Date.now()/1000?' 已逾期':' 交件'):''}</span><button class="btn btn-secondary" type="button" data-open-case="${esc(r.id)}">開啟案件</button></article>`).join('')||'<p>沒有符合條件的案件。</p>';body.querySelector('[data-case-pages]').innerHTML=pagination(slice);wireCases(rows);rows.querySelectorAll('[data-select-wish]').forEach(i=>i.addEventListener('change',()=>{if(i.checked)selection.add(i.dataset.selectWish);else selection.delete(i.dataset.selectWish);}));body.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{page=Number(b.dataset.page);redraw();}));};
  if(intake)body.querySelector('.christmas-list-tools details').hidden=true;
  for(const [selector,key]of [['[data-case-search]','query'],['[data-case-category]','category'],['[data-case-stage]','stage'],['[data-case-site]','site']])body.querySelector(selector).addEventListener(key==='query'?'input':'change',e=>{if(key==='query')query=e.target.value;if(key==='category')category=e.target.value;if(key==='stage')stage=e.target.value;if(key==='site')siteFilter=e.target.value;page=1;redraw();});body.querySelector('[data-create-wish]')?.addEventListener('click',()=>editWish());redraw();if(api.config.acceptanceMode&&ctx.nx)mountBulkManager(body.querySelector('[data-bulk-manager]'),{api,getRows:()=>filteredRows,getSelected:()=>selection,setSelected:next=>{selection=next;redraw();},refresh:load});
 }
 function renderReceiving(body){
  const own=data.claims.filter(c=>c.location_code===ctx.unit_id),pending=own.filter(c=>c.status==='gift_received'&&!c.batchId);
  body.innerHTML=`<div class="christmas-primary-stats"><p class="christmas-stat">累積收件<strong>${own.length}</strong></p><p class="christmas-stat">待交接<strong>${pending.length}</strong></p><p class="christmas-stat">已建立交接<strong>${data.batches.length}</strong></p></div>`+form('lookup','登記收到禮物',select('method','查詢方式',[['code','心願編號'],['phone','電話輔助查詢']])+input('value','心願編號或電話'),'查詢心願')+'<div data-receiving-results></div><section class="christmas-panel"><h3>待交接禮物</h3><div data-batch-slot></div></section><section class="christmas-panel"><h3>已交接紀錄</h3>'+data.batches.map(b=>`<p>${esc(b.codes.join('、'))} · ${b.pendingCodes?.length?'等待書屋確認（含部分待領取）':'書屋已確認領取'} · ${esc(b.displayCode||b.id)}${b.issueCodes?.length?' · 交接異常：'+esc(b.issueCodes.join('、')):''} · ${b.planned_at?christmasDate(b.planned_at):'未填預計時間'}${b.creator?' · 建立人員：'+esc(b.creator)+' · '+christmasTime(b.created_at):''}</p>`).join('')+'</section>';
  const lookup=body.querySelector('[data-case-action=lookup]');
  if(view==='receiving')body.querySelector('[data-receiving-results]').after(body.querySelector('.christmas-primary-stats'));
  if(view==='handoff'){lookup.remove();body.querySelector('[data-receiving-results]').remove();mountBatch(body.querySelector('[data-batch-slot]'),pending);return;}
  lookup.elements.method.value=lookupState.method;lookup.elements.value.value=lookupState.value;
  const results=body.querySelector('[data-receiving-results]');
  bindForm(lookup,async f=>{
    results.textContent='正在查詢，請稍候…';
    let rows;
    if(f.get('method')==='phone')rows=await post('/workspace/phone',{phone:f.get('value')});
    else{
      const match=await post('/ops/search',{code:String(f.get('value')).trim().toUpperCase()}).catch(error=>{
        results.textContent='';
        if(error.code==='FULL_WISH_CODE_REQUIRED')throw new Error('代收請輸入完整心願編號（例如 NX-151）。');
        throw error;
      });
      if(match.status==='received_elsewhere'){results.textContent=match.public_code+' · 這份禮物已由其他據點收件，請勿重複登記。';return;}
      rows=match.claim?[match]:[];
    }
    results.innerHTML=rows.map((row,index)=>`<p><button class="btn btn-secondary" type="button" data-receipt-match="${index}">${esc(row.public_code)} · ${esc(row.gift_name)} · ${esc(row.specifications||'未另外指定規格')} · ${row.receipt?'核對並收件':'查看狀態'}</button></p>`).join('')||'<p>沒有可處理的認領，請再確認編號或電話。</p>';
    for(const button of results.querySelectorAll('[data-receipt-match]'))button.addEventListener('click',()=>{
      const row=rows[Number(button.dataset.receiptMatch)];
      if(row.receipt&&can('gift.receive'))openReceipt(row);
      else if(row.claim?.status!=='claimed')void openCase(row.id);
    });
  },false);
  if(view==='receiving'){const section=body.querySelector('[data-batch-slot]').closest('section');section.innerHTML='<h3>已收件歷程</h3>'+own.map(c=>'<p><button type="button" data-open-case="'+esc(c.wish_id)+'">'+esc(c.public_code)+' · '+esc(c.gift_name)+'</button> · '+esc(statuses[c.status]||'已收件')+'</p>').join('')+'<a class="btn btn-secondary" href="#christmas?view=handoff">前往待交接禮物</a>';}
 }
 function openReceipt(row){
  const modal=openChristmasDialog({title:'確認收到禮物',onClose:()=>content.querySelector('[name=value]')?.focus()});
  const cross=row.receipt.crossSite;
  modal.body.innerHTML=`<p>${esc(row.public_code)} · ${esc(row.gift_name)} · ${esc(row.specifications||'未另外指定規格')}</p>`+
    (cross?`<p class="christmas-notice">原指定據點為 ${esc(row.receipt.originalSite)}，實際收件據點為 ${esc(row.receipt.actualSite)}。</p>`:'')+
    form('receipt','登記收件',input('quantity','收到件數','number','1')+
      '<label><input type="checkbox" name="confirmed" required>已核對心願編號、禮物及件數</label>'+
      (cross?'<label><input type="checkbox" name="crossSiteConfirmed" required>確認民眾改至其他合作據點交件</label>':'')+
      area('note','收件說明（選填）','',false));
  bindForm(modal.body.querySelector('form'),f=>post('/ops/fulfillment',{kind:'receipt',payload:{
    claimId:row.claim.id,wishCode:row.public_code,expectedVersion:row.claim.version,locationCode:ctx.unit_id,
    quantity:Number(f.get('quantity')),note:f.get('note'),manuallyConfirmed:f.has('confirmed'),crossSiteConfirmed:f.has('crossSiteConfirmed')
  }}),false,async()=>{
    lookupState={method:'code',value:''};
    const lookup=content.querySelector('[name=value]');if(lookup)lookup.value='';
    modal.close();
    const confirmation=row.public_code+' 已完成收件，等待交接給孩子的書屋。';
    output.textContent=confirmation;
    try{await load();output.textContent=confirmation;}
    catch{output.textContent=confirmation+' 清單未能更新，請重新整理。';}
  });
 }
 function mountBatch(slot,claims){if(!claims.length){slot.innerHTML='<p>目前沒有尚未建立交接的禮物。</p>';return;}
  slot.innerHTML=form('batch','建立本次交接',`<fieldset><legend>勾選要交給孩子的書屋的禮物</legend>${claims.map(c=>`<label><input name="items" type="checkbox" value="${esc(c.id)}">${esc(c.public_code)} · ${esc(c.gift_name)}</label>`).join('')}</fieldset>`+input('plannedAt','預計取件時間（選填）','datetime-local','',false)+area('note','交接說明（選填）','',false),'建立交接紀錄');bindForm(slot.querySelector('form'),async f=>{const ids=f.getAll('items');if(!ids.length)throw Error('請至少勾選一份禮物。');return post('/ops/fulfillment',{kind:'batch',payload:{organisationId:ctx.bookhouseId,items:ids.map(id=>({claimId:id,expectedVersion:claims.find(c=>c.id===id).version})),locationCode:ctx.unit_id,plannedAt:f.get('plannedAt')?Date.parse(f.get('plannedAt')+'+08:00')/1000:null,note:f.get('note')||''}});});
 }
 function renderHandoffs(body){body.innerHTML='<label>收件據點<select data-handoff-site><option value="all">全部據點</option>'+ctx.collectionSites.map(s=>'<option value="'+esc(s.id)+'">'+esc(s.label)+'</option>').join('')+'</select></label><p>開啟案件後，可核對本次交接、確認書屋已領取，再記錄禮物送達孩子手中。</p>'+data.batches.map(b=>`<section class="christmas-panel" data-handoff-location="${esc(b.collection_unit_id)}"><p>${esc(ctx.collectionSites.find(s=>s.id===b.collection_unit_id)?.label||'收件據點')}</p><h3>${b.pendingCodes?.length?'等待書屋領取／核對':'已領取'} · ${esc(b.id)}</h3><p>${esc(b.codes.join('、'))} · ${(b.quantity??b.codes.length)} 件 · ${b.creator?esc(b.creator)+' · '+christmasTime(b.created_at)+' · ':''}${b.planned_at?christmasDate(b.planned_at):'未填預計時間'}</p>${b.codes.map(code=>{const r=data.rows.find(r=>r.public_code===code);return r?`<button class="btn btn-secondary" type="button" data-open-case="${esc(r.id)}">${esc(code)} 開啟案件</button>`:'';}).join('')}</section>`).join('');body.querySelector('[data-handoff-site]').addEventListener('change',e=>body.querySelectorAll('[data-handoff-location]').forEach(row=>row.hidden=e.target.value!=='all'&&row.dataset.handoffLocation!==e.target.value));
  const ready=data.claims.filter(c=>c.status==='handed_over');if(ready.length&&can('gift.deliver')){body.insertAdjacentHTML('beforeend',form('bulk-delivery','多筆確認送達','<fieldset><legend>本次確實已交到孩子手中的禮物</legend>'+ready.map(c=>'<label><input type="checkbox" name="claims" value="'+esc(c.id)+'">'+esc(c.public_code)+' · '+esc(c.gift_name)+'</label>').join('')+'</fieldset>'+input('date','實際送達日期','date',christmasDate(Math.floor(Date.now()/1000)))+'<label><input type="checkbox" required>已逐筆依實際發放紀錄核對</label>','確認本次送達'));bindForm(body.querySelector('[data-case-action=bulk-delivery]'),async f=>{const ids=f.getAll('claims');if(!ids.length)throw Error('請勾選本次已送達的心願。');let done=0;for(const id of ids){const c=ready.find(c=>c.id===id);try{await post('/ops/fulfillment',{kind:'delivery',payload:{claimId:id,expectedVersion:c.version,handoffId:c.batchId,deliveredAt:f.get('date')===christmasDate(Math.floor(Date.now()/1000))?Math.floor(Date.now()/1000):Date.parse(f.get('date')+'T23:59:59+08:00')/1000,manuallyConfirmed:true,note:'書屋本次分批發放'}});done++;}catch(error){await load();throw Error('已完成 '+done+' 筆；'+c.public_code+' 尚未確認：'+error.message);}}return {recorded:done};});}
 }
 function bindForm(element,action,refresh=true,after=null){element.addEventListener('submit',async e=>{e.preventDefault();const button=element.querySelector('button[type=submit],button:not([type])'),status=element.querySelector('[data-form-status]');if(button.disabled)return;button.disabled=true;status.textContent='處理中，請稍候…';try{await action(new FormData(element));status.textContent='已儲存。';if(after)await after();if(refresh)await load();}catch(error){status.textContent=error.message;}finally{if(button.isConnected)button.disabled=false;}});}
 async function openCase(wishId){const modal=openChristmasDialog({title:'心願案件',onClose:()=>{if(limited)content.querySelector('[name=value]')?.focus();}});let row;
  const refresh=async()=>{row=await post('/workspace/case',{wishId});if(!modal.dialog.open)return;renderDetail();};
  const act=(name,path,body)=>{const f=modal.body.querySelector('[data-case-action='+name+']');if(f)bindForm(f,async data=>post(path,typeof body==='function'?body(data):body),false,async()=>{if(name==='receipt'&&limited){lookupState={method:'code',value:''};const lookup=content.querySelector('[name=value]');if(lookup)lookup.value='';await load();modal.close();output.textContent=row.wish.public_code+' 已完成收件，等待交接給孩子的書屋。';content.querySelector('[name=value]')?.focus();}else{await refresh();await load();}});};
  function renderDetail(){const w=row.wish,c=row.active,d=row.documents,canReceive=c?.status==='claimed'&&can('gift.receive');const latestIssues=[...new Map(row.issues.map(i=>[i.topicId,i])).values()];
   modal.body.innerHTML=`<p class="christmas-code">${esc(w.public_code)}</p><h2>${esc(w.gift_name)}</h2><p>${esc(w.public_nickname||'孩子的心願')} · ${esc(statuses[c?.status||w.status]||'草稿')}</p><section class="christmas-panel"><h3>心願基本資料</h3><p>${esc(w.description)}</p><p>${esc(w.specifications||'請依心願內容準備。')}</p>${can('wish.write')?'<button type="button" data-edit-basic>編輯心願資料</button>':''}</section>${c?`<section class="christmas-panel"><h3>認領與交付進度</h3><p>認領日期：${christmasDate(c.claimed_at)}｜交件期限：${Number.isSafeInteger(c.gift_due_at)?christmasDate(c.gift_due_at):'???'}</p><ol class="christmas-case-stages"><li>認領成功</li><li>${row.locationCode?'據點已收件':'等待交件'}</li><li>${['handed_over','delivered'].includes(c.status)?'書屋已領取':row.batch?'等待書屋領取':'尚未交接'}</li><li>${c.status==='delivered'?'禮物已送達':'尚未確認送達'}</li><li>紙本感謝卡：${esc(documentLabel(d?.thank_status))}；紙本捐贈證明：${esc(documentLabel(d?.proof_status))}</li></ol></section>`:'<p>這份心願目前沒有進行中的認領。</p>'}${row.delivery?'<p>實際送達日期：'+christmasDate(row.delivery.delivered_at)+' · 確認人員：孩子的書屋 · 操作時間：'+christmasTime(row.delivery.recordedAt)+' · '+esc(row.delivery.note)+'</p>':''}<div data-case-actions></div><section class="christmas-panel"><h3>需要協助</h3><div data-support-list>${latestIssues.map(i=>`<article><h4>${esc(i.type)} · ${i.status==='open'?'待處理':'已處理'}</h4><p>${esc(i.description)}</p><p>聯絡紀錄：${esc(i.contact||'尚無')}</p><p>處理結果：${esc(i.result||'尚未完成')}</p><p>${esc(i.handler)} · ${christmasTime(i.createdAt)}</p><button type="button" data-edit-support="${esc(i.topicId)}">更新處理紀錄</button></article>`).join('')||'<p>目前沒有需要協助的事項。</p>'}</div><button type="button" data-new-support>記錄需要協助的事項</button><div data-support-form></div></section>${!api.config.acceptanceMode||ctx.nx?`<details class="christmas-panel"><summary>操作歷程與歷次認領</summary>${row.claims.map(c=>`<p>${christmasDate(c.claimed_at)} · ${esc(statuses[c.status]||c.status)}</p>`).join('')}${row.history.map(e=>`<p>${christmasTime(e.created_at)} · ${esc(e.handler)} · ${esc(actionLabel(e.action))}${reasonLabel(e.reference)?' · '+esc(reasonLabel(e.reference)):''}</p>`).join('')}${row.issues.map(e=>`<p>${christmasTime(e.createdAt)} · ${esc(e.handler)} · ${esc(e.type)}：${esc(e.result||e.description)}</p>`).join('')}</details>`:''}`;
   modal.body.querySelector('[data-edit-basic]')?.addEventListener('click',()=>editWish(w,modal));const slot=modal.body.querySelector('[data-case-actions]');modal.body.querySelector('h2').insertAdjacentHTML('afterend','<p>公開狀態：'+(w.publication_status==='approved'?(api.config.publicWishBrowse===false?'已核准（未公開）':'已公開'):'草稿')+'</p>');
   modal.body.querySelector('h2').nextElementSibling.after(slot);
   if(ctx.nx&&can('staff.manage')&&api.config.testCleanupPreviewId===w.id){
    slot.insertAdjacentHTML('beforeend','<section class="christmas-panel"><h3>測試案件清理</h3><p>請先檢查這筆案件的關聯筆數。只有符合條件及已授權的測試案件可清理。</p><button type="button" class="btn btn-secondary" data-test-cleanup-preview>檢查關聯資料</button><details data-test-cleanup-reauth><summary>高權限重新驗證</summary><form><p>請輸入目前登入的 Super Admin 密碼及驗證器的新六位數驗證碼。</p><label>目前密碼<input name="password" type="password" autocomplete="current-password" required></label><label>驗證器代碼<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required></label><button type="submit" class="btn btn-primary">驗證並檢查關聯資料</button><p role="status"></p></form></details><div data-test-cleanup-result role="status"></div></section>');
    const button=slot.querySelector('[data-test-cleanup-preview]'),result=slot.querySelector('[data-test-cleanup-result]');
    const verification=slot.querySelector('[data-test-cleanup-reauth]');
    const verificationForm=verification.querySelector('form');
    verificationForm.addEventListener('submit',async event=>{
     event.preventDefault();
     const submit=verificationForm.querySelector('button'),status=verificationForm.querySelector('[role=status]');
     if(submit.disabled)return;
     submit.disabled=true;
     status.textContent='驗證中…';
     const {password,code}=verificationForm.elements;
     const body=JSON.stringify({password:password.value,code:code.value});
     verificationForm.reset();
     try{
      const response=await fetch('/christmas-api/staff-auth/step-up',{
       method:'POST',credentials:'same-origin',cache:'no-store',
       headers:{'Content-Type':'application/json'},body
      });
      if(!verification.isConnected)return;
      if(response.status===429){status.textContent='驗證次數過多，請稍後再試。';return;}
      if(!response.ok || (await response.json()).elevated!==true){
       status.textContent='重新驗證未通過。請確認登入狀態、密碼，並使用驗證器的新代碼。';
       return;
      }
      status.textContent='';
      verification.open=false;
      button.focus();
      button.click();
     }catch{
      status.textContent='無法連線完成驗證，請稍後再試。';
     }finally{submit.disabled=false;}
    });
    button.addEventListener('click',async()=>{
     button.disabled=true;
     try{
      const preview=await api.admin('/ops/retention/test-preview',{id:w.id,confirmId:w.id});
      const labels={privateProfiles:'兒童非公開資料',claims:'認領',receipts:'收件',handoffItems:'交接關聯',deliveries:'送達',paperEvents:'紙本文件事件',evidence:'憑證',media:'媒體',validOwnerSessions:'有效認領者工作階段',sharedContacts:'共用聯絡資料',sharedPortals:'共用認領者帳戶',sharedHandoffs:'共用交接',sharedEvidence:'共用附件'};
      result.innerHTML='<p>'+esc(preview.public_code)+' · '+esc(preview.id)+'</p><dl>'+Object.entries(labels).map(([key,label])=>'<dt>'+label+'</dt><dd>'+esc(preview[key])+'</dd>').join('')+'</dl>';
      if(preview.deletionSupported){
       result.insertAdjacentHTML('beforeend',form('test-cleanup','確認刪除測試案件',input('publicCode','請輸入 NX-001')+
        '<label><input name="confirmed" type="checkbox" required>我已核對預檢，確認這是要清理的測試案件。</label>','永久清理測試案件'));
       const cleanup=result.querySelector('[data-case-action=test-cleanup]');
       bindForm(cleanup,async fields=>{
        if(fields.get('publicCode')!==preview.public_code||!fields.has('confirmed'))throw Error('請輸入正確編號並確認。');
        return api.admin('/ops/retention/test-cleanup',{id:w.id,confirmId:preview.id,publicCode:fields.get('publicCode'),wishVersion:preview.wishVersion,claimVersion:preview.claimVersion,scopeCounts:preview.scopeCounts});
       },false,async()=>{modal.close();await load();output.textContent='測試案件已清理。';});
      }
     }catch(error){
      if(error.code==='REAUTH_REQUIRED'){
       verification.open=true;
       verificationForm.elements.password.focus();
       result.textContent='請在本區完成高權限重新驗證，再檢查關聯資料。';
      }else result.textContent=error.message;
     }
     finally{button.disabled=false;}
    });
   }
   if(api.config.wishUnpublish&&ctx.nx&&can('staff.manage')&&w.publication_status==='approved'){
    const key=crypto.randomUUID();
    slot.insertAdjacentHTML('beforeend',form('unpublish','停止公開','<label><input type="checkbox" required>確認停止公開。書屋仍可處理此案件。</label>','停止公開'));
    bindForm(slot.querySelector('[data-case-action=unpublish]'),
     ()=>post('/ops/wish-unpublish',{wishId:w.id,expectedVersion:w.version},key),false,
     async()=>{await refresh();await load();output.textContent=w.public_code+' 已停止公開。';});
   }
   if(intake){
    modal.body.querySelector('[data-support-list]').closest('section').hidden=true;
    modal.body.querySelector('details summary').textContent='操作歷程';
    modal.body.querySelector('h2').nextElementSibling.textContent='審核狀態：'+(row.proposals.some(p=>p.status==='pending')?'待審核':w.publication_status==='approved'?'已核准（尚未對外公開）':'草稿');
   }
   if(ctx.kind!=='collection'){
    const review=document.createElement('section');review.className='christmas-panel';slot.prepend(review);review.innerHTML='<h3>發布審核</h3>'+row.proposals.map(p=>'<p>'+esc(p.status==='pending'?'待審核':p.status==='approved'?'已核准':'退回修改')+' · '+christmasTime(p.created_at)+(p.return_reason?' · '+esc(p.return_reason):'')+'</p>').join('');
    if(!row.proposals.some(p=>p.status==='pending')&&w.publication_status==='draft'&&can('wish.write')){review.insertAdjacentHTML('beforeend',form('submit-review','提交 NXSPACE 審核','<p>核准與對外開放是分開的設定。</p>','提交審核'));act('submit-review','/ops/wish-submit',{wishId:w.id,expectedVersion:w.version});}
    review.insertAdjacentHTML('beforeend','<button type="button" class="btn btn-secondary" data-public-preview>預覽民眾看到的內容</button>');review.querySelector('[data-public-preview]').addEventListener('click',()=>{const p=row.proposals.find(p=>p.status==='pending'),v=p?JSON.parse(p.payload):{giftName:w.gift_name,publicNickname:w.public_nickname,description:w.description,specifications:w.specifications};const preview=openChristmasDialog({title:'公開心願預覽'});preview.body.innerHTML='<p>'+esc(w.public_code)+' · '+esc(v.publicNickname)+'</p><h2>'+esc(v.giftName)+'</h2><p>'+esc(v.description)+'</p><p>'+esc(v.specifications)+'</p><p>預覽尚未公開，請核對不含兒童真名或聯絡資料。</p>';});
   }
   if(canReceive){slot.insertAdjacentHTML('beforeend',form('receipt','確認收到禮物',(ctx.nx?select('locationCode','實際收件據點',ctx.collectionSites.map(s=>[s.id,s.label])):'')+input('quantity','收到件數','number','1')+'<label><input type="checkbox" name="confirmed" required>已核對心願編號、禮物及件數</label>'+area('note','收件說明（選填）','',false)));act('receipt','/ops/fulfillment',f=>({kind:'receipt',payload:{claimId:c.id,wishCode:w.public_code,expectedVersion:c.version,locationCode:f.get('locationCode')||ctx.unit_id,quantity:Number(f.get('quantity')),note:f.get('note'),manuallyConfirmed:f.has('confirmed')}}));}
   if(c?.status==='gift_received'&&!row.batch&&ctx.nx&&!readOnly){slot.insertAdjacentHTML('beforeend',form('correct-location','更正收件據點',select('newLocation','正確據點',ctx.collectionSites.map(s=>[s.id,s.label]))+area('reason','更正原因'),'確認更正'));act('correct-location','/ops/correct-location',f=>({claimId:c.id,oldLocation:row.locationCode,newLocation:f.get('newLocation'),note:f.get('reason')}));}
   if(c?.status==='gift_received'&&!row.batch&&can('gift.handoff')){slot.insertAdjacentHTML('beforeend',form('single-batch','交給孩子的書屋',input('plannedAt','預計取件時間（選填）','datetime-local','',false),'建立本次交接'));act('single-batch','/ops/fulfillment',f=>({kind:'batch',payload:{organisationId:ctx.bookhouseId,items:[{claimId:c.id,expectedVersion:c.version}],locationCode:row.locationCode,plannedAt:f.get('plannedAt')?Date.parse(f.get('plannedAt')+'+08:00')/1000:null,note:''}}));}
   if(row.batch?.items.some(i=>!i.accepted)&&can('gift.accept')){slot.insertAdjacentHTML('beforeend',form('accept','書屋確認已領取','<p>批次編號：'+esc(row.batch.displayCode||row.batch.id)+' · 原批次共 '+row.batch.quantity+' 件</p><fieldset><legend>勾選本次實際領取的正常禮物；未勾選者仍待領取</legend>'+row.batch.items.filter(i=>!i.accepted).map(i=>'<label><input type="checkbox" name="checkedItems" value="'+esc(i.claim_id)+'" checked>'+esc(i.public_code)+' · '+i.quantity+' 件</label><button class="btn btn-secondary" type="button" data-batch-missing="'+esc(i.wish_id)+'" data-missing-claim="'+esc(i.claim_id)+'">'+esc(i.public_code)+' 記錄缺件</button>').join('')+'</fieldset><label><input name="confirmed" type="checkbox" required>已核對本次領取的禮物；個別問題另記於案件的需要協助</label>'));act('accept','/ops/fulfillment',f=>({kind:'accept',payload:{batchId:row.batch.id,expectedVersion:row.batch.version,handedAt:Math.floor(Date.now()/1000),checkedItems:f.getAll('checkedItems'),receivedQuantity:row.batch.items.filter(i=>f.getAll('checkedItems').includes(i.claim_id)).reduce((sum,i)=>sum+i.quantity,0)}}));}
   slot.querySelectorAll('[data-batch-missing]').forEach(b=>b.addEventListener('click',async()=>{b.disabled=true;try{await post('/workspace/support',{wishId:b.dataset.batchMissing,expectedVersion:0,status:'open',type:'交接缺件',description:'書屋核對交接 '+(row.batch.displayCode||'本次交接')+'，本件尚未實際領取。',contact:'',result:''});const checkbox=slot.querySelector('[name=checkedItems][value="'+CSS.escape(b.dataset.missingClaim)+'"]');if(checkbox)checkbox.checked=false;b.textContent='缺件已記錄，正常禮物可繼續領取';await load();}catch(error){output.textContent=error.message;b.disabled=false;}}));
   if(c?.status==='handed_over'&&can('gift.deliver')){slot.insertAdjacentHTML('beforeend',form('delivery','確認禮物已送達孩子',input('deliveredAt','實際送達日期','date',christmasDate(Math.floor(Date.now()/1000)))+'<label><input name="confirmed" type="checkbox" required>已依紙本紀錄核對，禮物確實交到孩子手中</label>'+area('note','必要備註（選填）','',false)));act('delivery','/ops/fulfillment',f=>({kind:'delivery',payload:{claimId:c.id,expectedVersion:c.version,handoffId:row.batch.id,deliveredAt:f.get('deliveredAt')===christmasDate(Math.floor(Date.now()/1000))?Math.floor(Date.now()/1000):Date.parse(f.get('deliveredAt')+'T23:59:59+08:00')/1000,note:f.get('note'),manuallyConfirmed:f.has('confirmed')}}));}
   if(c?.status==='delivered'&&ctx.kind==='bookhouse'&&can('case.manage')&&!d.closed_at){
    const pending=['thanks','proof'].filter(kind=>!['sent','not_required'].includes(d[kind==='thanks'?'thank_status':'proof_status']));
    slot.insertAdjacentHTML('beforeend',form('documents','紙本文件','<p>兩項文件均由孩子的書屋製作、交付及聯繫。實物捐贈證明由孩子的書屋依相關規定辦理。</p><fieldset><legend>選擇本次要更新的文件（可複選）</legend>'+[['thanks','孩子的感謝卡'],['proof','實物捐贈證明']].map(([v,l])=>'<label><input name="documentType" type="checkbox" value="'+v+'" '+(pending.includes(v)?'':'disabled')+'>'+l+'：'+documentLabel(d[v==='thanks'?'thank_status':'proof_status'])+'</label>').join('')+'</fieldset>'+select('nextStatus','處理進度',[['ready_to_send','已製作或開立，待交付'],['sent','已交付'],...(!api.config.acceptanceMode?[['close','必要作業完成，結案']]:[])])+input('completedAt','完成日期','date',christmasDate(Math.floor(Date.now()/1000)))+select('deliveryMethod','交付方式',[['postal','紙本郵寄'],['in_person','當面交付']])+area('reference','處理備註（選填）','',false),'更新紙本文件進度'));
    const documents=slot.querySelector('[data-case-action=documents]');if(documents.elements.nextStatus.querySelector('[value=close]'))documents.elements.nextStatus.querySelector('[value=close]').disabled=pending.length>0;if(!pending.length){if(api.config.acceptanceMode)documents.hidden=true;else documents.elements.nextStatus.value='close';}
    bindForm(documents,async f=>f.get('nextStatus')==='close'?post('/ops/case',{claimId:c.id,expectedVersion:d.version,kind:'close',reference:f.get('reference')}):post('/workspace/documents',{claimId:c.id,expectedVersion:d.version,documents:f.getAll('documentType'),nextStatus:f.get('nextStatus'),completedAt:f.get('completedAt')===christmasDate(Math.floor(Date.now()/1000))?Math.floor(Date.now()/1000):Date.parse(f.get('completedAt')+'T23:59:59+08:00')/1000,deliveryMethod:f.get('deliveryMethod'),note:f.get('reference')||''}),false,async()=>{await refresh();await load();});
    slot.insertAdjacentHTML('beforeend',(api.config.acceptanceMode?[...new Map(row.paperHistory.map(e=>[e.documentType,e])).values()]:row.paperHistory).map(e=>'<p>'+(e.documentType==='thanks'?'孩子的感謝卡':'實物捐贈證明')+' · '+documentLabel(e.nextStatus)+' · '+(e.completedAt?christmasDate(e.completedAt):'尚待寄送')+' · '+(e.deliveryMethod==='postal'?'紙本郵寄':'當面交付')+' · '+esc(e.handler)+' · '+esc(e.note)+(e.mailingSnapshot?' · 當次寄送：'+esc(e.mailingSnapshot.recipientName)+' · '+esc(e.mailingSnapshot.postalCode)+' '+esc(e.mailingSnapshot.postalAddress):'')+'</p>').join(''));
   }
   if(ctx.permissions.includes('child.read')){slot.insertAdjacentHTML('beforeend','<details class="christmas-panel" data-child-panel><summary>兒童不公開資料</summary><div data-child-result role="status"></div></details>');const panel=slot.querySelector('[data-child-panel]');let loading=false,loaded=false;panel.addEventListener('toggle',async()=>{if(!panel.open||loaded||loading)return;loading=true;const result=panel.querySelector('[data-child-result]');result.textContent='正在載入…';try{const p=await post('/ops/child',{wishId:w.id});if(!modal.dialog.open)return;loaded=true;result.innerHTML='<p>兒童真實姓名：'+esc(p.realName)+'</p><p>必要聯絡資料：'+esc(p.necessaryContact)+'</p><p>內部備註：'+esc(p.internalNote)+'</p>';}catch(error){result.textContent=error.message;}finally{loading=false;}});}
   if(api.config.acceptanceMode&&!ctx.nx){
    if(c&&can('contact.read')){slot.insertAdjacentHTML('beforeend','<section class="christmas-panel"><h3>必要聯絡資訊</h3><div data-direct-contact role="status">正在載入授權資料…</div></section>');const target=slot.querySelector('[data-direct-contact]');queueMicrotask(async()=>{try{const p=await post('/ops/profile',{claimId:c.id});if(!modal.dialog.open||!target.isConnected)return;target.innerHTML='<p>'+esc(p.contactName)+' · '+esc(p.phone)+' · '+esc(p.email)+'</p><div data-mailing-correction></div>';const {mountMailingCorrection}=await import('./christmas-direct.js');await mountMailingCorrection(target.querySelector('[data-mailing-correction]'),api,c.id,'',output,ctx.nx);}catch(error){if(target.isConnected)target.textContent=error.message;}});}
   }else{
   if(c&&can('contact.read')){slot.insertAdjacentHTML('beforeend','<details class="christmas-panel"><summary>必要聯絡資訊與紙本收件資料</summary>'+(!ctx.nx?'<label>查閱原因<input data-contact-reason required maxlength="100" placeholder="例如：核對交件安排"></label>':'')+'<button type="button" data-contact>載入這份認領的聯絡資料</button><div data-contact-slot></div></details>');modal.body.querySelector('[data-contact]').addEventListener('click',async e=>{e.target.disabled=true;try{const reason=modal.body.querySelector('[data-contact-reason]')?.value.trim();if(!ctx.nx&&(!reason||reason.length<2))throw Error('請填寫查閱這筆聯絡資料的業務原因。');const p=await post('/ops/profile',{claimId:c.id,reason});if(api.config.directMode){const target=modal.body.querySelector('[data-contact-slot]');target.innerHTML='<p>'+esc(p.contactName)+' · '+esc(p.phone)+' · '+esc(p.email)+'</p><div data-mailing-correction></div>';const {mountMailingCorrection}=await import('./christmas-direct.js');await mountMailingCorrection(target.querySelector('[data-mailing-correction]'),api,c.id,reason,output);return;}if(ctx.nx){modal.body.querySelector('[data-contact-slot]').innerHTML='<p>'+esc(p.contactName)+' · '+esc(p.phone)+' · '+esc(p.email)+'</p><p>文件寄送資料由孩子的書屋管理。</p>';return;}mountDonorProfile(modal.body.querySelector('[data-contact-slot]'),p,async profile=>{await post('/ops/profile/save',{claimId:c.id,expectedVersion:p.profileVersion,profile,reason:'case_contact_update'});await refresh();await load();},output);}catch(error){output.textContent=error.message;e.target.disabled=false;}});}
   }
   if(c?.status==='claimed'&&can('claim.cancel')){slot.insertAdjacentHTML('beforeend',form('extend','調整交件期限',input('date','延長至哪一天','date')+area('reason','調整原因'),'確認延長期限')+form('cancel','取消認領並重新開放',select('cancellationType','取消原因',[['donor_cancel','認領者主動取消'],['overdue_confirmed','逾期未交件，經確認後取消'],['duplicate','重複認領或資料有誤'],['other','其他原因']])+area('reason','原因說明')+'<label><input type="checkbox" required>已核對認領紀錄，確認要取消並重新開放</label>','確認取消並重新開放'));act('extend','/ops/deadline',f=>({claimId:c.id,expectedVersion:c.version,newDueAt:Date.parse(f.get('date')+'T23:59:59+08:00')/1000,reason:f.get('reason')}));bindForm(slot.querySelector('[data-case-action=cancel]'),async f=>{return post('/ops/release',{claimId:c.id,expectedVersion:c.version,expectedWishVersion:w.version,reason:f.get('cancellationType')==='overdue_confirmed'?'overdue_confirmed':'donor_cancel',note:({donor_cancel:'認領者主動取消',overdue_confirmed:'逾期未交件，經確認後取消',duplicate:'重複認領或資料有誤',other:'其他原因'}[f.get('cancellationType')])+'：'+f.get('reason')});},false,async()=>{await refresh();await load();});}
   if(!c&&['cancelled','expired'].includes(w.status)&&can('wish.reopen')){slot.insertAdjacentHTML('beforeend',form('reopen','重新開放心願',area('reason','重新開放原因'),'確認重新開放'));bindForm(slot.querySelector('[data-case-action=reopen]'),async f=>{await post('/workspace/support',{wishId:w.id,expectedVersion:0,status:'resolved',type:'重新開放',description:f.get('reason'),contact:'',result:'已核對重新開放原因'});return post('/ops/reopen',{wishId:w.id,expectedVersion:w.version});},false,async()=>{await refresh();await load();});}
   if(c&&ctx.nx&&!readOnly&&api.config.directMode){slot.insertAdjacentHTML('beforeend',form('pin-reset','核對身分後重設 PIN',select('identityMethod','核對方式',[['phone_and_record','通話並核對認領資料'],['in_person_and_record','現場核對身分與認領資料']])+area('reference','身分及案件核對紀錄（不得填入 PIN）')+input('pin','新的四位數字 PIN','password')+input('pinConfirm','再次輸入 PIN','password')+'<label><input name="identityConfirmed" type="checkbox" required>已經核對本人身分及認領紀錄</label>','確認重設 PIN'));const pf=slot.querySelector('[data-case-action=pin-reset]');for(const k of ['pin','pinConfirm']){pf.elements[k].pattern='[0-9]{4}';pf.elements[k].maxLength=4;pf.elements[k].inputMode='numeric';}act('pin-reset','/workspace/pin-reset',f=>({claimId:c.id,pin:f.get('pin'),pinConfirm:f.get('pinConfirm'),identityMethod:f.get('identityMethod'),reference:f.get('reference'),identityConfirmed:f.has('identityConfirmed')}));}
   if(row.proposals?.some(p=>p.status==='pending')&&ctx.nx&&intakeOpen&&can('staff.manage')){slot.insertAdjacentHTML('beforeend',row.proposals.filter(p=>p.status==='pending').map(p=>{const proposed=JSON.parse(p.payload);return form('proposal-'+p.id,'確認書屋提出的修改','<p>'+esc(proposed.giftName)+' · '+esc(proposed.description)+'</p>'+select('decision','處理方式',[['approved',api.config.publicWishBrowse===false?'核准（尚未對外公開）':'確認發布'],['rejected','退回修改']])+area('reason','退回原因（退回時必填）','',false),'確認審核');}).join(''));for(const proposal of row.proposals.filter(p=>p.status==='pending'))act('proposal-'+proposal.id,'/ops/proposal-review',f=>({proposalId:proposal.id,decision:f.get('decision'),reason:f.get('reason')}));}
   if(c&&ctx.nx&&!readOnly&&!api.config.directMode){slot.insertAdjacentHTML('beforeend',`<details class="christmas-panel"><summary>協助認領者重設密碼</summary>${form('reset','核對身分後重設',select('identityMethod','核對方式',[['phone_and_record','通話並核對認領資料'],['in_person_and_record','現場核對身分與認領資料']])+area('reference','核對紀錄（請勿記錄密碼）')+input('temporaryPassword','暫時密碼（12–128字元）','password')+'<label><input type="checkbox" required>已核對身分，並會請本人登入後立即更換密碼</label>','確認重設密碼')}</details>`);act('reset','/workspace/password-reset',f=>({claimId:c.id,identityMethod:f.get('identityMethod'),reference:f.get('reference'),temporaryPassword:f.get('temporaryPassword')}));}
   if(readOnly)modal.body.querySelectorAll('[data-new-support],[data-edit-support]').forEach(b=>b.disabled=true);
   modal.body.querySelector('[data-new-support]').addEventListener('click',()=>supportForm());modal.body.querySelectorAll('[data-edit-support]').forEach(b=>b.addEventListener('click',()=>supportForm(latestIssues.find(i=>i.topicId===b.dataset.editSupport))));
   if(c?.status==='exception'&&can('gift.exception')){slot.insertAdjacentHTML('beforeend',form('resolve','確認既有問題已處理',area('note','處理結果'),'恢復原交付進度'));act('resolve','/ops/fulfillment',f=>({kind:'resolve',payload:{claimId:c.id,expectedVersion:c.version,reasonCode:'reviewed_corrected',note:f.get('note')}}));}
  }
  function supportForm(issue=null){const slot=modal.body.querySelector('[data-support-form]');slot.innerHTML=form('support','需要協助的事項',input('type','問題類型','text',issue?.type||'禮物交付')+area('description','問題說明',issue?.description||'')+area('contact','聯絡紀錄（選填）',issue?.contact||'',false)+select('status','處理狀態',[['open','待處理'],['resolved','已處理']])+area('result','處理結果（結案時必填）',issue?.result||'',false),'儲存處理紀錄');if(issue)slot.querySelector('[name=status]').value=issue.status;act('support','/workspace/support',f=>({wishId,topicId:issue?.topicId,expectedVersion:issue?.version||0,status:f.get('status'),type:f.get('type'),description:f.get('description'),contact:f.get('contact'),result:f.get('result')}));}
  modal.body.textContent='正在載入心願案件…';try{await refresh();}catch(error){modal.body.textContent=error.message;}
 }
 function editWish(w=null,parent=null){const modal=parent||openChristmasDialog({title:'新增心願'}),slot=document.createElement('section');slot.className='christmas-panel';modal.body.prepend(slot);let previewed='';
  const today=Math.floor((Date.now()/1000+28800)/86400),defaultClaim=(today+6)*86400-28801;
  const selectedDue=w?.claim_due_at||(!w?defaultClaim:ctx.claimDeadlineAt);
  slot.innerHTML=form('wish',w?'編輯心願資料':'新增心願',input('creatingUnit','建立單位','text',w?.created_unit_id?(w.created_unit_id===ctx.bookhouseId?'孩子的書屋':'NXSPACE'):ctx.label)+'<fieldset><legend>公開資料</legend>'+input('publicCode',w?'心願編號':'系統自動編號','text',w?.public_code||data.nextCode)+input('publicNickname','孩子公開暱稱','text',w?.public_nickname||'')+input('giftName','禮物名稱','text',w?.gift_name||'')+area('description','心願內容',w?.description||'')+area('specifications','禮物條件與提醒（選填）',w?.specifications||'',false)+input('claimDueAt','最後認領日期','date',christmasDate(selectedDue))+'<p>最後認領日期是民眾最晚可認領的日期；交件期限則由認領成功日起另行計算。活動最晚可認領至 '+esc(christmasDate(ctx.claimDeadlineAt))+'，最終收件日 '+esc(christmasDate(ctx.giftDeadlineAt))+'。</p><p data-deadline-warning role="status"></p></fieldset><details><summary>不公開資料（加密保存）</summary>'+input('realName','兒童真實姓名（不公開、選填）','text','',false)+area('necessaryContact','內部聯絡資料（不公開、選填）','',false)+area('internalNote','內部備註（不公開、選填）','',false)+'<p>留白會保留既有不公開資料，不會刪除。</p></details>'+(ctx.nx?select('publicationStatus','公開狀態',[['draft','儲存草稿'],['approved','預覽確認後發布']])+'<button type="button" data-wish-preview>查看公開預覽</button>':select('submission','儲存方式',[['draft','儲存草稿'],['submit','提交 NXSPACE 審核']])+'<p>核准與對外開放分開設定；已發布內容修改須重新審核。</p>'),'儲存心願');
  const f=slot.querySelector('form');f.elements.publicCode.readOnly=true;f.elements.creatingUnit.disabled=true;if(w&&ctx.nx)f.elements.publicationStatus.value=w.publication_status;
  if(intake&&ctx.nx)f.elements.publicationStatus.querySelector('[value="approved"]').textContent='預覽確認後核准（暫不公開）';
  if(api.config.launchMode){f.insertAdjacentHTML('afterbegin','<p>書屋提供兒童資料前，須確認資料來源及提供依據，並完成適用的告知和必要程序。請將可識別資訊留在不公開欄位。<a href="https://www.nxspace.tw/christmas/privacy/" target="_blank" rel="noopener noreferrer">查看個人資料蒐集告知事項</a></p>');f.querySelector('button:not([type])').insertAdjacentHTML('beforebegin','<label><input type="checkbox" name="disclosureConfirmed" required>我已核對本案資料提供依據及必要告知程序。</label>');}
  const snapshot=()=>JSON.stringify(['publicNickname','giftName','description','specifications','claimDueAt'].map(k=>f.elements[k].value));
  const warning=()=>{previewed='';const value=Date.parse(f.elements.claimDueAt.value+'T23:59:59+08:00')/1000;f.querySelector('[data-deadline-warning]').textContent=value>ctx.claimDeadlineAt?'預設日期超過活動認領上限，請修改最後認領日期，或先至活動設定確認規則。':'';};f.addEventListener('input',warning);warning();
  f.querySelector('[data-wish-preview]')?.addEventListener('click',()=>{if(!f.reportValidity())return;const preview=openChristmasDialog({title:'發布前公開預覽'});preview.body.innerHTML='<h2>'+esc(f.elements.giftName.value)+'</h2><p>'+esc(f.elements.publicNickname.value)+'</p><p>'+esc(f.elements.description.value)+'</p><p>'+esc(f.elements.specifications.value)+'</p><p>請確認沒有兒童真實姓名、聯絡資料或其他不應公開資訊。</p><button type="button" data-confirm-public>確認公開內容已審核</button>';preview.body.querySelector('button').addEventListener('click',()=>{previewed=snapshot();preview.close();});});
  let savedForReview=null, reviewKey=null, saveKey=null, savePayload=null;
  const submitSaved=async()=>{
    try {
      return await post('/ops/wish-submit',{wishId:savedForReview.wishId,expectedVersion:savedForReview.version},reviewKey);
    } catch {
      throw Error('草稿已儲存，送審結果尚未確認。可再次按下送審核對同一筆操作。');
    }
  };
  bindForm(f,async fields=>{if(savedForReview){const result=await submitSaved();output.textContent='修改已送交 NXSPACE 確認。';return result;}const approved=ctx.nx?fields.get('publicationStatus')==='approved':w?.publication_status==='approved';if(ctx.nx&&approved&&previewed!==snapshot())throw Error('請先查看目前內容的公開預覽，確認後再發布。');const realName=fields.get('realName');if(!realName&&(fields.get('necessaryContact')||fields.get('internalNote')))throw Error('新增不公開聯絡資料或備註時，請一併填寫兒童真實姓名，以完整加密保存。');const wantsReview=!ctx.nx&&fields.get('submission')==='submit';const splitReview=api.config.launchMode&&wantsReview&&!approved;const payload={...(api.config.launchMode?{disclosureConfirmed:fields.has('disclosureConfirmed')}:{}),...(w?{wishId:w.id,expectedVersion:w.version}:{expectedVersion:0,creatingUnitId:ctx.unit_id}),organisationId:ctx.bookhouseId,publicCode:fields.get('publicCode'),publicNickname:fields.get('publicNickname'),giftName:fields.get('giftName'),title:fields.get('giftName'),ageBand:w?.age_band||'6-9',description:fields.get('description'),specifications:fields.get('specifications')||'',claimDueAt:Date.parse(fields.get('claimDueAt')+'T23:59:59+08:00')/1000,giftDueAt:w?.gift_due_at||ctx.giftDeadlineAt,publicationStatus:approved?'approved':'draft',...(!ctx.nx&&!splitReview?{submitForReview:wantsReview}:{}),reviewConfirmed:ctx.nx&&approved,...(realName?{realName,necessaryContact:fields.get('necessaryContact'),internalNote:fields.get('internalNote'),privateReason:'建立或更新案件不公開資料'}:{})};const serialized=JSON.stringify(payload);if(savePayload!==serialized){savePayload=serialized;saveKey=crypto.randomUUID();}let r=await post('/wish-editor',payload,saveKey);if(splitReview){savedForReview=r;reviewKey=crypto.randomUUID();for(const control of f.querySelectorAll('input,textarea,select'))control.disabled=true;r=await submitSaved();}output.textContent=splitReview||r.status==='pending'?'修改已送交 NXSPACE 確認。':'心願已儲存。';return r;},true,async()=>{modal.close();});
 }
 await load(false);
}
function documentLabel(v){return {not_required:'無需求',preparing:'待製作',ready_to_send:'待寄送',sent:'已寄送'}[v]||'尚無紀錄';}
function reasonLabel(v){if(!v||/^(unit_|operational_|limited_|paper_record:|authorized_|paper_document_|identity_verified:)/.test(v)||/[a-f0-9]{8}-[a-f0-9-]{27}/i.test(v))return '';return {donor_cancel:'認領者申請取消',overdue_confirmed:'逾期已核對',reviewed_reopen:'確認後重新開放'}[v]||v;}
function actionLabel(v){const readable=operationLabel(v);if(readable!=='執行後台作業')return readable;return {'claim.cancelled_and_reopened':'取消認領並重新開放','claim.deadline_extended':'延長交件期限','wish.reopened':'重新開放心願','case.support_open':'記錄需要協助事項','case.support_resolved':'更新處理結果','account.password_reset':'協助重設登入密碼','case.phone_search':'電話輔助查詢','contact.business_read':'依業務需要查看聯絡資料','case.thanks':'更新紙本感謝卡','case.proof':'更新紙本捐贈證明','case.close':'完成案件'}[v]||(/receipt/.test(v)?'登記收到禮物':/batch/.test(v)?'建立本次交接':/accept/.test(v)?'書屋確認已領取':/deliver/.test(v)?'確認禮物已送達':/wish/.test(v)?'更新心願資料':'更新案件紀錄');}
