# Beta V1.1 Refinement Acceptance

## Result

- Local Demo: **COMPLETE**
- Production: **NOT STARTED**
- Accepted package range: Package 13–18

## Automated acceptance

- ES Module imports: PASS
- Notification Schema and payload sanitization: PASS
- Local notification delivery: PASS
- LINE／Email disabled behavior: PASS
- Production API／Remote Repository disabled boundary: PASS
- Schema Registry and idempotent Migration: PASS
- Demo data integrity and capacity: PASS
- Permission Key and Viewer read-only checks: PASS
- Audit／LocalStorage privacy checks: PASS
- Backup validation and unsafe-key rejection: PASS

## Manual Live Server flow

1. 重置 Demo 資料。
2. 登入管理中心並檢查管理首頁、場務首頁、店家首頁與 Viewer。
3. 建立活動、場租邀請並完成公開填寫。
4. 建立店家、商品、客製化、供應量與時段容量。
5. 使用手機 POS 建立、更新及作廢訂單，檢查營收。
6. 建立活動報名設定，完成公開報名、審核、額滿與取消測試。
7. 檢查場租收款、通知中心與 Audit。
8. 於驗收中心執行 Schema Migration、完整性與隱私檢查。
9. 驗證 Vendor 只見所屬資料、Organizer 只見所屬活動、Viewer 無法寫入。
10. 匯出備份、以有效備份匯入，並確認無效備份不覆寫資料。
11. 在 375px、768px、1280px 檢查表格、表單、Modal、導覽與驗收中心。

## Release statement

`Beta V1.1 Refinement Local Demo：COMPLETE`

此狀態只代表本機展示與驗收範圍完成，不代表 Production 已上線。
