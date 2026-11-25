export function createLoginPage({ setup = false, message = '', serverSession = false, originLabel = '營運帳號登入' } = {}) {
  const formAttributes = serverSession
    ? 'data-login method="post" action="/christmas-api/staff-auth/login"' : 'data-auth-form novalidate';
  return `<main class="admin-auth-page"><section class="admin-auth-card" aria-labelledby="auth-title">
    <a href="${serverSession ? '/' : '../index.html#home'}" class="admin-auth-brand">NXSPACE</a><span class="mode-chip">${serverSession ? originLabel : '本機測試模式'}</span>
    <h1 id="auth-title">NXSPACE 營運中心</h1>
    <p>供 NXSPACE 管理人員及合作店家登入使用</p>
    ${serverSession ? '<p class="admin-auth-note">請使用 NXSPACE 核發的帳號。</p>' : setup ? '<p class="admin-auth-note">首次使用請建立只存在此瀏覽器的管理帳號；密碼僅以加鹽雜湊保存。</p>' : '<p class="admin-auth-note">登入狀態會在關閉分頁或一小時後失效。</p>'}
    ${serverSession ? '<p class="admin-form-message" role="status" data-status></p>' : `<div class="admin-form-message" data-auth-message ${message ? "" : "hidden"}>${message}</div>`}
    <form ${formAttributes}>
      <label class="admin-field"><span>帳號</span><input name="username" autocomplete="username" minlength="${serverSession ? 3 : 4}" ${serverSession ? 'maxlength="40"' : ''} required aria-describedby="auth-username-error"><span class="admin-field-error" id="auth-username-error"></span></label>
      <label class="admin-field"><span>${setup ? "建立密碼" : "密碼"}</span><input name="password" type="password" autocomplete="${setup ? "new-password" : "current-password"}" minlength="8" required aria-describedby="auth-password-error"><span class="admin-field-error" id="auth-password-error"></span></label>
      ${serverSession ? '<label class="admin-field" data-login-mfa hidden><span>最高管理員驗證碼</span><input name="code" inputmode="numeric" pattern="[0-9]{6}" autocomplete="one-time-code" disabled></label>' : ''}
      <button class="btn btn-primary admin-submit" type="submit">${setup ? "建立帳號並登入" : "登入營運中心"}</button>
    </form>
    ${serverSession ? '' : '<details><summary>測試模式說明</summary><p>目前為純前端本機展示環境，並非正式登入服務。系統不提供或保存預設明文密碼。</p></details>'}
  </section></main>`;
}
