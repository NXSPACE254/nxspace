# Commerce Data Adapter

Schema 版本為 1.1，定義 merchants、merchant_users、merchant_business_hours、merchant_pickup_slots、merchant_closures、product_option_groups、product_options、orders、order_items、order_item_options、order_status_history、notification_events、notification_targets。

Public Projection 會遞迴移除顧客姓名、電話、Email、備註、密碼摘要、使用者指派、通知 Target、Token、Secret 與 Credential。Private Projection 要求已驗證身分及被授權 merchantId。正式 Write Payload 需通過 collection、schema、conflict metadata 與 Secret 檢查。

正式訂單與顧客資料只能寫入受保護 API；Google Sheets Public Read 僅限公開商店、營業時間、時段、休息日與公開商品選項。
