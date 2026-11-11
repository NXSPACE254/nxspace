import { createHero } from "../components/hero.js";
import { createSection } from "../components/section.js";
import { createEventCard } from "../components/event-card.js";
import { createVendorCard } from "../components/vendor-card.js";
import { createProductCard } from "../components/product-card.js";
import { createQuickEntryCard } from "../components/quick-entry-card.js";
import {
  homeBanner,
  heroContent,
  quickEntries,
  activities,
  vendors,
  products,
  venue
} from "../data/home-data.js";

function createDetailLink(href, label) {
  return `<a class="text-link" href="${href}" data-route-link>${label} →</a>`;
}

export function createHome() {
  const bannerContent = homeBanner ? `
    <aside class="home-banner" aria-label="最新消息">
      <div class="page-container home-banner-inner">
        <span>${homeBanner.eyebrow}</span>
        <strong>${homeBanner.title}</strong>
        <p>${homeBanner.description}</p>
        <a href="${homeBanner.href}" data-route-link>${homeBanner.label} →</a>
      </div>
    </aside>
  ` : "";

  const quickEntryContent = `
    <div class="quick-entry-grid">
      ${quickEntries.map((entry) => createQuickEntryCard(entry)).join("")}
    </div>
  `;

  const activityCards = `
    <div class="home-event-grid">
      ${activities.slice(0, 3).map((activity) => createEventCard({
        ...activity,
        footer: createDetailLink(`#activities/${activity.slug}`, "查看活動")
      })).join("")}
    </div>
    <div class="section-more">
      <a class="btn btn-secondary" href="#activities" data-route-link>查看全部活動</a>
    </div>
  `;

  const vendorCards = `
    <div class="home-event-grid">
      ${vendors.slice(0, 3).map((vendor) => createVendorCard({
        ...vendor,
        footer: createDetailLink(`#vendors/${vendor.slug}`, "認識品牌")
      })).join("")}
    </div>
    <div class="section-more">
      <a class="btn btn-secondary" href="#vendors" data-route-link>查看全部商家</a>
    </div>
  `;

  const productCards = `
    <div class="home-event-grid">
      ${products.slice(0, 3).map((product) => createProductCard({
        ...product,
        footer: createDetailLink(`#products/${product.slug}`, "查看商品")
      })).join("")}
    </div>
    <div class="section-more">
      <a class="btn btn-secondary" href="#products" data-route-link>查看全部商品</a>
    </div>
  `;

  const venueContent = `
    <div class="home-venue-card">
      <img src="${venue.image}" alt="${venue.name}" width="1200" height="720" loading="lazy" decoding="async">
      <div>
        <p class="page-eyebrow">VENUE RENTAL</p>
        <h3>${venue.name}</h3>
        <p>${venue.summary}</p>
        <a class="btn btn-primary" href="#venue" data-route-link>查看場地介紹</a>
      </div>
    </div>
  `;

  return `
    <div class="home">
      ${bannerContent}

      ${createHero(heroContent)}

      ${createSection({
        title: "快速入口",
        subtitle: "快速前往 NXSPACE 各項服務",
        content: quickEntryContent
      })}

      ${createSection({
        title: "近期活動",
        subtitle: "探索最新活動",
        content: activityCards
      })}

      ${createSection({
        title: "合作商家",
        subtitle: "探索特色品牌",
        content: vendorCards
      })}

      ${createSection({
        title: "精選商品",
        subtitle: "探索 NXSPACE 熱門商品",
        content: productCards
      })}

      ${createSection({
        title: "讓空間承接下一個想法",
        subtitle: "講座、工作坊、品牌活動與聚會，都能找到合適配置。",
        content: venueContent
      })}
    </div>
  `.trim();
}
