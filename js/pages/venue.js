import {
  rentalRules,
  venues,
  getVenueBySlug
} from "../data/venue-data.js";
import { createPageHeader } from "./catalog-page.js";

function createVenueCard(venue) {
  return `
    <article class="venue-card">
      <img src="${venue.image}" alt="${venue.name}" width="1200" height="720" loading="lazy" decoding="async">
      <div class="venue-card-body">
        <p class="page-eyebrow">${venue.capacity.recommended}</p>
        <h2>${venue.name}</h2>
        <p>${venue.summary}</p>
        <ul class="compact-feature-list">
          ${venue.features.slice(0, 3).map((feature) => `<li>${feature}</li>`).join("")}
        </ul>
        <div class="button-group">
          <a class="btn btn-primary" href="#venue/${venue.slug}" data-route-link>查看場地</a>
          <a class="btn btn-secondary" href="#venue/apply/${venue.slug}" data-route-link>提出申請</a>
        </div>
      </div>
    </article>
  `.trim();
}

function createProcessAndFaq() {
  return `
    <section class="rental-information page-container">
      <div>
        <p class="page-eyebrow">PROCESS</p>
        <h2>租借流程</h2>
        <ol class="process-list">
          ${rentalRules.process.map((step, index) => `
            <li>
              <span>${String(index + 1).padStart(2, "0")}</span>
              <div><h3>${step.title}</h3><p>${step.description}</p></div>
            </li>
          `.trim()).join("")}
        </ol>
      </div>
      <div>
        <p class="page-eyebrow">FAQ</p>
        <h2>常見問題</h2>
        <div class="faq-list">
          ${rentalRules.faqs.map((item) => `
            <details>
              <summary>${item.question}</summary>
              <p>${item.answer}</p>
            </details>
          `.trim()).join("")}
        </div>
      </div>
    </section>
  `;
}

export function createVenuePage() {
  return `
    <div class="public-page venue-page">
      ${createPageHeader({
        eyebrow: "VENUE RENTAL",
        title: "找到適合活動的空間",
        description: "從室內講座、品牌活動到戶外感市集，鐵花館與綠洲場提供不同節奏的場地選擇。"
      })}
      <div class="page-container venue-card-grid">
        ${venues.map(createVenueCard).join("")}
      </div>
      ${createProcessAndFaq()}
      <section class="page-container rental-callout">
        <div>
          <p class="page-eyebrow">START A CONVERSATION</p>
          <h2>已有日期與活動想法？</h2>
          <p>先送出詢問取得申請編號，NXSPACE 將再與你確認檔期與細節。</p>
        </div>
        <div class="button-group">
          <a class="btn btn-primary" href="#venue/apply" data-route-link>開始租借詢問</a>
          <a class="btn btn-secondary" href="#lookup" data-route-link>查詢申請進度</a>
        </div>
      </section>
    </div>
  `.trim();
}

export function createVenueDetailPage(slug = "") {
  const venue = getVenueBySlug(slug);

  if (!venue) {
    return "";
  }

  return `
    <article class="public-page venue-detail-page">
      <div class="page-container detail-breadcrumb">
        <a class="text-link" href="#venue" data-route-link>← 返回場地列表</a>
      </div>
      <header class="page-container venue-detail-hero">
        <div>
          <p class="page-eyebrow">VENUE</p>
          <h1>${venue.name}</h1>
          <p>${venue.description}</p>
          <div class="button-group">
            <a class="btn btn-primary" href="#venue/apply/${venue.slug}" data-route-link>選擇此場地</a>
            <a class="btn btn-secondary" href="#contact" data-route-link>聯絡詢問</a>
          </div>
        </div>
        <img src="${venue.image}" alt="${venue.name}" width="1200" height="720" loading="lazy" decoding="async">
      </header>

      <div class="page-container venue-spec-grid">
        <section class="prose-card"><h2>場地特色</h2><ul class="feature-list">${venue.features.map((item) => `<li>${item}</li>`).join("")}</ul></section>
        <section class="prose-card"><h2>適用活動</h2><ul class="feature-list">${venue.suitableFor.map((item) => `<li>${item}</li>`).join("")}</ul></section>
        <section class="prose-card"><h2>設備</h2><ul class="feature-list">${venue.facilities.map((item) => `<li>${item}</li>`).join("")}</ul></section>
        <section class="prose-card"><h2>服務</h2><ul class="feature-list">${venue.services.map((item) => `<li>${item}</li>`).join("")}</ul></section>
      </div>

      <section class="page-container rental-plans">
        <div class="section-heading"><p class="page-eyebrow">PLANS</p><h2>租借方案</h2><p>實際費用依活動內容、日期、設備與進撤場需求確認。</p></div>
        <div class="rental-plan-grid">
          ${venue.plans.map((plan) => `
            <article class="rental-plan-card">
              <p>${plan.duration}</p><h3>${plan.name}</h3><strong>${plan.price}</strong><span>${plan.note}</span>
            </article>
          `.trim()).join("")}
        </div>
      </section>

      <div class="page-container rental-rule-grid">
        <section class="prose-card"><h2>加時與加日</h2><ul class="feature-list">${rentalRules.overtime.map((item) => `<li>${item}</li>`).join("")}</ul></section>
        <section class="prose-card"><h2>注意事項</h2><ul class="feature-list">${rentalRules.notices.map((item) => `<li>${item}</li>`).join("")}</ul></section>
      </div>

      ${createProcessAndFaq()}
    </article>
  `.trim();
}
