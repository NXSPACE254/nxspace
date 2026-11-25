import { initializeCaseWorkspace } from './pages/christmas-case-workspace.js';
import { mountPlatformAudit } from './pages/platform-audit-view.js';
import { createChristmasApi } from './services/christmas-api.js';
import { mountStaffAccounts } from './staff-accounts.js';
import { configureNewPassword } from './staff-password.js';

const output = document.querySelector('[data-intake-status]');
const content = document.querySelector('[data-intake-content]');
const audit = document.querySelector('[data-intake-audit]');
const events = document.querySelector('[data-intake-events]');
const logout = document.querySelector('[data-intake-logout]');
const login = document.querySelector('[data-intake-login]');
const accountToggle = document.querySelector('[data-staff-accounts-toggle]');
const accounts = document.querySelector('[data-staff-accounts]');
const workspace = document.querySelector('[data-intake-workspace]');
const self = document.querySelector('[data-staff-self]');
const integratedDashboard = location.pathname === '/admin/';
const dashboardLoading = document.querySelector('[data-dashboard-loading]');

function showDashboardError(message) {
  dashboardLoading.querySelector('[role="status"]').textContent = message;
  dashboardLoading.querySelector('a').hidden = false;
}

async function mountDashboardShell(ctx, config, api) {
  const [{ createAdminLayout }, { adminNavigation }, { createAdminRouter },
    { createDashboardHome, createComingSoonPage }] = await Promise.all([
    import('./layouts/admin-layout.js'), import('./config/admin-config.js'),
    import('./router/admin-router.js'), import('./pages/admin-pages.js')
  ]);
  const navigation = config.superAdmin ? adminNavigation.filter(item => !item.roles && !item.href.includes('preview'))
    : adminNavigation.filter(item => item.href === '#christmas');
  const source = document.querySelector('[data-christmas-admin]');
  const shellRoot = document.createElement('div');
  shellRoot.hidden = Boolean(dashboardLoading);
  const page = document.createElement('section');
  page.className = source.className;
  page.dataset.christmasAdmin = '';
  page.append(...source.childNodes);
  page.querySelector('[data-christmas-subnav]').closest('details').remove();
  shellRoot.innerHTML = createAdminLayout({ navigation, activeHash: '#christmas', serverSession: true,
    session: { displayName: ctx.displayName || ctx.label, unitLabel: ctx.organisations.find(unit => unit.id === ctx.unit_id)?.label || ctx.label, roleLabel: ctx.roleLabel } });
  const overview = document.createElement('section');
  overview.hidden = true;
  shellRoot.querySelector('#admin-page').replaceChildren(overview,page);
  source.replaceWith(shellRoot);
  const shell = shellRoot.querySelector('[data-admin-shell]');
  const menu = shellRoot.querySelector('[data-admin-menu]');
  function setMenu(open) {
    shell.classList.toggle('is-menu-open', open);
    document.body.classList.toggle('is-admin-locked', open);
    menu.setAttribute('aria-expanded', String(open));
  }
  menu.addEventListener('click', () => setMenu(!shell.classList.contains('is-menu-open')));
  shellRoot.querySelector('[data-admin-backdrop]').addEventListener('click', () => setMenu(false));
  shellRoot.querySelector('[data-admin-collapse]').addEventListener('click', () => shell.classList.toggle('is-collapsed'));
  shellRoot.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    if (link.hash === '#admin-main') {
      event.preventDefault();
      shellRoot.querySelector('#admin-main').focus();
    }
    setMenu(false);
  });
  shellRoot.addEventListener('keydown', event => { if (event.key === 'Escape') setMenu(false); });
  const userMenu=shellRoot.querySelector('[data-user-menu]');
  const userPanel=shellRoot.querySelector('[data-user-menu-panel]');
  const profileLink=document.createElement('a');
  profileLink.href='#profile';
  profileLink.textContent='我的帳號';
  userPanel.querySelector('[data-logout]').before(profileLink);
  logout.hidden=true;
  userMenu.addEventListener('click',()=>{
    userPanel.hidden=!userPanel.hidden;
    userMenu.setAttribute('aria-expanded',String(!userPanel.hidden));
  });
  shellRoot.querySelector('[data-logout]').addEventListener('click',()=>logout.click());
  const search=shellRoot.querySelector('[data-global-search]');
  search.addEventListener('input',()=>{
    const field=page.querySelector(accounts.hidden?'[data-case-search]':'[data-account-search]');
    if(field){field.value=search.value;field.dispatchEvent(new Event('input'));}
  });
  return renderWorkspace => {
    let accountsTask;
    if (!config.superAdmin && !location.hash) history.replaceState(null, '', location.pathname + '#christmas');
    const renderRoute = async (route, current, signal) => {
      if(logout.disabled)return;
      if(!config.superAdmin&&!['#christmas','#profile'].includes(current.path)){location.hash='#christmas';return;}
      const system=['#users','#roles','#audit'].includes(current.path);
      const profile=current.path==='#profile';
      page.hidden=!system&&!profile&&current.path!=='#christmas';
      overview.hidden=!page.hidden;
      search.disabled=page.hidden;
      search.value='';
      shellRoot.querySelector('[data-admin-breadcrumb]').textContent=profile?'我的帳號':route?.label||ctx.label;
      self.hidden=!profile;
      for(const link of shellRoot.querySelectorAll('aside a[data-admin-link]')){
        if(link.hasAttribute('data-christmas-view'))continue;
        const active=link.hash===current.path;
        link.classList.toggle('is-active',active);
        if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
      }
      if(page.hidden){
        overview.innerHTML=current.path==='#dashboard'?createDashboardHome({list:()=>[]},null,{connected:false})
          :createComingSoonPage(route?.label||'營運功能','此模組尚未接入營運服務。');
        return;
      }
      if(profile){
        accounts.hidden=true;
        workspace.hidden=true;
        audit.hidden=true;
        self.open=true;
        return;
      }
      if(system){
        if(accounts.hidden){
          accountsTask ||= mountStaffAccounts(accounts, api).finally(() => { accountsTask = null; });
          await accountsTask;
          if (signal.aborted) return;
          accounts.hidden=false;
          workspace.hidden=true;
        }
        accounts.querySelector(`[data-section="${current.path==='#roles'?'roles':current.path==='#audit'?'events':'accounts'}"]`)?.click();
        return;
      }
      accounts.hidden=true;
      workspace.hidden=false;
      accountToggle.textContent='系統管理';
      accountToggle.setAttribute('aria-expanded','false');
      audit.hidden=!ctx.permissions.includes('staff.manage');
      await renderWorkspace(signal);
    };
    return createAdminRouter({
      routes: navigation.map(item => ({ ...item, path: item.href })),
      interruptible: true,
      async onRoute(route, current, focus, isCurrent, signal) {
        try {
          await renderRoute(route, current, signal);
          if (isCurrent() && !logout.disabled) {
            shellRoot.hidden = false;
            dashboardLoading?.remove();
          }
        } catch (error) {
          if (!isCurrent() || logout.disabled) return;
          if (shellRoot.hidden && dashboardLoading) showDashboardError('無法載入工作台，請重新載入。');
          else output.textContent = error.message;
        }
      }
    });
  };
}

function invalidateSession() {
  if (!integratedDashboard) {
    endSession(sessionMessage);
    return;
  }
  logout.disabled = true;
  const shellRoot = document.querySelector('[data-admin-shell]')?.parentElement;
  if (shellRoot) shellRoot.hidden = true;
  location.replace('/admin/login/');
}

function endSession(message) {
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  content.replaceChildren();
  events.replaceChildren();
  accounts.replaceChildren();
  accounts.hidden = accountToggle.hidden = true;
  workspace.hidden = false;
  self.hidden = true;
  for (const form of self.querySelectorAll('form')) form.reset();
  document.querySelector('[data-christmas-subnav]').replaceChildren();
  events.hidden = audit.hidden = true;
  login.hidden = false;
  logout.disabled = true;
  output.textContent = message;
}

const checkSession = (bootstrap = false) => fetch('/christmas-api/config', {
  cache: 'no-store', redirect: 'error', headers: { 'X-Requested-With': 'XMLHttpRequest',
    ...(bootstrap && integratedDashboard ? { 'X-NXSPACE-Dashboard': 'bootstrap' } : {}) }, signal: AbortSignal.timeout(10000)
});
const sessionMessage = '工作階段已結束或帳號權限已撤銷。請重新驗證登入，或聯絡 NXSPACE。';

try {
  const response = await checkSession(true);
  if (integratedDashboard && [401, 403].includes(response.status)) invalidateSession();
  if (!response.ok) throw new Error(sessionMessage);
  const { dashboardContext, ...config } = await response.json();
  const logoutDestination = config.staffPassword ? (integratedDashboard ? '/admin/login/' : '/staff/login/#staff') : '/cdn-cgi/access/logout';
  if(integratedDashboard)login.href='/admin/';
  if ((!config.intakeMode && !config.fulfillmentMode) || config.baseUrl !== '/christmas-api') throw new Error('公益後台尚未就緒。');
  const api = await createChristmasApi({ configuration: {...config,v11Dashboard:integratedDashboard} });
  const requestAdmin = api.admin;
  let caseRead;
  api.admin = async (...args) => {
    if (args[1] !== undefined && args[0] !== '/platform-audit/page') caseRead = undefined;
    try { return await requestAdmin(...args); }
    catch (error) {
      if (error.status === 401 || error.code === 'UNIT_FORBIDDEN_OR_REVOKED') invalidateSession();
      throw error;
    }
  };
  const ctx = dashboardContext ?? await api.admin('/context');
  output.textContent = '';
  const startDashboard = integratedDashboard ? await mountDashboardShell(ctx, config, api) : null;
  const readCases = refresh => {
    if (!integratedDashboard || refresh) {
      caseRead = undefined;
      return api.admin('/workspace/cases');
    }
    if (!caseRead || performance.now() >= caseRead.expires) {
      const entry = { expires: Infinity };
      entry.result = api.admin('/workspace/cases').then(data => {
        entry.expires = performance.now() + 5000;
        return data;
      }, error => {
        if (caseRead === entry) caseRead = undefined;
        throw error;
      });
      caseRead = entry;
    }
    return caseRead.result;
  };
  const renderWorkspace = async signal => {
    const query = new URLSearchParams(location.hash.split('?')[1]);
    const view = document.createElement('div');
    content.replaceChildren(view);
    await initializeCaseWorkspace({ content: view, output, api, ctx, view: query.get('view') || 'overview', filter: query.get('filter') || 'all', signal, readCases });
  };
  if(!integratedDashboard){
    await renderWorkspace();
    window.addEventListener('hashchange', () => {
      if (!logout.disabled) renderWorkspace().catch(error => { output.textContent = error.message; });
    });
  }
  logout.disabled = false;
  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try {
      const result = await api.admin('/session/logout', {});
      if (result.revoked !== true) throw new Error();
      endSession('已登出公益後台。');
      location.replace(logoutDestination);
    } catch (error) {
      if (error.code === 'SESSION_REVOKED') { location.replace(logoutDestination); return; }
      if (!login.hidden) return;
      logout.disabled = false;
      output.textContent = '尚未確認登出結果，請再試一次。';
    }
  });
  audit.hidden = !ctx.permissions.includes('staff.manage');
  if (config.staffPassword) {
    const profile = self.querySelector('[data-self-profile]');
    const password = self.querySelector('[data-self-password]');
    configureNewPassword(password.elements.newPassword, config.minimumPasswordLength);
    const profileButton = profile.querySelector('button');
    self.hidden = false;
    password.querySelector('[data-admin-code]').hidden = !config.superAdmin;
    password.elements.code.required = config.superAdmin;
    password.elements.code.disabled = !config.superAdmin;
    self.addEventListener('toggle', async () => {
      if (!self.open || !profileButton.disabled) return;
      const status = profile.querySelector('[role="status"]');
      try {
        const { displayName, contactEmail } = await api.admin('/account/profile');
        profile.elements.displayName.value = displayName;
        profile.elements.contactEmail.value = contactEmail;
        profileButton.disabled = false;
        status.textContent = '';
      } catch { status.textContent = '無法讀取基本資料，請關閉後重新開啟。'; }
    });
    profile.addEventListener('submit', async event => {
      event.preventDefault();
      if (profileButton.disabled) return;
      profileButton.disabled = true;
      const status = profile.querySelector('[role="status"]');
      try {
        await api.admin('/account/profile', Object.fromEntries(new FormData(profile)));
        status.textContent = '基本資料已儲存。';
      } catch { status.textContent = '無法儲存基本資料，請確認輸入後再試。'; }
      finally { profileButton.disabled = false; }
    });
    password.addEventListener('submit', async event => {
      event.preventDefault();
      const button = password.querySelector('button');
      button.disabled = true;
      const status = password.querySelector('[role="status"]');
      try {
        const response = await fetch(password.action, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(Object.fromEntries(new FormData(password))), cache: 'no-store'
        });
        if (!response.ok) {
          if (response.status === 503) status.textContent = '身分服務暫時無法確認結果，請聯絡 NXSPACE 核對帳號狀態。';
          else if (response.status === 429) status.textContent = '嘗試次數過多，請稍後再試。';
          else status.textContent = '無法變更密碼，請確認輸入後再試。';
          return;
        }
        endSession('密碼已變更，請重新登入。');
        location.replace(logoutDestination);
      } catch { status.textContent = '目前無法連線，請稍後再試。'; }
      finally {
        password.reset();
        button.disabled = false;
      }
    });
  }
  accountToggle.hidden = integratedDashboard || !config.superAdmin;
  accountToggle.addEventListener('click', async () => {
    if (accounts.hidden) {
      accountToggle.disabled = true;
      try {
        await mountStaffAccounts(accounts, api);
        accounts.hidden = false;
      } catch { output.textContent = '無法載入帳號管理，請重新驗證或稍後再試。'; }
      finally { accountToggle.disabled = false; }
    } else {
      accounts.hidden = true;
    }
    workspace.hidden = !accounts.hidden;
    audit.hidden = workspace.hidden || !ctx.permissions.includes('staff.manage');
    accountToggle.textContent = workspace.hidden ? '返回公益工作區' : '系統管理';
    accountToggle.setAttribute('aria-expanded', String(workspace.hidden));
  });
  audit.addEventListener('click', async () => {
    events.hidden = !events.hidden;
    if (!events.hidden) await mountPlatformAudit(events, api);
  });
  startDashboard?.(renderWorkspace);
} catch (error) {
  if (dashboardLoading?.isConnected) showDashboardError(error.message);
  else if (!integratedDashboard) endSession(error.message);
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !login.hidden) return;
  try {
    const result = await checkSession();
    if (result.status === 401 || result.status === 403) invalidateSession();
  } catch { /* A temporary connection failure leaves the current work intact. */ }
});

// Pages restored by browser history must recheck Access and current D1 permissions.
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
