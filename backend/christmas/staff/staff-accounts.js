import { configureNewPassword } from './staff-password.js';

const kinds = { admin: '公益管理', bookhouse: '書屋建檔', collection: '收件據點' };
const actions = { reset: '重設密碼', disable: '停用帳號', enable: '重新啟用', revoke: '撤銷工作階段',
  'suspend-access': '暫停活動權限', 'restore-access': '恢復活動權限' };
const accountStatus = user => user.credential_change_pending ? '待核對' : !user.enabled ? '停用' : user.revoked_at ? '活動權限暫停' : '啟用';

export async function mountStaffAccounts(panel, api) {
  const initial = await api.admin('/accounts/list');
  panel.innerHTML = `
    <h2>系統管理</h2>
    <nav class="staff-admin-actions" aria-label="系統管理功能">
      <button class="btn btn-secondary" type="button" data-section="accounts" aria-pressed="true">帳號管理</button>
      <button class="btn btn-secondary" type="button" data-section="units" aria-pressed="false">單位管理</button>
      <button class="btn btn-secondary" type="button" data-section="roles" aria-pressed="false">角色與權限</button>
      <button class="btn btn-secondary" type="button" data-section="events" aria-pressed="false">操作紀錄</button>
    </nav>
    ${api.config.contentEditorPreview ? '<button class="btn btn-secondary" type="button" data-content-step-up>高權限重新驗證</button>' : ''}
    <p role="status" data-system-status></p>
    <section data-view="accounts" aria-label="帳號管理">
      <div class="staff-admin-actions">
        <label>搜尋帳號或單位 <input type="search" data-account-search></label>
        <button class="btn btn-primary" type="button" data-add-account>新增帳號</button>
      </div>
      <ul class="staff-admin-list" data-account-list></ul>
    </section>
    <section data-view="units" aria-label="單位管理" hidden><ul class="staff-admin-list" data-unit-list></ul></section>
    <section data-view="roles" aria-label="角色與權限" hidden>
      <dl><dt>公益管理</dt><dd>活動管理與公益審核。</dd>
      <dt>書屋建檔</dt><dd>書屋心願建檔、送審與交付確認。</dd>
      <dt>收件據點</dt><dd>所屬據點的收件及交接。</dd></dl>
    </section>
    <section data-view="events" aria-label="操作紀錄" hidden><ul class="staff-admin-list" data-account-events></ul></section>
    <dialog class="staff-admin-dialog" data-account-dialog aria-labelledby="staff-account-title">
      <h3 id="staff-account-title"></h3>
      <form method="post" data-create-account>
        <label>所屬單位 <select name="unitId" required></select></label>
        <label>登入名稱 <input name="username" pattern="[a-zA-Z][a-zA-Z0-9_\\-]{2,39}" required></label>
        <label>使用者電子郵件 <input name="email" type="email" maxlength="254" required></label>
        <label>臨時密碼<span data-password-hint></span> <input name="password" type="password" autocomplete="new-password" required></label>
        <label><input name="emailVerified" type="checkbox" required>我已核實使用者身分、信箱與所屬單位。</label>
        <button class="btn btn-primary">建立帳號</button>
      </form>
      <section data-account-detail hidden>
        <p data-detail-summary></p><div class="staff-admin-actions" data-detail-actions></div>
      </section>
      <form method="post" data-account-operation hidden>
        <label data-reset-password>新臨時密碼<span data-password-hint></span> <input name="password" type="password" autocomplete="new-password"></label>
        <button class="btn btn-primary">確認</button>
      </form>
      <p role="status" data-account-status></p>
      <button class="btn btn-secondary" type="button" data-close-account>關閉</button>
    </dialog>
    <dialog class="staff-admin-dialog" data-step-dialog aria-labelledby="staff-step-title">
      <h3 id="staff-step-title">重新驗證</h3>
      <p>驗證後可在 15 分鐘內執行高權限操作。</p>
      <form method="post" data-step-up>
        <label>目前密碼 <input type="password" name="password" autocomplete="current-password" required></label>
        <label>驗證器代碼 <input name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" required></label>
        <p role="status"></p>
        <div class="staff-admin-actions">
          <button class="btn btn-primary">驗證並繼續</button>
          <button class="btn btn-secondary" type="button" data-cancel-step>取消</button>
        </div>
      </form>
    </dialog>`;

  const find = selector => panel.querySelector(selector);
  const create = find('[data-create-account]');
  const operation = find('[data-account-operation]');
  const accountDialog = find('[data-account-dialog]');
  const stepDialog = find('[data-step-dialog]');
  const stepForm = find('[data-step-up]');
  const detail = find('[data-account-detail]');
  const title = find('#staff-account-title');
  const message = find('[data-account-status]');
  let data = initial;
  let pendingForm;
  let selected;
  let action;
  let busy = false;

  function row(text) {
    const item = document.createElement('li');
    item.textContent = text;
    return item;
  }
  function button(text, click) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'btn btn-secondary';
    element.textContent = text;
    element.addEventListener('click', click);
    return element;
  }
  const unitName = id => data.units.find(unit => unit.id === id)?.label ?? id;
  function renderAccounts() {
    const query = find('[data-account-search]').value.trim().toLowerCase();
    const rows = data.users.flatMap(user => {
      const text = [user.username, unitName(user.organisation_id), kinds[user.kind], accountStatus(user)].join(' · ');
      if (!text.toLowerCase().includes(query)) return [];
      const item = row('');
      item.append(button(text, () => openAccount(user)));
      return [item];
    });
    find('[data-account-list]').replaceChildren(...(rows.length ? rows : [row('沒有符合的帳號。')]));
  }
  function render() {
    renderAccounts();
    const units = data.units.filter(unit => unit.available);
    create.elements.unitId.replaceChildren(...units.map(unit => new Option(`${unit.label}（${kinds[unit.unit_kind]}）`, unit.id)));
    find('[data-add-account]').disabled = !units.length;
    for (const form of [create, operation]) configureNewPassword(form.elements.password, data.minimumPasswordLength);
    find('[data-unit-list]').replaceChildren(...data.units.map(unit => row(`${unit.label} · ${kinds[unit.unit_kind]} · ${unit.available ? '可建立帳號' : '已有帳號'}`)));
    find('[data-account-events]').replaceChildren(...data.events.map(event => row([
      new Date(event.occurred_at * 1000).toLocaleString('zh-TW'), event.action, event.actor_id, event.target_id
    ].filter(Boolean).join(' · '))));
  }
  function openAccount(user) {
    selected = user;
    title.textContent = user?.username ?? '新增帳號';
    create.hidden = Boolean(user);
    detail.hidden = !user;
    operation.hidden = true;
    message.textContent = '';
    if (user) {
      find('[data-detail-summary]').textContent = [unitName(user.organisation_id), kinds[user.kind], accountStatus(user)].join(' · ');
      const allowed = ['reset', user.enabled ? 'disable' : 'enable', 'revoke', user.revoked_at ? 'restore-access' : 'suspend-access'];
      find('[data-detail-actions]').replaceChildren(...(user.credential_change_pending ? [] : allowed.map(key => button(actions[key], () => {
        action = key;
        title.textContent = actions[key];
        detail.hidden = true;
        operation.hidden = false;
        const password = operation.elements.password;
        password.disabled = !(password.required = key === 'reset');
        find('[data-reset-password]').hidden = password.disabled;
      }))));
    }
    accountDialog.showModal();
  }
  async function submit(form, mayReauth = true) {
    if (busy) return;
    busy = true;
    const submitButton = form.querySelector('button');
    submitButton.disabled = true;
    message.textContent = '';
    try {
      if (form === create) {
        const values = Object.fromEntries(new FormData(form));
        await api.admin('/accounts/create', { ...values, emailVerified: values.emailVerified === 'on' });
      } else {
        await api.admin('/accounts/' + action, { id: selected.id, ...(action === 'reset' ? { password: form.elements.password.value } : {}) });
      }
      accountDialog.close();
      find('[data-system-status]').textContent = form === create ? '帳號已建立，首次登入需更換密碼。' : `${actions[action]}完成。`;
      try { data = await api.admin('/accounts/list'); render(); }
      catch { find('[data-system-status]').textContent += ' 目前無法更新清單，請重新開啟系統管理。'; }
    } catch (error) {
      if (error.code === 'REAUTH_REQUIRED' && mayReauth) {
        pendingForm = form;
        stepForm.querySelector('[role="status"]').textContent = '';
        stepDialog.showModal();
      } else {
        form.elements.password.value = '';
        message.textContent = [0, 503].includes(error.status) || error.code === 'CREDENTIAL_CHANGE_UNAVAILABLE'
          ? '操作結果待確認，請先核對帳號狀態，避免重複送出。'
          : '操作未完成，請確認輸入與目前權限。';
      }
    } finally {
      busy = false;
      submitButton.disabled = false;
    }
  }

  for (const form of [create, operation]) form.addEventListener('submit', event => {
    event.preventDefault();
    void submit(form);
  });
  stepForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submitButton = stepForm.querySelector('button');
    if (submitButton.disabled) return;
    submitButton.disabled = true;
    const form = pendingForm;
    const status = stepForm.querySelector('[role="status"]');
    try {
      const response = await fetch('/christmas-api/staff-auth/step-up', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(stepForm)))
      });
      if (!response.ok) throw new Error();
      if (stepDialog.open && pendingForm === form) {
        stepDialog.close();
        if (form && accountDialog.open) await submit(form, false);
        else if (!form) find('[data-system-status]').textContent = '已完成高權限重新驗證，可返回活動設定與網站內容。';
      }
    } catch {
      status.textContent = '重新驗證未完成，請核對密碼及最新驗證器代碼。';
    } finally {
      stepForm.reset();
      submitButton.disabled = false;
    }
  });
  stepDialog.addEventListener('close', () => { pendingForm = null; stepForm.reset(); });
  accountDialog.addEventListener('close', () => { create.reset(); operation.reset(); });
  accountDialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  find('[data-close-account]').addEventListener('click', () => { if (!busy) accountDialog.close(); });
  find('[data-cancel-step]').addEventListener('click', () => { pendingForm = null; stepDialog.close(); });
  stepDialog.addEventListener('cancel', () => { pendingForm = null; });
  find('[data-content-step-up]')?.addEventListener('click', () => {
    pendingForm = null;
    stepForm.querySelector('[role="status"]').textContent = '';
    stepDialog.showModal();
  });
  find('[data-account-search]').addEventListener('input', renderAccounts);
  find('[data-add-account]').addEventListener('click', () => openAccount());
  for (const tab of panel.querySelectorAll('[data-section]')) tab.addEventListener('click', () => {
    for (const view of panel.querySelectorAll('[data-view]')) view.hidden = view.dataset.view !== tab.dataset.section;
    for (const sibling of panel.querySelectorAll('[data-section]')) sibling.setAttribute('aria-pressed', String(sibling === tab));
  });
  render();
}
