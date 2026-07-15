/**
 * @file main-layout.js
 * @description Main layout component for NXSPACE Platform Beta V1.
 * @module layouts/main-layout
 */

/**
 * Creates the main layout structure of the application.
 * @returns {HTMLDivElement} The main layout DOM element containing header, main, and footer sections.
 */
export function createMainLayout() {
  const layout = document.createElement('div');
  layout.id = 'app-layout';
  layout.innerHTML = `
<header id="site-header"></header>
<main id="page-container"></main>
<footer id="site-footer"></footer>
  `.trim();
  return layout;
}