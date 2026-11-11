const KEY = "nxspace.beta.v1.1.schema-registry";
const definitions = Object.freeze({
  identity: 2, merchant: 2, product: 2, order: 3, venueActivity: 3,
  invitation: 2, registration: 1, finance: 2, notification: 2, audit: 2
});
const read = (storage) => { try { return JSON.parse(storage.getItem(KEY) || "{}"); } catch { return {}; } };
export class SchemaRegistry {
  constructor({ storage = localStorage } = {}) { this.storage = storage; }
  list() {
    const state = read(this.storage);
    return Object.entries(definitions).map(([name, currentVersion]) => ({ name, version: Number(state[name]?.version) || 0, currentVersion, migrationFunctions: Array.from({ length: currentVersion }, (_, index) => `${name}.v${index + 1}`), lastMigratedAt: state[name]?.lastMigratedAt || null }));
  }
  migrate() {
    const before = this.storage.getItem(KEY), state = read(this.storage), migrated = [];
    try {
      Object.entries(definitions).forEach(([name, currentVersion]) => {
        const version = Number(state[name]?.version) || 0;
        if (version >= currentVersion) return;
        state[name] = { ...state[name], version: currentVersion, currentVersion, lastMigratedAt: new Date().toISOString() };
        migrated.push({ name, from: version, to: currentVersion });
      });
      const activityKey = "nxspace.beta.v1.venue-activities.activities";
      const activities = JSON.parse(this.storage.getItem(activityKey) || "[]");
      if (Array.isArray(activities) && activities.some((item) => !item.organizerId)) {
        this.storage.setItem(activityKey, JSON.stringify(activities.map((item) => item.organizerId ? item : { ...item, organizerId: `legacy-organizer-${item.activityId}`, organizerType: item.organizerType || "renter" })));
      }
      this.storage.setItem(KEY, JSON.stringify(state));
      return { migrated, schemas: this.list(), idempotent: migrated.length === 0 };
    } catch (error) { before === null ? this.storage.removeItem(KEY) : this.storage.setItem(KEY, before); throw error; }
  }
  validateBackup(backup) {
    if (!backup || backup.environment !== "local-demo" || typeof backup.collections !== "object") throw new Error("不是有效的 NXSPACE Local Demo 備份。");
    if (Number(backup.schemaVersion) > 2) throw new Error("備份 Schema 版本高於目前支援版本。");
    return true;
  }
  get currentBackupVersion() { return 2; }
}
let registry;
export function getSchemaRegistry() { registry ||= new SchemaRegistry(); return registry; }
