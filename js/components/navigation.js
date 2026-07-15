/**
 * @file navigation.js
 * @description Navigation component for NXSPACE Platform Beta V1.
 * @module components/navigation
 */

/**
 * Creates the navigation links HTML structure.
 * @returns {string} The HTML string representing the navigation bar.
 */
export function createNavigation() {
  return `
<nav class="navigation">
  <a href="#home">首頁</a>
  <a href="#activities">活動</a>
  <a href="#vendors">商家</a>
  <a href="#order">訂餐</a>
</nav>
  `.trim();
}