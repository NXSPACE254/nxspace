import { createVendorCard } from "../components/vendor-card.js";
import { vendors } from "../data/home-data.js";
import {
  createCatalogPage,
  createDetailPage,
  initializeCatalogPage
} from "./catalog-page.js";

function createVendorListCard(vendor) {
  return createVendorCard({
    ...vendor,
    footer: `<a class="text-link" href="#vendors/${vendor.slug}" data-route-link>認識品牌 →</a>`
  });
}

export function createVendorsPage() {
  return createCatalogPage({
    id: "vendors",
    eyebrow: "PARTNERS",
    title: "合作商家",
    description: "認識在 NXSPACE 相遇的餐飲、選物與地方品牌。",
    items: vendors,
    renderCard: createVendorListCard,
    searchLabel: "搜尋商家",
    sortOptions: [
      { value: "title", label: "品牌名稱 A–Z" },
      { value: "title-desc", label: "品牌名稱 Z–A" }
    ]
  });
}

export function initializeVendorsPage() {
  initializeCatalogPage({
    id: "vendors",
    items: vendors,
    renderCard: createVendorListCard,
    sorters: {
      title: (a, b) => a.title.localeCompare(b.title, "zh-Hant-TW"),
      "title-desc": (a, b) => b.title.localeCompare(a.title, "zh-Hant-TW")
    }
  });
}

export function createVendorDetailPage(slug = "") {
  const vendor = vendors.find((item) => item.slug === slug);

  return createDetailPage({
    eyebrow: vendor?.tag || "PARTNER",
    item: vendor,
    backHref: "#vendors",
    backLabel: "返回商家列表",
    meta: vendor ? [
      { label: "類別", value: vendor.tag },
      { label: "地點", value: vendor.location },
      { label: "營業時間", value: vendor.hours }
    ] : [],
    action: '<a class="btn btn-primary" href="#products" data-route-link>查看精選商品</a>'
  });
}

export function getVendorBySlug(slug = "") {
  return vendors.find((item) => item.slug === slug);
}
