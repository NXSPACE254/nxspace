import { getAdminEntryUrl } from "../config/environment.js";

/**
 * @file header.js
 * @description Header component for NXSPACE Platform Beta V1.
 * @module components/header
 */

/**
 * Creates the application header.
 *
 * @returns {string} Header HTML.
 */
export function createHeader({
  name = "NXSPACE",
  tagline = "Platform Beta V1"
} = {}) {
  return `
    <header class="header" data-header>

      <div class="header-container">

        <a class="header-logo" href="#home" aria-label="${name} 首頁">
          <span class="header-logo-title">
            ${name}
          </span>

          <span class="header-logo-subtitle">
            ${tagline}
          </span>
        </a>

        <div class="header-navigation"></div>

        <div class="header-actions">

          <a class="header-login btn btn-secondary" href="${getAdminEntryUrl()}">
            商店登入
          </a>

          <button
            class="navigation-toggle"
            type="button"
            aria-expanded="false"
            aria-controls="primary-navigation"
            data-navigation-toggle>
            <span class="visually-hidden">開啟主選單</span>
            <span class="navigation-toggle-line" aria-hidden="true"></span>
            <span class="navigation-toggle-line" aria-hidden="true"></span>
          </button>

        </div>

      </div>

      <button
        class="navigation-backdrop"
        type="button"
        aria-label="關閉主選單"
        data-navigation-backdrop
        hidden></button>

    </header>
  `.trim();
}
