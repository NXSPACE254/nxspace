import { createStateView } from "../components/state-view.js";
import { getPublicInquiryRepository } from "../repositories/public-inquiry-repository.js";
import { getOperationsRepository } from "../repositories/operations-repository.js";
import { formatPublicDate } from "../utils/date-time.js";
import { validateRentalLookup } from "../validation/public-forms.js";
import { createPageHeader } from "./catalog-page.js";

const escapeHtml = (value = "") => String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));

function createLookupResult(rental) {
  return `
    <article class="lookup-result">
      <div class="confirmation-status"><span>目前狀態</span><strong>${rental.statusLabel}</strong></div>
      <h2>申請 ${rental.id}</h2>
      <dl class="confirmation-summary">
        <div><dt>申請人</dt><dd>${rental.applicantName}</dd></div>
        <div><dt>聯絡電話</dt><dd>${rental.phone}</dd></div>
        <div><dt>Email</dt><dd>${rental.email}</dd></div>
        <div><dt>場地</dt><dd>${rental.venueName}</dd></div>
        <div><dt>日期</dt><dd>${formatPublicDate(rental.startDate)}${rental.endDate !== rental.startDate ? ` 至 ${formatPublicDate(rental.endDate)}` : ""}</dd></div>
        <div><dt>時間</dt><dd>${rental.startTime}－${rental.endTime}</dd></div>
      </dl>
      <div class="public-note"><h3>公開備註</h3><p>${rental.publicNote}</p></div>
    </article>
  `.trim();
}

function createOrderLookupResult(order) {
  const timeline = (order.statusHistory || []).map((item) => `<li><strong>${escapeHtml(item.to)}</strong><time>${new Date(item.at).toLocaleString("zh-TW")}</time></li>`).join("");
  return `<article class="lookup-result"><div class="confirmation-status"><span>訂單狀態</span><strong>${escapeHtml(order.statusLabel)}</strong></div><h2>訂單 ${escapeHtml(order.id)}</h2><dl class="confirmation-summary"><div><dt>商店</dt><dd>${escapeHtml(order.merchantName)}</dd></div><div><dt>取貨人</dt><dd>${escapeHtml(order.customerName)}</dd></div><div><dt>聯絡電話</dt><dd>${escapeHtml(order.phone)}</dd></div><div><dt>Email</dt><dd>${escapeHtml(order.email)}</dd></div><div><dt>取貨時間</dt><dd>${escapeHtml(order.pickupDate)} ${escapeHtml(order.pickupTime)}</dd></div><div><dt>預計完成</dt><dd>${escapeHtml(order.estimatedReadyTime || "尚未提供")}</dd></div></dl><section><h3>餐點摘要</h3><ul>${order.items.map(item => `<li>${escapeHtml(item.name)} × ${item.quantity}<small>${item.customizations.map(escapeHtml).join("、")}</small></li>`).join("")}</ul></section><div class="public-note"><h3>店家公開備註</h3><p>${escapeHtml(order.publicNote)}</p></div><section class="audit-timeline"><h3>狀態時間軸</h3><ol>${timeline || "<li>訂單已送出，等待店家確認。</li>"}</ol></section>${order.status === "rejected" ? '<p>店家已拒絕此訂單，請返回商店重新點餐或聯絡商店。</p><a class="btn btn-primary" href="#shops">返回商店</a>' : ""}</article>`;
}

export function createLookupPage() {
  return `
    <section class="public-page lookup-page" data-public-lookup>
      ${createPageHeader({
        eyebrow: "進度查詢",
        title: "申請與訂單查詢",
        description: "使用租借申請編號搭配 Email 或電話末四碼，查看目前處理狀態。"
      })}
      <div class="page-container lookup-grid">
        <section class="prose-card">
          <h2>租借申請查詢</h2>
          <p>查詢結果只顯示遮罩後的聯絡資料，不會公開完整個人資訊。</p>
          <form class="public-form compact-form" data-rental-lookup-form novalidate>
            <label class="field-group"><span>申請編號</span><input name="id" autocomplete="off" placeholder="NXR-YYYYMMDD-XXXXX" required aria-describedby="lookup-id-error"><span class="field-error" id="lookup-id-error" data-error-for="id"></span></label>
            <label class="field-group"><span>Email 或電話末四碼</span><input name="verifier" autocomplete="off" required aria-describedby="lookup-verifier-error"><span class="field-error" id="lookup-verifier-error" data-error-for="verifier"></span></label>
            <button class="btn btn-primary" type="submit">查詢租借申請</button>
          </form>
          <div class="lookup-output" role="status" aria-live="polite" data-rental-lookup-output></div>
        </section>

        <section class="prose-card">
          <h2>訂單查詢</h2>
          <p>輸入訂單編號及原始 Email 或手機末四碼，查詢目前處理與取貨狀態。</p>
          <form class="public-form compact-form" data-order-lookup-form novalidate>
            <label class="field-group"><span>訂單編號</span><input name="orderId" autocomplete="off" required placeholder="NXO-XXXXXXXX"></label>
            <label class="field-group"><span>Email 或手機末四碼</span><input name="orderVerifier" autocomplete="off" required><span class="field-error" data-order-lookup-error></span></label>
            <button class="btn btn-secondary" type="submit">查詢訂單</button>
          </form>
          <div class="lookup-output" role="status" aria-live="polite" data-order-lookup-output></div>
        </section>
      </div>
    </section>
  `.trim();
}

export function initializeLookupPage() {
  const root = document.querySelector("[data-public-lookup]");
  if (!root) return;
  const repository = getPublicInquiryRepository();
  const rentalForm = root.querySelector("[data-rental-lookup-form]");
  const rentalOutput = root.querySelector("[data-rental-lookup-output]");
  const orderForm = root.querySelector("[data-order-lookup-form]");
  const orderOutput = root.querySelector("[data-order-lookup-output]");
  const operationsRepository = getOperationsRepository();

  rentalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(rentalForm));
    const errors = validateRentalLookup(values);

    ["id", "verifier"].forEach((name) => {
      const field = rentalForm.elements[name];
      const error = rentalForm.querySelector(`[data-error-for="${name}"]`);
      error.textContent = errors[name] || "";
      field.setAttribute("aria-invalid", errors[name] ? "true" : "false");
    });

    if (Object.keys(errors).length > 0) {
      rentalForm.elements[Object.keys(errors)[0]].focus();
      rentalOutput.innerHTML = "";
      return;
    }

    const rental = repository.lookupRental(values.id, values.verifier);
    rentalOutput.innerHTML = rental
      ? createLookupResult(rental)
      : createStateView({
          type: "empty",
          title: "查無符合的申請",
          description: "請確認申請編號及驗證資料是否與送出時一致。"
        });
  });

  orderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const orderId = orderForm.elements.orderId.value.trim();
    const verifier = orderForm.elements.orderVerifier.value.trim();
    const orderError = orderForm.querySelector("[data-order-lookup-error]");
    if (!orderId || !verifier) {
      orderError.textContent = "請輸入訂單編號及驗證資料。";
      orderForm.elements.orderId.focus();
      return;
    }
    orderError.textContent = "";
    const order = operationsRepository.lookupOrder(orderId, verifier);
    orderOutput.innerHTML = order ? createOrderLookupResult(order) : createStateView({ type: "empty", title: "查無訂單", description: "請確認訂單編號與 Email 或手機末四碼是否正確。" });
  });
}
