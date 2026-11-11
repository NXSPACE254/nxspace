import { NotificationRepository, getNotificationService } from "../services/notification-service.js";
import { getCommerceRepository } from "../services/commerce-service.js";

const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const statusLabels = { queued: "等待處理", processing: "處理中", sent: "已處理", failed: "發送失敗", skipped: "已略過", disabled: "已停用" };
const channelLabels = { local: "Local Adapter", line: "LINE（未設定）", email: "Email（未設定）" };
export function createNotificationCenterPage() {
  const events = new NotificationRepository().list(), organizations = [...new Set(events.flatMap((item) => [item.merchantId, item.organizerId]).filter(Boolean))];
  return `<section data-notification-center><div class="admin-page-header"><div><span class="admin-eyebrow">Local Notification</span><h1>通知中心</h1><p>Local 通知可執行；LINE 與 Email 未設定時只會標記為已停用。</p></div><button class="btn btn-secondary" data-notification-test>建立 Local 測試通知</button></div>
  <div class="admin-toolbar notification-filters"><input type="search" data-filter="query" placeholder="搜尋標題、訊息或關聯編號"><select data-filter="event"><option value="">全部事件</option>${[...new Set(events.map((item) => item.eventType))].map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join("")}</select><select data-filter="channel"><option value="">全部管道</option>${Object.entries(channelLabels).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select><select data-filter="status"><option value="">全部狀態</option>${Object.entries(statusLabels).map(([key, label]) => `<option value="${key}">${label}</option>`).join("")}</select><select data-filter="owner"><option value="">全部店家／主辦單位</option>${organizations.map((value) => `<option>${esc(value)}</option>`).join("")}</select><input type="date" data-filter="from" aria-label="開始日期"><input type="date" data-filter="to" aria-label="結束日期"><button class="btn btn-secondary" data-notification-clear>清除 Local Demo 通知</button></div>
  <div class="notification-cards" data-notification-list>${events.map(card).join("") || '<div class="admin-empty"><p>目前沒有通知事件。</p></div>'}</div></section>`;
}
function card(event) {
  const owner = event.merchantId || event.organizerId || "";
  return `<article class="notification-card" data-notification-record data-search="${esc(`${event.title} ${event.message} ${event.relatedEntityId} ${owner}`.toLowerCase())}" data-event="${esc(event.eventType)}" data-channel="${event.channel}" data-status="${event.status}" data-owner="${esc(owner)}" data-date="${event.createdAt.slice(0, 10)}"><header><strong>${esc(event.title)}</strong><span>${statusLabels[event.status]}</span></header><dl><div><dt>事件</dt><dd>${esc(event.eventType)}</dd></div><div><dt>管道</dt><dd>${channelLabels[event.channel]}</dd></div><div><dt>關聯資料</dt><dd>${esc(event.relatedEntityType)}／${esc(event.relatedEntityId || "無")}</dd></div><div><dt>重試次數</dt><dd>${event.retryCount}</dd></div></dl><p>${esc(event.message)}</p><details><summary>Payload 摘要</summary><pre>${esc(JSON.stringify(event.payload, null, 2))}</pre></details><small>${esc(event.lastError)}</small><time>${new Date(event.createdAt).toLocaleString("zh-TW")}</time><div class="admin-row-actions"><button class="btn btn-secondary" data-notification-retry="${event.notificationId}">重試</button><button class="btn btn-secondary" data-notification-handled="${event.notificationId}" ${event.handledAt ? "disabled" : ""}>${event.handledAt ? "已標記處理" : "標記已處理"}</button></div></article>`;
}
export function initializeNotificationCenter({ identityRepository, session, showToast }) {
  const root = document.querySelector("[data-notification-center]"), repository = new NotificationRepository(), service = getNotificationService(); if (!root) return;
  const applyFilters = () => {
    const get = (name) => root.querySelector(`[data-filter="${name}"]`)?.value || "", query = get("query").toLowerCase(), from = get("from"), to = get("to");
    root.querySelectorAll("[data-notification-record]").forEach((card) => { card.hidden = Boolean(query && !card.dataset.search.includes(query) || get("event") && card.dataset.event !== get("event") || get("channel") && card.dataset.channel !== get("channel") || get("status") && card.dataset.status !== get("status") || get("owner") && card.dataset.owner !== get("owner") || from && card.dataset.date < from || to && card.dataset.date > to); });
  };
  root.querySelectorAll("[data-filter]").forEach((field) => field.addEventListener(field.type === "search" ? "input" : "change", applyFilters));
  root.addEventListener("click", async (event) => {
    if (event.target.closest("[data-notification-test]")) { const merchant = getCommerceRepository().listMerchants()[0]; await service.test(merchant.merchantId); identityRepository.audit("notification.tested", merchant.merchantId, session.userId); location.reload(); }
    const retry = event.target.closest("[data-notification-retry]"); if (retry) { const record = repository.list().find((item) => item.notificationId === retry.dataset.notificationRetry); await service.retry(record); identityRepository.audit("notification.retried", record.notificationId, session.userId); showToast(record.channel === "local" ? "Local 通知已重試。" : `${record.channel.toUpperCase()} Adapter 尚未設定。`); location.reload(); }
    const handled = event.target.closest("[data-notification-handled]"); if (handled) { repository.markHandled(handled.dataset.notificationHandled); identityRepository.audit("notification.handled", handled.dataset.notificationHandled, session.userId); location.reload(); }
    if (event.target.closest("[data-notification-clear]") && confirm("確定清除目前權限範圍內的 Local Demo 通知？")) { repository.clearLocal(); identityRepository.audit("notification.local-cleared", "notifications", session.userId); location.reload(); }
  });
}
