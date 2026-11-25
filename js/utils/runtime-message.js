import { environment } from "../config/environment.js";

export function isDemoRuntime(config = environment) {
  return config.adapterMode === "local" || /demo$/.test(config.mode || "");
}

export function runtimeMessage(demoText, productionText, config = environment) {
  return isDemoRuntime(config) ? demoText : productionText;
}

export function runtimeStatusLabels(labels = {}, config = environment) {
  return Object.freeze(Object.fromEntries(Object.entries(labels).map(([key, label]) => [
    key, runtimeMessage(`模擬狀態：${label}`, label, config)
  ])));
}

// Format existing records at read time as well; no LocalStorage migration is needed.
export function runtimePublicNote(note = "", config = environment) {
  if (!isDemoRuntime(config)) return note;
  const legacyDefaults = [
    "申請已收到，NXSPACE 將依序確認場地與活動內容。",
    "訂單已收到，NXSPACE 將依訂單狀態準備商品。",
    "訂單已送出，等待店家確認。"
  ];
  if (!note || legacyDefaults.includes(note)) {
    return "資料僅儲存在此瀏覽器，NXSPACE、店家及主辦單位未收到資料；不成立預約、訂單或報名，未付款、未寄送通知。";
  }
  return `本機模擬備註（非正式處理結果）：${note}`;
}
