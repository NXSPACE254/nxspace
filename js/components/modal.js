export function createConfirmDialog({ title, description, confirmLabel = "確認", tone = "danger" } = {}) {
  return `<dialog class="admin-dialog" data-admin-dialog aria-labelledby="dialog-title">
    <form method="dialog">
      <h2 id="dialog-title">${title}</h2>
      <p>${description}</p>
      <div class="admin-dialog-actions">
        <button class="btn btn-secondary" value="cancel">取消</button>
        <button class="btn btn-${tone}" value="confirm">${confirmLabel}</button>
      </div>
    </form>
  </dialog>`;
}

export function openConfirmDialog(dialog) {
  if (!dialog) return Promise.resolve(false);
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
    dialog.showModal();
  });
}
