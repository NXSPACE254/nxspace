// Christmas never uses Demo repositories or browser persistence.
const production = Object.freeze({ enabled: false, baseUrl: '/christmas-api', campaignId: '', testMode: false });
const messages = {400:'資料格式或必要欄位不符，請檢查後再送出。',401:'登入已失效，請重新登入後再試。',403:'沒有此操作的權限。',404:'找不到指定資料或資源。',409:'資料已變更、已認領或內容受到保護，請重新查詢。',413:'檔案或請求超過本機大小上限。',429:'操作過於頻繁，請稍後再試。',500:'服務發生錯誤，結果尚未確認。',503:'服務尚未就緒，結果尚未確認。'};
export class ChristmasApiError extends Error {
  constructor(status, code) { super(({CHILD_PROFILE_NOT_CREATED:'尚未建立兒童不公開資料',LOCAL_MAINTENANCE:'資料維護中，請稍後再試。',INVALID_WISH_CODE:'請輸入正確的數字或 NX 心願編號。',SITE_CONFIRMATION_REQUIRED:'開放收件前，請填妥並核定地址、電話與收件日期時間。',SITE_CONFLICT:'據點資料已更新，請重新載入。',NO_ELIGIBLE_WISHES:'沒有符合條件的心願，資料未變更。',BATCH_CONFLICT:'案件已更新或操作衝突，請重新檢查。',RETURN_REASON_REQUIRED:'退回修改前，請填寫清楚的修改原因。',REVIEW_ALREADY_PENDING:'這份心願已有待審核內容，請先完成審核。',CLAIM_DELIVERY_WINDOW_CONFLICT:'最後認領日期超過活動可認領期間，請調整日期。',EXISTING_DEADLINES_CONFLICT:'新日期與既有心願或認領期限衝突，請保留足夠時間。',IMPACT_CONFIRMATION_REQUIRED:'請先確認日期調整對既有案件的影響。',SETTINGS_CONFLICT:'活動設定已被更新，請重新整理後再調整。',DOCUMENT_CONFLICT:'所選文件進度不同或已更新，請核對後分別處理。',BOOKHOUSE_ONLY:'此項作業由孩子的書屋負責。',POSTAL_DETAILS_REQUIRED:'紙本郵寄前，請先補齊收件人、電話、郵遞區號與地址。'}[code]) || messages[status] || '請求失敗或逾時，結果尚未確認。請先查詢認領進度，避免重複送出。'); this.status=status; this.code=code; }
}
export async function createChristmasApi({ timeout = 10000, configuration = production } = {}) {
  let config = configuration;
  if (location.hostname === '127.0.0.1' && !configuration.enabled && document.querySelector('meta[name="christmas-api-discovery"]')?.content === '/christmas-api/config') {
    // The endpoint exists only in the independent local test server.
    try { const r=await fetch('/christmas-api/config',{cache:'no-store',signal:AbortSignal.timeout(timeout)}); if(r.ok) config=await r.json(); } catch { /* Remain disabled. */ }
  }
  const base = new URL(config.baseUrl, location.origin);
  if (base.search || base.hash || base.username || base.password || (base.origin !== location.origin && base.protocol !== 'https:') || (config.testMode && (location.hostname !== '127.0.0.1' || base.origin !== location.origin))) throw new ChristmasApiError(503,'UNSAFE_CONFIGURATION');
  async function request(area, path='', body, key, signal) {
    if (!config.enabled || !/^[A-Za-z0-9_-]{8,80}$/.test(config.campaignId)) throw new ChristmasApiError(503,'DISABLED');
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeout);
    try {
      const headers={Accept:'application/json'};
      if(config.intakeMode || config.fulfillmentMode) headers['X-Requested-With']='XMLHttpRequest';
      if(body!==undefined) headers['Content-Type']='application/json';
      if(key) headers['Idempotency-Key']=key;
      const response=await fetch(`${base.href.replace(/\/$/,'')}/${area}/campaigns/${encodeURIComponent(config.campaignId)}${path}`,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin',cache:'no-store',referrerPolicy:'no-referrer',signal:signal?AbortSignal.any([signal,controller.signal]):controller.signal});
      const data=await response.json().catch(()=>null);
      if(!response.ok) throw new ChristmasApiError(response.status,data?.error?.code || 'INVALID_RESPONSE');
      if(data===null) throw new ChristmasApiError(503,'INVALID_RESPONSE');
      return data;
    } catch(error) { if(error instanceof ChristmasApiError) throw error; throw new ChristmasApiError(0,'UNCONFIRMED'); }
    finally { clearTimeout(timer); }
  }
  return { config:Object.freeze(config), public:(path,body)=>request('public',path,body), admin:(path,body,key,signal)=>request('admin',path,body,key,signal) };
}
export function createClaimCredentials() {
  return {idempotencyKey:crypto.randomUUID(),claimSecret:btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')};
}
export function confirmedClaim(value) {
  return Boolean(value && /^[A-Za-z0-9_-]{8,80}$/.test(value.claimId || '') && Number.isSafeInteger(value.version) && value.version>=0 && ['claimed','gift_received','handed_over','delivered','exception','cancelled','expired'].includes(value.status));
}

// Shared page FAQ projection; unpublished content never reaches public pages.
export async function enhanceScopedFaq(scope){
 const targets=[...document.querySelectorAll('[data-scoped-faq="'+scope+'"]')];if(!targets.length)return;
 try{const api=await createChristmasApi();if(!api.config.enabled)return;const record=await api.public('/content'),rows=record.content?.scopedFaq?.[scope];if(!Array.isArray(rows))return;
 for(const target of targets){if(!target.isConnected)continue;target.replaceChildren();for(const [question,answer]of rows){const d=document.createElement('details'),s=document.createElement('summary'),p=document.createElement('p');s.textContent=question;p.textContent=answer;d.append(s,p);target.append(d);}}}catch{/* Existing FAQ remains readable when the optional service is unavailable. */}
}
