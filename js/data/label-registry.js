import { runtimeMessage, runtimeStatusLabels } from "../utils/runtime-message.js";
export const navigationLabels = Object.freeze({
  platform: "NXSPACE 營運中心", dashboard: "營運總覽", fieldDashboard: "場務總覽", merchantHome: "店家首頁",
  todayOperations: "今日營運", schedule: "今日行程", pos: "現場點單",
  activities: "活動與日曆", vendors: "合作店家", products: "商品管理",
  banners: "Banner 管理", orders: "訂單管理", rentals: "場地租借", availability: "可用日期管理",
  users: "使用者管理", roles: "角色與權限", integrations: "資料串接", settings: "系統設定",
  audit: "操作紀錄", acceptance: "驗收中心", notifications: "通知中心",
  rentalInvitations: "場租邀請", foodTruckSchedule: "餐車月排", feesInvoices: "費用與發票",
  customization: "通用客製化", dailySupply: "今日供應量", slotCapacity: "時段容量",
  promotions: "優惠公告", venueActivities: "場地活動", openPayment: "開啟繳費資訊",
  invitationExpires: "邀請有效期限"
  , productCategories: "商品分類", customizations: "通用客製化", dailySupplies: "今日供應量",
  slotCapacities: "時段容量", promotions: "優惠公告"
});

export const statusLabels = Object.freeze({
  draft: "草稿", published: "已發布", archived: "已下架", pending: "待處理",
  confirmed: "已接受", preparing: "備餐中", ready: "可取餐", completed: "已完成",
  cancelled: "已取消", unauthorized: "沒有操作權限", not_found: "找不到此頁面"
});

export const orderStatusLabels = runtimeStatusLabels({ pending_merchant_confirmation:"等待店家確認",accepted:"店家已接受",rejected:"店家已拒絕",preparing:"備餐中",ready:"可取餐",completed:"已完成",customer_cancelled:"顧客已取消",merchant_cancelled:"店家已取消",no_show:"未取餐" });
export const customizationTypeLabels = Object.freeze({ single:"單選",multiple:"複選",quantity:"數量",text:"文字備註" });
export const notificationStatusLabels = Object.freeze({ local_only:"僅本機通知紀錄",not_configured:"LINE 通知尚未設定",pending:"等待通知",sent:runtimeMessage("本機模擬已處理（未寄送）", "通知已送出"),failed:"通知失敗",retrying:"準備重試" });

export const roleLabels = Object.freeze({
  "Super Admin": "總管理", Admin: "NXSPACE 管理者", Manager: "場務管理者",
  Vendor: "合作店家", Viewer: "檢視人員"
});
export const roleIdLabels = Object.freeze({"role-super-admin":"總管理","role-admin":"NXSPACE 管理者","role-manager":"場務管理者","role-vendor":"合作店家","role-viewer":"檢視人員"});
export const dataScopeLabels = Object.freeze({ all:"全部資料",assigned:"指派資料",own:"自己的資料",read_only:"唯讀資料" });

const groupDefinitions = [
  ["dashboard", "儀表板"], ["activities", "活動管理"], ["events", "活動管理"],
  ["vendors", "商家管理"], ["merchants", "商家管理"], ["products", "商品管理"],
  ["banners", "Banner 管理"], ["orders", "訂單管理"], ["rentals", "場地租借"],
  ["availability", "可用日期管理"], ["users", "使用者管理"], ["roles", "角色與權限"],
  ["audit", "系統管理"], ["sensitive-data", "系統管理"], ["settings", "系統管理"],
  ["integrations", "系統管理"], ["venue-activities", "場地活動"],
  ["rental-invitations", "場租邀請"], ["venue-billing", "費用與發票"],
  ["food-truck-schedule", "餐車月排"],
  ["pos", "手機 POS"], ["customers", "顧客訂單"], ["registrations", "活動報名"],
  ["venue-finance", "場租費用"], ["field-checklists", "場務清單"]
  ,["product-categories", "商品分類"], ["customizations", "通用客製化"],
  ["supplies", "每日供應量"], ["slot-capacities", "時段容量"], ["promotions", "優惠公告"]
];

export const permissionGroupLabels = Object.freeze(Object.fromEntries(groupDefinitions));

const actionLabels = Object.freeze({
  view: "查看", create: "新增", update: "編輯", delete: "刪除", publish: "發布或下架",
  archive: "發布或下架", bulk: "批次管理", status: "更新狀態", export: "匯出資料",
  approve: "核准", reject: "拒絕", manage: "管理封鎖日期及時段", "reset-password": "重設密碼",
  "assign-role": "指派角色", "assign-permission": "設定權限", reveal: "查看敏感資料"
  , cancel: "取消", extend: "延長期限", revoke: "撤銷", reopen: "重新開放編輯",
  open: "開啟", receive: "確認收款", invoice: "管理發票", refund: "執行退費",
  adjust: "調整", void: "作廢", history: "查詢歷史", "admin-create": "管理員代建",
  "customer-contact": "查看顧客聯絡資料", "override-capacity": "共用總容量",
  settings: "管理設定", attendees: "查看名單", waitlist: "管理候補", attendance: "管理出席",
  summary: "匯出摘要", details: "匯出明細", contacts: "匯出聯絡資料", monthly: "管理月度應收",
  postpone: "管理延期", cancel: "管理取消"
});

export function getPermissionLabel(key = "") {
  const [area, action] = key.split(".");
  const subject = permissionGroupLabels[area] || area;
  if (key === "dashboard.view") return "查看角色首頁";
  if (key === "orders.status") return "接受、拒絕或更新備餐狀態";
  if (key === "sensitive-data.reveal") return "查看敏感資料";
  return `${actionLabels[action] || action}${subject.replace(/管理$|系統管理$/, "")}`;
}

export function isHighRiskPermission(key = "") {
  return /\.(delete|export)$|assign-permission|reset-password|sensitive-data\.reveal|settings\.update|integrations\.update/.test(key);
}

export const auditEventLabels = Object.freeze({
  "login.success": "登入成功", "login.failure": "登入失敗", "order.created": "建立訂單",
  "order.accepted": "店家接受訂單", "order.rejected": "店家拒絕訂單", "order.preparing": "開始備餐",
  "order.ready": "訂單可取餐", "order.completed": "訂單完成", "sensitive-data.revealed": "查看敏感資料",
  "permission.denied": "操作遭拒", "notification.sent": runtimeMessage("本機模擬已處理（未寄送）", "通知已送出"), "notification.failed": "通知失敗",
  "order.merchant_cancelled":"店家取消訂單","order.customer_cancelled":"顧客取消訂單","product.sold-out":"商品標記售完","product.restored":"商品恢復販售","merchant.orders-started":"商店開始接單","merchant.orders-paused":"商店暫停接單","notification.created":"建立通知","notification.tested":"通知測試","notification.retried":"通知重試","role-preview.entered":"進入角色預覽","role-preview.exited":"離開角色預覽"
  ,"activity.created":"建立場地活動","activity.updated":"修改場地活動","invitation.created":"建立場租邀請","invitation.extend":"延長場租邀請","invitation.revoke":"撤銷場租邀請","invitation.regenerate":"重新產生場租邀請","invitation.reopen":"重新開放場租邀請","invitee.submitted":"租客送出資料","invitee.draft-saved":"租客儲存草稿","billing.opened":"開啟繳費資訊","billing.updated":"修改場租費用","monthly-schedule.created":"建立餐車月排"
  ,"merchant.created":"建立店家","merchant.updated":"修改店家","merchant.force-closed":"NXSPACE 強制關閉店家","merchant.force-reopened":"解除店家強制關閉","product.created":"建立商品","product.updated":"修改商品","product.price-updated":"修改商品價格","category.created":"建立商品分類","category.updated":"修改商品分類","customization.created":"建立客製化範本","customization.updated":"修改客製化範本","customization.applied":"套用客製化範本","supply.updated":"修改每日供應量","slot-capacity.updated":"修改時段容量","promotion.created":"建立優惠公告","promotion.updated":"修改優惠公告"
});

export function getAuditEventLabel(key = "") { return auditEventLabels[key] || key; }
