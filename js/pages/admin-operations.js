import { orderStatuses, paymentStatuses, fulfillmentStatuses, rentalAdminStatuses, availabilityTypes } from "../data/operations-data.js";
import { venues } from "../data/venue-data.js";

const esc = (value = "") => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
const money = (value) => new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value || 0);
const optionList = (values, current = "") => Object.entries(values).map(([value, label]) => `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`).join("");

function pageHeader(title, description, actions = "") {
  return `<div class="admin-page-header"><div><span class="admin-eyebrow">OPERATIONS</span><h1>${title}</h1><p>${description}</p></div><div class="admin-header-actions">${actions}</div></div>`;
}

function operationsTable(statuses) {
  return `<div class="admin-toolbar"><input type="search" placeholder="搜尋編號、姓名或內容" data-ops-search aria-label="搜尋"><select data-ops-status aria-label="狀態"><option value="">全部狀態</option>${optionList(statuses)}</select><label>開始日期<input type="date" data-date-start></label><label>結束日期<input type="date" data-date-end></label><button class="btn btn-secondary" data-ops-clear>清除</button><span class="admin-result-count" data-ops-count></span></div>
    <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th><input type="checkbox" data-select-all aria-label="選取全部"></th><th>編號／申請人</th><th>日期</th><th>狀態</th><th>更新</th><th><span class="sr-only">操作</span></th></tr></thead><tbody data-ops-body></tbody></table><div class="admin-empty" data-ops-empty hidden><h2>沒有符合的資料</h2><p>請調整搜尋或篩選條件。</p></div></div>
    <div class="admin-bulk-bar" data-bulk-bar hidden><strong><span data-selected-count>0</span> 筆已選取</strong><select data-bulk-status>${optionList(statuses)}</select><button class="btn btn-primary" data-bulk-apply>批次更新</button><button class="btn btn-secondary" data-bulk-clear>取消</button></div>
    <div class="admin-pagination"><button class="btn btn-secondary" data-ops-prev>上一頁</button><span data-ops-page></span><button class="btn btn-secondary" data-ops-next>下一頁</button></div>
    <div class="admin-drawer" data-ops-drawer hidden><div class="admin-drawer-backdrop" data-ops-close></div><section role="dialog" aria-modal="true" aria-labelledby="ops-title"><div class="admin-drawer-header"><h2 id="ops-title" data-ops-title>詳細資料</h2><button class="admin-icon-button" data-ops-close aria-label="關閉">×</button></div><div data-ops-detail></div></section></div>`;
}

export function createOrdersManagementPage() {
  const exports = '<button class="btn btn-secondary" data-export="csv">CSV</button><button class="btn btn-secondary" data-export="json">JSON</button>';
  return `<section data-operations-page="orders">${pageHeader("訂單管理", "管理現場取貨訂單、付款與履約狀態。", exports)}${operationsTable(orderStatuses)}</section>`;
}

export function createRentalsManagementPage() {
  const exports = '<button class="btn btn-secondary" data-export="csv">CSV</button><button class="btn btn-secondary" data-export="json">JSON</button>';
  return `<section data-operations-page="rentals">${pageHeader("場地租借管理", "審核申請、管理公開備註並執行衝突檢查。", exports)}${operationsTable(rentalAdminStatuses)}</section>`;
}

export function createAvailabilityPage() {
  return `<section data-availability-page>${pageHeader("場地可用性", "維護場地封鎖、內部活動與維護日期。", '<button class="btn btn-primary" data-new-availability>＋ 新增設定</button>')}
    <div class="availability-admin-grid"><section class="admin-panel"><div class="admin-panel-heading availability-calendar-heading"><button class="admin-icon-button" data-calendar-prev aria-label="上個月">‹</button><h2 data-calendar-title>場地月曆</h2><button class="admin-icon-button" data-calendar-next aria-label="下個月">›</button></div><div class="availability-month" data-availability-calendar></div><h3>日期設定</h3><div data-availability-list></div></section><section class="admin-panel"><h2>狀態圖例</h2><ul class="availability-legend">${Object.entries(availabilityTypes).map(([value, label]) => `<li><span class="availability-dot is-${value}"></span>${label}</li>`).join("")}</ul><p>已核准租借與封鎖日期會阻止重疊核准。</p></section></div>
    <div class="admin-drawer" data-availability-drawer hidden><div class="admin-drawer-backdrop" data-availability-close></div><section role="dialog" aria-modal="true" aria-labelledby="availability-title"><div class="admin-drawer-header"><h2 id="availability-title">場地可用性設定</h2><button class="admin-icon-button" data-availability-close>×</button></div><form class="admin-form" data-availability-form><label class="admin-field"><span>場地</span><select name="venueId">${venues.map((venue) => `<option value="${venue.id}">${venue.name}</option>`).join("")}</select></label><label class="admin-field"><span>類型</span><select name="type">${optionList(availabilityTypes)}</select></label><label class="admin-field"><span>開始日期</span><input name="startDate" type="date" required></label><label class="admin-field"><span>結束日期</span><input name="endDate" type="date" required></label><label class="admin-field"><span>說明</span><textarea name="note" rows="4"></textarea></label><div class="admin-sticky-actions"><button class="btn btn-secondary" type="button" data-availability-close>取消</button><button class="btn btn-primary">儲存</button></div></form></section></div></section>`;
}

function createRows(type, records) {
  const labels = type === "orders" ? orderStatuses : rentalAdminStatuses;
  return records.map((record) => {
    const name = type === "orders" ? record.customerName : record.applicantName;
    const date = type === "orders" ? `${record.pickupDate} ${record.pickupTime}` : `${record.startDate} ${record.startTime}–${record.endTime}`;
    return `<tr><td><input type="checkbox" data-row-select value="${record.id}" aria-label="選取 ${record.id}"></td><td><strong>${record.id}</strong><small>${esc(name)}</small></td><td>${esc(date)}</td><td><span class="admin-status is-${record.status}">${esc(labels[record.status] || record.status)}</span></td><td>${new Date(record.updatedAt || record.createdAt).toLocaleDateString("zh-TW")}</td><td><div class="admin-row-actions"><button data-ops-view="${record.id}">檢視</button><button data-ops-delete="${record.id}">刪除</button></div></td></tr>`;
  }).join("");
}

export function initializeOperationsPage({ type, repository, showToast, can }) {
  const root = document.querySelector(`[data-operations-page="${type}"]`);
  if (!root) return;
  const state = { query: "", status: "", start: "", end: "", page: 1, size: 8, selected: new Set() };
  const getRecords = () => type === "orders" ? repository.listOrders() : repository.listRentals();
  const getFiltered = () => getRecords().filter((record) => {
    const date = type === "orders" ? record.pickupDate : record.startDate;
    return (!state.query || JSON.stringify(record).toLowerCase().includes(state.query)) && (!state.status || record.status === state.status) && (!state.start || date >= state.start) && (!state.end || date <= state.end);
  });

  function render() {
    const records = getFiltered();
    const pages = Math.max(1, Math.ceil(records.length / state.size));
    state.page = Math.min(state.page, pages);
    root.querySelector("[data-ops-body]").innerHTML = createRows(type, records.slice((state.page - 1) * state.size, state.page * state.size));
    root.querySelectorAll("[data-row-select]").forEach((box) => { box.checked = state.selected.has(box.value); });
    root.querySelector("[data-ops-empty]").hidden = Boolean(records.length);
    root.querySelector("[data-ops-count]").textContent = `${records.length} 筆`;
    root.querySelector("[data-ops-page]").textContent = `第 ${state.page} / ${pages} 頁`;
    root.querySelector("[data-ops-prev]").disabled = state.page === 1;
    root.querySelector("[data-ops-next]").disabled = state.page === pages;
    root.querySelector("[data-bulk-bar]").hidden = !state.selected.size;
    root.querySelector("[data-selected-count]").textContent = state.selected.size;
  }

  root.querySelector("[data-ops-search]").oninput = (event) => { state.query = event.target.value.trim().toLowerCase(); state.page = 1; render(); };
  root.querySelector("[data-ops-status]").onchange = (event) => { state.status = event.target.value; render(); };
  root.querySelector("[data-date-start]").onchange = (event) => { state.start = event.target.value; render(); };
  root.querySelector("[data-date-end]").onchange = (event) => { state.end = event.target.value; render(); };
  root.querySelector("[data-ops-clear]").onclick = () => { Object.assign(state, { query: "", status: "", start: "", end: "", page: 1 }); root.querySelectorAll("[data-ops-search],[data-ops-status],[data-date-start],[data-date-end]").forEach((node) => { node.value = ""; }); render(); };
  root.querySelector("[data-ops-prev]").onclick = () => { state.page -= 1; render(); };
  root.querySelector("[data-ops-next]").onclick = () => { state.page += 1; render(); };
  root.querySelector("[data-select-all]").onchange = (event) => { getFiltered().forEach((record) => event.target.checked ? state.selected.add(record.id) : state.selected.delete(record.id)); render(); };
  root.querySelector("[data-bulk-clear]").onclick = () => { state.selected.clear(); render(); };
  root.querySelector("[data-bulk-apply]").onclick = () => bulkUpdate();
  root.querySelectorAll("[data-export]").forEach((button) => { button.onclick = () => exportRecords(getFiltered(), type, button.dataset.export); });
  root.querySelectorAll("[data-ops-close]").forEach((button) => { button.onclick = closeDrawer; });
  root.querySelector("[data-ops-body]").onclick = handleTableClick;

  function handleTableClick(event) {
    const checkbox = event.target.closest("[data-row-select]");
    if (checkbox) { checkbox.checked ? state.selected.add(checkbox.value) : state.selected.delete(checkbox.value); render(); return; }
    const view = event.target.closest("[data-ops-view]");
    if (view) openDetail(view.dataset.opsView);
    const remove = event.target.closest("[data-ops-delete]");
    if (remove && can(`${type}.delete`) && confirm("確定刪除此筆資料？")) { type === "orders" ? repository.deleteOrder(remove.dataset.opsDelete) : repository.deleteRental(remove.dataset.opsDelete); showToast("資料已刪除。"); render(); }
  }

  function bulkUpdate() {
    if (!can(`${type}.update`)) return;
    const status = root.querySelector("[data-bulk-status]").value;
    try { state.selected.forEach((id) => type === "orders" ? repository.updateOrder(id, { status }) : repository.updateRental(id, { status })); state.selected.clear(); showToast("批次狀態已更新。"); render(); } catch (error) { showToast(error.message, "danger"); }
  }

  function openDetail(id) {
    const record = type === "orders" ? repository.getOrder(id) : repository.getRental(id);
    const drawer = root.querySelector("[data-ops-drawer]");
    root.querySelector("[data-ops-title]").textContent = `${type === "orders" ? "訂單" : "租借"} ${id}`;
    root.querySelector("[data-ops-detail]").innerHTML = `${type === "orders" ? orderDetail(record) : rentalDetail(record)}${auditTimeline(repository.listAudit().filter((item) => item.entityId === id))}`;
    drawer.hidden = false;
    document.body.classList.add("is-admin-locked");
    const form = drawer.querySelector("form");
    form.onsubmit = (event) => { event.preventDefault(); if (!can(`${type}.update`)) return; try { const changes = Object.fromEntries(new FormData(form)); type === "orders" ? repository.updateOrder(id, changes) : repository.updateRental(id, changes); showToast("資料已更新。"); closeDrawer(); render(); } catch (error) { showToast(error.message, "danger"); } };
    drawer.querySelector("[data-reveal]").onclick = (event) => { if (!can("sensitive-data.reveal")) return; event.currentTarget.remove(); drawer.querySelector("[data-sensitive]").hidden = false; repository.audit("reveal", type, id); };
    drawer.querySelector("[data-copy]").onclick = () => navigator.clipboard.writeText(id);
    drawer.querySelector("[data-print]").onclick = () => window.print();
  }

  function closeDrawer() { root.querySelector("[data-ops-drawer]").hidden = true; document.body.classList.remove("is-admin-locked"); }
  render();
}

function orderDetail(record) {
  return `<form class="admin-form"><div class="summary-panel"><button type="button" data-copy>複製編號</button><button type="button" data-print>列印摘要</button><p>${record.items.map((item) => `${esc(item.name)} × ${item.quantity}`).join("、")}</p><strong>${money(record.total)}</strong></div>${sensitivePanel(record)}<label class="admin-field">訂單狀態<select name="status">${optionList(orderStatuses, record.status)}</select></label><label class="admin-field">付款狀態<select name="paymentStatus">${optionList(paymentStatuses, record.paymentStatus)}</select></label><label class="admin-field">取貨狀態<select name="fulfillmentStatus">${optionList(fulfillmentStatuses, record.fulfillmentStatus)}</select></label><label class="admin-field">公開備註<textarea name="publicNote">${esc(record.publicNote)}</textarea></label><label class="admin-field">內部備註<textarea name="internalNote">${esc(record.internalNote)}</textarea></label><div class="admin-sticky-actions"><button class="btn btn-primary">儲存變更</button></div></form>`;
}

function rentalDetail(record) {
  return `<form class="admin-form"><div class="summary-panel"><button type="button" data-copy>複製編號</button><button type="button" data-print>列印摘要</button><p>${esc(record.venueName)} · ${record.startDate} ${record.startTime}–${record.endTime}</p></div>${sensitivePanel(record)}<label class="admin-field">申請狀態<select name="status">${optionList(rentalAdminStatuses, record.status)}</select></label><label class="admin-field">公開備註<textarea name="publicNote">${esc(record.publicNote)}</textarea></label><label class="admin-field">內部備註<textarea name="internalNote">${esc(record.internalNote || "")}</textarea></label><div class="admin-sticky-actions"><button class="btn btn-primary">儲存並檢查衝突</button></div></form>`;
}

function sensitivePanel(record) {
  return `<div class="sensitive-panel"><button type="button" data-reveal>顯示聯絡資料</button><dl data-sensitive hidden><dt>姓名</dt><dd>${esc(record.customerName || record.applicantName)}</dd><dt>電話</dt><dd>${esc(record.phone)}</dd><dt>Email</dt><dd>${esc(record.email)}</dd></dl></div>`;
}

function auditTimeline(records) {
  return `<section class="audit-timeline"><h3>Audit History</h3>${records.length ? `<ol>${records.map((item) => `<li><strong>${esc(item.action)}</strong><time>${new Date(item.createdAt).toLocaleString("zh-TW")}</time></li>`).join("")}</ol>` : "<p>尚無變更紀錄。</p>"}</section>`;
}

function exportRecords(records, type, format) {
  const safe = records.map(({ fingerprint, phone, email, internalNote, ...record }) => record);
  const content = format === "json" ? JSON.stringify(safe, null, 2) : ["id,status,date,total", ...safe.map((record) => `${record.id},${record.status},${record.pickupDate || record.startDate || ""},${record.total || ""}`)].join("\n");
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(new Blob([content], { type: format === "json" ? "application/json" : "text/csv" }));
  anchor.download = `nxspace-${type}.${format}`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export function initializeAvailabilityPage({ repository, showToast, can }) {
  const root = document.querySelector("[data-availability-page]");
  if (!root) return;
  const drawer = root.querySelector("[data-availability-drawer]");
  let visibleMonth = new Date();
  function render() {
    const records = repository.listAvailability();
    renderMonth(records);
    root.querySelector("[data-availability-list]").innerHTML = records.length ? records.map((record) => `<article class="availability-entry"><span class="availability-dot is-${record.type}"></span><div><strong>${venues.find((venue) => venue.id === record.venueId)?.name || record.venueId}</strong><p>${record.startDate} — ${record.endDate} · ${availabilityTypes[record.type]}</p><small>${esc(record.note)}</small></div><button data-delete-availability="${record.id}">刪除</button></article>`).join("") : '<div class="admin-empty"><p>目前沒有場地封鎖或維護設定。</p></div>';
    root.querySelectorAll("[data-delete-availability]").forEach((button) => { button.onclick = () => { if (can("availability.manage") && confirm("刪除此設定？")) { repository.deleteAvailability(button.dataset.deleteAvailability); render(); } }; });
  }
  function renderMonth(records) {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const days = new Date(year, month + 1, 0).getDate();
    root.querySelector("[data-calendar-title]").textContent = `${year} 年 ${month + 1} 月`;
    const blanks = Array.from({ length: firstWeekday }, () => '<span class="availability-day is-blank"></span>').join("");
    const cells = Array.from({ length: days }, (_, index) => { const day = index + 1; const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; const match = records.find((item) => item.startDate <= date && item.endDate >= date); return `<span class="availability-day ${match ? `is-${match.type}` : ""}" title="${match ? availabilityTypes[match.type] : "未設定"}">${day}</span>`; }).join("");
    root.querySelector("[data-availability-calendar]").innerHTML = `<div class="availability-weekdays"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div><div class="availability-days">${blanks}${cells}</div>`;
  }
  root.querySelector("[data-calendar-prev]").onclick = () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1); render(); };
  root.querySelector("[data-calendar-next]").onclick = () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1); render(); };
  root.querySelector("[data-new-availability]").onclick = () => { drawer.hidden = false; document.body.classList.add("is-admin-locked"); };
  root.querySelectorAll("[data-availability-close]").forEach((button) => { button.onclick = () => { drawer.hidden = true; document.body.classList.remove("is-admin-locked"); }; });
  root.querySelector("[data-availability-form]").onsubmit = (event) => { event.preventDefault(); if (!can("availability.manage")) return; try { repository.saveAvailability(Object.fromEntries(new FormData(event.currentTarget))); showToast("場地可用性已儲存。"); event.currentTarget.reset(); drawer.hidden = true; document.body.classList.remove("is-admin-locked"); render(); } catch (error) { showToast(error.message, "danger"); } };
  render();
}
