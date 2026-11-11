# Production Security Boundary

Beta V1 is a Local/Static Demo. Browser password hashes, SessionStorage, client permissions and LocalStorage are inspectable and mutable by the browser owner.

Before Production:

1. Replace Local Authentication with hosted identity, MFA and secure HttpOnly sessions.
2. Enforce every route, action and record scope on the server.
3. Replace LocalStorage repositories with a concurrent database and server validation.
4. Store API keys, Google credentials and write tokens only in Worker/backend Secret storage.
5. Add CSRF strategy, rate limiting, request size limits, security logging and account recovery.
6. Use protected media storage, malware/type validation and signed upload policies.
7. Encrypt sensitive data, define retention/deletion policy and protect backups/audit logs.
8. Run dependency-free static security review plus hosted penetration and privacy review.

Google Sheets browser access is limited to published public read data. Protected writes use the `ProtectedWriteAdapter` boundary and must terminate at an authenticated server endpoint.
# Beta V1.1 Production Gate

LocalStorage 僅供單一瀏覽器驗收。正式環境必須將 Authentication、merchant scope、訂單 Query／Mutation、通知與 Audit 移至受保護 Backend，再接 Production Database。LINE Token／Secret 僅能存在 Worker／Server Secret。

前端 LINE Payload 僅包含 eventId、type、merchantId、orderId、notificationTemplate、idempotencyKey。Worker 必須驗證身分與 merchant scope、解析受保護通知目標、Rate Limit、Retry 並使用 Worker Secret。
