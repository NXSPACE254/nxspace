import { getVenueActivityRepository, venues } from "./venue-activity-service.js";
import { NotificationRepository } from "./notification-service.js";
import { generatePublicId } from "../utils/id.js";

const KEY = "nxspace.beta.v1.1.activity-registrations";
const read = (storage, fallback = []) => { try { return JSON.parse(storage.getItem(KEY) || "null") ?? fallback; } catch { return fallback; } };
const write = (storage, value) => storage.setItem(KEY, JSON.stringify(value));
const now = () => new Date().toISOString();
const addDays = (days) => { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); };
const clean = (value = "") => String(value).trim();
const digits = (value = "") => String(value).replace(/\D/g, "").replace(/^886/, "0");
const maskPhone = (value = "") => `******${digits(value).slice(-4)}`;
const maskEmail = (value = "") => { const [name, domain] = String(value).split("@"); return name && domain ? `${name[0]}***@${domain}` : "***"; };

export const registrationStatusLabels = Object.freeze({ draft: "草稿", pending: "待確認", accepted: "已錄取", waitlisted: "候補", cancelled: "已取消", completed: "已完成", no_show: "未出席" });
export const registrationPaymentLabels = Object.freeze({ unpaid: "未繳費", partial: "部分繳費", paid: "已繳費", refunded: "已退費", waived: "免收費" });

export class RegistrationService {
  constructor({ venueRepository = getVenueActivityRepository(), storage = localStorage, notifications = new NotificationRepository() } = {}) {
    this.venues = venueRepository; this.storage = storage; this.notifications = notifications;
    this.initializeDemo();
  }
  listActivities(context = {}) {
    const records = this.venues.listActivities().filter((item) => item.enableRegistration || item.registrationSeedKey);
    return Array.isArray(context.organizerIds) ? records.filter((item) => context.organizerIds.includes(item.organizerId)) : records;
  }
  getActivity(id, context = {}) { return this.listActivities(context).find((item) => item.activityId === id) || null; }
  listPublicActivities() { return this.listActivities().filter((item) => this.registrationAvailability(item).visible); }
  registrationAvailability(activity) {
    const timestamp = Date.now(), starts = activity.registrationStartAt ? new Date(activity.registrationStartAt).getTime() : 0, ends = activity.registrationEndAt ? new Date(activity.registrationEndAt).getTime() : Infinity;
    const venueValid = Boolean(venues.find((item) => item.id === activity.venueId) && activity.startDate);
    const stats = this.capacityStats(activity.activityId);
    const visible = activity.enableRegistration === true && activity.enablePublicPage === true && activity.activityStatus === "confirmed" && venueValid;
    const open = visible && timestamp >= starts && timestamp <= ends && !["closed", "paused"].includes(activity.registrationStatus) && (stats.remaining > 0 || stats.waitlistRemaining > 0);
    return { visible, open, reason: !visible ? "此活動未開放公開報名。" : timestamp < starts ? "報名尚未開始。" : timestamp > ends ? "報名已截止。" : stats.remaining <= 0 && stats.waitlistRemaining <= 0 ? "活動及候補皆已額滿。" : "可報名", ...stats };
  }
  listRegistrations(activityId = "", context = {}) {
    const allowed = Array.isArray(context.organizerIds) ? new Set(this.listActivities(context).map((item) => item.activityId)) : null;
    return read(this.storage, []).map(normalizeRegistration).filter((item) => (!activityId || item.activityId === activityId) && (!allowed || allowed.has(item.activityId)));
  }
  capacityStats(activityId) {
    const activity = this.venues.getActivity(activityId), records = this.listRegistrations(activityId);
    const count = (statuses) => records.filter((item) => statuses.includes(item.status)).reduce((sum, item) => sum + item.attendeeCount, 0);
    const accepted = count(["accepted", "completed", "no_show"]), pending = count(["pending"]), waitlisted = count(["waitlisted"]);
    return { capacity: Number(activity?.capacity) || 0, accepted, pending, waitlisted, remaining: Math.max(0, Number(activity?.capacity || 0) - accepted), waitlistCapacity: Number(activity?.waitlistCapacity) || 0, waitlistRemaining: Math.max(0, Number(activity?.waitlistCapacity || 0) - waitlisted) };
  }
  saveSettings(activityId, input, context = {}) {
    assertPermission(context, "registrations.settings.update"); assertScope(context, this.venues.getActivity(activityId)?.organizerId);
    const current = this.venues.getActivity(activityId); if (!current) throw new Error("找不到活動。");
    const allowed = ["registrationTitle", "registrationDescription", "instructorName", "instructorIntroduction", "posterImage", "registrationStartAt", "registrationEndAt", "capacity", "waitlistCapacity", "fee", "paymentInstructions", "registrationTerms", "cancellationPolicy", "customRegistrationFields", "publicContactInformation", "registrationStatus", "registrationMode", "allowSelfCancellation", "selfCancellationEndAt", "refundInstructions", "enableRegistration", "enablePublicPage"];
    const changes = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.includes(key)));
    ["capacity", "waitlistCapacity", "fee"].forEach((key) => { if (key in changes) changes[key] = Number(changes[key]) || 0; });
    ["enableRegistration", "enablePublicPage", "allowSelfCancellation"].forEach((key) => { if (key in changes) changes[key] = changes[key] === true || changes[key] === "true" || changes[key] === "on"; });
    if (Number(changes.capacity ?? current.capacity) < this.capacityStats(activityId).accepted) throw new Error("活動名額不得低於目前已錄取人數。");
    const saved = this.venues.saveActivity({ ...current, ...changes }, { actor: context.actor, can: () => true });
    this.venues.audit("registration.settings-updated", activityId, context.actor, { capacity: saved.capacity, waitlistCapacity: saved.waitlistCapacity });
    return saved;
  }
  createRegistration(input) {
    const activity = this.venues.getActivity(input.activityId), availability = activity && this.registrationAvailability(activity);
    if (!activity || !availability.open) throw new Error(availability?.reason || "活動目前無法報名。");
    const attendeeCount = Number(input.attendeeCount) || 1;
    if (attendeeCount < 1 || attendeeCount > 10) throw new Error("報名人數必須介於 1 至 10 人。");
    if (!clean(input.attendeeName) || digits(input.attendeePhone).length < 9 || !clean(input.attendeeEmail).includes("@")) throw new Error("請確認姓名、手機與 Email。");
    if (!input.termsAccepted) throw new Error("請同意活動須知及取消規則。");
    let status;
    if (activity.registrationMode === "manual") status = "pending";
    else if (availability.remaining >= attendeeCount) status = "accepted";
    else if (availability.waitlistRemaining >= attendeeCount) status = "waitlisted";
    else throw new Error("剩餘名額或候補名額不足。");
    const timestamp = now(), record = normalizeRegistration({
      registrationId: generatePublicId("NXR"), activityId: activity.activityId, organizerId: activity.organizerId,
      attendeeName: clean(input.attendeeName), attendeePhone: clean(input.attendeePhone), attendeeEmail: clean(input.attendeeEmail).toLowerCase(),
      attendeeCount, notes: clean(input.notes), customAnswers: input.customAnswers || {}, status,
      paymentStatus: Number(activity.fee) > 0 ? "unpaid" : "waived", amountDue: Number(activity.fee || 0) * attendeeCount,
      amountPaid: 0, sourceType: input.sourceType || "public", publicLookupCode: crypto.randomUUID().slice(0, 8).toUpperCase(),
      internalNotes: "", notificationEvents: [], statusHistory: [{ from: null, to: status, actor: "customer", at: timestamp }],
      createdAt: timestamp, updatedAt: timestamp
    });
    const before = this.storage.getItem(KEY);
    try {
      const latest = this.registrationAvailability(activity);
      if (status === "accepted" && latest.remaining < attendeeCount || status === "waitlisted" && latest.waitlistRemaining < attendeeCount) throw new Error("名額剛被其他報名者使用，請重新送出。");
      write(this.storage, [record, ...read(this.storage, [])]);
      this.notify(record, "registration_created", `活動 ${activity.title} 新增 ${attendeeCount} 人報名`);
      this.venues.audit("registration.created", activity.activityId, "customer", { registrationId: record.registrationId, attendeeCount, status });
      return record;
    } catch (error) { before === null ? this.storage.removeItem(KEY) : this.storage.setItem(KEY, before); throw error; }
  }
  lookup(registrationId, phone) {
    const record = this.listRegistrations().find((item) => item.registrationId === clean(registrationId).toUpperCase() && digits(item.attendeePhone) === digits(phone));
    if (!record) return null;
    const activity = this.venues.getActivity(record.activityId), venue = venues.find((item) => item.id === activity?.venueId);
    return { registrationId: record.registrationId, activityTitle: activity?.registrationTitle || activity?.title, date: activity?.startDate, time: `${activity?.startTime}–${activity?.endTime}`, venue: venue?.name, attendeeCount: record.attendeeCount, status: record.status, statusLabel: registrationStatusLabels[record.status], paymentStatusLabel: registrationPaymentLabels[record.paymentStatus], amountDue: record.amountDue, publicNote: record.publicNote, updatedAt: record.updatedAt, contact: activity?.publicContactInformation, canCancel: this.canSelfCancel(activity, record) };
  }
  cancelSelf(registrationId, phone, reason = "") {
    const current = this.listRegistrations().find((item) => item.registrationId === clean(registrationId).toUpperCase() && digits(item.attendeePhone) === digits(phone));
    if (!current) throw new Error("找不到報名資料。");
    const activity = this.venues.getActivity(current.activityId); if (!this.canSelfCancel(activity, current)) throw new Error("已超過自行取消期限，請聯絡主辦單位。");
    return this.changeStatus(current, "cancelled", { actor: "customer", reason });
  }
  updateStatus(id, status, input = {}, context = {}) {
    assertPermission(context, status === "accepted" ? "registrations.waitlist.manage" : status === "completed" || status === "no_show" ? "registrations.attendance.manage" : "registrations.status.manage");
    const current = this.listRegistrations().find((item) => item.registrationId === id); if (!current) throw new Error("找不到報名資料。");
    assertScope(context, current.organizerId);
    if (status === "accepted" && this.capacityStats(current.activityId).remaining < current.attendeeCount) throw new Error("剩餘名額不足，無法轉為已錄取。");
    return this.changeStatus(current, status, { actor: context.actor, reason: input.reason, amountPaid: input.amountPaid, paymentStatus: input.paymentStatus, publicNote: input.publicNote });
  }
  export(activityId, level, format, context = {}) {
    const permission = level === "contacts" ? "registrations.export.contacts" : level === "details" ? "registrations.export.details" : "registrations.export.summary";
    assertPermission(context, permission); const activity = this.venues.getActivity(activityId); assertScope(context, activity?.organizerId);
    const includeContacts = context.can?.("registrations.export.contacts"), records = this.listRegistrations(activityId, context);
    const rows = records.map((item) => ({ registrationId: item.registrationId, activity: activity?.title, attendeeCount: item.attendeeCount, status: registrationStatusLabels[item.status], paymentStatus: registrationPaymentLabels[item.paymentStatus], ...(level !== "summary" ? { customAnswers: JSON.stringify(item.customAnswers), notes: item.notes, statusHistory: JSON.stringify(item.statusHistory) } : {}), ...(level === "contacts" ? { attendeeName: item.attendeeName, attendeePhone: includeContacts ? item.attendeePhone : maskPhone(item.attendeePhone), attendeeEmail: includeContacts ? item.attendeeEmail : maskEmail(item.attendeeEmail) } : {}) }));
    this.venues.audit("registration.exported", activityId, context.actor, { level, format, count: rows.length });
    if (format === "json") return { content: JSON.stringify(rows, null, 2), extension: "json", mime: "application/json" };
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    return { content: [headers, ...rows.map((row) => headers.map((key) => row[key] ?? ""))].map((row) => row.map(csv).join(",")).join("\r\n"), extension: "csv", mime: "text/csv;charset=utf-8" };
  }
  canSelfCancel(activity, record) { return Boolean(activity?.allowSelfCancellation && !["cancelled", "completed", "no_show"].includes(record.status) && (!activity.selfCancellationEndAt || Date.now() <= new Date(activity.selfCancellationEndAt).getTime())); }
  changeStatus(current, status, input) {
    const timestamp = now(), next = normalizeRegistration({ ...current, status, amountPaid: input.amountPaid ?? current.amountPaid, paymentStatus: input.paymentStatus || current.paymentStatus, publicNote: input.publicNote || current.publicNote, cancelledAt: status === "cancelled" ? timestamp : current.cancelledAt, cancellationReason: status === "cancelled" ? clean(input.reason) : current.cancellationReason, updatedAt: timestamp, statusHistory: [...current.statusHistory, { from: current.status, to: status, actor: input.actor, reason: clean(input.reason), at: timestamp }] });
    write(this.storage, read(this.storage, []).map((item) => normalizeRegistration(item).registrationId === next.registrationId ? next : item));
    this.notify(next, `registration_${status}`, `報名 ${next.registrationId} 已更新為${registrationStatusLabels[status]}`);
    this.venues.audit(status === "cancelled" ? "registration.cancelled" : "registration.status-updated", next.activityId, input.actor, { registrationId: next.registrationId, from: current.status, to: status });
    return next;
  }
  notify(record, type, preview) {
    const event = this.notifications.save({ eventId: crypto.randomUUID(), type, merchantId: record.organizerId, activityId: record.activityId, registrationId: record.registrationId, createdAt: now(), status: "local_only", preview });
    record.notificationEvents.push(event.eventId); write(this.storage, read(this.storage, []).map((item) => normalizeRegistration(item).registrationId === record.registrationId ? record : item));
  }
  initializeDemo() {
    const existing = this.venues.listActivities();
    const base = existing.find((item) => item.activityType === "lecture") || existing[0];
    if (base && !base.registrationSeedKey) this.venues.saveActivity({ ...base, registrationSeedKey: "lecture", enableRegistration: true, enablePublicPage: true, registrationTitle: "台東生活設計講座", registrationDescription: "從地方生活出發，分享設計與社群實踐。", instructorName: "Demo 講師", instructorIntroduction: "地方創意工作者，資料僅供測試。", posterImage: "https://picsum.photos/900/1200?random=171", registrationStartAt: new Date(Date.now() - 86400000).toISOString(), registrationEndAt: new Date(Date.now() + 4 * 86400000).toISOString(), capacity: 12, waitlistCapacity: 4, fee: 300, registrationMode: "automatic", registrationStatus: "open", allowSelfCancellation: true, selfCancellationEndAt: new Date(Date.now() + 3 * 86400000).toISOString(), registrationTerms: "請準時報到並遵守場地規範。", cancellationPolicy: "截止前可自行取消。", publicContactInformation: "demo-organizer@example.invalid", customRegistrationFields: [{ id: "experience", label: "參與經驗", type: "textarea", required: false }] }, { actor: "demo-seed", can: () => true });
    const seeds = [
      ["craft", "台東植物手作課", "course", 8, 3, "open", 6],
      ["full", "地方創生實務工作坊", "training", 4, 3, "open", 9],
      ["future", "島嶼閱讀分享會", "book_club", 10, 2, "scheduled", 14],
      ["closed", "社群經營講座", "lecture", 20, 0, "closed", 4]
    ];
    seeds.forEach(([key, title, type, capacity, waitlistCapacity, status, days]) => {
      if (this.venues.listActivities().some((item) => item.registrationSeedKey === key)) return;
      this.venues.saveActivity({ title, organizerType: "renter", organizerId: "organizer-demo", organizerName: "Demo 主辦單位", venueId: "venue-donghai", activityType: type, startDate: addDays(days), endDate: addDays(days), startTime: "14:00", endTime: "17:00", activityStatus: "confirmed", enableRegistration: true, enablePublicPage: true, enableVendorPortal: true, registrationSeedKey: key, registrationTitle: title, registrationDescription: "Local Demo 活動介紹。", instructorName: "Demo 講師", instructorIntroduction: "示範講師資料。", posterImage: `https://picsum.photos/900/1200?random=17${days}`, registrationStartAt: status === "scheduled" ? new Date(Date.now() + 3 * 86400000).toISOString() : new Date(Date.now() - 3 * 86400000).toISOString(), registrationEndAt: status === "closed" ? new Date(Date.now() - 86400000).toISOString() : new Date(Date.now() + 10 * 86400000).toISOString(), capacity, waitlistCapacity, fee: 500, paymentInstructions: "費用資料確認後另行通知。", registrationTerms: "請遵守活動規則。", cancellationPolicy: "活動前三日可取消。", publicContactInformation: "demo@example.invalid", registrationStatus: "open", registrationMode: "automatic", allowSelfCancellation: true, selfCancellationEndAt: new Date(Date.now() + 5 * 86400000).toISOString() }, { actor: "demo-seed", can: () => true });
    });
    if (!this.storage.getItem(KEY)) {
      const activities = this.listActivities(), full = activities.find((item) => item.registrationSeedKey === "full"), first = activities[0];
      const statuses = ["pending", "accepted", "waitlisted", "cancelled", "no_show"];
      const records = statuses.map((status, index) => normalizeRegistration({ registrationId: `NXR-DEMO-${index + 1}`, activityId: index > 0 && full ? full.activityId : first.activityId, organizerId: index > 0 && full ? full.organizerId : first.organizerId, attendeeName: `示範參加者 ${index + 1}`, attendeePhone: `09120000${index + 1}`, attendeeEmail: `attendee${index + 1}@example.invalid`, attendeeCount: index === 1 ? 2 : 1, status, paymentStatus: index === 1 ? "paid" : "unpaid", amountDue: 500, amountPaid: index === 1 ? 500 : 0, sourceType: "demo-seed", publicLookupCode: `DEMO${index + 1}`, createdAt: new Date(Date.now() - index * 3600000).toISOString() }));
      if (full) {
        const used = records.filter((item) => item.activityId === full.activityId && ["accepted", "no_show"].includes(item.status)).reduce((sum, item) => sum + item.attendeeCount, 0);
        for (let index = used; index < Number(full.capacity); index++) records.push(normalizeRegistration({ registrationId: `NXR-FULL-${index}`, activityId: full.activityId, organizerId: full.organizerId, attendeeName: `額滿示範 ${index}`, attendeePhone: `09220000${index}`, attendeeEmail: `full${index}@example.invalid`, attendeeCount: 1, status: "accepted", paymentStatus: "paid", amountDue: 500, amountPaid: 500, sourceType: "demo-seed" }));
      }
      write(this.storage, records);
    }
  }
}

function normalizeRegistration(item = {}) { return { registrationId: clean(item.registrationId).toUpperCase(), activityId: item.activityId || "", organizerId: item.organizerId || "", attendeeName: clean(item.attendeeName), attendeePhone: clean(item.attendeePhone), attendeeEmail: clean(item.attendeeEmail).toLowerCase(), attendeeCount: Number(item.attendeeCount) || 1, customAnswers: item.customAnswers || {}, notes: item.notes || "", status: item.status || "draft", paymentStatus: item.paymentStatus || "unpaid", amountDue: Number(item.amountDue) || 0, amountPaid: Number(item.amountPaid) || 0, createdAt: item.createdAt || now(), updatedAt: item.updatedAt || item.createdAt || now(), cancelledAt: item.cancelledAt || null, cancellationReason: item.cancellationReason || "", sourceType: item.sourceType || "public", publicLookupCode: item.publicLookupCode || crypto.randomUUID().slice(0, 8).toUpperCase(), internalNotes: item.internalNotes || "", publicNote: item.publicNote || "", notificationEvents: item.notificationEvents || [], statusHistory: item.statusHistory || [] }; }
function assertPermission(context, key) { if (!context?.can?.(key)) throw new Error("沒有執行此操作的權限。"); }
function assertScope(context, organizerId) { if (Array.isArray(context?.organizerIds) && !context.organizerIds.includes(organizerId)) throw new Error("沒有管理此主辦單位活動的權限。"); }
function csv(value) { const text = String(value ?? ""); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
let service;
export function getRegistrationService() { service ||= new RegistrationService(); return service; }
