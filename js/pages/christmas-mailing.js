export function mountMailingExport(container,api){
 const panel=document.createElement('section');panel.className='christmas-panel';panel.innerHTML='<h3>書屋紙本文件寄送名單</h3><p>請先在各案件補齊收件人、電話、郵遞區號與地址。下載的Excel包含寄送名單及逐份心願明細，由孩子的書屋自行運用；請妥善保管並於作業結束後依規定刪除。</p><form data-mailing-export><label>文件類型<select name="documentType"><option value="all">全部文件</option><option value="thanks">孩子的感謝卡</option><option value="proof">實物捐贈證明</option></select></label><label>寄送進度<select name="dispatch"><option value="pending">尚未寄送／交付</option><option value="sent">已寄送／交付</option><option value="all">全部</option></select></label><label><input name="merged" type="checkbox">合併相同收件人的寄送資料</label><p>收件人、電話、郵遞區號、地址、兩項文件需求與辦理及寄送進度均相同才合併；保留全部心願編號。下載不代表已寄送。</p><button class="btn btn-primary">檢查匯出筆數</button><p role="status" data-export-status></p></form>';container.prepend(panel);
 const form=panel.querySelector('form'),status=panel.querySelector('[data-export-status]');let checked='';form.addEventListener('input',()=>{checked='';form.querySelector('button').textContent='檢查匯出筆數';});form.addEventListener('submit',async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;try{const f=new FormData(form),filter={documentType:f.get('documentType'),dispatch:f.get('dispatch'),merged:f.has('merged')};if(checked!==JSON.stringify(filter)){const preview=await requestExport(api,{...filter,previewOnly:true});checked=JSON.stringify(filter);status.textContent=`符合 ${preview.count} 份心願，預計 ${preview.groups} 封寄送資料；感謝卡 ${preview.thanks??'依明細'} 份、實物捐贈證明 ${preview.proof??'依明細'} 份。請確認後下載；不會標記已寄送。`;b.textContent='確認下載 Excel 寄送名單';return;}const r=await requestExport(api,filter);const bytes=Uint8Array.from(atob(r.dataBase64),c=>c.charCodeAt(0)),url=URL.createObjectURL(new Blob([bytes],{type:r.contentType})),a=document.createElement('a');a.href=url;a.download=r.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent=`已匯出 ${r.count} 份心願，共 ${r.groups} 筆寄送資料。操作已記錄。`;}catch(error){status.textContent=error.code==='MAILING_DETAILS_REQUIRED'?'部分案件缺少完整寄送資料，請補齊後再匯出；本次沒有下載名單。':error.message;}finally{b.disabled=false;}});
}
import { openChristmasDialog } from '../components/christmas-controls.js';

function verifyExportPassword() {
 const modal=openChristmasDialog({title:'重新驗證紙本匯出'});
 modal.body.innerHTML='<form><label>目前密碼 <input name="password" type="password" autocomplete="current-password" required></label><button class="btn btn-primary">驗證並繼續</button><p role="status"></p></form>';
 return new Promise(resolve=>{
  let verified=false;
  modal.dialog.addEventListener('close',()=>resolve(verified),{once:true});
  const form=modal.body.querySelector('form');
  form.addEventListener('submit',async event=>{
   event.preventDefault();
   const button=form.querySelector('button');
   if(button.disabled)return;
   button.disabled=true;
   try{
    const response=await fetch('/christmas-api/staff-auth/export-step-up',{method:'POST',cache:'no-store',
     headers:{'Content-Type':'application/json'},body:JSON.stringify({password:form.elements.password.value})});
    if(!response.ok)throw new Error();
    verified=true;
    if(modal.dialog.open)modal.close();
   }catch{form.querySelector('[role="status"]').textContent='無法重新驗證，請確認密碼或稍後再試。';}
   finally{form.reset();button.disabled=false;}
  });
 });
}

async function requestExport(api, filter){
 try{return await api.admin('/workspace/export',filter);}
 catch(error){
  if(error.code!=='EXPORT_REAUTH_REQUIRED')throw error;
  if(!await verifyExportPassword())throw new Error('已取消匯出。');
  return api.admin('/workspace/export',filter);
 }
}
