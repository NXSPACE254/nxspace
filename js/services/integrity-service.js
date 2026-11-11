import { permissionCatalog, defaultRoles } from "../data/permission-data.js";
import { adminNavigation } from "../config/admin-config.js";
import { venues } from "../data/venue-data.js";
import { getCommerceRepository } from "./commerce-service.js";
import { getVenueActivityRepository } from "./venue-activity-service.js";
import { getRegistrationService } from "./registration-service.js";

const KEYS = Object.freeze({
  merchants: "nxspace.beta.v1.1.merchants", products: "nxspace.beta.v1.1.products", orders: "nxspace.beta.v1.orders",
  activities: "nxspace.beta.v1.venue-activities.activities", invitations: "nxspace.beta.v1.venue-activities.invitations",
  registrations: "nxspace.beta.v1.1.activity-registrations", supplies: "nxspace.beta.v1.1.daily-supplies",
  slots: "nxspace.beta.v1.1.slot-capacities", notifications: "nxspace.beta.v1.1.notifications",
  monthly: "nxspace.beta.v1.1.food-truck-monthly-billing", commerceAudit: "nxspace.beta.v1.1.commerce-audit",
  venueAudit: "nxspace.beta.v1.venue-activities.audit"
});
const read = (storage, key) => { try { const value = JSON.parse(storage.getItem(key) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } };
const issue = (code, message, entity = "") => ({ code, message, entity, suggestion: suggestions[code] || "檢查來源資料並以管理介面修正；系統不會自動刪除。" });
const suggestions = {
  missing_merchant: "重新指定有效店家。", missing_activity: "重新指定有效活動。", missing_product: "重新指定有效商品。",
  missing_venue: "重新指定有效場地。", duplicate_id: "保留正確紀錄並人工合併重複資料。",
  negative_value: "將金額或數量修正為零以上。", over_capacity: "增加容量或調整仍占用名額的紀錄。",
  invalid_permission: "從角色移除不存在的 Permission Key。"
};
export class IntegrityService {
  constructor({ storage = localStorage } = {}) { this.storage = storage; }
  run() {
    const commerce = getCommerceRepository(), venueRepository = getVenueActivityRepository(), registrationService = getRegistrationService();
    const merchants = read(this.storage, KEYS.merchants).length ? read(this.storage, KEYS.merchants) : commerce.listMerchants(), products = read(this.storage, KEYS.products).length ? read(this.storage, KEYS.products) : commerce.listProducts(), orders = read(this.storage, KEYS.orders);
    const activities = venueRepository.listActivities(), invitations = venueRepository.listInvitations(), registrations = registrationService.listRegistrations();
    const supplies = commerce.listDailySupplies(), slots = commerce.listSlotCapacities(), notifications = read(this.storage, KEYS.notifications), monthly = read(this.storage, KEYS.monthly);
    const issues = [], merchantIds = new Set(merchants.map((item) => item.merchantId)), productIds = new Set(products.map((item) => item.id || item.productId)), activityIds = new Set(activities.map((item) => item.activityId)), venueIds = new Set(venues.map((item) => item.id));
    products.forEach((item) => { if (!merchantIds.has(item.merchantId)) issues.push(issue("missing_merchant", "商品指向不存在的店家。", item.id)); if (Number(item.price) < 0) issues.push(issue("negative_value", "商品價格不可為負數。", item.id)); });
    orders.forEach((item) => { if (!merchantIds.has(item.merchantId)) issues.push(issue("missing_merchant", "訂單指向不存在的店家。", item.id || item.orderId)); if (Number(item.finalTotal ?? item.total) < 0) issues.push(issue("negative_value", "訂單金額不可為負數。", item.id || item.orderId)); });
    activities.forEach((item) => { if (!venueIds.has(item.venueId)) issues.push(issue("missing_venue", "活動指向不存在的場地。", item.activityId)); if (!item.organizerId && item.organizerType !== "internal") issues.push(issue("missing_organizer", "活動缺少 organizerId。", item.activityId)); });
    invitations.forEach((item) => { if (!activityIds.has(item.activityId)) issues.push(issue("missing_activity", "邀請指向不存在的活動。", item.invitationId)); });
    registrations.forEach((item) => { if (!activityIds.has(item.activityId)) issues.push(issue("missing_activity", "報名指向不存在的活動。", item.registrationId)); if (Number(item.amountDue) < 0 || Number(item.amountPaid) < 0) issues.push(issue("negative_value", "報名金額不可為負數。", item.registrationId)); });
    supplies.forEach((item) => { if (!productIds.has(item.productId)) issues.push(issue("missing_product", "供應量指向不存在的商品。", item.supplyId)); if (Number(item.dailyLimit) < 0) issues.push(issue("negative_value", "供應量不可為負數。", item.supplyId)); });
    slots.forEach((item) => { if (!activityIds.has(item.activityId)) issues.push(issue("missing_activity", "時段容量指向不存在的活動。", item.slotCapacityId)); if (Number(item.totalCapacity) < Number(item.reservationUsed || 0) + Number(item.walkInUsed || 0)) issues.push(issue("over_capacity", "時段容量低於已使用量。", item.slotCapacityId)); });
    monthly.forEach((item) => { if (Number(item.totalDue) < 0 || Number(item.amountReceived) < 0) issues.push(issue("negative_value", "月度應收金額不可為負數。", item.monthlyBillingId)); });
    this.checkRegistrationCapacity(activities, registrations, issues);
    this.checkDuplicateIds({ merchants, products, orders, activities, invitations, registrations, supplies, slots, notifications }, issues);
    defaultRoles.forEach((role) => role.permissions.filter((key) => !permissionCatalog.includes(key)).forEach((key) => issues.push(issue("invalid_permission", `角色含無效權限：${key}`, role.id))));
    adminNavigation.filter((item) => item.permission && !permissionCatalog.includes(item.permission)).forEach((item) => issues.push(issue("invalid_permission", `導覽含無效權限：${item.permission}`, item.href)));
    return { checkedAt: new Date().toISOString(), counts: { merchants: merchants.length, products: products.length, orders: orders.length, activities: activities.length, registrations: registrations.length, notifications: notifications.length }, issues, passed: issues.length === 0 };
  }
  checkRegistrationCapacity(activities, registrations, issues) {
    activities.filter((item) => item.enableRegistration).forEach((activity) => {
      const accepted = registrations.filter((item) => item.activityId === activity.activityId && ["accepted", "completed", "no_show"].includes(item.status)).reduce((sum, item) => sum + Number(item.attendeeCount || 1), 0);
      if (accepted > Number(activity.capacity || 0)) issues.push(issue("over_capacity", "活動已錄取人數超過名額。", activity.activityId));
    });
  }
  checkDuplicateIds(collections, issues) {
    const idFields = {
      merchants: ["merchantId", "id"], products: ["productId", "id"], orders: ["orderId", "id"],
      activities: ["activityId", "id"], invitations: ["invitationId", "id"], registrations: ["registrationId", "id"],
      supplies: ["supplyId", "id"], slots: ["slotCapacityId", "id"], notifications: ["notificationId", "eventId", "id"]
    };
    Object.entries(collections).forEach(([name, records]) => {
      const seen = new Set();
      records.forEach((item) => {
        const id = idFields[name]?.map((field) => item[field]).find(Boolean);
        if (id && seen.has(id)) issues.push(issue("duplicate_id", `${name} 存在重複 ID。`, id));
        if (id) seen.add(id);
      });
    });
  }
  privacy() {
    const audits = [...read(this.storage, KEYS.commerceAudit), ...read(this.storage, KEYS.venueAudit)], serialized = JSON.stringify(audits);
    return [
      { id: "audit-phone", label: "Audit 不保存完整手機", pass: !/09\d{8}/.test(serialized) },
      { id: "audit-email", label: "Audit 不保存完整 Email", pass: !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized) },
      { id: "audit-token", label: "邀請 Token 已遮罩", pass: !/"token"\s*:\s*"[a-f0-9]{20,}"/i.test(serialized) },
      { id: "audit-bank", label: "Audit 不保存銀行帳號", pass: !/bankAccountNote|accountNumber/i.test(serialized) },
      { id: "viewer", label: "Viewer 沒有寫入權限", pass: !defaultRoles.find((role) => role.id === "role-viewer")?.permissions.some((key) => !key.endsWith(".view")) },
      { id: "secrets", label: "LocalStorage 不含常見 Secret 欄位", pass: !Array.from({ length: this.storage.length }, (_, index) => this.storage.key(index)).some((key) => /secret|access-token|api-key/i.test(key)) }
    ];
  }
}
let service;
export function getIntegrityService() { service ||= new IntegrityService(); return service; }
