import { getRegistrationService, registrationPaymentLabels, registrationStatusLabels } from "../services/registration-service.js";
import { venues } from "../services/venue-activity-service.js";

const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const money = (value) => new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(Number(value) || 0);

export function createRegistrationActivitiesPage() {
  const service = getRegistrationService(), activities = service.listPublicActivities();
  return `<section class="public-page registration-catalog" data-registration-catalog><div class="page-container"><header class="page-heading"><span>NXSPACE 活動報名</span><h1>課程與活動</h1><p>查看活動內容、剩餘名額及報名須知。</p></header><div class="registration-public-grid">${activities.map((activity) => { const state = service.registrationAvailability(activity); return `<article class="registration-public-card"><img src="${esc(activity.posterImage)}" alt="" loading="lazy"><div><span>${activity.startDate} ${activity.startTime}</span><h2>${esc(activity.registrationTitle || activity.title)}</h2><p>${esc(activity.registrationDescription || activity.publicDescription)}</p><strong>剩餘 ${state.remaining} 名｜候補 ${state.waitlistRemaining} 名</strong><a class="btn btn-primary" href="#registration/${activity.activityId}">查看與報名</a></div></article>`; }).join("") || "<p>目前沒有開放報名的活動。</p>"}</div></div></section>`;
}
export function createRegistrationDetailPage(activityId) {
  const service = getRegistrationService(), activity = service.getActivity(activityId), state = activity && service.registrationAvailability(activity);
  if (!activity || !state?.visible) return `<section class="public-page"><div class="page-container"><h1>活動未開放</h1><p>此活動目前沒有公開報名頁。</p></div></section>`;
  const venue = venues.find((item) => item.id === activity.venueId);
  return `<section class="public-page registration-detail" data-registration-detail data-activity-id="${activity.activityId}"><div class="page-container">
    <article class="registration-hero"><img src="${esc(activity.posterImage)}" alt="${esc(activity.registrationTitle || activity.title)}"><div><span>${activity.startDate}｜${activity.startTime}–${activity.endTime}</span><h1>${esc(activity.registrationTitle || activity.title)}</h1><p>${esc(activity.registrationDescription || activity.publicDescription)}</p><dl><div><dt>場地</dt><dd>${esc(venue?.name)}</dd></div><div><dt>主辦單位</dt><dd>${esc(activity.organizerName)}</dd></div><div><dt>講師</dt><dd>${esc(activity.instructorName)}</dd></div><div><dt>費用</dt><dd>${money(activity.fee)}</dd></div><div><dt>剩餘名額</dt><dd>${state.remaining} 名；候補 ${state.waitlistRemaining} 名</dd></div><div><dt>報名截止</dt><dd>${activity.registrationEndAt ? new Date(activity.registrationEndAt).toLocaleString("zh-TW") : "依主辦單位公告"}</dd></div></dl></div></article>
    <div class="registration-columns"><section class="prose-card"><h2>講師介紹</h2><p>${esc(activity.instructorIntroduction)}</p><h2>報名須知</h2><p>${esc(activity.registrationTerms)}</p><h2>取消及退款</h2><p>${esc(activity.cancellationPolicy)}</p><h2>聯絡方式</h2><p>${esc(activity.publicContactInformation)}</p></section>
    <section class="prose-card"><h2>${state.open ? "填寫報名資料" : state.reason}</h2>${state.open ? registrationForm(activity) : `<p>${esc(state.reason)}</p>`}<p role="status" data-registration-feedback></p></section></div>
  </div></section>`;
}
function registrationForm(activity) {
  const customFields = (activity.customRegistrationFields || []).map((field) => {
    const name = `custom:${field.id}`, required = field.required ? "required" : "";
    if (field.type === "textarea") return `<label class="field-group"><span>${esc(field.label)}</span><textarea name="${name}" ${required}></textarea></label>`;
    if (field.type === "select" || field.type === "radio") return `<label class="field-group"><span>${esc(field.label)}</span><select name="${name}" ${required}><option value="">請選擇</option>${(field.options || []).map((option) => `<option>${esc(option)}</option>`).join("")}</select></label>`;
    if (field.type === "checkbox") return `<fieldset><legend>${esc(field.label)}</legend>${(field.options || []).map((option) => `<label class="check-field"><input type="checkbox" name="${name}" value="${esc(option)}"> ${esc(option)}</label>`).join("")}</fieldset>`;
    return `<label class="field-group"><span>${esc(field.label)}</span><input name="${name}" type="${["number", "date"].includes(field.type) ? field.type : "text"}" ${required}></label>`;
  }).join("");
  return `<form class="public-form" data-registration-form><label class="field-group"><span>姓名</span><input name="attendeeName" required autocomplete="name"></label><label class="field-group"><span>手機</span><input name="attendeePhone" required inputmode="tel" autocomplete="tel"></label><label class="field-group"><span>Email</span><input name="attendeeEmail" required type="email" autocomplete="email"></label><label class="field-group"><span>報名人數</span><input name="attendeeCount" required type="number" min="1" max="10" value="1"></label><label class="field-group"><span>備註</span><textarea name="notes"></textarea></label>${customFields}<label class="check-field"><input name="termsAccepted" type="checkbox" required> 我同意活動須知與取消規則</label><button class="btn btn-primary">送出報名</button></form>`;
}
export function createRegistrationLookupPage() {
  return `<section class="public-page" data-registration-lookup><div class="page-container registration-columns"><section class="prose-card"><h1>報名查詢</h1><form class="public-form" data-registration-lookup-form><label class="field-group"><span>報名序號</span><input name="registrationId" required placeholder="NXR-YYYYMMDD-XXXXX"></label><label class="field-group"><span>手機號碼</span><input name="phone" required inputmode="tel"></label><button class="btn btn-primary">查詢</button></form></section><section class="prose-card" data-registration-result><p>輸入報名序號與手機號碼查看自己的報名。</p></section></div></section>`;
}
export function initializeRegistrationPage() {
  const detail = document.querySelector("[data-registration-detail]"), service = getRegistrationService();
  detail?.querySelector("[data-registration-form]")?.addEventListener("submit", (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget), values = Object.fromEntries(data);
    values.activityId = detail.dataset.activityId; values.termsAccepted = data.has("termsAccepted"); values.customAnswers = {};
    for (const [key, value] of data.entries()) if (key.startsWith("custom:")) { const id = key.slice(7); values.customAnswers[id] = values.customAnswers[id] ? [].concat(values.customAnswers[id], value) : value; }
    try { const record = service.createRegistration(values); detail.querySelector("[data-registration-feedback]").innerHTML = `報名已建立：<strong>${record.registrationId}</strong>，狀態為${registrationStatusLabels[record.status]}。請保存序號。`; event.currentTarget.reset(); }
    catch (error) { detail.querySelector("[data-registration-feedback]").textContent = error.message; }
  });
  const lookup = document.querySelector("[data-registration-lookup]"), form = lookup?.querySelector("[data-registration-lookup-form]");
  form?.addEventListener("submit", (event) => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(form)), result = service.lookup(values.registrationId, values.phone), output = lookup.querySelector("[data-registration-result]");
    if (!result) { output.innerHTML = "<h2>找不到報名</h2><p>請確認報名序號及手機號碼。</p>"; return; }
    output.innerHTML = `<h2>${esc(result.activityTitle)}</h2><dl><div><dt>報名序號</dt><dd>${result.registrationId}</dd></div><div><dt>日期時間</dt><dd>${result.date} ${result.time}</dd></div><div><dt>場地</dt><dd>${esc(result.venue)}</dd></div><div><dt>人數</dt><dd>${result.attendeeCount}</dd></div><div><dt>狀態</dt><dd>${result.statusLabel}</dd></div><div><dt>繳費</dt><dd>${result.paymentStatusLabel}／${money(result.amountDue)}</dd></div><div><dt>最近更新</dt><dd>${new Date(result.updatedAt).toLocaleString("zh-TW")}</dd></div></dl><p>${esc(result.publicNote || result.contact || "")}</p>${result.canCancel ? `<form data-cancel-registration><label class="field-group"><span>取消原因</span><input name="reason"></label><button class="btn btn-secondary">取消報名</button></form>` : `<p>如需取消，請聯絡主辦單位：${esc(result.contact)}</p>`}`;
    output.querySelector("[data-cancel-registration]")?.addEventListener("submit", (cancelEvent) => { cancelEvent.preventDefault(); if (!confirm("確定取消此報名？")) return; try { service.cancelSelf(result.registrationId, values.phone, new FormData(cancelEvent.currentTarget).get("reason")); form.requestSubmit(); } catch (error) { output.insertAdjacentHTML("beforeend", `<p>${esc(error.message)}</p>`); } });
  });
}
