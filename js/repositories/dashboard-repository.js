import { activities, vendors, products, homeBanner } from "../data/home-data.js";

const NAMESPACE = "nxspace.beta.v1.dashboard";
const COLLECTIONS = ["activities", "vendors", "products", "banners"];

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function slugify(value = "") {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-").replace(/^-|-$/g, "") || `item-${Date.now()}`;
}

const seeds = {
  activities,
  vendors,
  products,
  banners: [{ id: "banner-home", slug: "home-update", status: "published", placement: "home", priority: 1, ...homeBanner }]
};

export class DashboardRepositoryInterface {
  list() { throw new Error("list must be implemented."); }
  save() { throw new Error("save must be implemented."); }
  remove() { throw new Error("remove must be implemented."); }
}

export class DashboardLocalRepository extends DashboardRepositoryInterface {
  constructor({ storage = localStorage } = {}) { super(); this.storage = storage; }
  key(type) { if (!COLLECTIONS.includes(type)) throw new Error("Unsupported collection."); return `${NAMESPACE}.${type}`; }
  read(type) {
    const raw = this.storage.getItem(this.key(type));
    if (!raw) { const initial = clone(seeds[type]).map((item, index) => ({ status: "published", order: index + 1, ...item })); this.write(type, initial); return initial; }
    try { const value = JSON.parse(raw); return Array.isArray(value) ? value : []; } catch { throw new Error("本機管理資料無法讀取。"); }
  }
  write(type, records) { this.storage.setItem(this.key(type), JSON.stringify(records)); }
  list(type) { return this.read(type); }
  get(type, id) { return this.read(type).find((item) => item.id === id) || null; }
  save(type, input) {
    const records = this.read(type);
    const now = new Date().toISOString();
    const existing = input.id ? records.find((item) => item.id === input.id) : null;
    const record = { ...existing, ...input, id: existing?.id || `${type.slice(0, 3)}-${crypto.randomUUID().slice(0, 8)}`, slug: slugify(input.slug || input.title || input.name), updatedAt: now, createdAt: existing?.createdAt || now };
    if (records.some((item) => item.id !== record.id && item.slug === record.slug)) throw new Error("Slug 已被其他資料使用。");
    if (record.publishStart && record.publishEnd && record.publishEnd < record.publishStart) throw new Error("發布結束日期不可早於開始日期。");
    const next = existing ? records.map((item) => item.id === record.id ? record : item) : [record, ...records];
    this.write(type, next);
    this.audit(existing ? "update" : "create", type, record.id);
    return record;
  }
  remove(type, id) { const records = this.read(type); this.write(type, records.filter((item) => item.id !== id)); this.audit("delete", type, id); }
  bulkUpdate(type, ids, changes) { const selected = new Set(ids); const now = new Date().toISOString(); this.write(type, this.read(type).map((item) => selected.has(item.id) ? { ...item, ...changes, updatedAt: now } : item)); ids.forEach((id) => this.audit("bulk-update", type, id, changes)); }
  duplicate(type, id) { const source = this.get(type, id); if (!source) throw new Error("找不到要複製的資料。"); const { id: ignoredId, createdAt, updatedAt, ...copy } = source; return this.save(type, { ...copy, title: `${copy.title || copy.name} Copy`, slug: `${copy.slug}-copy-${Date.now().toString().slice(-4)}`, status: "draft" }); }
  audit(action, type, id, details = {}) {
    const key = `${NAMESPACE}.audit`;
    let records = [];
    try { records = JSON.parse(this.storage.getItem(key) || "[]"); } catch { records = []; }
    records.unshift({ id: crypto.randomUUID(), action, type, entityId: id, details, createdAt: new Date().toISOString() });
    this.storage.setItem(key, JSON.stringify(records.slice(0, 50)));
  }
  recentActivity(limit = 6) { try { return JSON.parse(this.storage.getItem(`${NAMESPACE}.audit`) || "[]").slice(0, limit); } catch { return []; } }
  reset() { COLLECTIONS.forEach((type) => this.storage.removeItem(this.key(type))); this.storage.removeItem(`${NAMESPACE}.audit`); }
}

let dashboardRepository;
export function getDashboardRepository() { dashboardRepository ||= new DashboardLocalRepository(); return dashboardRepository; }
