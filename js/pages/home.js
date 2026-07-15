/**
 * @file home.js
 * @description Home page view component for NXSPACE Platform Beta V1.
 * @module pages/home
 */

/**
 * Creates the home page HTML structure.
 * @returns {string} The HTML string representing the home page section.
 */
export function createHome() {
  return `
<section class="home">
  <h1>NXSPACE Platform</h1>
  <p>Beta Version 1</p>
</section>
  `.trim();
}