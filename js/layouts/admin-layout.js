import { adminNavigation, adminWorkspaceOrder } from "../config/admin-config.js";
import { roleIdLabels } from "../data/label-registry.js";

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const displayName=session=>/Demo Admin|charity-preview-/i.test(session.displayName||'')?'公益模擬測試':session.displayName||'本機測試帳號';
export function createAdminLayout({ session, activeHash = "#dashboard", collapsed = false, navigation = adminNavigation, serverSession = false } = {}) {
  const groups = navigation.reduce((result, item) => {
    const name = item.group || "其他";
    (result[name] ||= []).push(item);
    return result;
  }, {});
  const activePath=activeHash.split('?')[0];
  const renderLink=item=>`<a class="admin-nav-link${activePath===item.href?' is-active':''}" href="${item.href}" data-admin-link ${activePath===item.href?'aria-current="page"':''}><span aria-hidden="true">${item.icon}</span><span class="admin-nav-label">${item.label}</span></a>`;
  const links=adminWorkspaceOrder.filter(group=>groups[group]?.length).map(group=>{
    const items=groups[group],open=items.some(item=>item.href===activePath);
    if(group==='聖誕公益')return `<details class="admin-workspace-group christmas-admin-nav" data-admin-workspace="${group}" ${open?'open':''}><summary class="admin-nav-link"><span aria-hidden="true">◇</span><a href="#christmas" class="admin-nav-label">聖誕公益</a></summary><div data-christmas-subnav><a class="admin-nav-link" href="#christmas" data-admin-link>活動總覽</a></div></details>`;
    return `<details class="admin-workspace-group" data-admin-workspace="${group}" ${open?'open':''}><summary class="admin-nav-link"><span aria-hidden="true">▸</span><span class="admin-nav-label">${group}</span></summary><div class="admin-workspace-links">${items.map(renderLink).join('')}</div></details>`;
  }).join('');
  return `<a class="skip-link" href="#admin-main">跳至主要內容</a>
    <div class="admin-shell${collapsed ? " is-collapsed" : ""}" data-admin-shell>
      <div class="admin-backdrop" data-admin-backdrop hidden></div>
      <aside class="admin-sidebar" id="admin-sidebar" aria-label="管理中心導覽">
        <div class="admin-brand"><span class="admin-brand-mark">NX</span><span class="admin-nav-label"><strong>NXSPACE 營運中心</strong><small>${serverSession ? '聖誕公益' : '本機測試模式'}</small></span></div>
        <nav class="admin-nav">${links}</nav>
        <a class="admin-nav-link" href="${serverSession ? '/' : '../index.html#home'}"><span aria-hidden="true">↗</span><span class="admin-nav-label">查看前台</span></a>
      </aside>
      <div class="admin-workspace">
        ${session.preview?`<div class="preview-banner" role="status"><strong>目前為角色預覽模式：${session.preview.label}</strong><span>寫入操作已停用</span><button class="btn btn-secondary" type="button" data-global-preview-exit>離開預覽模式</button></div>`:""}
        <header class="admin-topbar">
          <div class="admin-topbar-start"><button class="admin-icon-button admin-mobile-menu" type="button" data-admin-menu aria-controls="admin-sidebar" aria-expanded="false" aria-label="開啟導覽">☰</button><button class="admin-icon-button admin-collapse" type="button" data-admin-collapse aria-label="收合側邊欄">⇤</button><div data-admin-breadcrumb></div></div>
          ${serverSession ? `<div class="admin-topbar-actions"><label class="admin-global-search"><span class="sr-only">搜尋目前資料</span><input type="search" placeholder="搜尋目前資料" data-global-search disabled></label><button class="admin-icon-button" type="button" data-notifications aria-label="通知尚未接入" disabled>○</button><button class="admin-user-button" type="button" data-user-menu aria-expanded="false"><span class="admin-avatar">A</span><span>${esc([session.displayName,session.unitLabel].filter(Boolean).join(" · "))}</span></button><div class="admin-user-menu" data-user-menu-panel hidden><strong>${esc(session.displayName)}</strong><small>${esc([session.unitLabel,session.roleLabel].filter(Boolean).join(" · "))}</small><button type="button" data-logout>登出</button></div></div>` : `<div class="admin-topbar-actions"><label class="admin-global-search"><span class="sr-only">全站搜尋</span><input type="search" placeholder="搜尋目前資料" data-global-search></label><button class="admin-icon-button" type="button" data-notifications aria-label="通知">○</button><button class="admin-user-button" type="button" data-user-menu aria-expanded="false"><span class="admin-avatar">A</span><span>${esc(displayName(session))}</span></button><div class="admin-user-menu" data-user-menu-panel hidden><strong>${esc(displayName(session))}</strong><small>${session.roleIds?.map(id=>roleIdLabels[id]||"公益測試人員").join("、") || "本機測試帳號"}</small><details><summary>帳號資訊與變更密碼</summary><p data-account-note>主站本機帳號，只影響目前瀏覽器；正式管理身分由後端驗證。</p><form data-account-password><label>目前密碼<input name="current" type="password" autocomplete="current-password" required></label><label>新密碼（12–128字元）<input name="password" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><label>再次輸入新密碼<input name="confirm" type="password" minlength="12" maxlength="128" autocomplete="new-password" required></label><button type="submit">變更本機帳號密碼</button><p role="status"></p></form></details><button type="button" data-logout>登出</button></div></div>`}
        </header>
        <main class="admin-main" id="admin-main" tabindex="-1"><div id="admin-page"></div><footer class="admin-footer">NXSPACE Beta V1.1${serverSession ? '' : ' · 本機測試模式'}</footer></main>
      </div>
    </div>
    <div class="admin-toast-region" data-toast-region aria-live="polite" aria-atomic="true"></div>`;
}
