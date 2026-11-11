import { createEventCard } from "../components/event-card.js";
import { activities } from "../data/home-data.js";
import {
  createCatalogPage,
  createDetailPage,
  initializeCatalogPage
} from "./catalog-page.js";

function createActivityCard(activity) {
  return createEventCard({
    ...activity,
    footer: `<a class="text-link" href="#activities/${activity.slug}" data-route-link>查看活動詳情 →</a>`
  });
}

export function createActivitiesPage() {
  return createCatalogPage({
    id: "activities",
    eyebrow: "EVENTS",
    title: "近期活動",
    description: "從市集、展覽到講座與演出，找到下一次與台東相遇的方式。",
    items: activities,
    renderCard: createActivityCard,
    searchLabel: "搜尋活動",
    sortOptions: [
      { value: "date-asc", label: "日期由近到遠" },
      { value: "date-desc", label: "日期由遠到近" },
      { value: "title", label: "名稱排序" }
    ]
  });
}

export function initializeActivitiesPage() {
  initializeCatalogPage({
    id: "activities",
    items: activities,
    renderCard: createActivityCard,
    sorters: {
      "date-asc": (a, b) => a.sortDate.localeCompare(b.sortDate),
      "date-desc": (a, b) => b.sortDate.localeCompare(a.sortDate),
      title: (a, b) => a.title.localeCompare(b.title, "zh-Hant-TW")
    }
  });
}

export function createActivityDetailPage(slug = "") {
  const activity = activities.find((item) => item.slug === slug);

  return createDetailPage({
    eyebrow: activity?.tag || "EVENT",
    item: activity,
    backHref: "#activities",
    backLabel: "返回活動列表",
    meta: activity ? [
      { label: "日期", value: activity.date },
      { label: "時間", value: activity.time },
      { label: "地點", value: activity.location }
    ] : [],
    action: '<a class="btn btn-primary" href="#contact" data-route-link>洽詢活動資訊</a>'
  });
}

export function getActivityBySlug(slug = "") {
  return activities.find((item) => item.slug === slug);
}
