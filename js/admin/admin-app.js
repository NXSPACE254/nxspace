import { createAdminLayout } from "../layouts/admin-layout.js";
import { adminNavigation, managementSchemas } from "../config/admin-config.js";
import { getAuthenticationService } from "../services/auth-service.js";
import { getDashboardRepository } from "../repositories/dashboard-repository.js";
import { getOperationsRepository } from "../repositories/operations-repository.js";
import { getIdentityRepository } from "../repositories/identity-repository.js";
import { getPermissionService } from "../services/permission-service.js";
import { createAdminRouter } from "../router/admin-router.js";
import { createConfirmDialog, openConfirmDialog } from "../components/modal.js";
import { validateFields } from "../utils/validator.js";
import { createStore } from "../store/app-store.js";
import { createLoginPage, createUnauthorizedPage, createAdminNotFoundPage, createDashboardHome, createFieldDashboard, createComingSoonPage, createManagementPage, createTableRows } from "../pages/admin-pages.js";
import { createOrdersManagementPage, createRentalsManagementPage, createAvailabilityPage, initializeOperationsPage, initializeAvailabilityPage } from "../pages/admin-operations.js";
import { createUsersPage, createRolesPage, createIntegrationsPage, createSettingsPage, createAuditPage, initializeGovernancePage } from "../pages/admin-governance.js";
import { createAcceptancePage, initializeAcceptancePage } from "../pages/admin-acceptance.js";
import { createMerchantCenterPage, initializeMerchantCenter } from "../pages/merchant-center.js";
import { createNotificationCenterPage, initializeNotificationCenter } from "../pages/notification-center.js";
import { createRolePreviewPage, initializeRolePreviewPage } from "../pages/role-preview.js";
import { getRolePreviewService } from "../services/role-preview-service.js";
import { createVenueActivitiesPage, createRentalInvitationsPage, createFoodTruckSchedulePage, createVenueBillingPage, initializeVenueActivityModule } from "../pages/venue-activity-admin.js";
import { createCommerceMerchantsPage, createMerchantProfilePage, createCommerceProductsPage, createProductCategoriesPage, createCustomizationsPage, createDailySuppliesPage, createSlotCapacitiesPage, createPromotionsPage, initializeCommerceManagement } from "../pages/commerce-management.js";
import { createPosPage, createOrderOperationsPage, initializePosOperations } from "../pages/pos-operations.js";
import { createRegistrationAdminPage, initializeRegistrationAdmin } from "../pages/registration-admin.js";

const auth = getAuthenticationService();
const repository = getDashboardRepository();
const operationsRepository = getOperationsRepository();
const identityRepository = getIdentityRepository();
const permissionService = getPermissionService();
const rolePreviewService = getRolePreviewService();
const store = createStore({ dirty: false, collapsed: localStorage.getItem("nxspace.admin.collapsed") === "true" });
const root = document.getElementById("admin-app");
let router;
let lastFocusedElement;
let sessionTimer;

const routes = [
  { path: "#dashboard", title: "營運總覽", permission: "dashboard.view", render: () => createDashboardHome(repository, operationsRepository) },
  { path: "#field-dashboard", title: "場務總覽", permission: "dashboard.view", roles:["role-manager"], render: () => createFieldDashboard(repository, operationsRepository) },
  { path: "#merchant-home", title: "店家首頁", permission: "dashboard.view", roles:["role-vendor"], merchantCenter: true, render: () => createMerchantCenterPage(getEffectiveSession()) },
  { path: "#merchant-notifications", title: "通知中心", permission: "dashboard.view", roles:["role-vendor"], merchantCenter: true, render: () => createMerchantCenterPage(getEffectiveSession()) },
  { path: "#merchant-orders", title: "待處理訂單", permission: "orders.view", posModule: "queue", render: () => createOrderOperationsPage("queue", getEffectiveSession()) },
  { path: "#orders", title: "全部訂單", permission: "orders.view", posModule: "all", render: () => createOrderOperationsPage("all", getEffectiveSession()) },
  { path: "#today-revenue", title: "今日營業額", permission: "orders.view", posModule: "revenue", render: () => createOrderOperationsPage("revenue", getEffectiveSession()) },
  { path: "#customer-history", title: "顧客歷史訂單", permission: "customers.history", posModule: "customers", render: () => createOrderOperationsPage("customers", getEffectiveSession()) },
  { path: "#activity-operations", title: "活動與場租總覽", permission: "registrations.view", registrationModule: "dashboard", render: () => createRegistrationAdminPage("dashboard", getEffectiveSession()) },
  { path: "#registration-settings", title: "活動報名設定", permission: "registrations.settings.view", registrationModule: "settings", render: () => createRegistrationAdminPage("settings", getEffectiveSession()) },
  { path: "#registration-attendees", title: "報名名單", permission: "registrations.attendees.view", registrationModule: "attendees", render: () => createRegistrationAdminPage("attendees", getEffectiveSession()) },
  { path: "#venue-finance", title: "場租收款", permission: "venue-finance.view", registrationModule: "finance", render: () => createRegistrationAdminPage("finance", getEffectiveSession()) },
  { path: "#food-truck-monthly-billing", title: "餐車月度應收", permission: "venue-finance.monthly.view", registrationModule: "monthly", render: () => createRegistrationAdminPage("monthly", getEffectiveSession()) },
  { path: "#field-checklists", title: "設備與場務清單", permission: "field-checklists.view", registrationModule: "checklists", render: () => createRegistrationAdminPage("checklists", getEffectiveSession()) },
  { path: "#rentals", title: "租借管理", permission: "rentals.view", operationType: "rentals", render: createRentalsManagementPage },
  { path: "#availability", title: "場地可用性", permission: "availability.view", availability: true, render: createAvailabilityPage },
  { path: "#users", title: "使用者管理", permission: "users.view", governance: "users", render: () => createUsersPage(identityRepository) },
  { path: "#roles", title: "角色與權限", permission: "roles.view", governance: "roles", render: () => createRolesPage(identityRepository) },
  { path: "#role-preview", title: "角色預覽", permission: "roles.preview", rolePreview: true, render: () => createRolePreviewPage({roles:identityRepository.listRoles(),users:identityRepository.listUsers(),preview:rolePreviewService.get()}) },
  { path: "#notifications", title: "通知中心", permission: "integrations.view", notifications: true, render: createNotificationCenterPage },
  { path: "#integrations", title: "整合與同步", permission: "integrations.view", governance: "integrations", render: createIntegrationsPage },
  { path: "#settings", title: "系統設定", permission: "settings.view", governance: "settings", render: createSettingsPage },
  { path: "#audit", title: "操作紀錄", permission: "audit.view", governance: "audit", render: () => createAuditPage(identityRepository) },
  { path: "#acceptance", title: "最終驗收", permission: "settings.view", acceptance: true, render: createAcceptancePage },
  { path:"#schedule", title:"今日行程", permission:"dashboard.view", render:()=>createComingSoonPage("今日行程","目前可先於角色首頁查看今日摘要，完整日曆將於後續 Package 開放。") },
  { path:"#venue-activities", title:"場地活動", permission:"venue-activities.view", venueModule:"activities", render:createVenueActivitiesPage },
  { path:"#rental-invitations", title:"場租邀請", permission:"rental-invitations.view", venueModule:"invitations", render:createRentalInvitationsPage },
  { path:"#food-truck-schedule", title:"餐車月排", permission:"food-truck-schedule.view", venueModule:"schedule", render:createFoodTruckSchedulePage },
  { path:"#venue-billing", title:"費用與發票", permission:"venue-billing.view", venueModule:"billing", render:createVenueBillingPage },
  { path:"#commerce-merchants", title:"合作店家", permission:"merchants.view", commerceModule:"merchants", render:createCommerceMerchantsPage },
  { path:"#merchant-profile", title:"店家資料", permission:"vendors.view", roles:["role-vendor"], commerceModule:"merchant-profile", render:createMerchantProfilePage },
  { path:"#commerce-products", title:"商品管理", permission:"products.view", commerceModule:"products", render:createCommerceProductsPage },
  { path:"#product-categories", title:"商品分類", permission:"product-categories.manage", commerceModule:"categories", render:createProductCategoriesPage },
  { path:"#customizations", title:"通用客製化", permission:"customizations.view", commerceModule:"customizations", render:createCustomizationsPage },
  { path:"#daily-supplies", title:"今日供應量", permission:"supplies.view", commerceModule:"supplies", render:createDailySuppliesPage },
  { path:"#slot-capacities", title:"時段容量", permission:"slot-capacities.view", commerceModule:"capacities", render:createSlotCapacitiesPage },
  { path:"#promotion-notices", title:"優惠公告", permission:"promotions.view", commerceModule:"promotions", render:createPromotionsPage },
  { path:"#pos", title:"現場點單", permission:"pos.view", posModule:"pos", render:()=>createPosPage(getEffectiveSession()) },
  { path:"#customization", title:"通用客製化", permission:"products.view", render:()=>createComingSoonPage("通用客製化") },
  { path:"#daily-supply", title:"今日供應量", permission:"products.view", render:()=>createComingSoonPage("今日供應量") },
  { path:"#slot-capacity", title:"時段容量", permission:"products.view", render:()=>createComingSoonPage("時段容量") },
  { path:"#promotions", title:"優惠公告", permission:"dashboard.view", render:()=>createComingSoonPage("優惠公告") },
  ...Object.entries(managementSchemas).map(([type, schema]) => ({ path: `#${type}`, title: schema.title, permission: `${schema.permission}.view`, type, render: () => createManagementPage(type, permissionService.filterRecords(getEffectiveSession()?.user, repository.list(type))) })),
  { path: "#unauthorized", title: "沒有權限", public: true, render: createUnauthorizedPage }
];

function hasPermission(permission) {
  const session = getEffectiveSession();
  if (session?.readOnlyPreview && !permission.endsWith(".view")) return false;
  return Boolean(session?.user && permissionService.can(session.user, permission));
}

function getEffectiveSession() { const real=auth.getSession(); return real?rolePreviewService.apply(real):null; }
function roleHome(session = getEffectiveSession()) {
  const roles = session?.user?.roleIds || session?.roleIds || [];
  if (roles.includes("role-super-admin") || roles.includes("role-admin")) return "#dashboard";
  if (roles.includes("role-vendor")) return "#merchant-home";
  if (roles.includes("role-manager")) return "#field-dashboard";
  return "#dashboard";
}

function hasActionPermission(type, action) {
  const module = managementSchemas[type]?.permission;
  return Boolean(module && hasPermission(`${module}.${action}`));
}

function setDocumentMeta(title) {
  document.title = `${title} — NXSPACE 營運中心`;
  document.querySelector('meta[name="description"]')?.setAttribute("content", `${title}，NXSPACE 本機測試管理中心。`);
}

function announce(message) {
  const region = document.getElementById("admin-live-region");
  if (region) region.textContent = message;
}

function showToast(message, tone = "success") {
  const region = document.querySelector("[data-toast-region]");
  if (!region) return;
  const toast = document.createElement("div");
  toast.className = `admin-toast is-${tone}`;
  toast.setAttribute("role", tone === "danger" ? "alert" : "status");
  toast.textContent = message;
  region.append(toast);
  requestAnimationFrame(() => toast.classList.add("is-visible"));
  setTimeout(() => { toast.classList.remove("is-visible"); setTimeout(() => toast.remove(), 200); }, 3200);
}

function renderLogin(message = "") {
  router?.destroy();
  clearInterval(sessionTimer);
  document.body.classList.remove("is-admin-locked");
  const setup = !auth.hasCredential();
  root.innerHTML = createLoginPage({ setup, message });
  setDocumentMeta(setup ? "建立 Demo 管理員" : "登入");
  const form = root.querySelector("[data-auth-form]");
  form?.querySelector("input")?.focus();
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.submitting === "true") return;
    const data = new FormData(form);
    const username = String(data.get("username") || "").trim();
    const password = String(data.get("password") || "");
    const errors = {};
    if (username.length < 4) errors.username = "帳號至少需要 4 個字元。";
    if (password.length < 8) errors.password = "密碼至少需要 8 個字元。";
    form.querySelectorAll(".admin-field-error").forEach((node) => node.textContent = "");
    Object.entries(errors).forEach(([name, value]) => { form.querySelector(`#auth-${name}-error`).textContent = value; });
    if (Object.keys(errors).length) { form.querySelector(`[name="${Object.keys(errors)[0]}"]`)?.focus(); return; }
    const button = form.querySelector("button[type=submit]");
    form.dataset.submitting = "true"; button.disabled = true; button.textContent = "處理中…";
    try {
      if (setup) await auth.createDemoAccount({ username, password }); else await auth.login({ username, password });
      location.hash = roleHome(auth.getSession());
      mountDashboard();
    } catch (error) {
      const messageNode = root.querySelector("[data-auth-message]");
      messageNode.hidden = false; messageNode.textContent = error.message; messageNode.focus?.();
      button.disabled = false; button.textContent = setup ? "建立帳號並登入" : "登入營運中心"; form.dataset.submitting = "false";
    }
  });
}

async function confirmUnsavedChanges() {
  if (!store.getState().dirty) return true;
  root.insertAdjacentHTML("beforeend", createConfirmDialog({ title: "捨棄未儲存變更？", description: "離開後，目前表單內容不會保留。", confirmLabel: "捨棄變更", tone: "danger" }));
  const dialog = root.querySelector("[data-admin-dialog]:last-of-type");
  const confirmed = await openConfirmDialog(dialog);
  dialog.remove();
  if (confirmed) store.setState({ dirty: false });
  return confirmed;
}

function mountDashboard() {
  router?.destroy();
  document.body.classList.remove("is-admin-locked");
  const realSession = auth.getSession();
  if (!realSession) { renderLogin("登入狀態已過期，請重新登入。"); return; }
  const session = rolePreviewService.apply(realSession);
  if (!location.hash || (location.hash === "#dashboard" && roleHome(session) !== "#dashboard")) {
    history.replaceState(null, "", `${location.pathname}${location.search}${roleHome(session)}`);
  }
  root.innerHTML = createAdminLayout({ session, activeHash: location.hash || roleHome(session), collapsed: store.getState().collapsed, navigation: permissionService.filterNavigation(session.user, adminNavigation) });
  initializeShell();
  router = createAdminRouter({ routes, onBeforeRoute: confirmUnsavedChanges, onRoute: renderRoute });
  clearInterval(sessionTimer);
  sessionTimer = setInterval(() => {
    if (!auth.getSession()) { clearInterval(sessionTimer); renderLogin("Session 已過期，請重新登入。"); }
  }, 30000);
}

async function renderRoute(route, current, focus, isCurrent = () => true) {
  const page = document.getElementById("admin-page");
  if (!auth.getSession()) { renderLogin("登入狀態已過期，請重新登入。"); return; }
  const roleIds = getEffectiveSession()?.user?.roleIds || [];
  if (current.path === "#dashboard" && roleHome() !== "#dashboard") { location.hash = roleHome(); return; }
  if (route && (!route.public && !hasPermission(route.permission) || route.roles && !route.roles.some(role=>roleIds.includes(role)))) { location.hash = "#unauthorized"; return; }
  page.setAttribute("aria-busy", "true");
  page.innerHTML = `<div class="admin-loading" role="status"><span></span><p>正在載入資料…</p></div>`;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (!isCurrent() || !page.isConnected) return;
  try {
    page.innerHTML = route ? route.render() : createAdminNotFoundPage();
  } catch (error) {
    page.innerHTML = `<section class="admin-state" role="alert"><span class="admin-state-code">!</span><h1>資料載入失敗</h1><p>頁面暫時無法載入，請重試。</p><button class="btn btn-primary" type="button" data-route-retry>重新載入</button></section>`;
    console.error("[NXSPACE] Admin page rendering failed.", error);
    page.setAttribute("aria-busy", "false");
    page.querySelector("[data-route-retry]")?.addEventListener("click", () => router.navigate());
    return;
  }
  page.setAttribute("aria-busy", "false");
  const title = route?.title || "找不到頁面";
  setDocumentMeta(title);
  document.querySelector("[data-admin-breadcrumb]").textContent = `營運中心 / ${title}`;
  document.querySelectorAll("[data-admin-link]").forEach((link) => { const active = link.getAttribute("href") === current.path; link.classList.toggle("is-active", active); active ? link.setAttribute("aria-current", "page") : link.removeAttribute("aria-current"); });
  closeMobileMenu();
  if (route?.type) initializeManagement(route.type, current.query);
  if (route?.operationType) initializeOperationsPage({ type: route.operationType, repository: operationsRepository, showToast, can: hasPermission });
  if (route?.merchantCenter) initializeMerchantCenter({ session: getEffectiveSession(), showToast, readOnly: Boolean(getEffectiveSession()?.readOnlyPreview) });
  if (route?.notifications && !getEffectiveSession()?.readOnlyPreview) initializeNotificationCenter({ identityRepository, session: auth.getSession(), showToast });
  if (route?.rolePreview) initializeRolePreviewPage({ service: rolePreviewService, realSession: auth.getSession(), identityRepository, showToast, onChange: () => { location.hash=roleHome(); mountDashboard(); } });
  if (route?.availability) initializeAvailabilityPage({ repository: operationsRepository, showToast, can: hasPermission });
  if (route?.governance) initializeGovernancePage({ type: route.governance, repository: identityRepository, session: auth.getSession(), permissionService, showToast });
  if (route?.acceptance) initializeAcceptancePage({ identityRepository, permissionService, session: auth.getSession(), showToast, onReset: () => { location.hash = "#dashboard"; location.reload(); } });
  if (route?.venueModule) initializeVenueActivityModule({ mode:route.venueModule, session:getEffectiveSession(), can:hasPermission, showToast });
  if (route?.commerceModule) {
    initializeCommerceManagement({ mode:route.commerceModule, session:getEffectiveSession(), can:hasPermission, showToast });
    const writePermissionByModule = {
      merchants:"merchants.update", "merchant-profile":"merchants.update", products:"products.update",
      categories:"product-categories.manage", customizations:"customizations.update",
      supplies:"supplies.update", capacities:"slot-capacities.update", promotions:"promotions.update"
    };
    if (!hasPermission(writePermissionByModule[route.commerceModule])) {
      root.querySelector("[data-new]")?.setAttribute("hidden", "");
      root.querySelectorAll("[data-commerce-module] form input, [data-commerce-module] form select, [data-commerce-module] form textarea, [data-commerce-module] form button")
        .forEach((control) => { control.disabled = true; });
    }
  }
  if (route?.posModule) initializePosOperations({ mode: route.posModule, session: getEffectiveSession(), can: hasPermission, showToast });
  if (route?.registrationModule) initializeRegistrationAdmin({ mode: route.registrationModule, session: getEffectiveSession(), can: hasPermission, showToast });
  if (focus) { const main = document.getElementById("admin-main"); main.focus({ preventScroll: true }); main.scrollTo?.(0, 0); }
  announce(`${title}已載入`);
}

function initializeShell() {
  const shell = root.querySelector("[data-admin-shell]");
  const menuButton = root.querySelector("[data-admin-menu]");
  menuButton?.addEventListener("click", () => { const open = shell.classList.toggle("is-menu-open"); menuButton.setAttribute("aria-expanded", String(open)); document.body.classList.toggle("is-admin-locked", open); if (open) shell.querySelector(".admin-nav-link")?.focus(); });
  root.querySelector("[data-admin-backdrop]")?.addEventListener("click", closeMobileMenu);
  root.querySelector("[data-admin-collapse]")?.addEventListener("click", () => { const collapsed = shell.classList.toggle("is-collapsed"); store.setState({ collapsed }); localStorage.setItem("nxspace.admin.collapsed", String(collapsed)); });
  root.querySelector("[data-user-menu]")?.addEventListener("click", (event) => { const panel = root.querySelector("[data-user-menu-panel]"); panel.hidden = !panel.hidden; event.currentTarget.setAttribute("aria-expanded", String(!panel.hidden)); });
  root.querySelector("[data-notifications]")?.addEventListener("click", () => showToast("目前沒有新的通知。", "info"));
  root.querySelector("[data-logout]")?.addEventListener("click", async () => { if (!(await confirmUnsavedChanges())) return; auth.logout(); renderLogin("已安全登出管理中心。"); });
  root.querySelector("[data-global-preview-exit]")?.addEventListener("click", () => { identityRepository.audit("role-preview.exited", rolePreviewService.get()?.id||"preview", auth.getSession()?.userId); rolePreviewService.exit(); mountDashboard(); });
  root.querySelector("[data-global-search]")?.addEventListener("input", (event) => { const input = document.querySelector("[data-table-search]"); if (input) { input.value = event.target.value; input.dispatchEvent(new Event("input")); } });
  if (!root.dataset.globalKeyBound) {
    document.addEventListener("keydown", handleGlobalKeydown);
    document.addEventListener("click", (event) => {
      const panel = root.querySelector("[data-user-menu-panel]");
      if (panel && !panel.hidden && !event.target.closest("[data-user-menu], [data-user-menu-panel]")) panel.hidden = true;
    });
    root.dataset.globalKeyBound = "true";
  }
}

function closeMobileMenu() {
  const shell = root.querySelector("[data-admin-shell]");
  if (!shell) return;
  shell.classList.remove("is-menu-open"); document.body.classList.remove("is-admin-locked"); root.querySelector("[data-admin-menu]")?.setAttribute("aria-expanded", "false");
}

function handleGlobalKeydown(event) {
  if (event.key === "Tab") {
    const drawer = root.querySelector("[data-editor]:not([hidden]) > section, [data-order-action]:not([hidden]) > section");
    const mobileMenu = root.querySelector("[data-admin-shell].is-menu-open .admin-sidebar");
    trapFocus(event, drawer || mobileMenu);
  }
  if (event.key === "Escape") {
    const editor = root.querySelector("[data-editor]:not([hidden])");
    if (editor) closeEditor(editor); else { closeMobileMenu(); const panel = root.querySelector("[data-user-menu-panel]"); if (panel) panel.hidden = true; }
  }
}

function trapFocus(event, container) {
  if (!container) return;
  const focusable = [...container.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((node) => !node.hidden);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function initializeManagement(type, routeQuery) {
  const schema = managementSchemas[type];
  const page = root.querySelector(`[data-management-page="${type}"]`);
  const state = { query: "", status: "", sort: "updated-desc", page: 1, pageSize: 6, selected: new Set() };
  const search = page.querySelector("[data-table-search]");
  const status = page.querySelector("[data-table-status]");
  const sort = page.querySelector("[data-table-sort]");
  const availableRecords = () => permissionService.filterRecords(auth.getSession()?.user, repository.list(type));
  function filteredRecords() {
    const query = state.query.toLowerCase();
    let records = availableRecords().filter((item) => (!query || JSON.stringify(item).toLowerCase().includes(query)) && (!state.status || item.status === state.status));
    records.sort((a,b) => state.sort === "title-asc" ? String(a[schema.titleField]).localeCompare(String(b[schema.titleField]), "zh-Hant") : state.sort === "status-asc" ? String(a.status).localeCompare(String(b.status)) : String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return records;
  }
  function renderTable() {
    const records = filteredRecords(); const pages = Math.max(1, Math.ceil(records.length / state.pageSize)); state.page = Math.min(state.page, pages);
    const visible = records.slice((state.page-1)*state.pageSize, state.page*state.pageSize);
    page.querySelector("[data-table-body]").innerHTML = createTableRows(type, visible);
    page.querySelectorAll("[data-cms-select]").forEach((box) => { box.checked = state.selected.has(box.value); });
    page.querySelector("[data-table-empty]").hidden = records.length > 0;
    page.querySelector("[data-result-count]").textContent = `${records.length} 筆`;
    page.querySelector("[data-page-label]").textContent = `第 ${state.page} / ${pages} 頁`;
    page.querySelector("[data-prev]").disabled = state.page <= 1; page.querySelector("[data-next]").disabled = state.page >= pages;
    page.querySelector("[data-cms-bulk]").hidden = !state.selected.size;
    page.querySelector("[data-cms-selected-count]").textContent = state.selected.size;
  }
  search.addEventListener("input", () => { state.query = search.value.trim(); state.page=1; renderTable(); });
  status.addEventListener("change", () => { state.status=status.value; state.page=1; renderTable(); });
  sort.addEventListener("change", () => { state.sort=sort.value; renderTable(); });
  page.querySelector("[data-clear-filters]").addEventListener("click", () => { search.value=""; status.value=""; sort.value="updated-desc"; Object.assign(state,{query:"",status:"",sort:"updated-desc",page:1}); renderTable(); });
  page.querySelector("[data-prev]").addEventListener("click",()=>{state.page--;renderTable();}); page.querySelector("[data-next]").addEventListener("click",()=>{state.page++;renderTable();});
  page.querySelector("[data-create]").addEventListener("click",()=>openEditor(type));
  page.querySelector("[data-table-body]").addEventListener("click", async (event) => {
    const selected = event.target.closest("[data-cms-select]"); if (selected) { selected.checked ? state.selected.add(selected.value) : state.selected.delete(selected.value); renderTable(); return; }
    const edit = event.target.closest("[data-edit]"); const view = event.target.closest("[data-view]"); const duplicate = event.target.closest("[data-duplicate]"); const remove = event.target.closest("[data-delete]");
    if (edit || view) openEditor(type, repository.get(type,(edit||view).dataset[edit?"edit":"view"]), Boolean(view));
    if (duplicate) { try { repository.duplicate(type, duplicate.dataset.duplicate); showToast(`${schema.singular}已複製為草稿。`); renderTable(); } catch (error) { showToast(error.message, "danger"); } }
    if (remove) await deleteRecord(type, remove.dataset.delete, renderTable);
  });
  page.querySelector("[data-cms-select-all]").addEventListener("change", (event) => { filteredRecords().forEach((item) => event.target.checked ? state.selected.add(item.id) : state.selected.delete(item.id)); renderTable(); });
  page.querySelector("[data-cms-bulk-clear]").addEventListener("click", () => { state.selected.clear(); renderTable(); });
  page.querySelector("[data-cms-bulk-apply]").addEventListener("click", () => { if (!hasPermission(`${schema.permission}.bulk`)) { location.hash="#unauthorized"; return; } repository.bulkUpdate(type, [...state.selected], { status: page.querySelector("[data-cms-bulk-status]").value }); state.selected.clear(); showToast("批次狀態已更新。"); renderTable(); });
  page.querySelectorAll("[data-editor-close]").forEach((button)=>button.addEventListener("click",()=>closeEditor(page.querySelector("[data-editor]") )));
  page.querySelector("[data-editor-form]").addEventListener("input", (event) => { store.setState({dirty:true}); if (event.target.name === "image") updateImagePreview(page,event.target.value); });
  page.querySelector("[data-editor-form]").addEventListener("submit", (event)=>saveEditor(event,type,renderTable));
  renderTable();
  if (routeQuery.get("action") === "new") openEditor(type);
}

function openEditor(type, record = {}, readonly = false) {
  const page = root.querySelector(`[data-management-page="${type}"]`); const drawer = page.querySelector("[data-editor]"); const form = drawer.querySelector("form"); lastFocusedElement = document.activeElement;
  form.reset(); managementSchemas[type].fields.forEach(([name]) => { if (form.elements[name]) form.elements[name].value = record[name] ?? (name === "status" ? "published" : ""); }); form.elements.id.value=record.id||"";
  drawer.querySelector("[data-editor-title]").textContent = `${readonly ? "檢視" : record.id ? "編輯" : "新增"}${managementSchemas[type].singular}`;
  [...form.elements].forEach((control)=>{ if(control.name && control.name!=="id") control.disabled=readonly; }); form.querySelector("button[type=submit]").hidden=readonly;
  drawer.hidden=false; document.body.classList.add("is-admin-locked"); store.setState({dirty:false}); updateImagePreview(page,record.image); drawer.querySelector("input:not([type=hidden]), textarea, select")?.focus();
}

async function closeEditor(drawer) { if (!drawer || drawer.hidden) return; if (!(await confirmUnsavedChanges())) return; drawer.hidden=true; document.body.classList.remove("is-admin-locked"); store.setState({dirty:false}); lastFocusedElement?.focus(); }

function updateImagePreview(page, url="") { const preview=page.querySelector("[data-image-preview]"); if(!preview)return; preview.innerHTML = /^https?:\/\//.test(url) ? `<img src="${url.replace(/"/g,"&quot;")}" alt="圖片預覽" width="1200" height="800" loading="lazy" decoding="async">` : "尚未設定圖片"; }

async function saveEditor(event,type,refresh) {
  event.preventDefault(); const form=event.currentTarget; if(form.dataset.submitting==="true")return; const values=Object.fromEntries(new FormData(form)); const errors=validateFields(values,managementSchemas[type].fields);
  form.querySelectorAll("[data-error-for]").forEach(node=>node.textContent=errors[node.dataset.errorFor]||""); form.querySelectorAll("[aria-invalid]").forEach(node=>node.removeAttribute("aria-invalid"));
  if(Object.keys(errors).length){const first=form.elements[Object.keys(errors)[0]];first.setAttribute("aria-invalid","true");first.focus();return;}
  const action = values.id ? "update" : "create";
  if (!hasActionPermission(type, action)) { location.hash = "#unauthorized"; return; }
  const button=form.querySelector("button[type=submit]"); form.dataset.submitting="true";button.disabled=true;button.textContent="儲存中…";
  try { ["price","stock","priority"].forEach(name=>{if(values[name]!==undefined)values[name]=Number(values[name]);}); repository.save(type,values); store.setState({dirty:false}); form.closest("[data-editor]").hidden=true;document.body.classList.remove("is-admin-locked");refresh();showToast(`${managementSchemas[type].singular}已儲存。`); }
  catch(error){showToast(error.message,"danger");}
  finally{form.dataset.submitting="false";button.disabled=false;button.textContent="儲存";}
}

async function deleteRecord(type,id,refresh) {
  if (!hasActionPermission(type, "archive")) { location.hash = "#unauthorized"; return; }
  root.insertAdjacentHTML("beforeend",createConfirmDialog({title:`刪除${managementSchemas[type].singular}？`,description:"此操作會移除本機資料，無法復原。",confirmLabel:"確認刪除"})); const dialog=root.querySelector("[data-admin-dialog]:last-of-type"); const confirmed=await openConfirmDialog(dialog);dialog.remove(); if(!confirmed)return;
  try{repository.remove(type,id);refresh();showToast(`${managementSchemas[type].singular}已刪除。`);}catch(error){showToast(error.message,"danger");}
}

window.addEventListener("beforeunload",(event)=>{if(store.getState().dirty){event.preventDefault();event.returnValue="";}});

if (auth.getSession()) mountDashboard(); else renderLogin();
