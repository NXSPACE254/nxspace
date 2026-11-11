import { managementSchemas } from "../config/admin-config.js";
import { renderFieldError } from "../utils/validator.js";

function escapeHtml(value = "") { return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char])); }
function statusLabel(status) { return status === "published" ? "已發布" : status === "draft" ? "草稿" : "已下架"; }

export function createLoginPage({ setup = false, message = "" } = {}) {
  return `<main class="admin-auth-page"><section class="admin-auth-card" aria-labelledby="auth-title">
    <a href="../index.html#home" class="admin-auth-brand">NXSPACE</a><span class="mode-chip">本機測試模式</span>
    <h1 id="auth-title">NXSPACE 營運中心</h1>
    <p>供 NXSPACE 管理人員及合作店家登入使用</p>
    ${setup ? '<p class="admin-auth-note">首次使用請建立只存在此瀏覽器的管理帳號；密碼僅以加鹽雜湊保存。</p>' : '<p class="admin-auth-note">登入狀態會在關閉分頁或一小時後失效。</p>'}
    <div class="admin-form-message" data-auth-message ${message ? "" : "hidden"}>${message}</div>
    <form data-auth-form novalidate>
      <label class="admin-field"><span>帳號</span><input name="username" autocomplete="username" minlength="4" required aria-describedby="auth-username-error"><span class="admin-field-error" id="auth-username-error"></span></label>
      <label class="admin-field"><span>${setup ? "建立密碼" : "密碼"}</span><input name="password" type="password" autocomplete="${setup ? "new-password" : "current-password"}" minlength="8" required aria-describedby="auth-password-error"><span class="admin-field-error" id="auth-password-error"></span></label>
      <button class="btn btn-primary admin-submit" type="submit">${setup ? "建立帳號並登入" : "登入營運中心"}</button>
    </form>
    <details><summary>測試模式說明</summary><p>目前為純前端本機展示環境，並非正式登入服務。系統不提供或保存預設明文密碼。</p></details>
  </section></main>`;
}

export function createUnauthorizedPage() { return `<section class="admin-state"><span class="admin-state-code">403</span><h1>沒有操作權限</h1><p>目前登入帳號無法使用此管理功能。</p><a class="btn btn-primary" href="#dashboard">返回總覽</a></section>`; }
export function createAdminNotFoundPage() { return `<section class="admin-state"><span class="admin-state-code">404</span><h1>找不到管理頁面</h1><p>此管理頁面不存在或已移動。</p><a class="btn btn-primary" href="#dashboard">返回總覽</a></section>`; }

export function createDashboardHome(repository, operationsRepository) {
  const today = new Date().toISOString().slice(0, 10);
  const activities = repository.list("activities");
  const vendors = repository.list("vendors");
  const orders = operationsRepository?.listOrders() || [];
  const rentals = operationsRepository?.listRentals() || [];
  const todayActivities = activities.filter(item => item.sortDate === today);
  const todayRentals = rentals.filter(item => item.startDate <= today && item.endDate >= today);
  const todayOrders = orders.filter(item => String(item.createdAt || item.pickupDate || "").startsWith(today));
  const revenue = todayOrders.filter(item => item.status === "completed").reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const summary = [
    ["今日活動數", todayActivities.length], ["今日場地使用數", todayRentals.length],
    ["今日合作店家／餐車數", vendors.filter(item => item.status === "published").length],
    ["今日線上訂單數", todayOrders.length], ["今日現場訂單數", 0],
    ["今日實際營業額", `$${revenue.toLocaleString("zh-TW")}`],
    ["待處理場租數", rentals.filter(item => ["submitted","reviewing","needs_information"].includes(item.status)).length],
    ["待確認繳費數", rentals.filter(item => item.paymentStatus === "unpaid").length]
  ];
  const agenda = [
    ...todayRentals.map(item => ({ time:item.startTime || "09:00", venue:item.venueName || item.venueId || "場地未定", title:item.eventName || item.organization || "場地租借", type:"場地租借", partner:item.applicantName || item.organization || "—", end:item.endTime || "18:00", status:item.statusLabel || "待處理" })),
    ...todayActivities.map(item => ({ time:(item.time || "09:00").slice(0,5), venue:item.location || "場地未定", title:item.title, type:item.tag || "活動", partner:item.partner || "NXSPACE", end:(item.time || "").split("–")[1] || "—", status:item.status === "published" ? "已確認" : "準備中" }))
  ].sort((a,b) => a.time.localeCompare(b.time));
  const pending = [
    ["待補資料場租", rentals.filter(item => item.status === "needs_information").length],
    ["待確認場租", rentals.filter(item => ["submitted","reviewing"].includes(item.status)).length],
    ["未繳費場租", rentals.filter(item => item.paymentStatus === "unpaid").length],
    ["已取消或延期活動", activities.filter(item => ["cancelled","postponed"].includes(item.status)).length],
    ["店家暫停接單", vendors.filter(item => item.acceptsOrders === false || item.acceptsOrders === "false").length],
    ["商品今日售完", repository.list("products").filter(item => item.soldOut === true || item.availability === "sold_out").length]
  ].filter(([,count]) => count);
  return `<section><div class="admin-page-header"><div><span class="admin-eyebrow">NXSPACE 營運中心</span><h1>營運總覽</h1><p>${new Date().toLocaleDateString("zh-TW",{dateStyle:"full"})} 的跨場地營運摘要。</p></div><span class="mode-chip">本機測試模式</span></div>
    <div class="admin-kpi-grid">${summary.map(([label,value])=>`<article><span>${label}</span><strong>${value ?? 0}</strong></article>`).join("")}</div>
    <section class="admin-panel"><div class="admin-panel-heading"><div><h2>今日營運</h2><p>依開始時間排序的場地與活動資訊</p></div></div><div class="operations-agenda">${agenda.length ? agenda.map(item=>`<article><time>${escapeHtml(item.time)}–${escapeHtml(item.end)}</time><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.venue)} · ${escapeHtml(item.type)} · ${escapeHtml(item.partner)}</span></div><span class="admin-status is-published">${escapeHtml(item.status)}</span></article>`).join("") : '<div class="admin-empty"><p>今日尚無排定的場地或活動。</p></div>'}</div></section>
    <div class="admin-home-grid"><section class="admin-panel"><div class="admin-panel-heading"><div><h2>待處理事項</h2><p>需要營運人員留意的項目</p></div></div>${pending.length ? `<ul class="operations-tasks">${pending.map(([label,count])=>`<li><span>${label}</span><strong>${count}</strong></li>`).join("")}</ul>` : '<div class="admin-empty"><p>目前沒有待處理事項。</p></div>'}</section>
    <section class="admin-panel"><div class="admin-panel-heading"><div><h2>快速入口</h2><p>未完成流程會顯示後續 Package 開放</p></div></div><div class="admin-quick-actions"><a href="#activities?action=new">新增場地活動</a><a href="#rental-invitations">建立場租邀請</a><a href="#availability">餐車月排</a><a href="#vendors?action=new">新增合作店家</a><a href="#products?action=new">新增商品</a><a href="#orders">查看訂單</a><a href="#pos">開啟 POS</a><a href="#notifications">查看通知中心</a></div></section></div></section>`;
}

export function createFieldDashboard(repository, operationsRepository) {
  const today = new Date().toISOString().slice(0,10);
  const rentals = operationsRepository?.listRentals() || [];
  const venues = ["鐵花館","綠洲場","東海館"];
  const current = rentals.filter(item=>item.startDate<=today&&item.endDate>=today);
  return `<section><div class="admin-page-header"><div><span class="admin-eyebrow">現場作業</span><h1>場務總覽</h1><p>${new Date().toLocaleDateString("zh-TW",{dateStyle:"full"})} 場地、設備與租借待辦。</p></div></div>
  <div class="admin-kpi-grid">${venues.map(name=>`<article><span>今日${name}行程</span><strong>${current.filter(item=>String(item.venueName||item.venueId).includes(name)).length}</strong></article>`).join("")}<article><span>待準備設備</span><strong>${current.filter(item=>item.equipmentNeeds || item.equipment).length}</strong></article><article><span>待確認租借</span><strong>${rentals.filter(item=>["submitted","reviewing"].includes(item.status)).length}</strong></article><article><span>待繳費資料</span><strong>${rentals.filter(item=>item.paymentStatus==="unpaid").length}</strong></article><article><span>延期／取消紀錄</span><strong>${rentals.filter(item=>["cancelled","postponed"].includes(item.status)).length}</strong></article><article><span>本月場地使用次數</span><strong>${rentals.filter(item=>String(item.startDate).startsWith(today.slice(0,7))).length}</strong></article></div>
  <section class="admin-panel"><h2>今日場務清單</h2><div class="operations-agenda">${current.length?current.map(item=>`<article><time>${escapeHtml(item.startTime||"待定")}–${escapeHtml(item.endTime||"待定")}</time><div><strong>${escapeHtml(item.eventName||item.organization||"場地租借")}</strong><span>${escapeHtml(item.venueName||item.venueId||"場地未定")} · 桌椅：${escapeHtml(item.layoutNeeds||"依現場需求")} · 設備：${escapeHtml(item.equipmentNeeds||item.equipment||"無")}</span></div></article>`).join(""):'<div class="admin-empty"><p>今日尚無場務行程。</p></div>'}</div></section></section>`;
}

export function createComingSoonPage(title, description = "此功能將於後續 Package 開放。") {
  return `<section class="admin-state"><span class="admin-state-code">…</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p><a class="btn btn-primary" href="#dashboard">返回角色首頁</a></section>`;
}

export function createManagementPage(type, records, state = {}) {
  const schema = managementSchemas[type];
  const statuses = [...new Set(records.map((item) => item.status || "published"))];
  return `<section data-management-page="${type}"><div class="admin-page-header"><div><span class="admin-eyebrow">內容管理</span><h1>${schema.title}</h1><p>搜尋、篩選、排序並維護${schema.singular}資料。</p></div><button class="btn btn-primary" type="button" data-create>＋ 新增${schema.singular}</button></div>
    <div class="admin-toolbar"><label><span class="sr-only">搜尋</span><input type="search" value="${escapeHtml(state.query || "")}" placeholder="搜尋${schema.singular}" data-table-search></label><label><span class="sr-only">狀態</span><select data-table-status><option value="">全部狀態</option>${["published","draft","archived"].map(value=>`<option value="${value}" ${state.status===value?"selected":""}>${statusLabel(value)}</option>`).join("")}</select></label><label><span class="sr-only">排序</span><select data-table-sort><option value="updated-desc">最近更新</option><option value="title-asc" ${state.sort==='title-asc'?"selected":""}>名稱 A–Z</option><option value="status-asc" ${state.sort==='status-asc'?"selected":""}>狀態</option></select></label><button class="btn btn-secondary" type="button" data-clear-filters>清除</button><span class="admin-result-count" data-result-count>${records.length} 筆</span></div>
    <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th scope="col"><input type="checkbox" data-cms-select-all aria-label="選取全部"></th><th scope="col">名稱</th><th scope="col">分類／版位</th><th scope="col">狀態</th><th scope="col">更新</th><th scope="col"><span class="sr-only">操作</span></th></tr></thead><tbody data-table-body></tbody></table><div class="admin-empty" data-table-empty hidden><h2>沒有符合的資料</h2><p>調整搜尋或篩選條件後再試一次。</p></div></div>
    <div class="admin-bulk-bar" data-cms-bulk hidden><strong><span data-cms-selected-count>0</span> 筆已選取</strong><select data-cms-bulk-status><option value="published">發布</option><option value="draft">改為草稿</option><option value="archived">下架</option></select><button class="btn btn-primary" type="button" data-cms-bulk-apply>套用</button><button class="btn btn-secondary" type="button" data-cms-bulk-clear>取消</button></div>
    <div class="admin-pagination"><button class="btn btn-secondary" type="button" data-prev>上一頁</button><span data-page-label></span><button class="btn btn-secondary" type="button" data-next>下一頁</button></div>
    <div class="admin-drawer" data-editor hidden><div class="admin-drawer-backdrop" data-editor-close></div><section role="dialog" aria-modal="true" aria-labelledby="editor-title"><div class="admin-drawer-header"><div><span class="admin-eyebrow">EDITOR</span><h2 id="editor-title" data-editor-title></h2></div><button class="admin-icon-button" type="button" data-editor-close aria-label="關閉編輯器">×</button></div><form data-editor-form novalidate><input type="hidden" name="id">${schema.fields.map(([name,label,fieldType,required])=>createEditorField(name,label,fieldType,required)).join("")}<div class="admin-sticky-actions"><button class="btn btn-secondary" type="button" data-editor-close>取消</button><button class="btn btn-primary" type="submit">儲存</button></div></form></section></div>
  </section>`;
}

function createEditorField(name, label, type, required) {
  const describedBy = `${name}-error`;
  if (type === "textarea") return `<label class="admin-field"><span>${label}${required ? " *" : ""}</span><textarea name="${name}" rows="4" ${required?"required":""} aria-describedby="${describedBy}"></textarea>${renderFieldError(name)}</label>`;
  if (type === "status") return `<label class="admin-field"><span>${label}</span><select name="${name}" aria-describedby="${describedBy}"><option value="published">已發布</option><option value="draft">草稿</option><option value="archived">已下架</option></select>${renderFieldError(name)}</label>`;
  return `<label class="admin-field"><span>${label}${required ? " *" : ""}</span><input name="${name}" type="${type}" ${required?"required":""} aria-describedby="${describedBy}">${name==="image"?'<span class="admin-image-preview" data-image-preview>尚未設定圖片</span>':""}${renderFieldError(name)}</label>`;
}

export function createTableRows(type, records) {
  const schema = managementSchemas[type];
  return records.map((item)=>`<tr><td><input type="checkbox" data-cms-select value="${item.id}" aria-label="選取 ${escapeHtml(item[schema.titleField])}"></td><td><strong>${escapeHtml(item[schema.titleField] || "未命名")}</strong><small>${escapeHtml(item.slug || item.id)}</small></td><td>${escapeHtml(item.tag || item.placement || item.vendor || "—")}</td><td><span class="admin-status is-${item.status || 'published'}">${statusLabel(item.status || "published")}</span></td><td>${item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("zh-TW") : "初始資料"}</td><td><div class="admin-row-actions"><button type="button" data-view="${item.id}">預覽</button><button type="button" data-edit="${item.id}">編輯</button><button type="button" data-duplicate="${item.id}">複製</button><button type="button" data-delete="${item.id}">刪除</button></div></td></tr>`).join("");
}
