/**
 * Public fixture data used by the local frontend.
 * Package 08 will place the same contracts behind repository adapters.
 */

function readManagedCollection(type, fallback) {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(`nxspace.beta.v1.dashboard.${type}`) || "null");
    return Array.isArray(value) ? value.filter((item) => item.status === "published") : fallback;
  } catch {
    return fallback;
  }
}

const defaultHomeBanner = {
  eyebrow: "NXSPACE UPDATE",
  title: "台東生活提案，從一個空間開始",
  description: "活動、市集、品牌合作與場地體驗，持續在 NXSPACE 發生。",
  label: "探索近期活動",
  href: "#activities"
};

export const homeBanner = readManagedCollection("banners", [defaultHomeBanner])[0] || null;

export const heroContent = {
  eyebrow: "TODAY AT NXSPACE",
  title: "探索城市生活",
  description: "探索台東活動、特色商家、美食與生活體驗。",
  primaryAction: { label: "探索精選商品", href: "#products" },
  secondaryAction: { label: "查看近期活動", href: "#activities" },
  highlights: [
    {
      label: "TODAY",
      title: "🍕 TO THE PIZZA",
      lines: ["11:30－20:00", "NXSPACE 綠洲場", "現正供應中"]
    },
    {
      label: "NEXT EVENT",
      title: "🎪 夏日市集",
      lines: ["2026 / 07 / 25", "NXSPACE 鐵花館", "超過 20 個品牌參與"]
    }
  ]
};

export const quickEntries = [
  {
    icon: "🍕",
    title: "今日餐車",
    description: "查看今日餐車品牌、菜單與供應時間。",
    href: "#products"
  },
  {
    icon: "☕",
    title: "合作商家",
    description: "探索在地品牌與特色店家。",
    href: "#vendors"
  },
  {
    icon: "🎪",
    title: "最新活動",
    description: "市集、展覽、演出與期間限定活動。",
    href: "#activities"
  },
  {
    icon: "📅",
    title: "場地租借",
    description: "教育訓練、講座、聚會與活動空間。",
    href: "#venue"
  }
];

export const activities = readManagedCollection("activities", [
  {
    id: "event-001",
    slug: "summer-market",
    image: "https://picsum.photos/800/450?random=11",
    tag: "活動",
    title: "夏日市集",
    description: "探索在地品牌、美食與手作市集。",
    content: "集結台東在地飲食、選物與手作品牌，在午後到夜晚之間展開一場輕鬆的城市聚會。",
    date: "2026 / 07 / 25",
    time: "14:00－20:00",
    location: "NXSPACE 綠洲場",
    sortDate: "2026-07-25"
  },
  {
    id: "event-002",
    slug: "local-art-exhibition",
    image: "https://picsum.photos/800/450?random=12",
    tag: "展覽",
    title: "藝術創作展",
    description: "欣賞在地藝術家的精彩作品。",
    content: "以台東日常、地景與人的故事為主題，呈現不同媒材創作者的近期作品。",
    date: "2026 / 08 / 02",
    time: "10:00－18:00",
    location: "NXSPACE 鐵花館",
    sortDate: "2026-08-02"
  },
  {
    id: "event-003",
    slug: "daily-food-truck",
    image: "https://picsum.photos/800/450?random=13",
    tag: "餐車",
    title: "今日餐車",
    description: "每日不同品牌，限量供應。",
    content: "每日邀請不同餐飲品牌進駐，供應內容與時間依現場公告為準。",
    date: "每日供應",
    time: "11:30 起",
    location: "NXSPACE",
    sortDate: "2026-07-16"
  },
  {
    id: "event-004",
    slug: "taitung-coffee-talk",
    image: "https://picsum.photos/800/450?random=14",
    tag: "講座",
    title: "台東咖啡風土講座",
    description: "從產地到沖煮，認識台東咖啡的風味。",
    content: "由咖啡職人分享產區、處理法與沖煮變因，現場包含小型風味體驗。",
    date: "2026 / 08 / 09",
    time: "15:00－17:00",
    location: "NXSPACE 共創廳",
    sortDate: "2026-08-09"
  },
  {
    id: "event-005",
    slug: "slow-living-workshop",
    image: "https://picsum.photos/800/450?random=15",
    tag: "工作坊",
    title: "慢生活手作課",
    description: "用雙手完成一件陪伴日常的小作品。",
    content: "適合初學者的兩小時手作體驗，材料與工具由講師準備。",
    date: "2026 / 08 / 16",
    time: "14:00－16:00",
    location: "NXSPACE 共創廳",
    sortDate: "2026-08-16"
  },
  {
    id: "event-006",
    slug: "acoustic-night",
    image: "https://picsum.photos/800/450?random=16",
    tag: "演出",
    title: "島嶼不插電夜",
    description: "在城市夜色裡聽見溫柔的現場演出。",
    content: "邀請台東音樂人帶來不插電演出，席次有限，建議提早抵達。",
    date: "2026 / 08 / 22",
    time: "19:00－21:00",
    location: "NXSPACE 綠洲場",
    sortDate: "2026-08-22"
  },
  {
    id: "event-007",
    slug: "brand-meetup",
    image: "https://picsum.photos/800/450?random=17",
    tag: "交流",
    title: "地方品牌交流日",
    description: "讓品牌經營者交換經驗與合作靈感。",
    content: "以短講和自由交流組成，歡迎地方品牌、創作者與空間經營者參加。",
    date: "2026 / 09 / 05",
    time: "13:30－17:30",
    location: "NXSPACE 鐵花館",
    sortDate: "2026-09-05"
  }
]);

export const vendors = readManagedCollection("vendors", [
  {
    id: "vendor-001",
    slug: "cama-cafe",
    image: "https://picsum.photos/600?random=21",
    tag: "咖啡",
    title: "CAMA CAFE",
    description: "精品咖啡與輕食。",
    content: "提供穩定而清爽的咖啡體驗，適合工作、交流與短暫停留。",
    location: "NXSPACE 綠洲場",
    hours: "每日 09:00－18:00"
  },
  {
    id: "vendor-002",
    slug: "to-the-pizza",
    image: "https://picsum.photos/600?random=22",
    tag: "披薩",
    title: "TO THE PIZZA",
    description: "現烤手工披薩。",
    content: "以現擀麵糰和簡單配料呈現剛出爐的香氣，品項依當日供應調整。",
    location: "NXSPACE 綠洲場",
    hours: "週三至週日 11:30－20:00"
  },
  {
    id: "vendor-003",
    slug: "yu-tian-smoke",
    image: "https://picsum.photos/600?random=23",
    tag: "燻肉",
    title: "雨田燻",
    description: "煙燻料理與特色餐點。",
    content: "運用時間與木質香氣製作煙燻料理，供應適合分享的主食與小點。",
    location: "NXSPACE 鐵花館",
    hours: "依活動公告"
  },
  {
    id: "vendor-004",
    slug: "east-coast-bakery",
    image: "https://picsum.photos/600?random=24",
    tag: "烘焙",
    title: "海岸麥房",
    description: "每日少量出爐的天然酵母麵包。",
    content: "使用在地食材與長時間發酵，製作適合日常餐桌的麵包。",
    location: "NXSPACE 快閃區",
    hours: "週末 10:00－售完"
  },
  {
    id: "vendor-005",
    slug: "mountain-tea-room",
    image: "https://picsum.photos/600?random=25",
    tag: "茶飲",
    title: "山海茶席",
    description: "台灣茶與季節風味飲品。",
    content: "用簡潔方式分享不同產區的茶香，也提供適合散步飲用的冷泡茶。",
    location: "NXSPACE 綠洲場",
    hours: "每日 11:00－19:00"
  },
  {
    id: "vendor-006",
    slug: "taitung-select",
    image: "https://picsum.photos/600?random=26",
    tag: "選物",
    title: "台東日常選物",
    description: "地方設計、器物與生活用品。",
    content: "挑選能長久使用的地方物件，讓旅程中的發現回到日常。",
    location: "NXSPACE 鐵花館",
    hours: "每日 10:30－18:30"
  },
  {
    id: "vendor-007",
    slug: "island-gelato",
    image: "https://picsum.photos/600?random=27",
    tag: "甜點",
    title: "島嶼 Gelato",
    description: "以季節水果製作的小批次冰淇淋。",
    content: "依季節使用鳳梨、洛神、柑橘等風味，每週更換供應口味。",
    location: "NXSPACE 快閃區",
    hours: "週五至週日 12:00－19:00"
  }
]);

export const products = readManagedCollection("products", [
  {
    id: "product-001",
    slug: "specialty-americano",
    image: "https://picsum.photos/600?random=31",
    tag: "咖啡",
    title: "精品美式",
    description: "每日新鮮現萃。",
    content: "選用當季精品咖啡豆，呈現乾淨、平衡且適合日常飲用的風味。",
    price: "$120",
    priceValue: 120,
    vendor: "CAMA CAFE",
    availability: "供應中"
  },
  {
    id: "product-002",
    slug: "margherita-pizza",
    image: "https://picsum.photos/600?random=32",
    tag: "披薩",
    title: "瑪格麗特披薩",
    description: "現點現烤。",
    content: "番茄、起司與羅勒組成的經典口味，保留麵糰剛出爐的口感。",
    price: "$280",
    priceValue: 280,
    vendor: "TO THE PIZZA",
    availability: "供應中"
  },
  {
    id: "product-003",
    slug: "smoked-beef",
    image: "https://picsum.photos/600?random=33",
    tag: "燻肉",
    title: "煙燻牛肉",
    description: "每日限量供應。",
    content: "低溫煙燻保留肉汁與香氣，適合單點或搭配當日配菜。",
    price: "$180",
    priceValue: 180,
    vendor: "雨田燻",
    availability: "限量供應"
  },
  {
    id: "product-004",
    slug: "pineapple-cold-brew",
    image: "https://picsum.photos/600?random=34",
    tag: "茶飲",
    title: "鳳梨冷泡茶",
    description: "清爽茶香與台東鳳梨。",
    content: "以冷泡茶為基底加入台東鳳梨風味，甜度清爽。",
    price: "$100",
    priceValue: 100,
    vendor: "山海茶席",
    availability: "供應中"
  },
  {
    id: "product-005",
    slug: "sourdough-loaf",
    image: "https://picsum.photos/600?random=35",
    tag: "烘焙",
    title: "天然酵母鄉村麵包",
    description: "外脆內柔的日常主食。",
    content: "長時間低溫發酵，帶有溫和酸香與小麥甜味。",
    price: "$160",
    priceValue: 160,
    vendor: "海岸麥房",
    availability: "週末供應"
  },
  {
    id: "product-006",
    slug: "taitung-postcard-set",
    image: "https://picsum.photos/600?random=36",
    tag: "選物",
    title: "台東風景明信片組",
    description: "收藏旅途中看見的光與色彩。",
    content: "一組六張，以台東城市與自然地景為主題。",
    price: "$240",
    priceValue: 240,
    vendor: "台東日常選物",
    availability: "供應中"
  },
  {
    id: "product-007",
    slug: "roselle-gelato",
    image: "https://picsum.photos/600?random=37",
    tag: "甜點",
    title: "洛神 Gelato",
    description: "酸甜明亮的季節限定風味。",
    content: "選用台東洛神，以小批次方式製作，售完為止。",
    price: "$130",
    priceValue: 130,
    vendor: "島嶼 Gelato",
    availability: "季節限定"
  }
]);

export const venue = {
  name: "NXSPACE 多功能場域",
  summary: "適合講座、工作坊、品牌活動、展覽與小型聚會的彈性空間。",
  description: "以自然光、留白與可調整家具為基礎，讓每一場活動保有自己的節奏。",
  image: "https://picsum.photos/1200/720?random=41",
  capacity: "建議 10–80 人",
  facilities: ["投影與基礎音響", "彈性桌椅配置", "空調與無線網路", "活動接待區"],
  action: { label: "了解租借方式", href: "#contact" }
};
