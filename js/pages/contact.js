import { createContactInquiry } from "../models/public-inquiry-models.js";
import { getPublicInquiryRepository } from "../repositories/public-inquiry-repository.js";
import { validateContactInquiry } from "../validation/public-forms.js";
import { createPageHeader } from "./catalog-page.js";

const contactTypes = ["一般詢問", "活動合作", "品牌進駐", "商品合作", "場地租借", "其他"];

export function createContactPage() {
  return `
    <section class="public-page contact-page" data-contact-page>
      ${createPageHeader({ eyebrow: "CONTACT", title: "聯絡 NXSPACE", description: "活動合作、品牌進駐、商品與場地問題，都歡迎留下訊息。" })}
      <div class="page-container contact-form-layout">
        <form class="public-form contact-form" data-contact-form novalidate>
          <div class="form-error-summary" role="alert" tabindex="-1" data-contact-error-summary hidden></div>
          <div class="form-grid">
            <label class="field-group"><span>姓名 *</span><input name="name" autocomplete="name" required aria-describedby="contact-name-error"><span class="field-error" id="contact-name-error" data-error-for="name"></span></label>
            <label class="field-group"><span>Email 或電話 *</span><input name="contact" autocomplete="email" required aria-describedby="contact-method-error"><span class="field-error" id="contact-method-error" data-error-for="contact"></span></label>
            <label class="field-group"><span>聯絡類型 *</span><select name="type" required aria-describedby="contact-type-error"><option value="">請選擇</option>${contactTypes.map((type) => `<option value="${type}">${type}</option>`).join("")}</select><span class="field-error" id="contact-type-error" data-error-for="type"></span></label>
            <label class="field-group"><span>主旨 *</span><input name="subject" required aria-describedby="contact-subject-error"><span class="field-error" id="contact-subject-error" data-error-for="subject"></span></label>
          </div>
          <label class="field-group"><span>訊息內容 *</span><textarea name="message" rows="7" minlength="10" required aria-describedby="contact-message-error"></textarea><span class="field-error" id="contact-message-error" data-error-for="message"></span></label>
          <label class="agreement-line"><input type="checkbox" name="agreePrivacy" required aria-describedby="contact-privacy-error"> 我同意 NXSPACE 依 <a href="#privacy" target="_blank" rel="noopener">隱私權說明</a> 使用資料進行本次聯絡。<span class="field-error" id="contact-privacy-error" data-error-for="agreePrivacy"></span></label>
          <div class="form-submit-row"><button class="btn btn-primary" type="submit" data-contact-submit>送出訊息</button><span role="status" aria-live="polite" data-contact-status></span></div>
          <div class="form-result" role="alert" data-contact-result hidden></div>
        </form>

        <aside class="contact-aside">
          <p class="page-eyebrow">BEFORE YOU SEND</p>
          <h2>讓我們更快理解需求</h2>
          <ul class="feature-list"><li>場地詢問請提供預計日期與人數</li><li>活動合作請說明內容與合作方式</li><li>品牌進駐請附上品牌簡介</li></ul>
          <a class="btn btn-secondary" href="#venue/apply" data-route-link>直接填寫租借詢問</a>
        </aside>
      </div>
    </section>
  `.trim();
}

export function initializeContactPage() {
  const root = document.querySelector("[data-contact-page]");
  if (!root) return;
  const form = root.querySelector("[data-contact-form]");
  const submit = root.querySelector("[data-contact-submit]");
  const status = root.querySelector("[data-contact-status]");
  const result = root.querySelector("[data-contact-result]");
  const summary = root.querySelector("[data-contact-error-summary]");
  const repository = getPublicInquiryRepository();
  let isSubmitting = false;
  let pendingValues = null;

  function getValues() {
    const data = new FormData(form);
    return {
      name: data.get("name"), contact: data.get("contact"), subject: data.get("subject"),
      type: data.get("type"), message: data.get("message"), agreePrivacy: data.has("agreePrivacy")
    };
  }

  async function persist(values) {
    if (isSubmitting) return;
    isSubmitting = true;
    pendingValues = values;
    submit.disabled = true;
    status.textContent = "正在送出…";
    result.hidden = true;
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      const saved = repository.saveContact(createContactInquiry(values));
      result.hidden = false;
      result.className = "form-result is-success";
      result.innerHTML = `<strong>${saved.duplicate ? "已收到相同訊息" : "訊息已送出"}</strong><p>聯絡編號：${saved.record.id}。NXSPACE 將依序回覆。</p>`;
      status.textContent = "送出完成。";
      if (!saved.duplicate) form.reset();
    } catch (error) {
      console.error("[NXSPACE] Contact submission failed.", error);
      result.hidden = false;
      result.className = "form-result is-error";
      result.innerHTML = '訊息暫時無法儲存。<button class="text-button" type="button" data-contact-retry>重新嘗試</button>';
      status.textContent = "送出失敗。";
    } finally {
      isSubmitting = false;
      submit.disabled = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const values = getValues();
    const errors = validateContactInquiry(values);
    Object.keys({ name: 1, contact: 1, type: 1, subject: 1, message: 1, agreePrivacy: 1 }).forEach((name) => {
      const field = form.elements[name];
      const error = form.querySelector(`[data-error-for="${name}"]`);
      error.textContent = errors[name] || "";
      field.setAttribute("aria-invalid", errors[name] ? "true" : "false");
    });
    if (Object.keys(errors).length) {
      summary.hidden = false;
      summary.textContent = `表單有 ${Object.keys(errors).length} 個欄位需要修正。`;
      form.elements[Object.keys(errors)[0]].focus();
      return;
    }
    summary.hidden = true;
    persist(values);
  });

  result.addEventListener("click", (event) => {
    if (event.target.closest("[data-contact-retry]") && pendingValues) persist(pendingValues);
  });
}
