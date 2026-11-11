import { createStateView } from "../components/state-view.js";

export function createNotFoundPage() {
  return `
    <div class="page-container state-page">
      ${createStateView({
        type: "notFound",
        title: "找不到這個頁面",
        description: "網址可能已變更，或內容尚未公開。",
        action: '<a class="btn btn-primary" href="#home" data-route-link>返回首頁</a>',
        headingLevel: "h1"
      })}
    </div>
  `.trim();
}
