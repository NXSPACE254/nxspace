export function configureNewPassword(input, minimum) {
  const length = minimum === 8 ? 8 : 15;
  const hint = `至少 ${length} 字元，須包含英文字母與數字，最多 72 位元組`;
  input.minLength = length;
  input.maxLength = 72;
  input.pattern = `(?=.*[A-Za-z])(?=.*[0-9])[^\\x00-\\x1f\\x7f]{${length},72}`;
  input.title = hint;
  input.closest('label').querySelector('[data-password-hint]').textContent = `（${hint}）`;
  input.oninput = () => input.setCustomValidity(
    new TextEncoder().encode(input.value).length > 72 ? '密碼不可超過 72 位元組。' : ''
  );
  input.form.onreset = () => input.setCustomValidity('');
}
