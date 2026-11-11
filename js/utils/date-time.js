const MINUTES_PER_HOUR = 60;

export function toLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value = "") {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(value, amount = 0) {
  const date = typeof value === "string" ? parseLocalDate(value) : new Date(value);
  date.setDate(date.getDate() + amount);
  return toLocalDateString(date);
}

export function compareDateStrings(first = "", second = "") {
  return first.localeCompare(second);
}

export function getDatesInRange(startDate = "", endDate = "") {
  if (!startDate || !endDate || compareDateStrings(endDate, startDate) < 0) {
    return [];
  }

  const dates = [];
  let current = startDate;

  while (compareDateStrings(current, endDate) <= 0 && dates.length < 366) {
    dates.push(current);
    current = addDays(current, 1);
  }

  return dates;
}

export function timeToMinutes(value = "") {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours * MINUTES_PER_HOUR) + minutes;
}

export function intervalsOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  return timeToMinutes(firstStart) < timeToMinutes(secondEnd)
    && timeToMinutes(firstEnd) > timeToMinutes(secondStart);
}

export function isPastDate(value, today = toLocalDateString()) {
  return Boolean(value) && compareDateStrings(value, today) < 0;
}

export function formatPublicDate(value = "") {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-Hant-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(parseLocalDate(value));
}

export function isDateUnavailable(venue, date, today = toLocalDateString()) {
  if (!venue || !date || isPastDate(date, today)) {
    return true;
  }

  const weekday = parseLocalDate(date).getDay();
  let managedBlocked = false;
  try {
    const availability = JSON.parse(globalThis.localStorage?.getItem("nxspace.beta.v1.availability") || "[]");
    managedBlocked = availability.some((item) => item.venueId === venue.id && item.type !== "open" && item.startDate <= date && item.endDate >= date);
  } catch {
    managedBlocked = false;
  }
  return venue.unavailableWeekdays.includes(weekday)
    || venue.unavailableDates.includes(date)
    || managedBlocked;
}

export function findRentalConflict({ venue, startDate, endDate, startTime, endTime }) {
  if (!venue || !startDate || !endDate || !startTime || !endTime) {
    return null;
  }

  const selectedDates = getDatesInRange(startDate, endDate);
  let managedAvailability = [];
  let approvedRentals = [];
  try {
    managedAvailability = JSON.parse(globalThis.localStorage?.getItem("nxspace.beta.v1.availability") || "[]");
    approvedRentals = JSON.parse(globalThis.localStorage?.getItem("nxspace.beta.v1.rentals") || "[]").filter((rental) => rental.status === "approved");
  } catch {
    managedAvailability = [];
    approvedRentals = [];
  }

  for (const date of selectedDates) {
    if (isDateUnavailable(venue, date)) {
      return { date, reason: "此日期不開放租借" };
    }

    const occupied = venue.occupiedSlots.find((slot) => (
      slot.date === date
      && intervalsOverlap(startTime, endTime, slot.start, slot.end)
    ));

    if (occupied) {
      return {
        date,
        reason: `此時段已被占用（${occupied.start}－${occupied.end}）`
      };
    }

    const managedBlock = managedAvailability.find((item) => item.venueId === venue.id && item.type !== "open" && item.startDate <= date && item.endDate >= date);
    if (managedBlock) {
      return { date, reason: "此日期已由場地管理設定為不可租借。" };
    }

    const approved = approvedRentals.find((item) => item.venueId === venue.id && item.startDate <= date && item.endDate >= date && intervalsOverlap(startTime, endTime, item.startTime, item.endTime));
    if (approved) {
      return { date, reason: "此日期與時段已有核准的租借申請。" };
    }
  }

  return null;
}
