import { getAdminEntryUrl } from "../config/environment.js";

/**
 * @file footer.js
 * @description Settings-driven public footer component.
 * @module components/footer
 */

function createValueList(items = []) {
  return items.map(({ label = "", value = "", href = "" }) => `
    <li class="footer-list-item">
      <span class="footer-item-label">${label}</span>
      ${href
        ? `<a class="footer-link" href="${href}">${value}</a>`
        : `<span>${value}</span>`}
    </li>
  `.trim()).join("");
}

function createLinkList(items = []) {
  return items.map(({ label = "", href = "#home" }) => `
    <li>
      <a class="footer-link" href="${href}">${label}</a>
    </li>
  `.trim()).join("");
}

export function createFooter({
  brandName = "NXSPACE",
  description = "",
  contact = [],
  venue = [],
  social = [],
  legal = []
} = {}) {
  const currentYear = new Date().getFullYear();

  return `
    <div class="footer-container">
      <div class="footer-grid">
        <div class="footer-brand">
          <a class="footer-logo" href="#home" aria-label="${brandName} 首頁">
            ${brandName}
          </a>
          <p class="footer-description">${description}</p>
        </div>

        <section class="footer-group" aria-labelledby="footer-contact-title">
          <h2 id="footer-contact-title" class="footer-heading">聯絡我們</h2>
          <ul class="footer-list">${createValueList(contact)}</ul>
        </section>

        <section class="footer-group" aria-labelledby="footer-venue-title">
          <h2 id="footer-venue-title" class="footer-heading">場地資訊</h2>
          <ul class="footer-list">${createValueList(venue)}</ul>
        </section>

        <section class="footer-group" aria-labelledby="footer-social-title">
          <h2 id="footer-social-title" class="footer-heading">關注 NXSPACE</h2>
          <ul class="footer-list footer-link-list">${createLinkList(social)}</ul>
        </section>
      </div>

      <div class="footer-bottom">
        <p>© ${currentYear} ${brandName}. All rights reserved.</p>
        <div class="footer-admin-entry">
          <a class="footer-link" href="${getAdminEntryUrl()}">商店登入</a>
          <small>合作商家與管理人員入口</small>
        </div>
        <nav aria-label="法律資訊">
          <ul class="footer-legal">${createLinkList(legal)}</ul>
        </nav>
      </div>
    </div>
  `.trim();
}
