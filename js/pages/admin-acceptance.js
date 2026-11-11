import {
  listAcceptanceRecords, productionReadiness, recommendedTestFlow,
  runAcceptanceChecks, saveAcceptanceRecord
} from "../services/acceptance-service.js";
import { createLocalBackup, importLocalBackup, previewDemoReset, resetDemoData, validateLocalBackup } from "../services/demo-reset-service.js";
import { getSchemaRegistry } from "../services/schema-registry.js";

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
const statusLabels = { untested: "未測試", passed: "通過", failed: "失敗", not_applicable: "不適用" };
const readinessList = (items, className) => `<ul class="acceptance-list ${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;

export function createAcceptancePage() {
  return `<section class="acceptance-page" data-acceptance-page>
    <header class="admin-page-header"><div><p class="admin-eyebrow">Beta V1.1 發布控制</p><h1>整合驗收中心</h1><p>集中管理 Package 13–18 驗收、資料品質、備份與正式環境準備度。</p></div><button class="btn btn-primary" type="button" data-run-acceptance>執行自動檢查</button></header>
    <div class="acceptance-summary" data-acceptance-summary aria-live="polite"></div>
    <section class="admin-panel"><h2>自動檢查</h2><div class="acceptance-checks" data-acceptance-checks></div><div data-integrity-results></div></section>
    <section class="admin-panel"><div class="panel-heading"><div><h2>Package 13–18 人工驗收</h2><p>每項結果與備註會保存在本機瀏覽器。</p></div></div><div class="acceptance-groups" data-acceptance-groups></div></section>
    <div class="admin-grid-two">
      <section class="admin-panel"><h2>Schema Registry</h2><div data-schema-list></div><button class="btn btn-secondary" type="button" data-run-migration>執行 Migration</button></section>
      <section class="admin-panel"><h2>Production Readiness</h2><h3>已完成</h3>${readinessList(productionReadiness.completed, "is-complete")}<h3>正式環境待完成</h3>${readinessList(productionReadiness.incomplete, "is-incomplete")}</section>
    </div>
    <section class="admin-panel"><h2>Production Foundation 建議順序</h2><ol class="acceptance-flow">${productionReadiness.order.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></section>
    <section class="admin-panel"><h2>Local Demo 建議驗收流程</h2><ol class="acceptance-flow is-compact">${recommendedTestFlow.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol></section>
    <section class="admin-panel demo-reset-panel"><h2>Demo 備份與重置</h2><p>匯入會先驗證檔案；驗證失敗不會覆寫現有資料。重置會保留一位可登入的 Super Admin。</p><div class="admin-actions"><button class="btn btn-secondary" type="button" data-reset-preview>預覽重置</button><button class="btn btn-secondary" type="button" data-reset-backup>匯出備份</button><label class="btn btn-secondary file-button">匯入備份<input type="file" accept="application/json,.json" data-backup-import></label><button class="btn btn-danger" type="button" data-reset-confirm disabled>確認重置 Demo 資料</button></div><div class="reset-preview" data-reset-result aria-live="polite">尚未執行操作。</div></section>
  </section>`;
}

export function initializeAcceptancePage({ identityRepository, permissionService, session, showToast = () => {}, onReset } = {}) {
  const page = document.querySelector("[data-acceptance-page]");
  if (!page) return;
  const registry = getSchemaRegistry();

  const renderRecords = () => {
    page.querySelector("[data-acceptance-groups]").innerHTML = listAcceptanceRecords().map((group) => `<article class="acceptance-group"><h3>Package ${group.package} — ${escapeHtml(group.name)}</h3>${group.items.map((item) => `<div class="acceptance-record" data-record="${item.id}"><label><span>${escapeHtml(item.label)}</span><select data-record-status>${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}"${item.status === value ? " selected" : ""}>${label}</option>`).join("")}</select></label><label><span class="sr-only">備註</span><input type="text" maxlength="500" value="${escapeHtml(item.notes)}" placeholder="測試備註" data-record-notes></label><button class="btn btn-secondary btn-small" type="button" data-save-record>儲存</button><small>${item.testedAt ? new Date(item.testedAt).toLocaleString("zh-TW") : "尚未測試"}</small></div>`).join("")}</article>`).join("");
  };
  const renderSchemas = () => {
    page.querySelector("[data-schema-list]").innerHTML = registry.list().map((schema) => `<div class="schema-row"><span>${escapeHtml(schema.name)}</span><strong>v${schema.version} / v${schema.currentVersion}</strong></div>`).join("");
  };
  const renderChecks = () => {
    const result = runAcceptanceChecks({ identityRepository, permissionService, session });
    page.querySelector("[data-acceptance-summary]").innerHTML = `<div class="acceptance-status is-${result.passed ? "ready" : "attention"}"><strong>${result.passed ? "自動檢查通過" : "仍有項目需處理"}</strong><span>${escapeHtml(result.environment.version)} · ${new Date(result.checkedAt).toLocaleString("zh-TW")}</span></div>`;
    page.querySelector("[data-acceptance-checks]").innerHTML = result.checks.map((check) => `<div class="acceptance-check"><span class="status-dot is-${check.pass ? "success" : "danger"}" aria-hidden="true"></span><span>${escapeHtml(check.label)}</span><strong>${check.pass ? "PASS" : "FAIL"}</strong></div>`).join("");
    const issues = result.integrity.issues;
    page.querySelector("[data-integrity-results]").innerHTML = issues.length ? `<details class="integrity-results"><summary>${issues.length} 筆資料問題</summary>${issues.map((item) => `<p><strong>${escapeHtml(item.code)}</strong> ${escapeHtml(item.message)} ${item.entity ? `(${escapeHtml(item.entity)})` : ""}<br><small>${escapeHtml(item.suggestion)}</small></p>`).join("")}</details>` : `<p class="success-message">資料完整性檢查未發現問題。</p>`;
  };

  page.addEventListener("click", (event) => {
    const saveButton = event.target.closest("[data-save-record]");
    if (!saveButton) return;
    const row = saveButton.closest("[data-record]");
    saveAcceptanceRecord(row.dataset.record, { status: row.querySelector("[data-record-status]").value, notes: row.querySelector("[data-record-notes]").value });
    renderRecords();
    showToast("驗收結果已儲存。", "success");
  });
  page.querySelector("[data-run-acceptance]").addEventListener("click", () => { renderChecks(); showToast("自動檢查已更新。", "info"); });
  page.querySelector("[data-run-migration]").addEventListener("click", () => {
    const result = registry.migrate();
    renderSchemas();
    renderChecks();
    showToast(result.idempotent ? "Schema 已是最新版本。" : `已完成 ${result.migrated.length} 項 Migration。`, "success");
  });
  page.querySelector("[data-reset-preview]").addEventListener("click", () => {
    const preview = previewDemoReset();
    page.querySelector("[data-reset-result]").textContent = `將清除 ${preview.keyCount} 組 NXSPACE 本機資料；目前共有 ${preview.userCount} 位使用者。${preview.preserves}`;
    page.querySelector("[data-reset-confirm]").disabled = false;
  });
  page.querySelector("[data-reset-backup]").addEventListener("click", () => downloadJson(createLocalBackup(), `nxspace-local-demo-${new Date().toISOString().slice(0, 10)}.json`));
  page.querySelector("[data-backup-import]").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      validateLocalBackup(backup);
      const result = importLocalBackup(backup, { actor: session?.user?.id || "system" });
      page.querySelector("[data-reset-result]").textContent = `備份匯入完成，共 ${result.keyCount} 組資料。`;
      renderRecords(); renderSchemas(); renderChecks();
      showToast("Demo 備份已匯入。", "success");
    } catch (error) {
      page.querySelector("[data-reset-result]").textContent = `匯入失敗：${error.message}`;
      showToast(error.message, "danger");
    } finally {
      event.target.value = "";
    }
  });
  page.querySelector("[data-reset-confirm]").addEventListener("click", () => {
    if (!confirm("確定重置所有 Demo 資料？建議先匯出備份。")) return;
    try {
      const result = resetDemoData({ currentUserId: session?.user?.id });
      showToast(`Demo 資料已重置，保留使用者 ${result.preservedUserId}。`, "success");
      onReset?.();
    } catch (error) {
      showToast(error.message, "danger");
    }
  });
  renderRecords();
  renderSchemas();
  renderChecks();
}

function downloadJson(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
