/**
 * @file app.js
 * @description Application entry point and orchestrator for NXSPACE Platform Beta V1.
 * @module app
 */

import { createMainLayout } from "./layouts/main-layout.js";
import { createHeader } from "./components/header.js";
import { createFooter } from "./components/footer.js";
import { createNavigation } from "./components/navigation.js";
import { createHome } from "./pages/home.js";
import { initializeRouter } from "./router/router.js";
import { render } from "./utils/dom.js";

/**
 * Initializes the application and renders components sequentially.
 * @returns {void}
 */
function initializeApp() {
  // 1. 取得 app 容器
  const app = document.getElementById("app");

  // 2. 渲染 MainLayout
  render(app, createMainLayout());

  // 3. 取得 Layout 內各個主要節點
  const siteHeader = document.getElementById("site-header");
  const pageContainer = document.getElementById("page-container");
  const siteFooter = document.getElementById("site-footer");

  // 4. 渲染 Header
  render(siteHeader, createHeader());

  // 5. Header 建立後取得 navigation 容器
  const headerNavigation = document.querySelector(".header-navigation");

  // 6. 渲染 Navigation
  render(headerNavigation, createNavigation());

  // 7. 渲染 Home 頁面
  render(pageContainer, createHome());

  // 8. 渲染 Footer
  render(siteFooter, createFooter());

  // 9. 初始化 Router
  initializeRouter();
}

// 10. DOMContentLoaded 呼叫 initializeApp
document.addEventListener("DOMContentLoaded", initializeApp);