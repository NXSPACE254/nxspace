# Production Roadmap

Production status: **NOT STARTED**

## Production Foundation recommended order

1. 建立 Cloudflare Worker API 與環境設定。
2. 建立 D1 Schema、Migration、索引與資料約束。
3. 導入正式 Authentication、HttpOnly Cookie、Session 到期與撤銷。
4. 將 Permission 與 merchant／organizer／activity Scope 移到伺服器端。
5. 為訂單、供應量、報名與收款建立 Transaction Lock／idempotency。
6. 建立 R2 媒體儲存、驗證、公開／簽名 URL 與生命週期。
7. 在 Worker 端整合 LINE 與 Email，Secret 只存於正式 Secret Storage。
8. 建立 Google Sheets 的唯讀報表／匯出流程，不承載 Session、權限或交易真實來源。
9. 加入 Rate Limit、結構化 Audit、監控、告警與正式備份復原。
10. 建立 Staging、自動驗證與 Production Deployment 流程。

## Blockers

- Cloudflare Worker、D1、R2。
- 正式 Authentication 與 server-side authorization。
- Session Security、Secret Storage、Rate Limit。
- 訂單／報名／收款並行一致性。
- LINE Messaging API、Email Provider、金流與電子發票。
- 備份復原、監控告警、Staging 與 Production Deployment。
