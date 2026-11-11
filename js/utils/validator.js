export function validateFields(values, fields) {
  const errors = {};
  fields.forEach(([name, label, type, required]) => {
    const value = String(values[name] ?? "").trim();
    if (required && !value) errors[name] = `請填寫${label}。`;
    if (value && type === "url") {
      try { const url = new URL(value); if (!/^https?:$/.test(url.protocol)) throw new Error(); } catch { errors[name] = `${label}必須是有效的 HTTP(S) URL。`; }
    }
    if (value && type === "number" && (!Number.isFinite(Number(value)) || Number(value) < 0)) errors[name] = `${label}必須是零或正數。`;
  });
  return errors;
}

export function renderFieldError(name) {
  return `<span class="admin-field-error" id="${name}-error" data-error-for="${name}"></span>`;
}
