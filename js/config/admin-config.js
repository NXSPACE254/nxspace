const existingAdminNavigation = [
  { group:'場地',label:'場館照片與位置',icon:'▧',href:'#venueProfiles',permission:'events.view',excludeRoles:['role-vendor'] },
  { group:'公益', label:'聖誕公益管理', icon:'◇', href:'#christmas', permission:'dashboard.view', excludeRoles:['role-vendor'] },
  { group:"營運", label:"營運總覽", icon:"⌂", href:"#dashboard", permission:"dashboard.view", excludeRoles:["role-vendor","role-manager"] },
  { group:"營運", label:"首頁重點與公告", icon:"✧", href:"#banners", permission:"banners.view", excludeRoles:["role-vendor"] },
  { group:"營運", label:"場務總覽", icon:"⌂", href:"#field-dashboard", permission:"dashboard.view", roles:["role-manager"] },
  { group:"今日營運", label:"店家首頁", icon:"⌂", href:"#merchant-home", permission:"dashboard.view", roles:["role-vendor"] },
  { group:"今日營運", label:"待處理訂單", icon:"▦", href:"#merchant-orders", permission:"orders.view", roles:["role-vendor"] },
  { group:"今日營運", label:"全部訂單", icon:"≡", href:"#orders", permission:"orders.view", roles:["role-vendor"] },
  { group:"今日營運", label:"現場點單", icon:"＋", href:"#pos", permission:"pos.view", roles:["role-vendor"] },
  { group:"今日營運", label:"今日營業額", icon:"$", href:"#today-revenue", permission:"orders.view", roles:["role-vendor"] },
  { group:"今日營運", label:"顧客歷史訂單", icon:"◎", href:"#customer-history", permission:"customers.history", roles:["role-vendor"] },
  { group:"營運", label:"今日行程", icon:"◷", href:"#schedule", permission:"dashboard.view", excludeRoles:["role-vendor"] },
  { group:"活動營運", label:"活動與場租總覽", icon:"⌂", href:"#activity-operations", permission:"registrations.view" },
  { group:"活動營運", label:"活動報名設定", icon:"◇", href:"#registration-settings", permission:"registrations.settings.view" },
  { group:"活動營運", label:"報名名單", icon:"≡", href:"#registration-attendees", permission:"registrations.attendees.view" },
  { group:"活動營運", label:"場租收款", icon:"$", href:"#venue-finance", permission:"venue-finance.view", excludeRoles:["role-vendor"] },
  { group:"活動營運", label:"餐車月度應收", icon:"□", href:"#food-truck-monthly-billing", permission:"venue-finance.monthly.view", excludeRoles:["role-vendor"] },
  { group:"活動營運", label:"設備與場務清單", icon:"✓", href:"#field-checklists", permission:"field-checklists.view" },
  { group:"營運", label:"場地活動", icon:"◫", href:"#venue-activities", permission:"venue-activities.view" },
  { group:"營運", label:"通知中心", icon:"◌", href:"#notifications", permission:"integrations.view" },
  { group:"場地", label:"場地租借", icon:"▧", href:"#rentals", permission:"rentals.view" },
  { group:"場地", label:"場租邀請", icon:"✉", href:"#rental-invitations", permission:"rental-invitations.view" },
  { group:"場地", label:"餐車月排", icon:"□", href:"#food-truck-schedule", permission:"food-truck-schedule.view" },
  { group:"場地", label:"費用與發票", icon:"＄", href:"#venue-billing", permission:"venue-billing.view" },
  { group:"商務", label:"合作店家", icon:"◇", href:"#commerce-merchants", permission:"merchants.view", excludeRoles:["role-vendor"] },
  { group:"商品", label:"商品管理", icon:"▣", href:"#commerce-products", permission:"products.view" },
  { group:"商品", label:"商品分類", icon:"◇", href:"#product-categories", permission:"product-categories.manage" },
  { group:"商品", label:"通用客製化", icon:"◇", href:"#customizations", permission:"customizations.view" },
  { group:"商品", label:"今日供應量", icon:"#", href:"#daily-supplies", permission:"supplies.view" },
  { group:"商品", label:"時段容量", icon:"◷", href:"#slot-capacities", permission:"slot-capacities.view" },
  { group:"商務", label:"訂單管理", icon:"≡", href:"#orders", permission:"orders.view", excludeRoles:["role-vendor"] },
  { group:"店家", label:"店家資料", icon:"◇", href:"#merchant-profile", permission:"vendors.view", roles:["role-vendor"] },
  { group:"店家", label:"優惠公告", icon:"◌", href:"#promotion-notices", permission:"promotions.view", roles:["role-vendor"] },
  { group:"店家", label:"通知中心", icon:"○", href:"#merchant-notifications", permission:"dashboard.view", roles:["role-vendor"] },
  { group:"系統", label:"使用者", icon:"◎", href:"#users", permission:"users.view" },
  { group:"系統", label:"角色與權限", icon:"◉", href:"#roles", permission:"roles.view" },
  { group:"系統", label:"角色預覽", icon:"◐", href:"#role-preview", permission:"roles.preview" },
  { group:"系統", label:"整合設定", icon:"⇄", href:"#integrations", permission:"integrations.view", excludeRoles:["role-vendor"] },
  { group:"系統", label:"系統設定", icon:"⚙", href:"#settings", permission:"settings.view" },
  { group:"系統", label:"操作紀錄", icon:"≡", href:"#audit", permission:"audit.view" },
  { group:"系統", label:"驗收中心", icon:"✓", href:"#acceptance", permission:"settings.view" }
];

// Group existing destinations without removing routes or changing permissions.
const activityWorkspace = new Set(['#activity-operations','#registration-settings','#registration-attendees','#venue-finance','#food-truck-monthly-billing','#field-checklists','#venue-activities','#rentals','#rental-invitations','#venue-billing']);
const foodWorkspace = new Set(['#merchant-home','#merchant-orders','#orders','#pos','#today-revenue','#customer-history','#commerce-products','#product-categories','#customizations','#daily-supplies','#slot-capacities','#merchant-profile','#promotion-notices','#merchant-notifications','#food-truck-schedule']);
const systemWorkspace = new Set(['#users','#roles','#role-preview','#integrations','#settings','#audit','#acceptance']);
export const adminWorkspaceOrder = Object.freeze(['營運中心','活動與場地','餐車營運','合作夥伴','聖誕公益','系統管理']);
export const adminNavigation = existingAdminNavigation.map(item=>({...item,group:item.href==='#christmas'?'聖誕公益':activityWorkspace.has(item.href)?'活動與場地':foodWorkspace.has(item.href)?'餐車營運':item.href==='#commerce-merchants'?'合作夥伴':systemWorkspace.has(item.href)?'系統管理':'營運中心',label:item.href==='#merchant-orders'?'今日訂單工作台':item.label}));

export const managementSchemas = {
  venueProfiles:{title:'場館照片與位置',singular:'場館公開資料',permission:'events',titleField:'title',fields:[['title','場館名稱','text',true],['slug','場館網址代稱（請保留）','text',true],['image','自有或已授權照片 HTTPS 網址','url',false],['photoCredit','照片授權或來源說明','text',false],['address','已核對完整地址（未確認請留白）','text',false],['transport','位置與交通資訊（未確認請留白）','textarea',false],['status','公開狀態','status',true]]},
  activities: { title: "活動管理", singular: "活動", permission: "events", titleField: "title", fields: [
    ["title", "活動名稱", "text", true], ["slug", "Slug", "text", true], ["tag", "分類", "text", true], ["date", "日期顯示", "text", true], ["sortDate", "排序日期", "date", true], ["time", "時間", "text", true], ["location", "場地", "text", true], ["capacity", "名額", "number", false], ["registrationUrl", "報名 URL", "url", false], ["image", "圖片 URL", "url", false], ["description", "摘要", "textarea", true], ["content", "完整內容", "textarea", true], ["status", "狀態", "status", true]
  ]},
  vendors: { title: "商家管理", singular: "商家", permission: "merchants", titleField: "title", fields: [
    ["title", "商家名稱", "text", true], ["merchantId", "商店 ID", "text", true], ["slug", "網址代稱", "text", true], ["tag", "分類", "text", true], ["location", "位置", "text", true], ["hours", "每日營業時間", "text", false], ["businessDays", "營業星期（0–6，逗號分隔）", "text", true], ["orderOpenTime", "接單開始時間", "time", true], ["orderCloseTime", "接單截止時間", "time", true], ["pickupSlots", "取餐時段（逗號分隔）", "text", true], ["maxOrdersPerSlot", "每時段最大訂單數", "number", true], ["pendingCountsTowardCapacity", "待確認訂單占用容量（true／false）", "text", true], ["minimumLeadMinutes", "最短提前分鐘", "number", true], ["maximumAdvanceDays", "最長提前天數", "number", true], ["specialClosures", "特殊休息日（逗號分隔）", "text", false], ["specialOpenDates", "臨時營業日（逗號分隔）", "text", false], ["blockedDates", "封鎖日期（逗號分隔）", "text", false], ["blockedSlots", "封鎖時段（日期|時間）", "text", false], ["assignedUserIds", "指派使用者 ID（逗號分隔）", "text", false], ["acceptsOrders", "是否接單（true／false）", "text", true], ["pauseReason", "暫停接單原因", "textarea", false], ["notificationEnabled", "LINE 通知啟用（true／false）", "text", false], ["logo", "Logo URL", "url", false], ["image", "主要圖片 URL", "url", false], ["description", "摘要", "textarea", true], ["content", "品牌介紹", "textarea", true], ["status", "狀態", "status", true]
  ]},
  products: { title: "商品管理", singular: "商品", permission: "products", titleField: "title", fields: [
    ["title", "商品名稱", "text", true], ["merchantId", "所屬商店 ID", "text", true], ["slug", "網址代稱", "text", true], ["sku", "商品編號", "text", false], ["vendor", "商家", "text", true], ["tag", "分類", "text", true], ["price", "價格", "number", true], ["originalPrice", "原價", "number", false], ["stock", "庫存", "number", false], ["soldOut", "售完（true／false）", "text", false], ["availableDays", "供應星期（0–6，逗號分隔）", "text", false], ["availableSlots", "供應時段（逗號分隔）", "text", false], ["maxQuantity", "每筆最大數量", "number", false], ["availability", "供應狀態", "text", false], ["image", "圖片 URL", "url", false], ["description", "摘要", "textarea", true], ["content", "商品說明", "textarea", true], ["status", "狀態", "status", true]
  ]},
  banners: { title: "首頁重點與公告", singular: "重點活動／公告", permission: "banners", titleField: "title", fields: [
    ["title", "標題", "text", true], ["slug", "網址代稱", "text", true], ["eyebrow", "眉題", "text", false], ["placement", "顯示位置", "placement", true], ["priority", "優先順序", "number", true], ["publishStart", "發布開始", "date", false], ["publishEnd", "發布結束", "date", false], ["label", "按鈕文字", "text", true], ["href", "連結", "text", true], ["image", "圖片網址（使用自有素材）", "url", false], ["description", "內容", "textarea", true], ["status", "狀態", "status", true]
  ]}
};
