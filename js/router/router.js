import { createStateView } from "../components/state-view.js";
import { createNotFoundPage } from "../pages/not-found.js";
import { render } from "../utils/dom.js";
import { routeRegistry } from "./routes.js";

const DEFAULT_HASH = "#home";

function normalizeHash(hash = "") {
  const normalized = hash.trim().split("?")[0].replace(/^#\//, "#") || DEFAULT_HASH;
  return normalized.length > 1 ? normalized.replace(/\/$/, "") : normalized;
}

function createRouteMatcher(path) {
  const parameterNames = [];
  const pattern = path.replace(/:([a-zA-Z0-9_]+)/g, (_, name) => {
    parameterNames.push(name);
    return "([^/]+)";
  });

  return {
    parameterNames,
    regex: new RegExp(`^${pattern}$`)
  };
}

const compiledRoutes = routeRegistry.map((route) => ({
  ...route,
  matcher: createRouteMatcher(route.path)
}));

function matchRoute(hash) {
  for (const route of compiledRoutes) {
    const match = hash.match(route.matcher.regex);

    if (!match) {
      continue;
    }

    const params = route.matcher.parameterNames.reduce((result, name, index) => {
      try {
        result[name] = decodeURIComponent(match[index + 1]);
      } catch {
        result[name] = match[index + 1];
      }
      return result;
    }, {});

    return { route, params };
  }

  return null;
}

function updateDocumentMetadata({ title, description }) {
  document.title = title || "找不到頁面｜NXSPACE";
  const descriptionElement = document.querySelector('meta[name="description"]');

  if (descriptionElement) {
    descriptionElement.setAttribute(
      "content",
      description || "NXSPACE 頁面不存在或尚未公開。"
    );
  }
}

export function initializeRouter({ container } = {}) {
  if (!container) {
    console.error("[NXSPACE] Router container not found.");
    return;
  }

  let renderVersion = 0;
  let scheduledFrame = 0;

  function renderCurrentRoute({ focus = false } = {}) {
    const version = ++renderVersion;
    const sourceHash = window.location.hash;
    const currentHash = normalizeHash(sourceHash);
    const matchedRoute = matchRoute(currentHash);

    render(container, createStateView({
      type: "loading",
      title: "正在載入",
      description: "正在準備頁面內容。",
      headingLevel: "h1"
    }));

    window.requestAnimationFrame(() => {
      if (version !== renderVersion || sourceHash !== window.location.hash) {
        return;
      }

      try {
        if (!matchedRoute) {
          render(container, createNotFoundPage());
          updateDocumentMetadata({
            title: "找不到頁面｜NXSPACE",
            description: "NXSPACE 頁面不存在或尚未公開。"
          });
        } else {
          const { route, params } = matchedRoute;
          const pageContent = route.render(params);

          if (!pageContent) {
            render(container, createNotFoundPage());
            updateDocumentMetadata({
              title: "找不到內容｜NXSPACE",
              description: "指定的 NXSPACE 內容不存在或尚未公開。"
            });
          } else {
            render(container, pageContent);
            updateDocumentMetadata({
              title: route.getTitle ? route.getTitle(params) : route.title,
              description: route.description
            });
            route.afterRender?.(params);
          }
        }

        window.dispatchEvent(new CustomEvent("nxspace:routechange", {
          detail: { hash: currentHash }
        }));

        if (focus) {
          container.focus({ preventScroll: true });
          window.scrollTo({ top: 0, behavior: "auto" });
        }
      } catch (error) {
        console.error("[NXSPACE] Route rendering failed.", error);
        render(container, createStateView({
          type: "error",
          title: "頁面載入失敗",
          description: "請重新整理頁面，或返回首頁後再試一次。",
          action: '<a class="btn btn-primary" href="#home" data-route-link>返回首頁</a>',
          headingLevel: "h1"
        }));
        updateDocumentMetadata({
          title: "載入失敗｜NXSPACE",
          description: "NXSPACE 頁面暫時無法載入。"
        });
      }
    });
  }

  function scheduleRouteRender() {
    window.cancelAnimationFrame(scheduledFrame);
    scheduledFrame = window.requestAnimationFrame(() => {
      renderCurrentRoute({ focus: true });
    });
  }

  if (!window.location.hash) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${DEFAULT_HASH}`);
  }

  window.addEventListener("hashchange", scheduleRouteRender);
  window.addEventListener("popstate", scheduleRouteRender);

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href^="#"]');

    if (!link) {
      return;
    }

    if (link.classList.contains("skip-link")) {
      event.preventDefault();
      container.focus({ preventScroll: true });
      return;
    }

    const targetHash = normalizeHash(link.getAttribute("href"));

    if (targetHash === normalizeHash(window.location.hash)) {
      event.preventDefault();
      renderCurrentRoute({ focus: true });
    }
  });

  renderCurrentRoute();
}
