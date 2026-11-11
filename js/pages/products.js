import { createProductCard } from "../components/product-card.js";
import { products } from "../data/home-data.js";
import {
  createCatalogPage,
  createDetailPage,
  initializeCatalogPage
} from "./catalog-page.js";

function createProductListCard(product) {
  return createProductCard({
    ...product,
    footer: `<a class="text-link" href="#products/${product.slug}" data-route-link>查看商品 →</a>`
  });
}

export function createProductsPage() {
  return createCatalogPage({
    id: "products",
    eyebrow: "PRODUCTS",
    title: "精選商品",
    description: "從咖啡、餐點到地方選物，發現 NXSPACE 的日常推薦。",
    items: products,
    renderCard: createProductListCard,
    searchLabel: "搜尋商品",
    sortOptions: [
      { value: "price-asc", label: "價格由低到高" },
      { value: "price-desc", label: "價格由高到低" },
      { value: "title", label: "名稱排序" }
    ]
  });
}

export function initializeProductsPage() {
  initializeCatalogPage({
    id: "products",
    items: products,
    renderCard: createProductListCard,
    sorters: {
      "price-asc": (a, b) => a.priceValue - b.priceValue,
      "price-desc": (a, b) => b.priceValue - a.priceValue,
      title: (a, b) => a.title.localeCompare(b.title, "zh-Hant-TW")
    }
  });
}

export function createProductDetailPage(slug = "") {
  const product = products.find((item) => item.slug === slug);

  return createDetailPage({
    eyebrow: product?.tag || "PRODUCT",
    item: product,
    backHref: "#products",
    backLabel: "返回商品列表",
    meta: product ? [
      { label: "價格", value: product.price },
      { label: "品牌", value: product.vendor },
      { label: "供應狀態", value: product.availability }
    ] : [],
    action: '<a class="btn btn-primary" href="#contact" data-route-link>洽詢商品</a>'
  });
}

export function getProductBySlug(slug = "") {
  return products.find((item) => item.slug === slug);
}
