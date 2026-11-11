import { getEnvironmentSummary } from "../config/environment.js";
import { permissionCatalog } from "../data/permission-data.js";
import { adminNavigation } from "../config/admin-config.js";
import { getIntegrityService } from "./integrity-service.js";
import { getSchemaRegistry } from "./schema-registry.js";

const STATE_KEY = "nxspace.beta.v1.1.acceptance";
export const ACCEPTANCE_STATUSES = Object.freeze(["untested", "passed", "failed", "not_applicable"]);

export const acceptanceGroups = Object.freeze([
  { package: 13, name: "營運中心、資訊架構與角色首頁", items: ["管理中心登入與首頁", "現場營運首頁", "店家首頁與 Viewer 唯讀"] },
  { package: 14, name: "場地活動、場租邀請與費用管理", items: ["活動管理", "場租邀請與公開填寫", "月結與費用紀錄"] },
  { package: 15, name: "店家、商品、客製化與供應量", items: ["店家與商品管理", "客製化設定", "每日供應與時段容量"] },
  { package: 16, name: "手機 POS、現場點單與訂單營運", items: ["手機 POS 點單", "訂單狀態與作廢", "營收與顧客紀錄"] },
  { package: 17, name: "課程報名、場租收款與營運規則", items: ["公開報名", "名單與容量規則", "收款與取消規則"] },
  { package: 18, name: "整合驗收、通知與 Production Adapter", items: ["通知事件與 Adapter", "Schema 與資料完整性", "備份、重置與 Production Readiness"] }
]);

export const recommendedTestFlow = Object.freeze([
  "重置 Demo 資料", "登入管理中心", "檢查總覽首頁", "建立場地活動", "建立場租邀請", "完成公開邀請填寫",
  "檢查場租費用", "建立活動報名規則", "建立店家", "建立商品與客製化", "使用手機 POS 建立訂單", "更新訂單狀態",
  "作廢訂單", "檢查供應量與時段容量", "檢查營收", "完成公開活動報名", "審核報名", "驗證額滿與取消規則",
  "驗證場租付款通知", "驗證角色權限", "驗證 Viewer 唯讀", "驗證 Vendor 範圍", "檢查通知中心", "檢查 Audit",
  "執行資料完整性檢查", "匯出 Demo 備份"
]);

export const productionReadiness = Object.freeze({
  completed: ["前台資訊架構", "管理中心資訊架構", "角色與權限模型", "LocalStorage Repository", "場地活動與場租流程", "店家商品與 POS", "報名與費用管理", "Audit", "Adapter 介面"],
  incomplete: ["Cloudflare Worker", "Cloudflare D1", "Cloudflare R2", "正式 Authentication", "Server-side Permission", "Session Security", "Transaction Lock", "Rate Limit", "Secret Storage", "LINE Messaging API", "Email Provider", "金流", "電子發票", "正式備份與復原", "監控與告警", "Staging", "Production Deployment"],
  order: ["Cloudflare Worker API", "D1 Schema 與 Migration", "正式 Authentication", "Server-side Permission 與 Scope", "訂單／報名 Transaction Lock", "R2 媒體儲存", "LINE 與 Email 通知", "Google Sheets 匯出", "Rate Limit／Secret Storage／Audit", "Staging", "Production Deployment"]
});

function storageCheck(storage) {
  const key = "nxspace.beta.v1.health-check";
  try {
    storage.setItem(key, "ok");
    const valid = storage.getItem(key) === "ok";
    storage.removeItem(key);
    return valid;
  } catch {
    return false;
  }
}

function readState(storage) {
  try {
    const value = JSON.parse(storage.getItem(STATE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

export function listAcceptanceRecords(storage = localStorage) {
  const state = readState(storage);
  return acceptanceGroups.map((group) => ({
    ...group,
    items: group.items.map((label, index) => {
      const id = `package-${group.package}-${index + 1}`;
      return { id, label, status: ACCEPTANCE_STATUSES.includes(state[id]?.status) ? state[id].status : "untested", notes: state[id]?.notes || "", testedAt: state[id]?.testedAt || null };
    })
  }));
}

export function saveAcceptanceRecord(id, { status, notes = "" }, storage = localStorage) {
  if (!ACCEPTANCE_STATUSES.includes(status)) throw new Error("不支援的驗收狀態。");
  const validIds = new Set(acceptanceGroups.flatMap((group) => group.items.map((_, index) => `package-${group.package}-${index + 1}`)));
  if (!validIds.has(id)) throw new Error("找不到驗收項目。");
  const state = readState(storage);
  state[id] = { status, notes: String(notes).trim().slice(0, 500), testedAt: new Date().toISOString() };
  storage.setItem(STATE_KEY, JSON.stringify(state));
  return state[id];
}

export function runAcceptanceChecks({ storage = localStorage, identityRepository, permissionService, session } = {}) {
  const integrity = getIntegrityService().run();
  const privacy = getIntegrityService().privacy();
  const schemas = getSchemaRegistry().list();
  const knownPermissions = new Set(permissionCatalog);
  const checks = [
    { id: "storage", label: "LocalStorage 可讀寫", pass: storageCheck(storage) },
    { id: "session", label: "目前登入 Session 有效", pass: Boolean(session?.user?.id) },
    { id: "super-admin", label: "至少一位啟用中的 Super Admin", pass: Boolean(identityRepository?.listUsers().some((user) => user.status === "active" && user.roleIds?.includes("role-super-admin"))) },
    { id: "roles", label: "系統角色資料已建立", pass: Boolean(identityRepository?.listRoles().filter((role) => role.system).length >= 5) },
    { id: "permissions", label: "驗收執行者具管理權限", pass: Boolean(permissionService?.can(session?.user, "settings.view")) },
    { id: "navigation-permissions", label: "側欄沒有未知 Permission Key", pass: adminNavigation.every((item) => !item.permission || knownPermissions.has(item.permission)) },
    { id: "schemas", label: "Schema Registry 已完成 Migration", pass: schemas.every((schema) => schema.version === schema.currentVersion) },
    { id: "integrity", label: "資料關聯與容量檢查通過", pass: integrity.passed },
    { id: "privacy", label: "Security／Privacy 檢查通過", pass: privacy.every((check) => check.pass) },
    { id: "production-disabled", label: "Production Adapter 維持停用", pass: getEnvironmentSummary().productionReady === false }
  ];
  return { checkedAt: new Date().toISOString(), environment: getEnvironmentSummary(), checks, integrity, privacy, schemas, passed: checks.every((check) => check.pass) };
}
