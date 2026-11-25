import { configureNewPassword } from '/js/staff-password.js';
import { createLoginPage } from '/public-assets/js/pages/admin-login.js';

const root = document.querySelector('[data-unified-login]');
const staging = location.hostname === 'nxspace-auth-staging.talgo292.workers.dev';
root.innerHTML = createLoginPage({serverSession: true, originLabel: staging ? 'Staging · 僅用合成帳號' : '營運帳號登入'});
root.querySelector('.admin-auth-card').append(document.querySelector('[data-first-password]').content.cloneNode(true));

const login = document.querySelector('[data-login]');
const password = document.querySelector('[data-password]');
const status = document.querySelector('[data-status]');
const endpoint = '/christmas-api/staff-auth/';
const destination = location.pathname === '/admin/login/' && location.hash !== '#staff' ? '/admin/' : '/staff/';
let splitPassword = false;

function syncLoginMfa() {
  const needsMfa = login.elements.username.value.toLowerCase() === 'talgo292';
  const input = login.elements.code;
  input.closest('label').hidden = !needsMfa;
  input.disabled = !needsMfa;
  input.required = needsMfa;
  if (!needsMfa) input.value = '';
}
login.elements.username.addEventListener('input', syncLoginMfa);
login.elements.username.addEventListener('change', syncLoginMfa);
syncLoginMfa();

function showPassword(required, split = false, minimum) {
  splitPassword = split;
  const needsMfa = required && split;
  password.querySelector('[data-password-mfa]').hidden = !needsMfa;
  password.elements.code.disabled = !needsMfa;
  password.elements.code.required = needsMfa;
  password.elements.code.value = '';
  if (required) configureNewPassword(password.elements.newPassword, minimum);
  login.hidden = required;
  password.hidden = !required;
}

const post = (action, data) => fetch(endpoint + action, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
  cache: 'no-store'
});

for (const [form, action] of [[login, 'login'], [password, 'password']]) {
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const button = form.querySelector('button');
    button.disabled = true;
    status.textContent = '';
    let committing = false;
    try {
      const data = Object.fromEntries(new FormData(form));
      if (action === 'password' && data.password === data.newPassword) {
        status.textContent = '新密碼須與初始密碼不同。';
        return;
      }
      const split = action === 'password' && splitPassword;
      committing = action === 'password' && !split;
      let response = await post(split ? 'password-prepare' : action, data);
      if (split && response.ok) {
        const { proof } = await response.json();
        if (!proof) throw Error('PASSWORD_PROOF_MISSING');
        committing = true;
        response = await post('password-commit', { proof, newPassword: data.newPassword });
      }
      if (!response.ok) {
        const code = (await response.json().catch(() => null))?.error?.code;
        if (action === 'password' && code === 'PASSWORD_POLICY') {
          if (response.status === 422) showPassword(false);
          status.textContent = response.status === 422
            ? '新密碼未通過身分服務驗證。請用初始密碼重新登入，再選擇新密碼。'
            : '新密碼須符合畫面所示規則，且與初始密碼不同。';
          return;
        }
        if (response.status === 503 || code === 'CREDENTIAL_CHANGE_UNAVAILABLE') status.textContent = '身分服務暫時無法確認結果。若正在變更密碼，請聯絡 NXSPACE 核對帳號狀態。';
        else if (response.status === 429) status.textContent = '嘗試次數過多，請稍後再試。';
        else status.textContent = '無法驗證或變更密碼，請確認輸入後再試。';
        return;
      }
      const result = await response.json();
      if (result.changed) {
        showPassword(false);
        status.textContent = '密碼已變更，請重新登入。';
      } else if (result.mustChange) {
        showPassword(true, result.splitPassword === true, result.minimumPasswordLength);
      } else {
        location.replace(destination);
      }
    } catch {
      status.textContent = committing ? '密碼變更結果未確認，請先聯絡 NXSPACE 核對帳號狀態。' : '目前無法連線，請稍後再試。';
    } finally {
      form.reset();
      if (form === login) syncLoginMfa();
      button.disabled = false;
    }
  });
}

const current = await fetch(endpoint + 'status', { cache: 'no-store' }).catch(() => null);
if (current?.ok) {
  const result = await current.json();
  if (result.mustChange) showPassword(true, result.splitPassword === true, result.minimumPasswordLength);
  else location.replace(destination);
}
