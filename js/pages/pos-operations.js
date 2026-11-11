import { getCommerceRepository } from "../services/commerce-service.js";
import { getOrderOperationsService, paymentMethodLabels, sourceTypeLabels, unifiedOrderStatusLabels } from "../services/order-operations-service.js";

const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const money = (value) => new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(Number(value) || 0);
const today = () => new Date().toISOString().slice(0, 10);
const activeStatuses = ["pending_merchant_confirmation", "accepted", "preparing", "ready"];
const supplyRemaining = (record) => record ? Math.max(0, Number(record.dailyLimit || 0) - Number(record.reservedQuantity || 0) - Number(record.onSiteQuantity || 0) - Number(record.completedQuantity || 0) + Number(record.cancelledReleasedQuantity || 0) - Number(record.wasteQuantity || 0)) : 0;

function merchantScope(session, repository) {
  const roles = session?.user?.roleIds || session?.roleIds || [];
  const userId = session?.user?.id || session?.userId;
  if (roles.includes("role-super-admin") || roles.includes("role-admin")) return repository.listMerchants().map((item) => item.merchantId);
  return repository.listMerchants().filter((item) => item.assignedUserIds.includes(userId)).map((item) => item.merchantId);
}
function contextOf(session, can, repository) {
  return { actor: session?.user?.id || session?.userId || "system", roles: session?.user?.roleIds || session?.roleIds || [], scope: merchantScope(session, repository), can };
}
function pageHeader(title, description) {
  return `<div class="admin-page-header"><div><span class="admin-eyebrow">NXSPACE 店家營運</span><h1>${title}</h1><p>${description}</p></div></div>`;
}
function kpis(summary) {
  return `<div class="admin-kpi-grid pos-kpis">
    <article><span>今日線上訂單</span><strong>${summary.online}</strong></article>
    <article><span>今日現場訂單</span><strong>${summary.walkIn}</strong></article>
    <article><span>等待確認</span><strong>${summary.pending}</strong></article>
    <article><span>備餐中</span><strong>${summary.preparing}</strong></article>
    <article><span>可取餐</span><strong>${summary.ready}</strong></article>
    <article><span>今日實收營業額</span><strong>${money(summary.revenue)}</strong></article>
  </div>`;
}

export function createPosPage(session) {
  const commerce = getCommerceRepository(), service = getOrderOperationsService();
  const scope = merchantScope(session, commerce), merchants = commerce.listMerchants().filter((item) => scope.includes(item.merchantId) && item.status === "active");
  const merchant = merchants[0], activities = merchant ? commerce.eligibleSalesActivities(merchant.merchantId) : [];
  const activity = activities.find((item) => item.startDate >= today()) || activities[0];
  const products = merchant ? commerce.listProducts(merchant.merchantId).filter((item) => item.status === "active" && item.salesStatus === "available") : [];
  const slots = merchant && activity ? commerce.listSlotCapacities(merchant.merchantId).filter((item) => item.activityId === activity.activityId) : [];
  return `<section data-pos-page>
    ${pageHeader("手機 POS／現場點單", "依序選商品、取餐時段與付款方式；送出時一次占用供應量與現場容量。")}
    ${kpis(service.summary({ scope }))}
    <form class="pos-layout" data-pos-form>
      <section class="admin-panel pos-catalog">
        <div class="admin-toolbar">
          <label class="admin-field"><span>店家</span><select name="merchantId" data-pos-merchant>${merchants.map((item) => `<option value="${item.merchantId}">${esc(item.name)}</option>`).join("")}</select></label>
          <label class="admin-field"><span>活動</span><select name="activityId" data-pos-activity>${activities.map((item) => `<option value="${item.activityId}" data-date="${item.startDate}" ${item.activityId === activity?.activityId ? "selected" : ""}>${item.startDate}｜${esc(item.title)}</option>`).join("")}</select></label>
          <label class="admin-field"><span>搜尋商品</span><input type="search" data-product-search placeholder="商品名稱或 SKU"></label>
        </div>
        <div class="pos-product-grid" data-pos-products>
          ${products.map((product) => {
            const supply = activity && commerce.listDailySupplies(merchant.merchantId).find((item) => item.activityId === activity.activityId && item.productId === product.id);
            const remaining = supplyRemaining(supply), unavailable = !supply || !supply.available || remaining <= 0;
            return `<article class="pos-product-card" data-product-name="${esc(`${product.name} ${product.sku}`.toLowerCase())}">
              <img src="${esc(product.image)}" alt="" loading="lazy"><div><strong>${esc(product.name)}</strong><small>${esc(product.sku)}｜${money(product.price)}</small><span>今日剩餘 ${remaining}</span></div>
              <label><span class="sr-only">${esc(product.name)}數量</span><input type="number" name="quantity:${product.id}" min="0" max="${Math.min(product.maxQuantity, remaining)}" value="0" ${unavailable ? "disabled" : ""}></label>
            </article>`;
          }).join("") || '<div class="admin-empty"><p>此活動目前沒有可販售商品。</p></div>'}
        </div>
      </section>
      <aside class="admin-panel pos-checkout">
        <h2>訂單資料</h2>
        <input type="hidden" name="pickupDate" value="${activity?.startDate || today()}">
        <label class="admin-field"><span>取餐時段</span><select name="pickupTime" required>${slots.map((slot) => `<option value="${slot.startTime}">${slot.startTime}｜現場剩餘 ${Math.max(0, slot.walkInReservedCapacity - slot.walkInUsed)}／總剩餘 ${slot.remainingCapacity}</option>`).join("")}</select></label>
        <label class="admin-field"><span>顧客姓名（選填）</span><input name="customerName" autocomplete="name"></label>
        <label class="admin-field"><span>顧客電話（選填）</span><input name="customerPhone" inputmode="tel" autocomplete="tel"></label>
        <label class="admin-field"><span>餐點備註</span><textarea name="notes"></textarea></label>
        <label class="admin-field"><span>付款方式</span><select name="paymentMethod">${Object.entries(paymentMethodLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
        <label class="admin-field"><span>實收金額</span><input name="paidAmount" type="number" min="0" value="0"></label>
        <label class="admin-field"><span>金額調整</span><select name="adjustmentType"><option value="none">無</option><option value="discount">折扣</option><option value="surcharge">加價</option></select></label>
        <label class="admin-field"><span>調整金額</span><input name="adjustmentAmount" type="number" min="0" value="0"></label>
        <label class="admin-field"><span>調整原因</span><input name="adjustmentReason"></label>
        <label class="admin-check"><input name="allowSharedCapacity" type="checkbox"><span>現場保留不足時允許使用總容量</span></label>
        <div class="pos-total"><span>商品小計</span><strong data-pos-total>${money(0)}</strong></div>
        <button class="btn btn-primary" type="submit">建立現場訂單</button>
      </aside>
    </form>
  </section>`;
}

export function createOrderOperationsPage(mode = "all", session) {
  const commerce = getCommerceRepository(), service = getOrderOperationsService(), scope = merchantScope(session, commerce);
  const all = service.listOrders({ scope }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const orders = mode === "queue" ? all.filter((item) => activeStatuses.includes(item.orderStatus)) : all;
  if (mode === "revenue") return createRevenuePage(all, service.summary({ scope }));
  if (mode === "customers") return createCustomerPage();
  return `<section data-order-operations data-mode="${mode}">
    ${pageHeader(mode === "queue" ? "待處理訂單" : "全部訂單", "統一處理線上、現場與管理員代建訂單。")}
    ${kpis(service.summary({ scope }))}
    <div class="admin-toolbar">
      <label class="admin-field"><span>搜尋</span><input type="search" data-order-search placeholder="訂單編號、電話或姓名"></label>
      <label class="admin-field"><span>狀態</span><select data-order-status-filter><option value="">全部狀態</option>${Object.entries(unifiedOrderStatusLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
      <button class="btn btn-secondary" data-export="csv">匯出 CSV</button><button class="btn btn-secondary" data-export="json">匯出 JSON</button>
    </div>
    <div class="merchant-order-grid" data-order-list>${orders.map(orderCard).join("") || '<div class="admin-empty"><p>目前沒有訂單。</p></div>'}</div>
    ${orderActionDialog()}
  </section>`;
}

function orderCard(order) {
  const next = ({ pending_merchant_confirmation: ["accepted", "rejected"], accepted: ["preparing", "merchant_cancelled"], preparing: ["ready", "merchant_cancelled"], ready: ["completed", "no_show", "merchant_cancelled"] })[order.orderStatus] || [];
  return `<article class="merchant-order-card" data-order-card data-search="${esc(`${order.orderId} ${order.customerPhone} ${order.customerName}`.toLowerCase())}" data-status="${order.orderStatus}">
    <header><div><span>${sourceTypeLabels[order.sourceType]}</span><h2>${order.orderId}</h2></div><strong>${unifiedOrderStatusLabels[order.orderStatus]}</strong></header>
    <p>${order.pickupDate} ${order.pickupTime}｜${esc(order.customerName || "現場顧客")} ${esc(order.customerPhone)}</p>
    <ul>${order.items.map((item) => `<li>${esc(item.productName)} × ${item.quantity}<small>${item.customizationSnapshot.map((option) => esc(option.optionName || option.name)).join("、")}</small></li>`).join("")}</ul>
    <p>原始 ${money(order.originalTotal)}｜最終 ${money(order.finalTotal)}｜實收 ${money(order.paidAmount)}（${paymentMethodLabels[order.paymentMethod] || "其他"}）</p>
    <div class="admin-row-actions">${next.map((status) => `<button class="btn btn-secondary" data-status-action="${status}" data-order-id="${order.orderId}">${unifiedOrderStatusLabels[status]}</button>`).join("")}<button class="btn btn-secondary" data-adjust="${order.orderId}">調整實收</button><button class="btn btn-secondary" data-void="${order.orderId}" ${order.voidStatus === "voided" ? "disabled" : ""}>${order.voidStatus === "voided" ? "已作廢" : "作廢"}</button></div>
  </article>`;
}
function orderActionDialog() {
  return `<div class="admin-drawer" data-order-dialog hidden><div class="admin-drawer-backdrop" data-dialog-close></div><section role="dialog" aria-modal="true"><div class="admin-drawer-header"><h2 data-dialog-title>更新訂單</h2><button class="admin-icon-button" data-dialog-close aria-label="關閉">×</button></div><form class="admin-form" data-order-action-form><input type="hidden" name="id"><input type="hidden" name="action"><input type="hidden" name="status"><label class="admin-field"><span>原因</span><textarea name="reason"></textarea></label><label class="admin-field" data-adjust-field hidden><span>調整類型</span><select name="adjustmentType"><option value="discount">折扣</option><option value="surcharge">加價</option></select></label><label class="admin-field" data-adjust-field hidden><span>調整金額</span><input name="adjustmentAmount" type="number" min="0"></label><label class="admin-field" data-adjust-field hidden><span>實收金額</span><input name="paidAmount" type="number" min="0"></label><label class="admin-field" data-adjust-field hidden><span>付款方式</span><select name="paymentMethod">${Object.entries(paymentMethodLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label><button class="btn btn-primary">確認更新</button></form></section></div>`;
}
function createRevenuePage(orders, summary) {
  const paid = orders.filter((order) => order.paymentStatus === "paid" && order.voidStatus !== "voided");
  const byMethod = Object.entries(paymentMethodLabels).map(([key, label]) => `<article><span>${label}</span><strong>${money(paid.filter((order) => order.paymentMethod === key).reduce((sum, order) => sum + order.paidAmount, 0))}</strong></article>`).join("");
  return `<section data-order-operations data-mode="revenue">${pageHeader("今日營業額", "以實收金額統計，作廢訂單不計入。")}${kpis(summary)}<div class="admin-kpi-grid">${byMethod}</div></section>`;
}
function createCustomerPage() {
  return `<section data-order-operations data-mode="customers">${pageHeader("顧客歷史訂單", "以標準化手機號碼查詢最近 30 天訂單。")}<section class="admin-panel"><form class="admin-toolbar" data-customer-form><label class="admin-field"><span>手機號碼</span><input name="phone" inputmode="tel" placeholder="0912-345-678" required></label><button class="btn btn-primary">查詢</button></form><div class="merchant-order-grid" data-customer-results></div></section></section>`;
}

export function initializePosOperations({ mode, session, can, showToast }) {
  const commerce = getCommerceRepository(), service = getOrderOperationsService(), context = contextOf(session, can, commerce);
  const posRoot = document.querySelector("[data-pos-page]");
  if (posRoot) {
    const form = posRoot.querySelector("[data-pos-form]"), products = commerce.listProducts(form.elements.merchantId.value);
    const updateTotal = () => {
      const subtotal = products.reduce((sum, product) => sum + product.price * Number(form.elements[`quantity:${product.id}`]?.value || 0), 0);
      const adjustment = Number(form.elements.adjustmentAmount.value || 0);
      const total = Math.max(0, subtotal + (form.elements.adjustmentType.value === "discount" ? -adjustment : adjustment));
      posRoot.querySelector("[data-pos-total]").textContent = money(total);
    };
    form.addEventListener("input", updateTotal);
    posRoot.querySelector("[data-product-search]").addEventListener("input", (event) => posRoot.querySelectorAll("[data-product-name]").forEach((card) => card.hidden = !card.dataset.productName.includes(event.target.value.trim().toLowerCase())));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form)), activityOption = form.elements.activityId.selectedOptions[0];
      values.pickupDate = activityOption?.dataset.date || values.pickupDate;
      values.sourceType = "walk-in"; values.allowSharedCapacity = form.elements.allowSharedCapacity.checked;
      values.items = products.map((product) => ({ productId: product.id, quantity: Number(form.elements[`quantity:${product.id}`]?.value || 0), customizations: [] })).filter((item) => item.quantity > 0);
      try { const order = service.createWalkInOrder(values, context); showToast(`現場訂單 ${order.orderId} 已建立。`); location.hash = "#merchant-orders"; }
      catch (error) { showToast(error.message, "danger"); }
    });
    return;
  }
  const root = document.querySelector("[data-order-operations]");
  if (!root) return;
  const customerForm = root.querySelector("[data-customer-form]");
  customerForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    try { const orders = service.customerHistory(customerForm.elements.phone.value, context); root.querySelector("[data-customer-results]").innerHTML = orders.map(orderCard).join("") || '<div class="admin-empty"><p>最近 30 天沒有相符訂單。</p></div>'; }
    catch (error) { showToast(error.message, "danger"); }
  });
  const filter = () => {
    const query = root.querySelector("[data-order-search]")?.value.trim().toLowerCase() || "", status = root.querySelector("[data-order-status-filter]")?.value || "";
    root.querySelectorAll("[data-order-card]").forEach((card) => card.hidden = Boolean(query && !card.dataset.search.includes(query) || status && card.dataset.status !== status));
  };
  root.querySelector("[data-order-search]")?.addEventListener("input", filter);
  root.querySelector("[data-order-status-filter]")?.addEventListener("change", filter);
  root.addEventListener("click", (event) => {
    const exportButton = event.target.closest("[data-export]");
    if (exportButton) {
      try { const file = service.exportOrders(exportButton.dataset.export, context); download(file.content, `nxspace-orders-${today()}.${file.extension}`, file.mime); }
      catch (error) { showToast(error.message, "danger"); }
      return;
    }
    const status = event.target.closest("[data-status-action]"), adjust = event.target.closest("[data-adjust]"), voidButton = event.target.closest("[data-void]"), close = event.target.closest("[data-dialog-close]");
    const drawer = root.querySelector("[data-order-dialog]"), form = root.querySelector("[data-order-action-form]");
    if (close) { drawer.hidden = true; document.body.classList.remove("is-admin-locked"); return; }
    if (!status && !adjust && !voidButton) return;
    form.reset(); form.elements.id.value = status?.dataset.orderId || adjust?.dataset.adjust || voidButton?.dataset.void;
    form.elements.action.value = status ? "status" : adjust ? "adjust" : "void"; form.elements.status.value = status?.dataset.statusAction || "";
    root.querySelectorAll("[data-adjust-field]").forEach((field) => field.hidden = !adjust);
    root.querySelector("[data-dialog-title]").textContent = status ? `更新為${unifiedOrderStatusLabels[status.dataset.statusAction]}` : adjust ? "調整實收金額" : "作廢訂單";
    drawer.hidden = false; document.body.classList.add("is-admin-locked"); form.elements.reason.focus();
  });
  root.querySelector("[data-order-action-form]")?.addEventListener("submit", (event) => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (values.action === "status") service.updateStatus(values.id, values.status, values, context);
      if (values.action === "adjust") service.adjustOrder(values.id, { ...values, adjustmentReason: values.reason }, context);
      if (values.action === "void") service.voidOrder(values.id, values.reason, context);
      showToast("訂單已更新。"); location.reload();
    } catch (error) { showToast(error.message, "danger"); }
  });
}

function download(content, filename, mime) {
  const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: mime }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
