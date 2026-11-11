export const rentalStatuses = Object.freeze({
  submitted: { label: "已送出", tone: "info" },
  reviewing: { label: "審核中", tone: "warning" },
  approved: { label: "已核准", tone: "success" },
  rejected: { label: "未通過", tone: "danger" },
  cancelled: { label: "已取消", tone: "secondary" }
});

export const activityTypeOptions = [
  "講座與分享會",
  "工作坊與課程",
  "品牌活動",
  "展覽與市集",
  "音樂與表演",
  "公司或團體聚會",
  "其他"
];

export const equipmentOptions = [
  "投影設備",
  "基礎音響",
  "無線麥克風",
  "活動桌椅",
  "接待桌",
  "延長線與電源"
];

export const rentalTimePresets = [
  { value: "morning", label: "上午 09:00－12:00", start: "09:00", end: "12:00" },
  { value: "afternoon", label: "下午 13:00－17:00", start: "13:00", end: "17:00" },
  { value: "evening", label: "晚上 18:00－21:00", start: "18:00", end: "21:00" },
  { value: "custom", label: "自訂時段", start: "", end: "" }
];

export const venues = [
  {
    id: "venue-tiehua",
    slug: "tiehua-hall",
    name: "鐵花館",
    status: "active",
    venueType: "室內多功能場地",
    public: true,
    rentableHours: { start: "09:00", end: "21:00" },
    internalNotes: "Demo：基本配置 4 張桌子、8 張椅子。",
    equipmentInventory: { 桌子: 4, 椅子: 8, 投影機: 1, 投影筆: 1, 音響: 1, 麥克風: 2, 延長線: 4, 白板: 1 },
    shortName: "鐵花館",
    summary: "適合講座、展覽、品牌發表與中型交流活動的室內場域。",
    description: "鐵花館以完整室內機能與彈性配置為特色，可依活動形式調整講座、展覽或交流動線。",
    image: "https://picsum.photos/1200/720?random=51",
    gallery: [
      "https://picsum.photos/800/600?random=52",
      "https://picsum.photos/800/600?random=53"
    ],
    capacity: { seated: 60, standing: 90, recommended: "20–80 人" },
    features: ["完整室內空調", "彈性舞台與座位", "獨立接待區", "鄰近市區交通節點"],
    suitableFor: ["講座與分享會", "品牌活動", "展覽與市集", "公司或團體聚會"],
    facilities: ["投影設備", "基礎音響", "無線麥克風", "活動桌椅", "無線網路"],
    services: ["場地配置討論", "活動前設備測試", "基礎清潔", "現場交接"],
    plans: [
      { id: "tiehua-half", name: "半日方案", duration: "4 小時", price: "NT$ 8,000 起", note: "適合講座、工作坊與小型發表" },
      { id: "tiehua-full", name: "全日方案", duration: "8 小時", price: "NT$ 14,000 起", note: "適合展覽、市集與完整活動日" },
      { id: "tiehua-custom", name: "專案方案", duration: "依需求", price: "另行報價", note: "跨日、特殊設備或複合型活動" }
    ],
    unavailableWeekdays: [1],
    unavailableDates: ["2026-08-03", "2026-08-10", "2026-08-17"],
    occupiedSlots: [
      { date: "2026-08-02", start: "13:00", end: "18:00" },
      { date: "2026-08-09", start: "09:00", end: "12:00" }
    ]
  },
  {
    id: "venue-oasis",
    slug: "oasis-field",
    name: "綠洲場",
    status: "active",
    venueType: "戶外開放場地",
    public: true,
    rentableHours: { start: "09:00", end: "22:00" },
    internalNotes: "Demo：餐車與市集活動優先使用場地。",
    equipmentInventory: { 露營桌: 6, 露營椅: 24, 音響: 1, 麥克風: 2, 延長線: 6, 電源: 4, 風扇: 2, 電燈: 6 },
    shortName: "綠洲場",
    summary: "有自然光與戶外感的開放空間，適合市集、餐車、演出與生活提案。",
    description: "綠洲場保留開放、輕鬆的空間氣氛，能承接餐飲、市集、音樂與跨品牌合作。",
    image: "https://picsum.photos/1200/720?random=54",
    gallery: [
      "https://picsum.photos/800/600?random=55",
      "https://picsum.photos/800/600?random=56"
    ],
    capacity: { seated: 40, standing: 120, recommended: "20–100 人" },
    features: ["自然採光", "開放式活動動線", "餐車與市集友善", "室內外彈性串聯"],
    suitableFor: ["展覽與市集", "音樂與表演", "品牌活動", "公司或團體聚會"],
    facilities: ["基礎音響", "活動桌椅", "接待桌", "延長線與電源", "無線網路"],
    services: ["場地配置討論", "進撤場動線確認", "基礎清潔", "現場交接"],
    plans: [
      { id: "oasis-half", name: "半日方案", duration: "4 小時", price: "NT$ 6,000 起", note: "適合快閃、拍攝與小型聚會" },
      { id: "oasis-full", name: "全日方案", duration: "8 小時", price: "NT$ 11,000 起", note: "適合市集、演出與品牌活動" },
      { id: "oasis-custom", name: "專案方案", duration: "依需求", price: "另行報價", note: "大型配置、跨日或特殊進撤場" }
    ],
    unavailableWeekdays: [2],
    unavailableDates: ["2026-08-04", "2026-08-11", "2026-08-18"],
    occupiedSlots: [
      { date: "2026-07-25", start: "12:00", end: "21:00" },
      { date: "2026-08-16", start: "13:00", end: "17:00" }
    ]
  },
  {
    id: "venue-donghai",
    slug: "donghai-hall",
    name: "東海館",
    shortName: "東海館",
    status: "active",
    venueType: "室內會議場地",
    public: true,
    rentableHours: { start: "09:00", end: "21:00" },
    internalNotes: "Demo：基本配置 4 張桌子、8 張椅子。",
    equipmentInventory: { 桌子: 4, 椅子: 8, 投影機: 1, 投影筆: 1, 音響: 1, 麥克風: 2, 延長線: 4, 白板: 1 },
    summary: "適合會議、教育訓練、讀書會與小型課程的室內空間。",
    description: "東海館提供安靜、易調整的會議與教學環境。",
    image: "https://picsum.photos/1200/720?random=57",
    gallery: ["https://picsum.photos/800/600?random=58"],
    capacity: { seated: 24, standing: 36, recommended: "8–30 人" },
    features: ["室內空調", "彈性桌椅", "會議白板", "投影設備"],
    suitableFor: ["會議", "教育訓練", "課程", "讀書會"],
    facilities: ["投影機", "白板", "音響", "麥克風", "延長線"],
    services: ["場地配置討論", "設備測試", "基礎清潔", "現場交接"],
    plans: [{ id: "donghai-half", name: "半日方案", duration: "4 小時", price: "NT$ 4,000 起", note: "適合會議與小型課程" }],
    unavailableWeekdays: [],
    unavailableDates: [],
    occupiedSlots: []
  }
];

export const rentalRules = {
  overtime: [
    "超出方案時間 30 分鐘以上，以每小時計費並於活動前確認。",
    "需延長至隔日撤場時，依跨日專案方案重新估價。",
    "未經確認的臨時加時，場地方可依後續檔期狀況婉拒。"
  ],
  notices: [
    "送出詢問不代表完成預訂，須待 NXSPACE 聯絡並確認檔期。",
    "活動內容、噪音、餐飲及佈置方式須於確認前完整說明。",
    "使用者應維護場地與設備，特殊清潔或損壞可能另行計費。",
    "禁止違法、危險或未經許可的商業行為。"
  ],
  process: [
    { title: "選擇場地與日期", description: "確認人數、活動形式與預計時段。" },
    { title: "送出租借詢問", description: "填寫聯絡與活動資料並取得申請編號。" },
    { title: "場地方聯絡確認", description: "確認檔期、設備、配置與正式報價。" },
    { title: "完成預訂", description: "依確認內容完成後續程序與活動準備。" }
  ],
  faqs: [
    { question: "送出表單就算預訂成功嗎？", answer: "不是。表單送出後狀態為已送出，需由 NXSPACE 聯絡確認檔期與內容。" },
    { question: "可以租借多天嗎？", answer: "可以。請選擇日期區間並於活動說明填寫每日使用方式，將以專案方案評估。" },
    { question: "可以自備設備或餐飲嗎？", answer: "可以提出需求，但須事先說明用電、音量、進撤場與清潔方式。" },
    { question: "如何查詢申請進度？", answer: "使用申請編號搭配 Email 或電話末四碼，即可在公開查詢頁查看目前狀態。" }
  ]
};

export function getVenueBySlug(slug = "") {
  return venues.find((venue) => venue.slug === slug);
}

export function getVenueById(id = "") {
  return venues.find((venue) => venue.id === id);
}
