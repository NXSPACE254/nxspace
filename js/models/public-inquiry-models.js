import { rentalStatuses } from "../data/venue-data.js";
import { generatePublicId } from "../utils/id.js";

function cleanString(value = "") {
  return String(value).trim();
}

function createFingerprint(values = []) {
  return values.map((value) => cleanString(value).toLocaleLowerCase("zh-Hant-TW")).join("|");
}

export function createRentalApplication(input = {}) {
  const now = new Date().toISOString();
  const record = {
    id: generatePublicId("NXR"),
    status: "submitted",
    statusLabel: rentalStatuses.submitted.label,
    applicantName: cleanString(input.applicantName),
    phone: cleanString(input.phone),
    email: cleanString(input.email).toLowerCase(),
    organization: cleanString(input.organization),
    venueId: cleanString(input.venueId),
    venueName: cleanString(input.venueName),
    activityType: cleanString(input.activityType),
    dateMode: input.dateMode === "range" ? "range" : "single",
    startDate: cleanString(input.startDate),
    endDate: cleanString(input.endDate || input.startDate),
    timePreset: cleanString(input.timePreset),
    startTime: cleanString(input.startTime),
    endTime: cleanString(input.endTime),
    expectedPeople: Number(input.expectedPeople),
    equipment: Array.isArray(input.equipment) ? input.equipment.map(cleanString) : [],
    activityDescription: cleanString(input.activityDescription),
    notes: cleanString(input.notes),
    publicNote: "申請已收到，NXSPACE 將依序確認場地與活動內容。",
    createdAt: now,
    updatedAt: now
  };

  return {
    ...record,
    fingerprint: createFingerprint([
      record.phone,
      record.email,
      record.venueId,
      record.startDate,
      record.endDate,
      record.startTime,
      record.endTime
    ])
  };
}

export function createContactInquiry(input = {}) {
  const now = new Date().toISOString();
  const record = {
    id: generatePublicId("NXC"),
    status: "received",
    statusLabel: "已收到",
    name: cleanString(input.name),
    contact: cleanString(input.contact),
    subject: cleanString(input.subject),
    type: cleanString(input.type),
    message: cleanString(input.message),
    createdAt: now,
    updatedAt: now
  };

  return {
    ...record,
    fingerprint: createFingerprint([
      record.contact,
      record.subject,
      record.type,
      record.message
    ])
  };
}

export function maskEmail(email = "") {
  const [name = "", domain = ""] = email.split("@");

  if (!name || !domain) {
    return "***";
  }

  return `${name.slice(0, 1)}***@${domain}`;
}

export function maskPhone(phone = "") {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `******${digits.slice(-4)}` : "******";
}

export function maskName(name = "") {
  if (!name) {
    return "***";
  }

  return `${name.slice(0, 1)}${"＊".repeat(Math.max(1, name.length - 1))}`;
}

export function toPublicRentalApplication(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    status: record.status,
    statusLabel: rentalStatuses[record.status]?.label || record.statusLabel,
    applicantName: maskName(record.applicantName),
    phone: maskPhone(record.phone),
    email: maskEmail(record.email),
    venueName: record.venueName,
    activityType: record.activityType,
    startDate: record.startDate,
    endDate: record.endDate,
    startTime: record.startTime,
    endTime: record.endTime,
    expectedPeople: record.expectedPeople,
    publicNote: record.publicNote,
    createdAt: record.createdAt
  };
}
