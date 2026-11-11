# LINE Messaging 整合邊界

Package 11 僅提供 Local Notification Log。事件狀態為 `local_only`，介面明確顯示「LINE 通知尚未設定」，不得視為 LINE 已成功送出。

正式環境必須由 Cloudflare Worker 或 Backend 實作 LINE Messaging Adapter，並將 Channel Access Token 與 Channel Secret 保存於 Server Environment Secret。Secret 不得進入前端 JavaScript、LocalStorage、Google Sheets 或 GitHub。

通知事件只保存 eventId、type、merchantId、orderId、時間、狀態、嘗試次數及安全錯誤。預覽不得包含完整手機、Email、私人備註或憑證。

預定 Endpoint 為 `POST /api/notifications/line`。前端不傳 LINE User／Group ID；Worker 負責查找受保護 Target、建立訊息、去重、限流、重試與結果紀錄。Endpoint 未設定時回傳 `not_configured`。
