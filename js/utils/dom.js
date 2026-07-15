/**
 * ==========================================================================
 * File: js/utils/dom.js
 * Project: NXSPACE Platform
 * Description: DOM Utility Functions.
 *              Provides helper methods for rendering HTML into the page.
 * Version: 1.0
 * ==========================================================================
 */

/**
 * 將 HTML 字串渲染到指定容器。
 *
 * @param {HTMLElement} container - 要掛載內容的 DOM 元素
 * @param {string} html - HTML 字串
 */
export function render(container, html) {
  if (!container) {
    console.error("[NXSPACE] Render target not found.");
    return;
  }

  container.innerHTML = html;
}