const host = globalThis.location?.hostname || "localhost";
const isLocal = host === "localhost" || host === "127.0.0.1" || host === "";
const isGitHubPages = host.endsWith("github.io");

export const environment = Object.freeze({
  appName: "NXSPACE Platform Beta V1",
  version: "1.0.0-beta.1",
  releaseDate: "2026-07-16",
  mode: isLocal ? "local-demo" : "static-demo",
  hosting: isGitHubPages ? "github-pages" : host.includes("pages.dev") ? "cloudflare-pages" : isLocal ? "live-server" : "static-host",
  basePath: new URL("../../", import.meta.url).pathname,
  adapterMode: "local",
  productionReady: false
});

export function getAdminEntryUrl() {
  return `${environment.basePath}admin/`;
}

export function getEnvironmentSummary() {
  return { ...environment };
}

export function getPublicEntryUrl(hash = "#home") {
  return `${environment.basePath}index.html${hash}`;
}
