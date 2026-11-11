/**
 * @file navigation.js
 * @description Responsive primary navigation component and interactions.
 * @module components/navigation
 */

import { getAdminEntryUrl } from "../config/environment.js";

const MOBILE_NAVIGATION_QUERY = "(max-width: 64rem)";
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function normalizeHash(hash = "") {
  return hash || "#home";
}

function createNavigationLink({ label = "", href = "#home" } = {}) {
  return `
    <a class="navigation-link" href="${href}" data-navigation-link>
      ${label}
    </a>
  `.trim();
}

export function createNavigation({ items = [] } = {}) {
  return `
    <nav
      id="primary-navigation"
      class="navigation"
      aria-label="主要導覽"
      data-navigation>
      <div class="navigation-panel-header">
        <span class="navigation-panel-title">選單</span>
        <button
          class="navigation-close"
          type="button"
          aria-label="關閉主選單"
          data-navigation-close>
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <div class="navigation-links">
        ${items.map((item) => createNavigationLink(item)).join("")}
      </div>

      <div class="navigation-panel-action">
        <a class="btn btn-secondary" href="${getAdminEntryUrl()}">商店登入</a>
        <small>合作商家與管理人員入口</small>
      </div>
    </nav>
  `.trim();
}

export function initializeNavigation() {
  const header = document.querySelector("[data-header]");
  const navigation = document.querySelector("[data-navigation]");
  const toggle = document.querySelector("[data-navigation-toggle]");
  const closeButton = document.querySelector("[data-navigation-close]");
  const backdrop = document.querySelector("[data-navigation-backdrop]");
  const links = Array.from(document.querySelectorAll("[data-navigation-link]"));
  const routeLinks = Array.from(navigation.querySelectorAll('a[href^="#"]'));
  const mobileQuery = window.matchMedia(MOBILE_NAVIGATION_QUERY);

  if (!header || !navigation || !toggle || !closeButton || !backdrop) {
    console.error("[NXSPACE] Navigation controls are incomplete.");
    return;
  }

  let isOpen = false;

  function updateActiveLink() {
    const currentHash = normalizeHash(window.location.hash);

    links.forEach((link) => {
      const linkHash = link.getAttribute("href");
      const isActive = linkHash === currentHash || currentHash.startsWith(`${linkHash}/`);
      link.classList.toggle("is-active", isActive);

      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function closeNavigation({ restoreFocus = true } = {}) {
    if (!isOpen) {
      return;
    }

    isOpen = false;
    header.classList.remove("is-navigation-open");
    document.body.classList.remove("is-navigation-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.querySelector(".visually-hidden").textContent = "開啟主選單";
    backdrop.hidden = true;

    if (restoreFocus) {
      toggle.focus({ preventScroll: true });
    }
  }

  function openNavigation() {
    if (isOpen || !mobileQuery.matches) {
      return;
    }

    isOpen = true;
    header.classList.add("is-navigation-open");
    document.body.classList.add("is-navigation-open");
    toggle.setAttribute("aria-expanded", "true");
    toggle.querySelector(".visually-hidden").textContent = "關閉主選單";
    backdrop.hidden = false;
    closeButton.focus({ preventScroll: true });
  }

  function handleMenuKeydown(event) {
    if (!isOpen) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeNavigation();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const focusableElements = Array.from(
      navigation.querySelectorAll(FOCUSABLE_SELECTOR)
    ).filter((element) => !element.hasAttribute("hidden"));

    if (focusableElements.length === 0) {
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  toggle.addEventListener("click", () => {
    if (isOpen) {
      closeNavigation();
    } else {
      openNavigation();
    }
  });

  closeButton.addEventListener("click", () => closeNavigation());
  backdrop.addEventListener("click", () => closeNavigation());

  document.addEventListener("pointerdown", (event) => {
    if (
      isOpen &&
      !navigation.contains(event.target) &&
      !toggle.contains(event.target)
    ) {
      closeNavigation();
    }
  });

  document.addEventListener("keydown", handleMenuKeydown);

  routeLinks.forEach((link) => {
    link.addEventListener("click", () => {
      updateActiveLink();

      if (isOpen) {
        closeNavigation({ restoreFocus: false });
        window.requestAnimationFrame(() => {
          document.getElementById("page-container")?.focus({ preventScroll: true });
        });
      }
    });
  });

  window.addEventListener("hashchange", updateActiveLink);
  window.addEventListener("nxspace:routechange", updateActiveLink);

  mobileQuery.addEventListener("change", (event) => {
    if (!event.matches) {
      closeNavigation({ restoreFocus: false });
    }
  });

  updateActiveLink();
}
