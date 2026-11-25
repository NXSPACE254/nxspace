# NXSPACE Platform Beta V1.1 — Project Status

## BRAND-01 FINAL｜正式入口結案

- 正式品牌、舊 QR 路徑、點餐及公益靜態預告驗收通過。Pages 綁定與 TLS 已核對，DNS 精確欄位的 API 讀取限制留在紀錄。見 [正式驗收與回復](PACKAGE_30_BRAND_01.md)。

## BRAND-01｜正式點餐送單修補

- `oasis-order` 已部署送單誤報修補。三個原網址的公開菜單及攔截式驗收通過。下一步待授權一筆受控測單，根網域維持原站。見 [部署與回復紀錄](PACKAGE_30_BRAND_01.md)。

## BRAND-01｜獨立 Pages 公開測試

- `nxspace-brand` 已上傳並部署。根網域與點餐子網域維持既有綁定，正式切換前仍須部署並驗收點餐送單修補。 [品牌公開測試](https://nxspace-brand.pages.dev/)

## BRAND-01｜點餐子網域啟用後驗收

- `order.nxspace.tw` 已通過 HTTPS 與實際菜單唯讀驗證。正式送單誤報成功的修補尚未部署，端到端寫入仍待營運授權。獨立品牌 Pages 可先上傳預覽，根網域切換暫緩。見 [本輪驗收及切換手冊](PACKAGE_30_BRAND_01.md)。

## 2026-11-20｜BRAND-01 正式入口上線準備

- 品牌 Pages 首次預覽、正式雙入口候選成品及純靜態公益預告皆已本機打包。點餐隔離驗證與公開菜單唯讀檢查通過。下一個正式操作為授權現有 `oasis-order` 加上點餐子網域及相應 DNS，保留原根網域。見 [部署與回復順序](PACKAGE_30_BRAND_01.md)。

## 2026-11-20｜AUTH-FREE-02D 最後驗收

- 正式部署不放行。管理員首次改密持續超過 10 ms，另有一次 staging 改密回傳 503。書屋合併送審的 CPU P95 為 10.671 ms。見 [最終驗收](PACKAGE_30_AUTH_FREE_02D.md)。
- `nxspace.tw` 仍為現有點餐網站。公益預告、合作單位登入及公開功能關閉已在 staging 驗證。見 [BRAND-01](PACKAGE_30_BRAND_01.md)。

## 2026-11-20｜AUTH-FREE-02D 書屋建檔與首次改密續作

- 72 項本機測試與 59 次 staging HTTP 驗證通過。書屋三條優先路徑的可辨識 CPU 樣本均低於 10 ms。管理員含 TOTP 的首次改密仍達 10.761 ms，正式部署暫緩。見 [雲端驗收](PACKAGE_30_AUTH_FREE_02D.md)。

## 2026-11-19｜AUTH-FREE-02D 建檔與案件查閱 CPU

- 既有 staging 通過帳號及建檔回歸。案件查閱 CPU 已降低，書屋草稿及送審仍超過 Workers Free CPU 預算，正式部署暫緩。見 [雲端驗收](PACKAGE_30_AUTH_FREE_02D.md)。

## 2026-11-19｜AUTH-FREE-02C Workers Free CPU 定位

- 已在原 staging 部署心願路徑優化。書屋送審 CPU 已下降，仍高於 Workers Free 的 10 ms 預算，暫緩正式部署。見 [CPU 驗收紀錄](PACKAGE_30_AUTH_FREE_02C.md)。

## 2026-11-19｜AUTH-FREE-02B 隔離雲端驗收

- 真實 Supabase 帳密、角色、撤銷與合成建檔功能通過。Workers Free CPU P99 60.538 ms 超出 10 ms 預算，暫緩正式部署。見 [雲端驗收紀錄](PACKAGE_30_AUTH_FREE_02B.md)。

## 2026-11-19｜Package 30-AUTH-FREE-01

- 密碼驗證改由 Supabase Auth，保留 NXSPACE 帳號、TOTP、D1 單位權限及 24 小時工作階段。待認證服務實際雲端及 Workers Free CPU 驗收。
- 下一步由 NXSPACE 建立 Free 隔離專案並確認受管信箱。見 [AUTH-FREE-01 操作手冊](PACKAGE_30_AUTH_FREE_01.md)。

## 2026-11-19｜Package 30-BRAND-01 品牌入口與點餐分流準備

- 品牌首頁與兩個服務入口可透過 Live Server 預覽，另備獨立 Pages 靜態成品。確認 Oasis-order 正式 SHA，以隔離瀏覽器驗證送單確認修補與舊 `#order` 深連結。
- 下一步待授權將 `order.nxspace.tw` 加至原 Pages 並驗收，之後才切換根網域。見 [BRAND-01 操作手冊](PACKAGE_30_BRAND_01.md)。

## 2026-11-19｜DEPLOY-05D 帳號架構確認

- 保留統一登入、單位角色及唯一 Super Admin。補上登入後的「我的帳號」，新增 `0020_staff_profiles.sql` 儲存自助維護的顯示名稱和聯絡信箱。密碼變更沿用原 API。
- 本機實測 OWASP 建議參數的 PBKDF2 同樣超出 Workers Free 的預算。正式等待執行方案核定及隔離雲端資源驗證。見 [DEPLOY-05D 驗證紀錄](PACKAGE_30_DEPLOY_05D.md)。

## 2026-11-19｜Package 30-DEPLOY-05C 帳密資源驗證

- 確認正式 Cloudflare 帳戶目前為 Workers Free。本機 scrypt 成本超出 Free CPU 預算，已完成 Node、workerd 與隔離 D1 驗證。
- 待授權 Workers Paid 與隔離 staging 驗證。通過前暫緩正式 D1 0019。見 [DEPLOY-05C 驗證紀錄](PACKAGE_30_DEPLOY_05C.md)。

## 2026-11-19｜Package 30-DEPLOY-05B 本機帳密與單位帳號管理

- 新增獨立身分、工作階段及稽核表，沿用公益活動、角色與單位授權。Super Admin 使用一次性初始化及 TOTP，合作單位使用帳密。
- 下一步待正式授權前，先驗證 Cloudflare CPU 預算、正式部署設定及復原方式。正式初始化與升級順序見 [DEPLOY-05B 操作手冊](PACKAGE_30_DEPLOY_05B.md)。

## 2026-11-19｜Package 30-DEPLOY-04 公益預告與建檔部署準備

- 更新預告首頁與合作單位登入入口，補上正式 Worker 的私人認領查詢開關。Wrangler 正式 D1 綁定、55 個白名單資產及 dry run 均已核對，所有功能開關預設關閉。
- 隔離 D1、合成 Access 與 Chromium 驗收通過。正式公開前優先核對 Zero Trust 應用並取得 Access、正式初始化及部署授權。程序見 [DEPLOY-04 上線檢查](PACKAGE_30_DEPLOY_04.md)。

## 2026-11-19｜Package 30-DEPLOY-03 正式 D1 初始化

- 正式 D1 `nxspace-christmas-intake-prod` 已套用 0001–0018。部署來源為 `88e56d62ceecae6a5f9b1708564541ee602cf02e`，各 SQL 與該 Commit 一致。
- 下一階段 Worker 部署前，先按使用者確認的兩階段規則核對公開入口和權限。內部建檔階段，`christmas.nxspace.tw` 顯示「聖誕公益即將上線，敬請期待」，提供使用既有 Cloudflare Access 的「合作單位登入」及公開隱私政策。書屋與 NXSPACE 可建檔及審核，米勒、大樹、CAMA 依授權使用各自工作區。民眾瀏覽、認領與相關 API 關閉。
- 正式公開階段由 NXSPACE 管理員決定時點，透過後端開關分別開啟公開瀏覽與認領，切換時保留既有心願。

## 2026-11-18｜Package 30-LAUNCH 本機上線整合

- 新增公益正式路由與四組開關、公開入口、V1.0 隱私政策原文、正式設定範本及 LAUNCH 白名單。修改 Worker、既有心願與履約介面和隔離測試，沿用 18 份 migration 與單一活動資料來源。
- 新增 `docs/PACKAGE_30_LAUNCH.md`、`docs/PACKAGE_30_LAUNCH_BRAND.md` 及品牌打包腳本，沿用 30-C1 的四份預覽來源。
- 下一步待核定正式 IdP、資料庫、政策發布及書屋資料來源，並完成正式點餐子網域與舊 QR 預演。真實資料寫入與正式發布另行授權。

## 2026-11-18｜Package 30-D1 聖誕公益正式建檔準備

- 新增 `backend/christmas/src/intake-worker.mjs`、`staff/index.html`、`staff/christmas-intake.js`、`package-intake.ps1`、`tests/intake-worker.test.mjs` 及 `docs/PACKAGE_30D1_INTAKE.md`。
- 更新 `access-auth.mjs`、`wrangler.example.toml`、`christmas-case-workspace.js`、`christmas-controls.js`、`christmas-management-tools.js`、`christmas.js`、`platform-audit-view.js` 與兩份專案紀錄。以 Access、專用 D1 及服務端路由白名單重用既有心願案件與審核流程。
- 隔離 workerd／D1 與 Chromium 完成 NX-001 建檔、審核、撤回、私密存取、帳號停用和備份還原。Package 29 回歸 406／406，SQLite 及 D1 瀏覽器流程通過。
- 正式合作單位各使用一組帳號，稽核歸屬單位。公益後台 Access 工作階段統一 24 小時；新增 `0018_intake_session_revocations.sql`，供 Worker 即時撤銷並稽核主動登出。
- 下一步為人工驗收、確認活動資料與初始帳號，並取得正式 Access、D1 與 Worker 部署授權；公開及認領階段另案驗收。

## 2026-11-18｜Package 30-C1 品牌入口網站預覽

- 新增 `preview/brand/index.html`、`brand.css`、`brand.js`、`order-preview.html`。提供品牌首頁、點餐模擬入口、舊 `#order` 導向及「心願整理中」介紹。正式服務網址預設停用。
- 更新 `docs/PROJECT_STATUS.md`、`docs/CHANGELOG.md`。從專案根目錄啟動 Live Server 後開啟 `/preview/brand/`。預覽未接入營運 API、測試資料或正式服務。
- 下一步等待人工檢視。確認後，由 Package 30-C2 補齊實體 QR、正式點餐網址與回復條件。

## 2026-11-17｜Package 29 本機初始化與版本封存

- 依最新授權不再清理已停止的10633；由17份Migration建立獨立新營運SQLite，60表、Roles三筆，其餘59表皆0。未填入未確認的營運資料。
- 完整備份實際還原、完整性及外鍵檢查通過；另外的驗證副本完成NX-001新增／送審／核准／公開，初始庫雜湊及零筆數不變。
- 10633加密備份與10634訓練資料均保留；10634逐表比對與原備份一致。全回歸406／406及PIN修正證據核對有效，20份測試檔SHA256一致，未重跑已完成功能。
- P29來源／測試／文件以本機Commit封存，不Push、不部署。正式日期、據點、聲明、真實授權帳號、獨立金鑰及服務部署仍待設定，詳見PACKAGE_29_DATABASE_INITIALIZATION.md。
- 下一步僅等待人工確認；不啟動Package30，後續全站整合另由使用者指示。

## 2026-11-16｜Package 29 技術收尾，10633即時來源缺失阻擋結案

- 使用者已完成10634全流程人工驗收。本輪僅修PIN隱私測試誤判、測試證據輸出與Git忽略規則，未重做功能。
- 全部20份後端測試檔完整回歸406／406（SQLite／D1，0失敗、0跳過）；最終PIN專項28／28，首頁11／11，185份JS／MJS語法通過；SQLite／D1各4組畫面回歸通過，pageerror均為0。
- 10634實查152心願／2認領／1收件／1交接批次／1送達，保持原狀；已建立新的DPAPI一致性備份。原10633歷史備份151／1及10634新備份均逐列還原成功、外鍵錯誤0、金鑰證明通過。
- 10633無監聽程序，原記憶體D1沒有可確認的即時持久檔案，故依指令停止清理；SQLite／D1副本清理與NX-001送審核准演練通過，不能視為原環境清理成功。
- HEAD仍為P28基準ef69d832c6f0d0eba837e26fea7fc13797400ea0；未stage、未Commit、未Push、未部署。需先確認原10633最後狀態或另行授權替代來源，才可初始化營運資料與結案。備份、SHA256、入口及全檔案清單見PACKAGE_29_OPERATIONS.md。

## 2026-11-16｜Package 29 進行中，依使用者指示暫停後續開發

- 基準 ef69d832c6f0d0eba837e26fea7fc13797400ea0；保留中斷前修改，未提交、Push 或部署。
- SQLite／D1專項24／24；兩引擎各4組畫面檢查通過，包含375／768／1280px及CMS。完整回歸尚未結束，已觀察到SQLite既有PIN帳號測試失敗，不宣稱全數通過。
- 304份來源及1945份既有證據備份SHA256差異0。DPAPI備份隔離還原59張應用表、151心願／1認領，逐列差異及外鍵錯誤0；95張表說法未獲證據支持。SQLite／D1隔離清理通過，原10633未清理。
- 使用者最新決策：暫不清理原始資料庫；等待C57～C88原文交叉比對，不擅自結案。正式據點／隱私聲明未提供，據點自行新增管理仍為缺失。詳見PACKAGE_29_OPERATIONS.md。


## 2026-11-16｜Package 28 公益認領、紙本寄送與後台設定

- 基準 `6a40ae2`。直接認領、Email＋四位數字 PIN、必要電話與紙本寄送必填；停用新流程 Email／LINE、舊驗證與自助資料修改入口。PIN 採 salt／HMAC pepper／PBKDF2，後端限速、暫鎖、HttpOnly 工作階段與 NXSPACE 核身重設。
- 認領保存公開心願與同意版本；沿用內容後台管理隱私權草稿／預覽／發布、FAQ 動態管理。修復隱藏欄位驗證阻擋儲存；活動日期直接儲存且不重算舊案件期限。
- 官方中華郵政 22 縣市、368 行政區及另列 3 郵遞區域，371 筆逐列跨來源核對；地址更正加密留痕、寄送事件快照與 Excel 分列，保留原文件需求並標示本列寄送文件。
- 初輪完整回歸 376／377，一項 VM 啟動參數錯誤修正後前端 4／4；最後針對性回歸 33／33。SQLite／D1 各 8 組畫面及 375／768／1280 px 通過，來源核對 0 差異；所有中途失敗保留，詳見 PACKAGE_28_OPERATIONS.md。
- 原 NX-151 與舊服務保留，最終驗收入口 10633 為獨立 D1 合成副本、原公開內容相同；10632 中途預覽亦保留。新增 16／修改 22 檔，開發前 288 來源／1,802 既有證據與 Git bundle，最終備份核對見 FINAL_BACKUP.json。
- 未 Push／部署／寄真實通知／清資料。正式聲明與據點資料、真實裝置／列印／Excel、持久備援及正式服務仍待人工確認；記憶體預覽不可視為持久資料備份。下一階段僅先等待使用者驗收，經指示後再安排 Package 29。

## 2026-11-16｜Package 27 公益流程與前後台整合

- 基準824aa3e；補齊草稿送審、退回原因與重新發布，保護既有認領，公開進度只呈現認領數。原NX-151及舊服務保留。
- 固定五個日曆日與最終收件日取較早值，既有期限不重算；書屋可部分領取、缺件追蹤及多件送達，文件先預覽筆數再匯出，補郵寄資料不重置製作進度。
- 後端姓名角色、直接授權查閱及稽核；Email安全重設採既有單次連結，本機不寄信。FAQ三範圍、主站活動分類、餐車狀態、場館素材共用與聯絡／查詢說明完成。
- 完整後端353／353；後續變更另有24項兩引擎流程與56項相容回歸，畫面E2E兩引擎各10組；主站58項、Origin11項及三尺寸通過。精確結果與所有中途失敗見PACKAGE_27_OPERATIONS.md及FINAL_DELIVERY。
- 新增6／修改40檔；開發前282份來源、1400份證據及Git歷史備份，最終逐檔核對結果見FINAL_BACKUP。最終入口10631，中途10630與舊服務保留；未Push、部署、寄信或清資料。
- 實際Word、真實照片／地址、正式身分／郵件與持久備援仍待驗收。建議下一Package 28為上線前素材與服務驗收，本次停止等使用者測試。

## 2026-11-15｜Package 26 公益補強與首頁優化

- 基準aa3b892；書屋專用xlsx寄送名單、加密郵遞區號與地址欄位、嚴格收件資料合併及獨立匯出資格；NX及據點不能下載。
- 共用後端PlatformAudit與現有操作紀錄頁介接，保留帳號、時間、結果及安全差異，登入／失敗／匯出可追蹤，過期清理與紀錄同交易。主站Local Demo紀錄與可信後端紀錄分開，未提前接完餐車與外送員事件。
- 公益首頁進度直接依公開心願及有效認領統計；取消、重認領與送達分開計算。
- 首頁八區排序、品牌標語、可管理重點活動與公告、今日排班及營業連動、少量商品、三場館及NT500未稅共用時租；不使用隨機圖冒充素材，缺照片／地址保留預設與洽詢。
- 首輪後端325項有4項相容性失敗，已同名重驗全過；最終新增24項、首頁6項、兩引擎既有公益各10組／新畫面各9組、原站59與Origin11項通過。聯合覆蓋329項，詳PACKAGE_26_OPERATIONS.md，失敗紀錄保留。
- 新增10／修改24檔；272份來源與1137份既有證據備份核對零差異。最終預覽10629，所有舊測試服務保留，未Push、部署、正式寄信或清資料。
- 下一步先實際Word及頁面驗收，補三館真實素材，再由使用者決定活動／場地分頁及正式身分介接；停止其他開發。

## 2026-11-15｜Package 25 操作精簡、管理整合及前台優化

- 基準b8b029b；前台兩類與跨類搜尋，保留12筆、翻卡與原地視窗，合作資訊集中下方。
- 案件主要四類，送達與文件分開；登入帶入建立單位、預設當日後5日、公開預覽審核。三據點連續收件、多筆交接時間選填，書屋依據點核對領取及記錄實際送達。
- 書屋專屬紙本文件可複選、獨立狀態及加密交付紀錄；NX不取得文件寄送資料。活動設定先檢查影響再保存，既有個別期限保留，沿用FAQ草稿預覽發布。
- 完整後端300項、最終補充SQLite12／D1 12及舊紀錄重試1項通過；兩引擎瀏覽器各10組、原站59項、Origin11項與三尺寸通過。失敗與修正紀錄見PACKAGE_25_OPERATIONS.md。
- 新增4檔、修改15檔；268份基準來源與980既有證據備份核對一致。最終驗收10626，10623／10624／10625保留；沒有Push、部署或正式寄信。
- 下一步僅由使用者驗收本次操作，停止其他開發。

## 2026-11-15｜Package 24 聖誕公益介面與操作整合

- 基準bc336605；前台12筆分頁、原地心願視窗與翻卡、自然臺灣用語、紙本文件及Email密碼查詢。新版不提供代填、可見憑證或自助重設連結；密碼12–128字元保護保留。
- 案件整合收件、交接、送達、紙本文件、需要協助、取消與歷程；三據點共用工作台。電話查詢權限／限流、原子取消原因、管理員核對重設與強制換密碼均由伺服器驗證。
- 沿用內容表，新增草稿、FAQ增刪排序、預覽發布與追加式紀錄；公益測試身分過期後仍維持受限畫面。
- 後端最終280項全過；兩引擎完整瀏覽器及檔案清單見PACKAGE_24_OPERATIONS.md。舊失敗證據保留；正式服務未啟用，沒有Push或部署。
- 保留10623資料，新版預覽10624。256份基準來源備份核對一致；下一步先由使用者驗收，再確認數字密碼安全方案，不自動開發其他模組。

## 2026-11-14｜Package 23 聖誕公益最終整合（本機驗收）

- 以0ed182e為基準，新增可編輯公開活動文案／12題FAQ、主站入口、私人認領日期／交件資訊、授權延長期限、8種本機Email模板與預覽；既有五單位收件交接、密碼安全及無附件流程保留。其他業務模組暫停擴充。
- 最終後端248項全過；原站58項、Origin11項、三尺寸及10623實際預覽驗證。SQLite／D1完整瀏覽器各12組通過，檔案清單見 CHRISTMAS_FINAL_INTEGRATION_20261114.md；過程失敗證據保留。
- 249來源備份復原零差異，591原證據雜湊未變。新預覽10623獨立保留，10621／10622未重置。
- 正式Resend、Workers／D1與身份、雲端遷移及寄送仍未啟用；無Push／部署。下一步先由使用者操作完整流程，再確認營運資料，不自動開始下一Package。

## 2026-11-14｜Phase 1保存／Phase 2主要可操作畫面

- Phase 1已保存本機Commit e8becbafc13d039e113b64a6f8718ae98c124dce；210來源備份核對零差異，沒有Push。
- Phase 2保留未提交：餐車自動成立／橫向工作台、Email＋密碼私人查詢、無附件紙本核對履約、場租500元未稅／人工收款與未寄送Email預覽、獨立Courier合成工作台。SQLite／D1新版10組瀏覽器、原站58項及三尺寸通過；完整後端228項、Origin11項及靜態包8組通過，123檔白名單來源核對零差異。
- 最新預覽http://127.0.0.1:10622/__test，原10621保留。完整入口、測試身份及限制見HANDOFF_PHASE2_OPERATIONS_20261114.md。正式Email、LINE、D1及認領仍未開放，沒有部署。
- 原始證據遺失／重建的既有標示不變，未清理任何證據。以下為前批歷史紀錄。

## Current status

- 2026-11-14最新交接Phase 0：V2已保存72a28ac405060cc68314b95bac4d7e63d772d268（36份必要來源）；20A 398檔＋4報告、新來源206檔備份與新目錄復原演練均零差異。獨立Package 22A缺原始指令，不能確認完成；22A-1不等於22A。
- Phase 1第一批導覽／角色／查詢整合保留未提交：公開六項主選單＋聖誕入口，後台六工作區，商家訂單入口，書屋與據點依已驗證單位限制工作區。8組操作及3種尺寸通過，公益SQLite18組重驗通過，Worker關閉21項、Client／模組4項通過；沒有部署或開正式服務。
- 最新規格以OPERATIONS_HANDOFF_20261114.md為準：Resend取代Gmail，今年無附件／R2非必要。Email＋密碼、無附件人工核對、餐車自動成立與橫向看板、場租500元及匯款流程、活動發布權限、Courier均未完成，不能用舊流程宣稱新規格已驗收。
- 證據事件：舊腳本輸出路徑寫死，導致原V2 SQLite JSON及12 PNG共13檔被本輪結果覆寫，原始位元組未找回。已隔離並標記，V2復原副本另重建18組通過；其他原始證據及備份未受影響。測試輸出改為獨立新目錄、拒絕覆寫。詳見HANDOFF_PHASE0_20261114.md、HANDOFF_PHASE1_OPERATIONS_20261114.md；已停止新增功能待確認。

- 聖誕公益Dashboard第二輪：公益八項功能整合原左側展開選單及手機抽屜；新增D1實際統計／2日內催收、獨立建立心願、桌機列表／手機卡片、單筆私人資料與情境附件；現行UI統一Email認領，歷史協助API及資料保留。詳見 `docs/CHRISTMAS_DASHBOARD_V2.md`。
- 本輪完整後端206項通過；新版SQLite 18組、D1操作17組＋純私人修改補驗1組、原21C 16組＋21C-R 10組、Origin 11組及原站58項通過。新增4／修改16份，舊證據保留。未Commit、Push或部署；待負責人確認後才保存並進入22A受保護測試部署準備，正式Email／認領／雲端附件仍關閉。

- 聖誕公益營運精簡（21C-S延伸）：NX SPACE名稱、登入單位自動稽核、統一5個臺灣日曆日期限、逾期排序、原子取消並重新開放、追加收件點更正、感謝卡／證明分開處理，以及左側展開選單、單筆心願與NX-001編號。原Claims及履約流程保留，正式Email／認領關閉。
- 完整後端187項、最後政策／Client 25項、SQLite及D1新版瀏覽器各12組、Origin針對性11組與原站58項驗收；證據另存`docs/evidence/christmas-simplified/`，正式環境界線及差異見`docs/CHRISTMAS_SIMPLIFIED_OPERATIONS.md`。本次未Commit、Push或部署，等待確認。
- Package 22A-1本機預覽：修正跨來源頂層HTML導覽被Sec-Fetch-Site檢查誤擋，以及HTML表單因no-referrer送出Origin:null；僅本機HTML改用same-origin政策。API Origin／Host／身份／權限與CSRF檢查保留，正式Worker不變。
- 獨立Playwright Chromium針對性11組驗收通過，涵蓋四入口、Dashboard登入、API讀寫、外部Origin／缺Origin／錯Host／iframe與未授權拒絕、正式寫入失敗關閉。預覽僅監聽127.0.0.1，可用NXSPACE_PREVIEW_PORT固定10621；本次修改未Commit、Push或部署，證據留在本機`docs/evidence/package-22a1/`。
- Package 21C-S：五組單位權限、Email免會員認養、現場協助認養、三據點收件與書屋交付、獨立感謝卡／文件／結案、期限及取消重新開放，沿用同一D1與Dashboard。
- 21C-R已保存本機Commit `d4286e52fa4da9acd1cb37298780cf1598a19d82`；21C-S經後續確認授權保存本機Commit，未Push、Merge或部署。
- 原140項後端回歸通過；新增28項SQLite／D1及Client／管理4項最終重驗。新版瀏覽器10組、原21C 16組、21C-R 10組及原站58項通過；原站外部圖片使用合成替身。
- 詳細權限、欄位、三尺寸截圖、測試證據及限制見 `docs/PACKAGE_21CS_OPERATIONS.md`。正式Worker、Email、雲端附件、通知及實際郵寄未啟用。
- 本機驗收結果可供審議22A範圍；尚未具備正式營運或無條件部署條件，不自行開始22A。
- 額度中斷後續驗：取消／重新開放／稽核回滾的SQLite及D1結果完整，最終後端／Client 32項、新版兩引擎各10組、原16＋10組瀏覽器及原站58項通過。Undo僅還原本節等三份文件補充，現依原補文與證據恢復；程式及測試來源一致，未重做Package。
- 21C-S提交範圍為26份來源與文件；本機截圖、日誌及驗收證據保留但不提交。正式雲端驗收及拍攝腳本僅語法檢查的界線見`docs/PACKAGE_21CS_OPERATIONS.md`。

### 21C-R歷史狀態

- 21C-R完成心願營運、附件及私人查詢擴充；保存前140項後端測試通過。歷史報告保留於 `docs/PACKAGE_21CR_OPERATIONS.md`，其中當時未提交的狀態已由上述21C-R保存Commit取代。

### 21C歷史狀態

- Package 21C：公益活動／匿名心願詳情／認領及私人進度已接入現有Hash Router；Dashboard新增公益管理，後端管理清單採DB權限及機構隔離。正式認領未開放。
- 21B-3已保存為 `83fe2422ed21aec6a8e2783c8e3161ba2b435deb`；21C保持未提交，無Push／Merge／部署。
- 驗證：既有118＋新增4項通過；21C瀏覽器16組通過，375／768／1280截圖；原站58項在外部圖片合成替身下通過。真實picsum圖片10張未載入，保留失敗，不混稱已通過。
- 詳見 `docs/PACKAGE_21C_INTEGRATION.md`。雲端端到端條件尚未具備；下一步等待使用者審閱及本機驗收，不開始新Package。

### 21B-3歷史狀態

- Package 21B-3：新增機構隔離、冪等收件、待簽收批次、機構簽收、送達、異常／解除、私人進度及附件介面；沿用同一DB，累積21表。118／118通過（76一般／HTTP＋42 D1模擬），詳見 `docs/PACKAGE_21B_3_FULFILLMENT.md`。
- 21B-2已保存本機Commit `4227d4b1e3b6296da93a911309e262a066b7315c`；21B-3保留工作區，未Commit／Push／部署。正式API未開放。
- 下一階段可規劃本機公益前台／Dashboard整合，須另行確認；正式機構導入與Access／通知／儲存等設定仍待完成。

### 21B-2歷史狀態

- Package 21B-2：新增Access JWT驗證、D1原子限流、安全邊界／日誌、版本化加密／HMAC、授權解密、金鑰輪替、憑證期限／撤銷與到期個資清除；80／80本機測試通過（57一般＋23 D1模擬）。未開放正式API。
- 21B-1已保存本機Commit `a88d784246dab382758bd553e1a862346748352f`；21A仍為 `9e880619e4ea64294fdc9aab0bfda7cfa5f4e4bf`。21B-2未Commit、Push或部署。
- 21B-2驗收與正式設定缺口見 `docs/PACKAGE_21B_2_SECURITY.md`；下一步需使用者確認21B-3範圍。

### 21B-1歷史狀態

- Package 21B-1：完成獨立 D1 介面 Repository、加密、原子認領、冪等恢復、取消／逾期／異常及憑證輪替；37項一般 SQLite／本機 HTTP＋16項官方 Miniflare D1模擬通過，雲端尚未驗證。
- 21A 已本機保存為 `9e880619e4ea64294fdc9aab0bfda7cfa5f4e4bf`；21B-1 尚未 Commit／Push／部署。正式 Worker 仍失敗關閉；本機 API 不在部署入口引用。
- 詳見 `docs/PACKAGE_21B_1_VALIDATION.md`；已補 D1 模擬，下一步需另行確認21B-2身份及防濫用範圍。

### 21A 歷史狀態（由21B-1更新上述進度）

- Package 21A：新增獨立 `backend/christmas/`，完成14表Migration初稿、狀態／權限與輸入驗證、20個API契約路由及設定範例；21項本機SQLite／Worker骨架測試通過。
- 公益API仍為失敗關閉的骨架，不具備正式認領、身份驗證、加密或雲端資料讀寫；未建立資源、Commit、Push或部署。
- 規格與營運待確認事項：`docs/CHRISTMAS_21A_SPEC.md`。下一步建議21B本機Repository／驗證流程，需使用者確認；尚未開始。

- 最新本機驗收：Package 20C-1G，59 項獨立 Chromium 回歸通過；場租舊資料確認／查詢與 Demo 回饋阻擋已修正。
- 保存範圍：20B-2 計畫、20C 安全與404、20C-1F 手機溢出及20C-1G文案一致性；僅作本機開發基線，不代表正式驗收或可公開部署。
- 新增 `js/utils/runtime-message.js`，依模式選擇文案／狀態；既有資料欄位、狀態鍵及業務規則不變。
- 詳細證據與未覆蓋項目見 `docs/PACKAGE_20C_1G_VALIDATION.md`；公開會員註冊尚不存在，角色矩陣及正式通知／金流未完成。

## Historical local checkpoints

- Package 20C-1F：已修復手機導覽的關閉態水平 transform；首頁 document 寬度由 727px 恢復為 375px，九個前台頁面三尺寸量測通過。
- 實際場租送出發現另一重大阻擋：`public-inquiry-models.js` 的 publicNote 仍宣稱 NXSPACE 已收到並將確認申請。依範圍限制停止，未擴大修正、未建立 Commit；點餐／報名完整驗收尚未完成。
- 瀏覽器及回環伺服器已關閉；仍不可視為完整瀏覽器驗收通過。

- Package 20C：測試分支 `test/nxspace-pages-20261111`，基線 `cb28f4f5243173bd9654901ffca9574506744403`。
- Demo 提示、遠端 Adapter 阻擋、深層 404 與精確發布白名單已完成本機修正；未 Commit／Push／部署。
- 本機程式與產物驗證通過；瀏覽器、Linux 實際打包與 Cloudflare Access 尚未驗收，受保護部署仍為 NO-GO。
- 詳見 `docs/PACKAGE_20C_VALIDATION.md`；下列 Package 18 完成狀態保留為歷史本機 Demo 紀錄。

- Latest completed package: Package 18 — 整合驗收、通知與 Production Adapter
- Beta V1.1 Refinement Local Demo: **COMPLETE**
- Production: **NOT STARTED**
- Runtime: HTML5、CSS3、JavaScript ES Modules、LocalStorage、GitHub Pages／Live Server

## Completed local-demo scope

- Package 13：營運中心、資訊架構、角色首頁與角色範圍。
- Package 14：場地活動、場租邀請、費用與月結。
- Package 15：店家、商品、通用客製化、每日供應量與時段容量。
- Package 16：手機 POS、現場點單、訂單狀態、營收與顧客紀錄。
- Package 17：活動報名、名單、收款、容量與取消／延期規則。
- Package 18：統一通知事件、停用中的 LINE／Email Adapter、Repository／API／Auth／Storage 邊界、Schema Registry、Migration、資料完整性、隱私檢查、驗收中心、備份與重置。

## Validation status

- Package 18 目標模組可由 ES Module 執行環境匯入。
- 統一通知 Schema、Payload 遮罩、Local Adapter、LINE／Email disabled 狀態通過。
- Remote Repository 與 Production API 在未設定時拒絕執行。
- 10 組 Schema Migration 可重複執行，第二次不重複遷移。
- Demo 關聯、重複 ID、負值、容量、Permission Key 與隱私檢查通過。
- 備份格式驗證與不允許 Key 拒絕測試通過。

## Next recommended phase

Production Foundation：Cloudflare Worker、D1、正式 Authentication 與 server-side authorization。

## Package 30｜最終放行候選（2026-11-23）

- 從已部署的清除版 Worker 與品牌入口封存資產整理出獨立候選，疊加公告、據點及品牌同源認領修正。
- 使用既有 Worker／D1／ASSETS／Supabase 設定。候選新增的正式資料庫相依性為 0025，無需 R2。
- 隔離 Worker/D1 通過公開掛載認領、PIN 查詢、併發互斥、公告發布與據點版本控制。正式角色及書屋參照待管理者回報。
- 下一步完成桌機與手機瀏覽器全流程驗收及正式放行審核。

## 第一階段｜單筆測試案件清理候選

- 0026 只在指定測試案件的完整交易內允許清理。在正式環境仍須獨立核准後才開啟清理設定與操作。舊案件的稽核與不可重用 ID 保留。
- 本階段不套用正式遷移、不執行正式清理。應以候選 Workerd/D1 的正式結構相容性及失敗回復證據審核，再安排正式變更。

## 2026-11-23｜Package 31 聖誕公益前台審閱候選

- 前台首屏、心願卡、空狀態、四步參與、據點、故事、FAQ 與認領／查詢介面已在隔離環境驗證。
- 保留正式公開 API、認領及 Email／PIN 規則。候選資產保留 Package 30 已部署的後台重新驗證介面。
- 正式部署待營運方審閱；下一步確認行動畫面、活動公告日期及正式據點資訊的呈現。
## 2026-11-23｜Package 31-B 前台候選精修

- 壓縮手機首屏和心願卡，調整認領表單順序與成功收據。受影響檔案為 christmas.css、christmas-browse.js、christmas-direct.js、christmas.js。
- 以隔離 Chromium 驗證 320／390／1440 px、認領成功與 FAQ 鍵盤操作。正式網站待審閱，下一步為候選畫面與公告資料確認。

## 2026-11-25｜Package 31-C-A 正式營運流程修正候選

- 正式 Worker `2dc848b9-ffac-48c7-9582-e284b3351700` 承接 100% 流量。抽查正式首頁與公開 JS／CSS，雜湊與 31-B 成品相符。
- 31C-01／02 通過五個指定寬度的本機 Chromium 驗收及 SQLite／D1／Workerd 回歸。正式 NXSPACE 模式查閱預設隱藏，寄送更正仍需原因。
- 正式 D1 備份已在隔離 SQLite 還原。正式 Worker 已切換到精確鎖定 NX-001 的關閉版；D1 0026 仍特許上一個內部 ID，目前 NX-001 並未設示範標記。隔離副本以精確新 ID 演練成功，正式清除待案件確認和 Super Admin。

## 2026-11-25｜Package 31-C-B 活動品牌與圖片候選

- 新增主辦、協辦與活動協力介紹、活動首頁品牌設定、圖片選擇壓縮、替代文字及草稿預覽。採用 0027 圖片登記與公開 Standard R2 綁定。只發布公益品牌內容的操作維持全站發布旗標關閉。
- 本機 Chromium 測過前台五個指定寬度，以及活動設定與實際壓縮上傳的 390／1440 px。正式帳戶 R2 回傳 10042，待帳戶持有人完成訂閱。
- 下一步完成正式測試案件清除及 R2 訂閱，再建立兩個私有桶、核對正式 D1 增量遷移和部署。Package 32 保留。 [正式操作與媒體管理](PACKAGE_31_C_RELEASE.md)

## 2026-11-25｜Package 31-C 正式網站放行

- 正式 Worker `f9ba9ae3-4cdb-45b5-8762-7846a9f906ad` 承接 100% 流量。0027 已套用，新增媒體表為空，心願及認領各一筆，外鍵檢查通過。
- 建立兩個 APAC Standard 私有 R2 桶，關閉 r2.dev 且無自訂網域。只有公開素材桶綁定公益 Worker。容量限制 5 GB，公開讀取限流 120 次／60 秒，既有五項營運旗標全開，網站發布與清除開關關閉。
- 正式 Chromium 五種寬度、FAQ 與查詢入口通過，匿名後台圖片查閱 401、未發佈圖片 404。Lighthouse 手機效能 99、LCP 1.557 秒、CLS 0.058。
- NX-001 已透過 Super Admin 窗口永久清除。稽核及原內部 ID 保留，正式清除開關已關閉，D1 防護已復原。Package 32 待營運方完成正式網站驗收。

## Package 31-C-R｜正式上線後使用者體驗

- 封面支援自訂換行與民眾日期格式；主協辦 LOGO 按分類對齊。管理端新增單一單位展開、圖片規格提示、容量、草稿時間及桌機／手機預覽。
- 正式備份包含 D1、已發布品牌版本與 11 個 D1 登記的 R2 物件。使用者設定資料由既有 API 讀取。
- 本機 33 項回歸及五尺寸 Chromium 驗收通過。無資料庫遷移。Package 32 待本次正式網站驗收。
- 正式 Worker `e99c953c-bf29-4e71-875b-f586ebc4623b` 已承接全部流量。品牌版本 6 與 11 筆媒體登記一致。GitHub 發布分支待自動審查核准。
- 結案補正封面載入位移及兩組既有測試。實體裝置與真實 INP 留待人工驗收；Package 32 等待新規格。
