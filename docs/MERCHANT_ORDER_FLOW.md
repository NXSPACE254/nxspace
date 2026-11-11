# 商店點餐與接單流程

公開流程：`商店列表 → 商店菜單 → 日期與時段 → 客製化 → 購物車 → 顧客資料 → 訂單確認 → 公開查詢`。

每張訂單只屬於一個 `merchantId`。購物車切換商店前必須由顧客確認清空。送出時重新驗證商店、日期、時段、商品、數量、客製化與價格。

狀態主流程：`pending_merchant_confirmation → accepted → preparing → ready → completed`。拒絕、取消與未取餐只允許由 `commerce-service.js` 定義的轉換進入，並保存操作者、原因與時間。

Vendor 查詢及 Mutation 都以指派的 `merchantId` scope 過濾；隱藏導覽不是授權機制。

Package 12 的容量只計入有效狀態；拒絕與取消釋放容量。接受／拒絕會先確認，拒絕原因分為顧客可見內容與內部備註。
