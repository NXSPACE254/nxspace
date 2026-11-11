const NOTIFICATION_KEY = "nxspace.beta.v1.1.notifications";
const now = () => new Date().toISOString();
const read = () => { try { const value = JSON.parse(localStorage.getItem(NOTIFICATION_KEY) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } };
const sanitizeText = (value = "") => String(value).replace(/09\d{8}/g, "09******").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "***@***").replace(/[a-f0-9]{24,}/gi, "[masked]");
export function sanitizeNotificationPayload(payload = {}) {
  const blocked = /password|secret|token|authorization|bankAccount|accountNumber/i;
  return Object.fromEntries(Object.entries(payload).filter(([key]) => !blocked.test(key)).map(([key, value]) => [key, typeof value === "string" ? sanitizeText(value) : value]));
}
export function normalizeNotification(event = {}) {
  const notificationId = event.notificationId || event.eventId || crypto.randomUUID(), eventType = event.eventType || event.type || "system_event";
  const channel = ["local", "line", "email"].includes(event.channel) ? event.channel : "local";
  const legacyStatus = ({ local_only: "sent", not_configured: "disabled", pending: "queued", retrying: "processing" })[event.status] || event.status;
  return {
    ...event, notificationId, eventId: notificationId, eventType, type: eventType, channel,
    recipientType: event.recipientType || (event.merchantId ? "merchant" : event.organizerId ? "organizer" : "system"),
    recipientReference: sanitizeText(event.recipientReference || event.merchantId || event.organizerId || ""),
    relatedEntityType: event.relatedEntityType || (event.orderId ? "order" : event.registrationId ? "registration" : event.activityId ? "activity" : "system"),
    relatedEntityId: event.relatedEntityId || event.orderId || event.registrationId || event.activityId || null,
    merchantId: event.merchantId || null, organizerId: event.organizerId || null, activityId: event.activityId || null,
    title: sanitizeText(event.title || eventType), message: sanitizeText(event.message || event.preview || ""),
    payload: sanitizeNotificationPayload(event.payload || {}), status: ["queued", "processing", "sent", "failed", "skipped", "disabled"].includes(legacyStatus) ? legacyStatus : "queued",
    retryCount: Number(event.retryCount ?? event.attempts) || 0, attempts: Number(event.retryCount ?? event.attempts) || 0,
    lastError: sanitizeText(event.lastError || event.errorMessageSafe || ""), createdAt: event.createdAt || now(),
    sentAt: event.sentAt || null, updatedAt: event.updatedAt || event.createdAt || now(), handledAt: event.handledAt || null
  };
}
export class NotificationRepository {
  list(scope = null) {
    const events = read().map(normalizeNotification);
    if (!scope) return events;
    if (Array.isArray(scope)) return events.filter((item) => scope.includes(item.merchantId) || scope.includes(item.organizerId));
    return events.filter((item) => (!scope.merchantIds || scope.merchantIds.includes(item.merchantId)) && (!scope.organizerIds || scope.organizerIds.includes(item.organizerId)));
  }
  save(event) {
    const record = normalizeNotification(event), records = read().map(normalizeNotification), exists = records.some((item) => item.notificationId === record.notificationId);
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(exists ? records.map((item) => item.notificationId === record.notificationId ? record : item) : [record, ...records]));
    return record;
  }
  markHandled(id) { const event = this.list().find((item) => item.notificationId === id); if (!event) throw new Error("找不到通知。"); return this.save({ ...event, handledAt: now(), updatedAt: now() }); }
  clearLocal(scope = null) {
    const removable = new Set(this.list(scope).filter((item) => item.channel === "local").map((item) => item.notificationId));
    const retained = this.list().filter((item) => !removable.has(item.notificationId)); localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(retained)); return retained;
  }
  clearTests(scope = null) {
    const removable = new Set(this.list(scope).filter((item) => item.eventType === "test").map((item) => item.notificationId));
    const retained = this.list().filter((item) => !removable.has(item.notificationId)); localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(retained)); return retained;
  }
}
export class NotificationAdapter { async send() { throw new Error("Notification Adapter 尚未設定。"); } }
export class LocalNotificationAdapter extends NotificationAdapter {
  constructor(repository = new NotificationRepository()) { super(); this.repository = repository; }
  async send(event) { return this.repository.save({ ...normalizeNotification(event), channel: "local", status: "sent", sentAt: now(), updatedAt: now(), lastError: "" }); }
}
export class DisabledLineNotificationAdapter extends NotificationAdapter {
  async send(event) { return normalizeNotification({ ...event, channel: "line", status: "disabled", lastError: "LINE Messaging Adapter 尚未設定", updatedAt: now() }); }
  sendMerchantNewOrder(payload) { return this.send({ ...payload, eventType: "merchant_new_order" }); }
  sendMerchantOrderUpdate(payload) { return this.send({ ...payload, eventType: "merchant_order_update" }); }
  sendCustomerOrderUpdate(payload) { return this.send({ ...payload, eventType: "customer_order_update" }); }
  sendOrganizerNewRegistration(payload) { return this.send({ ...payload, eventType: "organizer_new_registration" }); }
  sendCustomerRegistrationUpdate(payload) { return this.send({ ...payload, eventType: "customer_registration_update" }); }
  sendRentalStatusUpdate(payload) { return this.send({ ...payload, eventType: "rental_status_update" }); }
  sendPaymentStatusUpdate(payload) { return this.send({ ...payload, eventType: "payment_status_update" }); }
}
export class LineMessagingNotificationAdapter extends DisabledLineNotificationAdapter {
  constructor() { super(); }
}
export class DisabledEmailNotificationAdapter extends NotificationAdapter {
  async send(event) { return normalizeNotification({ ...event, channel: "email", status: "disabled", lastError: "Email Adapter 尚未設定", updatedAt: now() }); }
  template(title, message, payload = {}) { return { locale: "zh-Hant-TW", subject: title, preview: message, payload: sanitizeNotificationPayload(payload) }; }
  sendRentalInvitation(payload) { return this.send({ ...payload, eventType: "rental_invitation", title: "NXSPACE 場租邀請" }); }
  sendRentalPaymentInformation(payload) { return this.send({ ...payload, eventType: "rental_payment_information", title: "NXSPACE 場租繳費資訊" }); }
  sendRegistrationConfirmation(payload) { return this.send({ ...payload, eventType: "registration_confirmation", title: "NXSPACE 報名成立" }); }
  sendRegistrationStatusUpdate(payload) { return this.send({ ...payload, eventType: "registration_status_update", title: "NXSPACE 報名狀態更新" }); }
  sendOrderStatusUpdate(payload) { return this.send({ ...payload, eventType: "order_status_update", title: "NXSPACE 訂單狀態更新" }); }
  sendActivityCancellation(payload) { return this.send({ ...payload, eventType: "activity_cancelled", title: "NXSPACE 活動取消" }); }
  sendActivityPostponement(payload) { return this.send({ ...payload, eventType: "activity_postponed", title: "NXSPACE 活動延期" }); }
}
export class NotificationService {
  constructor({ localAdapter = new LocalNotificationAdapter(), lineAdapter = new DisabledLineNotificationAdapter(), emailAdapter = new DisabledEmailNotificationAdapter() } = {}) { this.localAdapter = localAdapter; this.lineAdapter = lineAdapter; this.emailAdapter = emailAdapter; }
  createNewOrderEvent(order) { return normalizeNotification({ eventType: "merchant_new_order", channel: "local", recipientType: "merchant", recipientReference: order.merchantId, relatedEntityType: "order", relatedEntityId: order.id || order.orderId, merchantId: order.merchantId, title: "新訂單", message: `${order.merchantNameSnapshot || "店家"} 收到新訂單 ${order.id || order.orderId}`, payload: { pickupDate: order.pickupDate, pickupTime: order.pickupTime, itemCount: order.items?.length || 0 } }); }
  notifyNewOrder(order) { return this.localAdapter.send(this.createNewOrderEvent(order)); }
  async retry(event) {
    const current = normalizeNotification(event), retry = { ...current, retryCount: current.retryCount + 1, attempts: current.retryCount + 1, status: "processing", updatedAt: now() };
    if (current.channel !== "local") return new NotificationRepository().save({ ...retry, status: "disabled", lastError: `${current.channel.toUpperCase()} Adapter 尚未設定` });
    return this.localAdapter.send(retry);
  }
  test(merchantId) { return this.localAdapter.send({ eventType: "test", channel: "local", recipientType: "merchant", recipientReference: merchantId, relatedEntityType: "system", merchantId, title: "Local 測試通知", message: "NXSPACE Local Notification Adapter 運作正常。" }); }
}
let service;
export function getNotificationService() { service ||= new NotificationService(); return service; }
