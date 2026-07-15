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
      <header id="site-header"></header>
      <main id="page-container"></main>
      <footer id="site-footer"></footer>
    </div>
  `;
}