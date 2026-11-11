const PREFIX = "nxspace.beta.v1";
const USERS_KEY = `${PREFIX}.identity.users`;
const ROLES_KEY = `${PREFIX}.identity.roles`;
const LEGACY_KEY = `${PREFIX}.demo-credential`;
const BACKUP_AUDIT_KEY = `${PREFIX}.backup.audit`;
const FORBIDDEN_KEY = /secret|access.?token|api.?key|password/i;

function listNxspaceKeys(storage) {
  return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key) => key?.startsWith(PREFIX));
}

function safeParse(value) {
  try { return JSON.parse(value); } catch { return value; }
}

export function createLocalBackup(storage = localStorage) {
  return {
    schemaVersion: 2,
    createdAt: new Date().toISOString(),
    environment: "local-demo",
    collections: Object.fromEntries(listNxspaceKeys(storage).filter((key) => !FORBIDDEN_KEY.test(key)).map((key) => [key, safeParse(storage.getItem(key))]))
  };
}

export function validateLocalBackup(backup) {
  if (!backup || backup.environment !== "local-demo" || ![1, 2].includes(Number(backup.schemaVersion)) || !backup.createdAt || typeof backup.collections !== "object" || Array.isArray(backup.collections)) throw new Error("備份格式或 Schema Version 不正確。");
  const keys = Object.keys(backup.collections);
  if (keys.some((key) => !key.startsWith(PREFIX) || FORBIDDEN_KEY.test(key))) throw new Error("備份包含不允許的資料 Key。");
  return { valid: true, schemaVersion: Number(backup.schemaVersion), keyCount: keys.length, createdAt: backup.createdAt };
}

export function importLocalBackup(backup, { storage = localStorage, actor = "system" } = {}) {
  const validation = validateLocalBackup(backup);
  const snapshot = Object.fromEntries(listNxspaceKeys(storage).map((key) => [key, storage.getItem(key)]));
  try {
    Object.entries(backup.collections).forEach(([key, value]) => storage.setItem(key, JSON.stringify(value)));
    const audit = safeParse(storage.getItem(BACKUP_AUDIT_KEY) || "[]");
    storage.setItem(BACKUP_AUDIT_KEY, JSON.stringify([{ auditId: crypto.randomUUID(), action: "backup.imported", actorId: actor, schemaVersion: validation.schemaVersion, keyCount: validation.keyCount, createdAt: new Date().toISOString() }, ...(Array.isArray(audit) ? audit : [])]));
    return validation;
  } catch (error) {
    listNxspaceKeys(storage).forEach((key) => storage.removeItem(key));
    Object.entries(snapshot).forEach(([key, value]) => storage.setItem(key, value));
    throw error;
  }
}

export function previewDemoReset(storage = localStorage) {
  const keys = listNxspaceKeys(storage);
  const users = safeParse(storage.getItem(USERS_KEY) || "[]");
  return {
    keyCount: keys.length,
    userCount: Array.isArray(users) ? users.length : 0,
    keys,
    preserves: "將保留目前登入的 Super Admin，或一位可用的 Super Admin。"
  };
}

export function resetDemoData({ storage = localStorage, currentUserId } = {}) {
  const users = safeParse(storage.getItem(USERS_KEY) || "[]");
  const current = Array.isArray(users) ? users.find((user) => user.id === currentUserId) : null;
  const fallback = Array.isArray(users) ? users.find((user) => user.status === "active" && user.roleIds?.includes("role-super-admin")) : null;
  const preserved = current?.roleIds?.includes("role-super-admin") ? current : fallback;
  if (!preserved) throw new Error("找不到可保留的啟用中 Super Admin，無法安全重置。");

  listNxspaceKeys(storage).forEach((key) => {
    if (key !== USERS_KEY && key !== ROLES_KEY) storage.removeItem(key);
  });
  storage.setItem(USERS_KEY, JSON.stringify([{ ...preserved, status: "active", roleIds: ["role-super-admin"], updatedAt: new Date().toISOString(), updatedBy: "demo-reset" }]));
  storage.setItem(BACKUP_AUDIT_KEY, JSON.stringify([{ auditId: crypto.randomUUID(), action: "demo.reset", actorId: preserved.id, createdAt: new Date().toISOString() }]));
  storage.removeItem(LEGACY_KEY);
  return { preservedUserId: preserved.id, removedUserCount: Math.max(0, users.length - 1) };
}
