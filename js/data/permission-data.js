import { dataScopeLabels } from "./label-registry.js";

export const permissionCatalog = [
  "dashboard.view", "activities.view", "activities.create", "activities.update", "activities.delete", "activities.publish", "activities.bulk",
  "vendors.view", "vendors.create", "vendors.update", "vendors.delete", "vendors.publish", "vendors.bulk",
  "products.view", "products.create", "products.update", "products.delete", "products.publish", "products.bulk",
  "banners.view", "banners.create", "banners.update", "banners.delete", "banners.publish", "banners.bulk",
  "orders.view", "orders.create", "orders.update", "orders.delete", "orders.status", "orders.export",
  "rentals.view", "rentals.update", "rentals.approve", "rentals.reject", "rentals.delete", "rentals.export",
  "availability.view", "availability.manage", "users.view", "users.create", "users.update", "users.delete", "users.reset-password", "users.assign-role",
  "roles.view", "roles.create", "roles.update", "roles.delete", "roles.assign-permission", "roles.preview", "audit.view", "audit.export", "sensitive-data.reveal",
  "settings.view", "settings.update", "integrations.view", "integrations.update",
  "events.view", "events.create", "events.update", "events.archive", "events.bulk", "merchants.view", "merchants.create", "merchants.update", "merchants.archive", "merchants.bulk", "products.archive", "banners.archive",
  "venue-activities.view", "venue-activities.create", "venue-activities.update", "venue-activities.cancel", "venue-activities.status",
  "rental-invitations.view", "rental-invitations.create", "rental-invitations.extend", "rental-invitations.revoke", "rental-invitations.reopen",
  "venue-billing.view", "venue-billing.update", "venue-billing.open", "venue-billing.receive", "venue-billing.invoice", "venue-billing.refund",
  "food-truck-schedule.view", "food-truck-schedule.create", "food-truck-schedule.update"
  ,"merchants.status", "merchants.permissions", "merchants.force-close",
  "products.price", "products.disable", "products.sold-out",
  "product-categories.manage", "customizations.view", "customizations.create", "customizations.update", "customizations.apply",
  "supplies.view", "supplies.update", "slot-capacities.view", "slot-capacities.update", "slot-capacities.release",
  "promotions.view", "promotions.create", "promotions.update", "promotions.disable",
  "pos.view", "pos.create", "pos.override-capacity",
  "orders.admin-create", "orders.adjust", "orders.void", "orders.customer-contact",
  "customers.history", "customers.export",
  "registrations.view", "registrations.settings.view", "registrations.settings.create", "registrations.settings.update",
  "registrations.attendees.view", "registrations.status.manage", "registrations.waitlist.manage", "registrations.attendance.manage",
  "registrations.export.summary", "registrations.export.details", "registrations.export.contacts",
  "venue-finance.view", "venue-finance.update", "venue-finance.receive", "venue-finance.refund", "venue-finance.invoice",
  "venue-finance.monthly.view", "venue-finance.monthly.update", "venue-finance.postpone", "venue-finance.cancel",
  "field-checklists.view", "field-checklists.update"
];

const contentManager = permissionCatalog.filter((key) => /^(dashboard|activities|events|vendors|merchants|products|banners)\./.test(key));
export const defaultRoles = [
  { id: "role-super-admin", name: "Super Admin", description: "完整 Local Demo 管理權限", system: true, permissions: permissionCatalog, dataScope: "all" },
  { id: "role-admin", name: "Admin", description: "平台內容與營運管理", system: true, permissions: permissionCatalog.filter((key) => key !== "roles.delete" && key !== "roles.preview" && key !== "users.delete"), dataScope: "all" },
  { id: "role-manager", name: "Manager", description: "內容與營運管理", system: true, permissions: [...contentManager, ...permissionCatalog.filter((key) => /^(orders|rentals|availability)\.(view|update|status|approve|reject|export)$/.test(key) || /^(venue-activities|rental-invitations|food-truck-schedule|registrations|venue-finance|field-checklists)\./.test(key) || /^(venue-billing)\.(view|update|open|receive|invoice)$/.test(key) || /^(customizations|supplies|slot-capacities|promotions)\.view$/.test(key))], dataScope: "assigned" },
  { id: "role-vendor", name: "Vendor", description: "所屬商家資料管理", system: true, permissions: permissionCatalog.filter((key) => /^(dashboard\.view|vendors\.view|merchants\.update|products\.(view|create|update|price|sold-out)|orders\.(view|create|update|status|adjust|void|export|customer-contact)|pos\.(view|create|override-capacity)|customers\.history|venue-activities\.view|food-truck-schedule\.view|registrations\.(view|settings\.view|settings\.update|attendees\.view|status\.manage|waitlist\.manage|attendance\.manage|export\.summary|export\.details|export\.contacts)|field-checklists\.view|product-categories\.manage|customizations\.(view|create|update|apply)|supplies\.(view|update)|slot-capacities\.(view|update|release)|promotions\.(view|create|update|disable))$/.test(key)), dataScope: "own" },
  { id: "role-viewer", name: "Viewer", description: "唯讀查詢", system: true, permissions: permissionCatalog.filter((key) => key.endsWith(".view")), dataScope: "read_only" }
];

export const userStatuses = Object.freeze({ active: "啟用", inactive: "停用", suspended: "暫停", pending_activation: "待啟用" });
export const dataScopes = dataScopeLabels;
