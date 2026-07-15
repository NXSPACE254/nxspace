/**
 * @file header.js
 * @description Header component for NXSPACE Platform Beta V1.
 * @module components/header
 */

/**
 * Creates the header HTML structure.
 * @returns {string} The HTML string representing the header.
 */
export function createHeader() {
  return `
<div class="header">
  <div class="header-logo">NXSPACE</div>
  <div class="header-navigation"></div>
  <div class="header-user"></div>
</div>
  `.trim();
}