import { adminNavigation } from "../config/admin-config.js";
import { roleIdLabels } from "../data/label-registry.js";

export function createAdminLayout({ session, activeHash = "#dashboard", collapsed = false, navigation = adminNavigation } = {}) {
  const groups = navigation.reduce((result, item) => {
    const name = item.group || "其他";
    (result[name] ||= []).push(item);
    return result;
  }, {});
  const links = Object.entries(groups).map(([group, items]) => `<section class="admin-nav-group" aria-labelledby="nav-${group}">
    <h2 id="nav-${group}" class="admin-nav-group-title admin-nav-label">${group}</h2>
    ${items.map((item) => `<a class="admin-nav-link${activeHash === item.href ? " is-active" : ""}" href="${item.href}" data-admin-link ${activeHash === item.href ? 'aria-current="page"' : ""}><span aria-hidden="true">${item.icon}</span><span class="admin-nav-label">${item.label}</span></a>`).join("")}
  </section>`).join("");
  return `<a class="skip-link" href="#admin-main">跳至主要內容</a>
    <div class="admin-shell${collapsed ? " is-collapsed" : ""}" data-admin-shell>
      <div class="admin-backdrop" data-admin-backdrop hidden></div>
      <aside class="admin-sidebar" id="admin-sidebar" aria-label="管理中心導覽">
        <div class="admin-brand"><span class="admin-brand-mark">NX</span><span class="admin-nav-label"><strong>NXSPACE 營運中心</strong><small>本機測試模式</small></span></div>
        <nav class="admin-nav">${links}</nav>
        <a class="admin-nav-link" href="../index.html#home"><span aria-hidden="true">↗</span><span class="admin-nav-label">查看前台</span></a>
      </aside>
      <div class="admin-workspace">
        ${session.preview?`<div class="preview-banner" role="status"><strong>目前為角色預覽模式：${session.preview.label}</strong><span>寫入操作已停用</span><button class="btn btn-secondary" type="button" data-global-preview-exit>離開預覽模式</button></div>`:""}
        <header class="admin-topbar">
          <div class="admin-topbar-start"><button class="admin-icon-button admin-mobile-menu" type="button" data-admin-menu aria-controls="admin-sidebar" aria-expanded="false" aria-label="開啟導覽">☰</button><button class="admin-icon-button admin-collapse" type="button" data-admin-collapse aria-label="收合側邊欄">⇤</button><div data-admin-breadcrumb></div></div>
          <div class="admin-topbar-actions"><label class="admin-global-search"><span class="sr-only">全站搜尋</span><input type="search" placeholder="搜尋目前資料" data-global-search></label><button class="admin-icon-button" type="button" data-notifications aria-label="通知">○</button><button class="admin-user-button" type="button" data-user-menu aria-expanded="false"><span class="admin-avatar">A</span><span>${session.displayName}</span></button><div class="admin-user-menu" data-user-menu-panel hidden><strong>${session.username}</strong><small>${session.roleIds?.map(id=>roleIdLabels[id]||"自訂角色").join("、") || "本機測試帳號"}</small><button type="button" data-logout>登出</button></div></div>
        </header>
        <main class="admin-main" id="admin-main" tabindex="-1"><div id="admin-page"></div><footer class="admin-footer">NXSPACE Beta V1.1 · 本機測試模式</footer></main>
      </div>
    </div>
    <div class="admin-toast-region" data-toast-region aria-live="polite" aria-atomic="true"></div>`;
}
