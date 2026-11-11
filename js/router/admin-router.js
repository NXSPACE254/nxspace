const DEFAULT_ROUTE = "#dashboard";

export function parseAdminHash(hash = location.hash) {
  const value = hash || DEFAULT_ROUTE;
  const separator = value.indexOf("?");
  const path = (separator < 0 ? value : value.slice(0, separator)).replace(/^#\//, "#").replace(/\/$/, "");
  return { path: !path || path === "#" ? DEFAULT_ROUTE : path, query: new URLSearchParams(separator < 0 ? "" : value.slice(separator + 1)) };
}

export function createAdminRouter({ routes, onBeforeRoute, onRoute }) {
  let disposed = false, version = 0, frame = 0, running = false, pending = null;
  let acceptedHash = location.hash || DEFAULT_ROUTE;

  async function drain() {
    if (running || disposed) return;
    running = true;
    try {
      while (pending && !disposed) {
        const request = pending;
        pending = null;
        const isCurrent = () => !disposed && request.version === version && request.hash === location.hash;
        const current = parseAdminHash(request.hash);
        const allowed = !onBeforeRoute || await onBeforeRoute(current);
        if (!isCurrent()) continue;
        if (!allowed) {
          history.replaceState(null, "", location.pathname + location.search + acceptedHash);
          continue;
        }
        const route = routes.find((item) => item.path === current.path);
        await onRoute(route, current, request.focus, isCurrent);
        if (isCurrent()) acceptedHash = request.hash;
      }
    } catch (error) {
      console.error("[NXSPACE] Admin route failed.", error);
    } finally {
      running = false;
    }
  }

  function navigate({ focus = true } = {}) {
    if (disposed) return;
    pending = { hash: location.hash, focus, version: ++version };
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(drain);
  }
  function handleLocationChange() { navigate(); }
  function handleClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href^="#"]');
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
    if (link.classList.contains("skip-link")) {
      event.preventDefault();
      document.getElementById("admin-main")?.focus({ preventScroll: true });
    } else if (link.getAttribute("href") === location.hash) {
      event.preventDefault();
      navigate();
    }
  }
  window.addEventListener("hashchange", handleLocationChange);
  window.addEventListener("popstate", handleLocationChange);
  document.addEventListener("click", handleClick);
  if (!location.hash) history.replaceState(null, "", location.pathname + location.search + DEFAULT_ROUTE);
  navigate({ focus: false });
  return {
    navigate,
    destroy() {
      disposed = true;
      version++;
      pending = null;
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", handleLocationChange);
      window.removeEventListener("popstate", handleLocationChange);
      document.removeEventListener("click", handleClick);
    }
  };
}
