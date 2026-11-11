import {
  compareDateStrings,
  isDateUnavailable,
  parseLocalDate,
  toLocalDateString
} from "../utils/date-time.js";

const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];

function isWithinRange(date, startDate, endDate) {
  return startDate && endDate
    && compareDateStrings(date, startDate) >= 0
    && compareDateStrings(date, endDate) <= 0;
}

export function createAvailabilityCalendar({
  venue,
  year,
  month,
  startDate = "",
  endDate = ""
} = {}) {
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const leadingCells = firstDay.getDay();
  const monthLabel = new Intl.DateTimeFormat("zh-Hant-TW", {
    year: "numeric",
    month: "long"
  }).format(firstDay);
  const dayCells = [];

  for (let index = 0; index < leadingCells; index += 1) {
    dayCells.push('<span class="calendar-day calendar-day-empty" aria-hidden="true"></span>');
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = toLocalDateString(new Date(year, month, day));
    const unavailable = isDateUnavailable(venue, date);
    const occupied = venue?.occupiedSlots.some((slot) => slot.date === date);
    const selected = date === startDate || date === endDate;
    const inRange = isWithinRange(date, startDate, endDate);
    const classes = [
      "calendar-day",
      selected ? "is-selected" : "",
      inRange ? "is-in-range" : "",
      unavailable ? "is-unavailable" : "",
      occupied && !unavailable ? "has-occupied-time" : ""
    ].filter(Boolean).join(" ");
    const status = unavailable
      ? "不可選"
      : occupied
        ? "部分時段已占用"
        : "可選";

    dayCells.push(`
      <button
        class="${classes}"
        type="button"
        data-calendar-date="${date}"
        aria-label="${month + 1} 月 ${day} 日，${status}${selected ? "，已選擇" : ""}"
        ${selected ? 'aria-pressed="true"' : 'aria-pressed="false"'}
        ${unavailable ? "disabled" : ""}>
        <span>${day}</span>
        ${occupied && !unavailable ? '<span class="calendar-dot" aria-hidden="true"></span>' : ""}
      </button>
    `.trim());
  }

  return `
    <section class="availability-calendar" aria-label="場地可租借日期">
      <div class="calendar-header">
        <button class="calendar-navigation" type="button" data-calendar-previous aria-label="上一個月">←</button>
        <h3 aria-live="polite">${monthLabel}</h3>
        <button class="calendar-navigation" type="button" data-calendar-next aria-label="下一個月">→</button>
      </div>
      <div class="calendar-weekdays" aria-hidden="true">
        ${weekdayLabels.map((label) => `<span>${label}</span>`).join("")}
      </div>
      <div class="calendar-grid">
        ${dayCells.join("")}
      </div>
      <div class="calendar-legend" aria-label="月曆圖例">
        <span><i class="legend-available"></i>可選</span>
        <span><i class="legend-selected"></i>已選</span>
        <span><i class="legend-occupied"></i>部分占用</span>
        <span><i class="legend-unavailable"></i>不可選</span>
      </div>
    </section>
  `.trim();
}

export function getCalendarMonthFromDate(value = "") {
  const date = value ? parseLocalDate(value) : new Date();
  return { year: date.getFullYear(), month: date.getMonth() };
}
