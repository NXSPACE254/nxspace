import { createHome } from "../pages/home.js";
import {
  createActivitiesPage,
  createActivityDetailPage,
  getActivityBySlug,
  initializeActivitiesPage
} from "../pages/activity.js";
import {
  createVendorsPage,
  createVendorDetailPage,
  getVendorBySlug,
  initializeVendorsPage
} from "../pages/vendors.js";
import {
  createProductsPage,
  createProductDetailPage,
  getProductBySlug,
  initializeProductsPage
} from "../pages/products.js";
import {
  createVenuePage,
  createVenueDetailPage
} from "../pages/venue.js";
import {
  createVenueApplicationPage,
  initializeVenueApplicationPage,
  createRentalConfirmationPage,
  initializeRentalConfirmationPage
} from "../pages/venue-application.js";
import { createAboutPage, createPolicyPage } from "../pages/about.js";
import { createContactPage, initializeContactPage } from "../pages/contact.js";
import { createLookupPage, initializeLookupPage } from "../pages/lookup.js";
import { createOrderPage, initializeOrderPage, createOrderConfirmationPage, initializeOrderConfirmationPage, createShopsPage, createShopPage, initializeShopPage, createCartPage, initializeCartPage } from "../pages/order.js";
import { createRentalInvitationPage, initializeRentalInvitationPage } from "../pages/rental-invitation.js";
import { createRegistrationActivitiesPage, createRegistrationDetailPage, createRegistrationLookupPage, initializeRegistrationPage } from "../pages/registration.js";

const SITE_NAME = "NXSPACE";

function createTitle(pageTitle = "") {
  return pageTitle ? `${pageTitle}｜${SITE_NAME}` : `${SITE_NAME} Platform Beta V1`;
}

export const routeRegistry = [
  {
    path: "#registration",
    title: createTitle("課程與活動報名"),
    description: "查看 NXSPACE 公開課程、活動名額與報名資訊。",
    render: createRegistrationActivitiesPage
  },
  {
    path: "#registration/lookup",
    title: createTitle("報名查詢"),
    description: "使用報名序號與手機號碼查詢自己的活動報名。",
    render: createRegistrationLookupPage,
    afterRender: initializeRegistrationPage
  },
  {
    path: "#registration/:activityId",
    getTitle: () => createTitle("活動報名"),
    description: "NXSPACE 課程與活動公開報名頁。",
    render: ({ activityId }) => createRegistrationDetailPage(activityId),
    afterRender: initializeRegistrationPage
  },
  {
    path: "#home",
    title: createTitle(),
    description: "探索台東活動、特色商家、美食、商品與場地體驗。",
    render: createHome
  },
  {
    path: "#activities",
    title: createTitle("近期活動"),
    description: "瀏覽 NXSPACE 近期市集、展覽、講座與演出。",
    render: createActivitiesPage,
    afterRender: initializeActivitiesPage
  },
  {
    path: "#activities/:slug",
    getTitle: ({ slug }) => createTitle(getActivityBySlug(slug)?.title || "找不到活動"),
    description: "NXSPACE 活動詳細資訊。",
    render: ({ slug }) => createActivityDetailPage(slug)
  },
  {
    path: "#vendors",
    title: createTitle("合作商家"),
    description: "探索 NXSPACE 合作餐飲、選物與地方品牌。",
    render: createVendorsPage,
    afterRender: initializeVendorsPage
  },
  {
    path: "#vendors/:slug",
    getTitle: ({ slug }) => createTitle(getVendorBySlug(slug)?.title || "找不到商家"),
    description: "NXSPACE 合作商家詳細資訊。",
    render: ({ slug }) => createVendorDetailPage(slug)
  },
  {
    path: "#products",
    title: createTitle("精選商品"),
    description: "瀏覽 NXSPACE 精選餐飲、飲品與地方選物。",
    render: createProductsPage,
    afterRender: initializeProductsPage
  },
  {
    path: "#products/:slug",
    getTitle: ({ slug }) => createTitle(getProductBySlug(slug)?.title || "找不到商品"),
    description: "NXSPACE 精選商品詳細資訊。",
    render: ({ slug }) => createProductDetailPage(slug)
  },
  {
    path: "#rental/invite/:token",
    title: createTitle("場租資料填寫"),
    description: "使用 Local Demo 邀請補充場租活動資料。",
    render: ({ token }) => createRentalInvitationPage(token),
    afterRender: initializeRentalInvitationPage
  },
  {
    path: "#venue",
    title: createTitle("場地介紹"),
    description: "認識 NXSPACE 多功能場地、容量與基礎設備。",
    render: createVenuePage
  },
  {
    path: "#venue/apply",
    title: createTitle("場地租借詢問"),
    description: "選擇 NXSPACE 場地、日期與時段並送出租借詢問。",
    render: () => createVenueApplicationPage(),
    afterRender: initializeVenueApplicationPage
  },
  {
    path: "#venue/apply/:slug",
    title: createTitle("場地租借詢問"),
    description: "選擇 NXSPACE 場地、日期與時段並送出租借詢問。",
    render: ({ slug }) => createVenueApplicationPage(slug),
    afterRender: initializeVenueApplicationPage
  },
  {
    path: "#venue/confirmation/:id",
    title: createTitle("租借申請確認"),
    description: "查看 NXSPACE 場地租借申請編號與摘要。",
    render: ({ id }) => createRentalConfirmationPage(id),
    afterRender: initializeRentalConfirmationPage
  },
  {
    path: "#venue/:slug",
    getTitle: ({ slug }) => createTitle(slug === "tiehua-hall" ? "鐵花館" : slug === "oasis-field" ? "綠洲場" : slug === "donghai-hall" ? "東海館" : "找不到場地"),
    description: "NXSPACE 場地特色、設備、方案與租借說明。",
    render: ({ slug }) => createVenueDetailPage(slug)
  },
  {
    path: "#about",
    title: createTitle("關於我們"),
    description: "認識 NXSPACE 與我們關注的地方生活。",
    render: createAboutPage
  },
  {
    path: "#contact",
    title: createTitle("聯絡我們"),
    description: "聯絡 NXSPACE 洽詢活動、品牌、商品與場地合作。",
    render: createContactPage,
    afterRender: initializeContactPage
  },
  {
    path: "#lookup",
    title: createTitle("申請與訂單查詢"),
    description: "使用申請編號安全查詢 NXSPACE 租借申請狀態。",
    render: createLookupPage,
    afterRender: initializeLookupPage
  },
  {
    path: "#privacy",
    title: createTitle("隱私權說明"),
    description: "NXSPACE Beta V1 隱私權基礎說明。",
    render: () => createPolicyPage({ type: "privacy" })
  },
  {
    path: "#terms",
    title: createTitle("使用條款"),
    description: "NXSPACE Beta V1 網站使用條款。",
    render: () => createPolicyPage({ type: "terms" })
  },
  {
    path: "#shops",
    title: createTitle("商店與線上點餐"),
    description: "選擇 NXSPACE 合作商店並預訂餐點。",
    render: createShopsPage
  },
  {
    path: "#shops/:slug/order",
    getTitle: ({ slug }) => createTitle("線上點餐"),
    description: "選擇取餐日期、時段與餐點。",
    render: ({ slug }) => createShopPage(slug),
    afterRender: initializeShopPage
  },
  {
    path: "#shops/:slug",
    getTitle: ({ slug }) => createTitle("商店菜單"),
    description: "查看商店營業資訊、菜單與可預訂時段。",
    render: ({ slug }) => createShopPage(slug),
    afterRender: initializeShopPage
  },
  {
    path: "#order/cart",
    title: createTitle("購物車"),
    description: "確認餐點、取餐時間與顧客資料。",
    render: createCartPage,
    afterRender: initializeCartPage
  },
  {
    path: "#order/confirmation/:id",
    title: createTitle("訂單確認"),
    description: "NXSPACE 商品訂單確認與取貨摘要。",
    render: ({ id }) => createOrderConfirmationPage(id),
    afterRender: initializeOrderConfirmationPage
  },
  {
    path: "#order",
    title: createTitle("商店與線上點餐"),
    description: "從 NXSPACE 合作商店開始選擇餐點。",
    render: createOrderPage,
    afterRender: initializeOrderPage
  }
];
