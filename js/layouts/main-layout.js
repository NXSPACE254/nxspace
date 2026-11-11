/**
 * ==========================================================================
 * File: js/layouts/main-layout.js
 * Project: NXSPACE Platform
 * Description: Main Layout Component.
 *              Generates the main application layout.
 * Version: 1.0
 * ==========================================================================
 */

/**
 * 建立主版面 Layout。
 *
 * @returns {string}
 */
export function createMainLayout() {
  return `
    <div id="app-layout">
      <a class="skip-link" href="#page-container">跳至主要內容</a>
      <div id="site-header"></div>
      <main id="page-container" tabindex="-1"></main>
      <footer id="site-footer"></footer>
    </div>
  `.trim();
}
