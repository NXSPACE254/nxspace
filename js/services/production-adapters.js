import { LocalIdentityRepository } from "../repositories/identity-repository.js";
import { getCommerceRepository } from "./commerce-service.js";
import { getVenueActivityRepository } from "./venue-activity-service.js";
import { getRegistrationService } from "./registration-service.js";
import { getVenueFinanceService } from "./venue-finance-service.js";
import { NotificationRepository } from "./notification-service.js";
import { getMediaStorageAdapter } from "./media-storage-service.js";

const disabled = () => { throw new Error("Production API 尚未設定。"); };
export class ProductionApiClient {
  constructor({ baseUrl = "", enabled = false } = {}) { this.baseUrl = baseUrl; this.enabled = enabled; }
  assertEnabled() { if (!this.enabled || !this.baseUrl) disabled(); }
  authenticate() { disabled(); } refreshSession() { disabled(); } fetchCurrentUser() { disabled(); }
  fetchActivities() { disabled(); } createActivity() { disabled(); } updateActivity() { disabled(); }
  createInvitation() { disabled(); } fetchInvitation() { disabled(); } submitInvitation() { disabled(); }
  fetchMerchants() { disabled(); } fetchProducts() { disabled(); } createOrder() { disabled(); } updateOrder() { disabled(); }
  createRegistration() { disabled(); } updateRegistration() { disabled(); } uploadMedia() { disabled(); }
  sendNotification() { disabled(); } fetchAudit() { disabled(); }
}
export class RemoteRepositoryStub {
  constructor(domain) { this.domain = domain; }
  unavailable() { throw new Error(`${this.domain} Remote Repository 尚未設定。`); }
  list() { return this.unavailable(); } get() { return this.unavailable(); } save() { return this.unavailable(); } remove() { return this.unavailable(); }
}
export class RepositoryFactory {
  constructor({ mode = "local", apiClient = new ProductionApiClient() } = {}) { this.mode = mode; this.apiClient = apiClient; }
  create(domain) {
    if (this.mode === "remote") {
      this.apiClient.assertEnabled();
      return new RemoteRepositoryStub(domain);
    }
    const local = {
      identity: () => new LocalIdentityRepository(), merchant: getCommerceRepository, product: getCommerceRepository,
      order: getCommerceRepository, "venue-activity": getVenueActivityRepository, "rental-invitation": getVenueActivityRepository,
      registration: getRegistrationService, finance: getVenueFinanceService, notification: () => new NotificationRepository(),
      audit: getVenueActivityRepository, media: getMediaStorageAdapter
    };
    if (!local[domain]) throw new Error(`未知 Repository Domain：${domain}`);
    return local[domain]();
  }
}
export class ProductionAuthenticationBoundary {
  constructor({ adapter = null } = {}) { this.adapter = adapter; }
  login() { return this.requireAdapter("login", arguments); } logout() { return this.requireAdapter("logout", arguments); }
  refresh() { return this.requireAdapter("refresh", arguments); } revoke() { return this.requireAdapter("revoke", arguments); }
  currentSession() { return this.requireAdapter("currentSession", arguments); }
  requirePermission() { return this.requireAdapter("requirePermission", arguments); }
  requireScope() { return this.requireAdapter("requireScope", arguments); }
  sessionExpiry() { return this.requireAdapter("sessionExpiry", arguments); }
  inactivityTimeout() { return 60 * 60 * 1000; }
  requireAdapter(method, args) { if (!this.adapter?.[method]) throw new Error("Production Authentication 尚未設定。"); return this.adapter[method](...args); }
}
export const productionStoragePlan = Object.freeze({
  d1: ["Users", "Roles", "Permissions", "Sessions", "Merchants", "Products", "Product Categories", "Customization Templates", "Activities", "Rental Invitations", "Orders", "Registrations", "Payments", "Notifications", "Audit Logs"],
  r2: ["店家 Logo", "店家封面", "商品圖片", "活動海報", "講師圖片", "場地圖片", "公開附件"],
  googleSheets: ["管理報表", "匯出", "人工分析", "備份輔助"],
  googleSheetsExcluded: ["Session", "密碼", "權限主資料", "即時訂單交易鎖", "報名名額交易鎖", "Secret Storage"]
});
let factory;
export function getRepositoryFactory() { factory ||= new RepositoryFactory({ mode: "local" }); return factory; }
