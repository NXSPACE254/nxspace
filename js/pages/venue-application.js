import {
  createAvailabilityCalendar,
  getCalendarMonthFromDate
} from "../components/availability-calendar.js";
import { createStateView } from "../components/state-view.js";
import {
  activityTypeOptions,
  equipmentOptions,
  rentalTimePresets,
  venues,
  getVenueById,
  getVenueBySlug
} from "../data/venue-data.js";
import {
  createRentalApplication,
  toPublicRentalApplication
} from "../models/public-inquiry-models.js";
import { getPublicInquiryRepository } from "../repositories/public-inquiry-repository.js";
import {
  compareDateStrings,
  formatPublicDate,
  toLocalDateString
} from "../utils/date-time.js";
import { validateRentalApplication } from "../validation/public-forms.js";
import { createPageHeader } from "./catalog-page.js";

const fieldNames = [
  "applicantName", "phone", "email", "organization", "venueId", "activityType",
  "startDate", "endDate", "timePreset", "startTime", "endTime", "expectedPeople",
  "activityDescription", "notes", "agreePrivacy", "agreeTerms"
];

function createFieldError(name) {
  return `<span class="field-error" id="${name}-error" data-error-for="${name}"></span>`;
}

function createOptions(items, selectedValue = "") {
  return items.map((item) => {
    const value = typeof item === "string" ? item : item.value;
    const label = typeof item === "string" ? item : item.label;
    return `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${label}</option>`;
  }).join("");
}

export function createVenueApplicationPage(venueSlug = "") {
  const selectedVenue = venueSlug ? getVenueBySlug(venueSlug) : venues[0];
  if (!selectedVenue) return "";
  const today = toLocalDateString();
  const { year, month } = getCalendarMonthFromDate(today);

  return `
    <section class="public-page rental-application-page" data-rental-application>
      ${createPageHeader({
        eyebrow: "RENTAL APPLICATION",
        title: "場地租借詢問",
        description: "選擇日期與時段並留下活動資訊。送出後會取得申請編號，但尚不代表正式預訂完成。"
      })}

      <div class="page-container rental-application-layout">
        <form class="public-form rental-form" data-rental-form novalidate>
          <div class="form-error-summary" role="alert" tabindex="-1" data-form-error-summary hidden></div>

          <fieldset class="form-section">
            <legend><span>01</span>聯絡資料</legend>
            <div class="form-grid">
              <label class="field-group"><span>申請人姓名 *</span><input name="applicantName" autocomplete="name" required aria-describedby="applicantName-error">${createFieldError("applicantName")}</label>
              <label class="field-group"><span>聯絡電話 *</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required aria-describedby="phone-error">${createFieldError("phone")}</label>
              <label class="field-group"><span>Email *</span><input name="email" type="email" autocomplete="email" required aria-describedby="email-error">${createFieldError("email")}</label>
              <label class="field-group"><span>公司或團體名稱</span><input name="organization" autocomplete="organization" aria-describedby="organization-error">${createFieldError("organization")}</label>
            </div>
          </fieldset>

          <fieldset class="form-section">
            <legend><span>02</span>場地與活動</legend>
            <div class="form-grid">
              <label class="field-group"><span>場地 *</span><select name="venueId" required aria-describedby="venueId-error">${venues.map((venue) => `<option value="${venue.id}" ${venue.id === selectedVenue.id ? "selected" : ""}>${venue.name}｜${venue.capacity.recommended}</option>`).join("")}</select>${createFieldError("venueId")}</label>
              <label class="field-group"><span>活動類型 *</span><select name="activityType" required aria-describedby="activityType-error"><option value="">請選擇</option>${createOptions(activityTypeOptions)}</select>${createFieldError("activityType")}</label>
              <label class="field-group"><span>預計人數 *</span><input name="expectedPeople" type="number" min="1" max="${selectedVenue.capacity.standing}" inputmode="numeric" required aria-describedby="expectedPeople-hint expectedPeople-error"><small id="expectedPeople-hint">${selectedVenue.name} 最多 ${selectedVenue.capacity.standing} 人</small>${createFieldError("expectedPeople")}</label>
            </div>
          </fieldset>

          <fieldset class="form-section">
            <legend><span>03</span>日期與時段</legend>
            <div class="selection-mode" role="radiogroup" aria-label="日期選擇方式">
              <label><input type="radio" name="dateMode" value="single" checked> 單日</label>
              <label><input type="radio" name="dateMode" value="range"> 日期區間</label>
            </div>
            <div data-calendar-container>
              ${createAvailabilityCalendar({ venue: selectedVenue, year, month })}
            </div>
            <div class="form-grid date-input-grid">
              <label class="field-group"><span>開始日期 *</span><input name="startDate" type="date" min="${today}" required aria-describedby="startDate-error">${createFieldError("startDate")}</label>
              <label class="field-group" data-end-date-field><span>結束日期 *</span><input name="endDate" type="date" min="${today}" required aria-describedby="endDate-error">${createFieldError("endDate")}</label>
              <label class="field-group"><span>時段 *</span><select name="timePreset" aria-describedby="timePreset-error">${createOptions(rentalTimePresets, "morning")}</select>${createFieldError("timePreset")}</label>
              <label class="field-group"><span>開始時間 *</span><input name="startTime" type="time" value="09:00" required aria-describedby="startTime-error">${createFieldError("startTime")}</label>
              <label class="field-group"><span>結束時間 *</span><input name="endTime" type="time" value="12:00" required aria-describedby="endTime-error">${createFieldError("endTime")}</label>
            </div>
            <div class="availability-feedback" role="status" aria-live="polite" data-availability-feedback>請選擇日期以檢查場地狀態。</div>
          </fieldset>

          <fieldset class="form-section">
            <legend><span>04</span>設備與活動說明</legend>
            <div class="checkbox-grid">
              ${equipmentOptions.map((item) => `<label><input type="checkbox" name="equipment" value="${item}"> ${item}</label>`).join("")}
            </div>
            <label class="field-group"><span>活動說明 *</span><textarea name="activityDescription" rows="5" minlength="10" required aria-describedby="activityDescription-error" placeholder="請說明活動內容、流程與空間使用方式"></textarea>${createFieldError("activityDescription")}</label>
            <label class="field-group"><span>備註</span><textarea name="notes" rows="3" aria-describedby="notes-error" placeholder="其他希望我們先了解的需求"></textarea>${createFieldError("notes")}</label>
          </fieldset>

          <fieldset class="form-section agreement-section">
            <legend><span>05</span>資料用途與同意</legend>
            <p>資料僅用於本次租借詢問、申請查詢與後續聯絡；公開查詢只顯示遮罩後的聯絡資料。</p>
            <label><input type="checkbox" name="agreePrivacy" required aria-describedby="agreePrivacy-error"> 我已閱讀並同意 <a href="#privacy" target="_blank" rel="noopener">隱私權說明</a>。${createFieldError("agreePrivacy")}</label>
            <label><input type="checkbox" name="agreeTerms" required aria-describedby="agreeTerms-error"> 我已閱讀並同意 <a href="#terms" target="_blank" rel="noopener">使用條款</a>。${createFieldError("agreeTerms")}</label>
          </fieldset>

          <div class="form-submit-row">
            <button class="btn btn-primary" type="submit" data-submit-button>送出租借詢問</button>
            <span class="submit-status" role="status" aria-live="polite" data-submit-status></span>
          </div>
          <div class="form-result" role="alert" data-form-result hidden></div>
        </form>

        <aside class="rental-summary" aria-labelledby="rental-summary-title">
          <p class="page-eyebrow">SUMMARY</p>
          <h2 id="rental-summary-title">申請摘要</h2>
          <dl data-rental-summary>
            <div><dt>場地</dt><dd>${selectedVenue.name}</dd></div>
            <div><dt>日期</dt><dd>尚未選擇</dd></div>
            <div><dt>時間</dt><dd>09:00－12:00</dd></div>
            <div><dt>狀態</dt><dd>尚未送出</dd></div>
          </dl>
          <p>送出後仍需由 NXSPACE 確認檔期、活動內容與正式報價。</p>
          <a class="text-link" href="#lookup" data-route-link>已有申請編號？查詢進度 →</a>
        </aside>
      </div>
    </section>
  `.trim();
}

function getFormValues(form) {
  const data = new FormData(form);
  return {
    applicantName: data.get("applicantName"),
    phone: data.get("phone"),
    email: data.get("email"),
    organization: data.get("organization"),
    venueId: data.get("venueId"),
    activityType: data.get("activityType"),
    dateMode: data.get("dateMode"),
    startDate: data.get("startDate"),
    endDate: data.get("endDate"),
    timePreset: data.get("timePreset"),
    startTime: data.get("startTime"),
    endTime: data.get("endTime"),
    expectedPeople: data.get("expectedPeople"),
    equipment: data.getAll("equipment"),
    activityDescription: data.get("activityDescription"),
    notes: data.get("notes"),
    agreePrivacy: data.has("agreePrivacy"),
    agreeTerms: data.has("agreeTerms")
  };
}

function updateFieldErrors(form, errors) {
  fieldNames.forEach((name) => {
    const field = form.elements[name];
    const error = form.querySelector(`[data-error-for="${name}"]`);
    const message = errors[name] || "";

    if (error) error.textContent = message;
    if (field) field.setAttribute("aria-invalid", message ? "true" : "false");
  });
}

export function initializeVenueApplicationPage() {
  const root = document.querySelector("[data-rental-application]");
  if (!root) return;

  const form = root.querySelector("[data-rental-form]");
  const calendarContainer = root.querySelector("[data-calendar-container]");
  const summary = root.querySelector("[data-rental-summary]");
  const feedback = root.querySelector("[data-availability-feedback]");
  const submitButton = root.querySelector("[data-submit-button]");
  const submitStatus = root.querySelector("[data-submit-status]");
  const errorSummary = root.querySelector("[data-form-error-summary]");
  const result = root.querySelector("[data-form-result]");
  const repository = getPublicInquiryRepository();
  let selectedVenue = getVenueById(form.elements.venueId.value);
  let calendarMonth = getCalendarMonthFromDate();
  let isSubmitting = false;
  let pendingValues = null;

  function renderCalendar() {
    calendarContainer.innerHTML = createAvailabilityCalendar({
      venue: selectedVenue,
      year: calendarMonth.year,
      month: calendarMonth.month,
      startDate: form.elements.startDate.value,
      endDate: form.elements.endDate.value
    });
  }

  function updateSummary() {
    const values = getFormValues(form);
    const dateText = values.startDate
      ? values.dateMode === "range" && values.endDate !== values.startDate
        ? `${formatPublicDate(values.startDate)} 至 ${formatPublicDate(values.endDate)}`
        : formatPublicDate(values.startDate)
      : "尚未選擇";
    const rows = summary.querySelectorAll("dd");
    rows[0].textContent = selectedVenue.name;
    rows[1].textContent = dateText;
    rows[2].textContent = `${values.startTime || "--:--"}－${values.endTime || "--:--"}`;

    const validation = validateRentalApplication(values, selectedVenue);
    const availabilityError = validation.startDate
      || validation.endDate
      || validation.startTime
      || validation.endTime
      || "";
    feedback.textContent = values.startDate
      ? availabilityError || "目前選擇未發現基礎檔期衝突，仍需由 NXSPACE 最終確認。"
      : "請選擇日期以檢查場地狀態。";
    feedback.classList.toggle("is-error", Boolean(availabilityError));
  }

  function setDateSelection(date) {
    const mode = form.elements.dateMode.value;
    const startInput = form.elements.startDate;
    const endInput = form.elements.endDate;

    if (mode === "single") {
      startInput.value = date;
      endInput.value = date;
    } else if (!startInput.value || (startInput.value && endInput.value)) {
      startInput.value = date;
      endInput.value = "";
    } else if (compareDateStrings(date, startInput.value) < 0) {
      endInput.value = startInput.value;
      startInput.value = date;
    } else {
      endInput.value = date;
    }

    renderCalendar();
    updateSummary();
  }

  calendarContainer.addEventListener("click", (event) => {
    const dateButton = event.target.closest("[data-calendar-date]");
    if (dateButton) setDateSelection(dateButton.dataset.calendarDate);

    if (event.target.closest("[data-calendar-previous]")) {
      calendarMonth.month -= 1;
      if (calendarMonth.month < 0) { calendarMonth.month = 11; calendarMonth.year -= 1; }
      renderCalendar();
    }

    if (event.target.closest("[data-calendar-next]")) {
      calendarMonth.month += 1;
      if (calendarMonth.month > 11) { calendarMonth.month = 0; calendarMonth.year += 1; }
      renderCalendar();
    }
  });

  calendarContainer.addEventListener("keydown", (event) => {
    const current = event.target.closest("[data-calendar-date]");
    if (!current || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const buttons = Array.from(calendarContainer.querySelectorAll("[data-calendar-date]:not(:disabled)"));
    const currentIndex = buttons.indexOf(current);
    const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    buttons[Math.min(buttons.length - 1, Math.max(0, currentIndex + offset))]?.focus();
  });

  form.elements.venueId.addEventListener("change", () => {
    selectedVenue = getVenueById(form.elements.venueId.value);
    form.elements.expectedPeople.max = selectedVenue.capacity.standing;
    form.querySelector("#expectedPeople-hint").textContent = `${selectedVenue.name} 最多 ${selectedVenue.capacity.standing} 人`;
    renderCalendar();
    updateSummary();
  });

  Array.from(form.elements.dateMode).forEach((radio) => radio.addEventListener("change", () => {
    if (radio.checked && radio.value === "single" && form.elements.startDate.value) {
      form.elements.endDate.value = form.elements.startDate.value;
    }
    renderCalendar();
    updateSummary();
  }));

  ["startDate", "endDate"].forEach((name) => form.elements[name].addEventListener("change", () => {
    if (name === "startDate" && form.elements.dateMode.value === "single") {
      form.elements.endDate.value = form.elements.startDate.value;
    }
    if (form.elements.startDate.value) calendarMonth = getCalendarMonthFromDate(form.elements.startDate.value);
    renderCalendar();
    updateSummary();
  }));

  form.elements.timePreset.addEventListener("change", () => {
    const preset = rentalTimePresets.find((item) => item.value === form.elements.timePreset.value);
    if (preset?.start) {
      form.elements.startTime.value = preset.start;
      form.elements.endTime.value = preset.end;
    }
    updateSummary();
  });

  ["startTime", "endTime"].forEach((name) => form.elements[name].addEventListener("change", updateSummary));

  async function persist(values) {
    if (isSubmitting) return;
    isSubmitting = true;
    pendingValues = values;
    submitButton.disabled = true;
    submitStatus.textContent = "正在儲存申請…";
    result.hidden = true;

    try {
      await new Promise((resolve) => window.setTimeout(resolve, 450));
      const application = createRentalApplication({ ...values, venueName: selectedVenue.name });
      const saved = repository.saveRental(application);
      submitStatus.textContent = saved.duplicate ? "已找到相同申請，正在開啟確認頁。" : "申請已儲存。";
      window.location.hash = `#venue/confirmation/${saved.record.id}`;
    } catch (error) {
      console.error("[NXSPACE] Rental submission failed.", error);
      result.hidden = false;
      result.innerHTML = '申請暫時無法儲存。<button class="text-button" type="button" data-rental-retry>重新嘗試</button>';
      submitStatus.textContent = "儲存失敗。";
      submitButton.disabled = false;
    } finally {
      isSubmitting = false;
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (isSubmitting) return;

    const values = getFormValues(form);
    const errors = validateRentalApplication(values, selectedVenue);
    updateFieldErrors(form, errors);

    if (Object.keys(errors).length > 0) {
      errorSummary.hidden = false;
      errorSummary.textContent = `表單有 ${Object.keys(errors).length} 個欄位需要修正。`;
      form.elements[Object.keys(errors)[0]]?.focus();
      return;
    }

    errorSummary.hidden = true;
    persist(values);
  });

  result.addEventListener("click", (event) => {
    if (event.target.closest("[data-rental-retry]") && pendingValues) persist(pendingValues);
  });

  updateSummary();
}

export function createRentalConfirmationPage(id = "") {
  const repository = getPublicInquiryRepository();
  const record = repository.getRentalById(id) || (id === "latest" ? repository.getLatestRental() : null);
  const rental = toPublicRentalApplication(record);

  if (!rental) {
    return `<div class="page-container state-page">${createStateView({
      type: "notFound",
      title: "找不到申請結果",
      description: "此申請編號不存在，或瀏覽器尚未儲存這筆資料。",
      action: '<a class="btn btn-primary" href="#venue/apply" data-route-link>重新提出申請</a>',
      headingLevel: "h1"
    })}</div>`;
  }

  return `
    <section class="public-page confirmation-page" data-rental-confirmation>
      ${createPageHeader({ eyebrow: "APPLICATION RECEIVED", title: "租借詢問已送出", description: "請保存申請編號，NXSPACE 將依序確認檔期與活動內容。" })}
      <div class="page-container confirmation-card">
        <div class="confirmation-status"><span>目前狀態</span><strong>${rental.statusLabel}</strong></div>
        <div class="application-id-block"><span>申請編號</span><code data-application-id>${rental.id}</code><button class="btn btn-secondary" type="button" data-copy-application-id>複製編號</button><span role="status" aria-live="polite" data-copy-status></span></div>
        <dl class="confirmation-summary">
          <div><dt>申請人</dt><dd>${rental.applicantName}</dd></div>
          <div><dt>場地</dt><dd>${rental.venueName}</dd></div>
          <div><dt>活動類型</dt><dd>${rental.activityType}</dd></div>
          <div><dt>日期</dt><dd>${formatPublicDate(rental.startDate)}${rental.endDate !== rental.startDate ? ` 至 ${formatPublicDate(rental.endDate)}` : ""}</dd></div>
          <div><dt>時間</dt><dd>${rental.startTime}－${rental.endTime}</dd></div>
          <div><dt>預計人數</dt><dd>${rental.expectedPeople} 人</dd></div>
        </dl>
        <div class="public-note"><h2>後續說明</h2><p>${rental.publicNote}</p><p>可使用申請編號搭配 Email 或電話末四碼查詢進度。</p></div>
        <div class="button-group"><a class="btn btn-primary" href="#home" data-route-link>返回首頁</a><a class="btn btn-secondary" href="#lookup" data-route-link>查詢申請</a><a class="text-link" href="#venue/apply" data-route-link>重新提出申請</a></div>
      </div>
    </section>
  `.trim();
}

export function initializeRentalConfirmationPage() {
  const root = document.querySelector("[data-rental-confirmation]");
  if (!root) return;
  const button = root.querySelector("[data-copy-application-id]");
  const status = root.querySelector("[data-copy-status]");
  const id = root.querySelector("[data-application-id]").textContent;

  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(id);
      status.textContent = "已複製申請編號。";
    } catch {
      const input = document.createElement("textarea");
      input.value = id;
      input.setAttribute("readonly", "");
      document.body.append(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      status.textContent = "已複製申請編號。";
    }
  });
}
