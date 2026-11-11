# Known Limitations

## Local Demo boundary

- 資料與 Session 只保存在瀏覽器 LocalStorage，不是多人或跨裝置系統。
- Local Adapter 只記錄站內通知；LINE 與 Email Adapter 明確回傳 `disabled`。
- 媒體只產生本機預覽，不會持久保存；R2 Adapter 尚未啟用。
- Repository Factory 的 remote 模式與 Production API Client 尚未設定，會拒絕執行。
- 權限與 Scope 是前端 Demo 防護，不能取代 server-side authorization。
- 沒有交易鎖，訂單、供應量、報名容量不支援多人並行寫入。
- Demo 備份是瀏覽器下載／匯入，不是正式備份、版本保留或災難復原。
- Google Sheets、金流、電子發票、LINE、Email 與正式監控尚未整合。

## Security boundary

- 專案不保存正式 API Key、Channel Token、密碼或銀行帳號。
- 正式環境仍需 HttpOnly Cookie、Session Revocation、Rate Limit、Secret Storage、登入 Audit 與資料庫層權限。
- Production 狀態為 **NOT STARTED**。
