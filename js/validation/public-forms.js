import {
  compareDateStrings,
  findRentalConflict,
  isPastDate,
  timeToMinutes
} from "../utils/date-time.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^[0-9+()\-\s]{8,20}$/;

function required(value) {
  return String(value ?? "").trim().length > 0;
}

export function validateRentalApplication(values = {}, venue) {
  const errors = {};

  if (!required(values.applicantName)) errors.applicantName = "請填寫申請人姓名。";
  if (!required(values.phone)) errors.phone = "請填寫聯絡電話。";
  else if (!phonePattern.test(values.phone)) errors.phone = "請輸入有效的電話格式。";
  if (!required(values.email)) errors.email = "請填寫 Email。";
  else if (!emailPattern.test(values.email)) errors.email = "請輸入有效的 Email 格式。";
  if (!required(values.venueId)) errors.venueId = "請選擇場地。";
  if (!required(values.activityType)) errors.activityType = "請選擇活動類型。";
  if (!required(values.startDate)) errors.startDate = "請選擇開始日期。";
  if (!required(values.endDate)) errors.endDate = "請選擇結束日期。";
  if (values.startDate && isPastDate(values.startDate)) errors.startDate = "不可選擇過去日期。";
  if (values.startDate && values.endDate && compareDateStrings(values.endDate, values.startDate) < 0) {
    errors.endDate = "結束日期不可早於開始日期。";
  }
  if (!required(values.startTime)) errors.startTime = "請選擇開始時間。";
  if (!required(values.endTime)) errors.endTime = "請選擇結束時間。";
  if (values.startTime && values.endTime && timeToMinutes(values.endTime) <= timeToMinutes(values.startTime)) {
    errors.endTime = "結束時間必須晚於開始時間。";
  }
  if (values.startTime && values.endTime && timeToMinutes(values.endTime) - timeToMinutes(values.startTime) > 14 * 60) {
    errors.endTime = "單日使用時間不可超過 14 小時。";
  }

  const expectedPeople = Number(values.expectedPeople);
  if (!Number.isInteger(expectedPeople) || expectedPeople < 1) {
    errors.expectedPeople = "預計人數至少為 1 人。";
  } else if (venue && expectedPeople > venue.capacity.standing) {
    errors.expectedPeople = `此場地最多容納 ${venue.capacity.standing} 人。`;
  }

  if (!required(values.activityDescription) || values.activityDescription.trim().length < 10) {
    errors.activityDescription = "活動說明至少需要 10 個字。";
  }
  if (!values.agreePrivacy) errors.agreePrivacy = "請先同意隱私權說明。";
  if (!values.agreeTerms) errors.agreeTerms = "請先同意使用條款。";

  if (!errors.startDate && !errors.endDate && !errors.startTime && !errors.endTime && venue) {
    const conflict = findRentalConflict({
      venue,
      startDate: values.startDate,
      endDate: values.endDate,
      startTime: values.startTime,
      endTime: values.endTime
    });

    if (conflict) {
      errors.startDate = `${conflict.date}：${conflict.reason}`;
    }
  }

  return errors;
}

export function validateContactInquiry(values = {}) {
  const errors = {};

  if (!required(values.name)) errors.name = "請填寫姓名。";
  if (!required(values.contact)) errors.contact = "請填寫 Email 或電話。";
  else if (!emailPattern.test(values.contact) && !phonePattern.test(values.contact)) {
    errors.contact = "請輸入有效的 Email 或電話。";
  }
  if (!required(values.subject)) errors.subject = "請填寫主旨。";
  if (!required(values.type)) errors.type = "請選擇聯絡類型。";
  if (!required(values.message) || values.message.trim().length < 10) {
    errors.message = "訊息內容至少需要 10 個字。";
  }
  if (!values.agreePrivacy) errors.agreePrivacy = "請先同意隱私權說明。";

  return errors;
}

export function validateRentalLookup(values = {}) {
  const errors = {};
  if (!/^NXR-\d{8}-[A-Z0-9]{5}$/.test(String(values.id || "").trim().toUpperCase())) {
    errors.id = "請輸入正確的租借申請編號。";
  }
  if (!required(values.verifier)) {
    errors.verifier = "請輸入申請 Email 或電話末四碼。";
  } else if (!emailPattern.test(values.verifier) && !/^\d{4}$/.test(values.verifier)) {
    errors.verifier = "請輸入完整 Email 或四位電話末碼。";
  }
  return errors;
}
