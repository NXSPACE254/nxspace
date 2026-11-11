/**
 * Public, non-sensitive site configuration.
 * Credentials and private endpoints must never be added to this module.
 */
export const publicSiteConfig = Object.freeze({
  brand: {
    name: "NXSPACE",
    tagline: "Platform Beta V1"
  },
  navigation: [
    { label: "首頁", href: "#home" },
    { label: "活動", href: "#activities" },
    { label: "商店", href: "#shops" },
    { label: "線上點餐", href: "#order" },
    { label: "場地", href: "#venue" },
    { label: "關於", href: "#about" },
    { label: "查詢", href: "#lookup" }
  ],
  footer: {
    description: "探索台東活動、特色商家、美食與生活體驗。",
    contact: [
      { label: "聯絡信箱", value: "hello@nxspace.tw", href: "mailto:hello@nxspace.tw" }
    ],
    venue: [
      { label: "服務地區", value: "台東" },
      { label: "場地資訊", value: "即將公布" }
    ],
    social: [
      { label: "社群與品牌合作洽詢", href: "#contact" }
    ],
    legal: [
      { label: "隱私權政策", href: "#privacy" },
      { label: "使用條款", href: "#terms" }
    ]
  }
});
