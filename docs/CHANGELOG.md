# Changelog

## BRAND-01 FINAL｜正式入口結案

- 核對營運方完成的正式網域切換與受控測單。記錄兩個正式 Pages 部署、QR 與手機驗收、DNS 記錄核對範圍及回復程序。

## BRAND-01｜正式點餐送單修補

- 將已驗證的最小修補部署至 `oasis-order`，備份舊部署並核對三站的成功、明確拒絕、斷線與重試防護。正式送單待授權。

## BRAND-01｜獨立 Pages 公開測試

- 將已驗收的品牌成品 Direct Upload 至 `nxspace-brand`。點餐入口指向既有點餐子網域，公益預告由同站靜態頁提供。

## BRAND-01｜點餐子網域啟用後驗收

- 品牌成品連到已啟用的點餐子網域，隨同打包獨立靜態公益預告。更新預覽、送單修補部署狀態、受控測試單與切換回復程序。

## 2026-11-20｜BRAND-01 正式入口上線準備

- 新增 `preview/brand/christmas.html`。在既有打包腳本加入純靜態公益預告輸出，並在驗證腳本加入公益關閉檢查與隔離點餐表單測試。
- 更新品牌上線與回復程序及專案狀態。品牌與公益成品已備妥供 Pages 驗收。

## 2026-11-20｜AUTH-FREE-02D 最後驗收

- 管理員改密的 TOTP 防重放計數與憑證鎖定改為同一筆 D1 交易，保留密碼驗證、稽核及工作階段撤銷。補測首次改密拒絕已消耗的 TOTP。
- 更新 AUTH-FREE-02D 的最終 staging 數據與放行判定，以及 BRAND-01 的正式網域唯讀查核結果。

## 2026-11-20｜AUTH-FREE-02D 書屋建檔與首次改密續作

- 修改 `campaign-experience.mjs`、`repository.mjs`、`unit-operations.mjs` 與 `staff-identity.mjs`。合併建立草稿、編輯送審及改密的 D1 往返。保留版本控管、權限、稽核、TOTP 與舊工作階段撤銷。
- 新增並收錄 AUTH-FREE-02B、02C、02D 驗收文件，更新本檔與專案狀態。提交一併保留原先未提交的 `case-workspace.mjs`、`intake-worker.mjs` 和 `sqlite-adapter.mjs` 改動。
- 下一步為 AUTH-FREE 的 staging CPU 驗收收尾。見 [逐路徑數據與部署判定](PACKAGE_30_AUTH_FREE_02D.md)。

## 2026-11-19｜AUTH-FREE-02D 建檔與案件查閱 CPU

- 建檔階段查閱案件改為批次讀取所需的心願、歷史與提案。儲存心願使用已查核的原始列及交易回傳值，SQLite 測試配接器同步支援批次查詢結果。見 [雲端驗收](PACKAGE_30_AUTH_FREE_02D.md)。

## 2026-11-19｜AUTH-FREE-02C Workers Free CPU 定位

- `intake-worker.mjs` 與 `unit-operations.mjs` 在單次心願儲存或審核請求內共用已從 D1 讀取的操作者資料。各操作仍檢查所需權限。
- 新增 [CPU 驗收紀錄](PACKAGE_30_AUTH_FREE_02C.md)。下一步處理書屋送審仍超過的 CPU 預算。

## 2026-11-19｜AUTH-FREE-02B 隔離雲端驗收

- 新增 [雲端驗收紀錄](PACKAGE_30_AUTH_FREE_02B.md)，更新專案狀態。下一步定位高 CPU 路徑並重測 Workers Free。

## 2026-11-19｜Package 30-AUTH-FREE-01

- 新增 Supabase Adapter 與操作手冊，替換舊密碼雜湊服務及尚未部署的 0019 欄位。更新 Worker、建帳、最高管理員初始化、隔離測試、Wrangler 範本及專案紀錄。
- 保留 0020 基本資料與既有角色。下一步驗收真實 Free 專案，正式 D1 維持 0018。

## 2026-11-19｜Package 30-BRAND-01 品牌入口與點餐分流準備

- 更新 `preview/brand/index.html`、`brand.css`、`brand.js`、`scripts/package-launch-brand.ps1` 及專案紀錄。新增 Oasis-order 修補檔、瀏覽器驗證腳本與 [切換手冊](PACKAGE_30_BRAND_01.md)。
- 本機隔離驗證響應式首頁、兩個入口、舊網址與送單三種狀態。下一步是授權並驗收原點餐 Pages 的新子網域。

## 2026-11-19｜DEPLOY-05D 帳號架構確認

- 新增 `backend/christmas/migrations/0020_staff_profiles.sql` 與 [驗證紀錄](PACKAGE_30_DEPLOY_05D.md)。更新既有帳密 Worker、身分服務、後台頁面、隔離測試及專案紀錄。
- 自助基本資料只限本人讀寫，結構獨立於角色、單位及稽核身分。保留 scrypt，下一步待核定可承載安全雜湊的正式執行方案。

## 2026-11-19｜Package 30-DEPLOY-05C 帳密資源驗證

- 新增 `docs/PACKAGE_30_DEPLOY_05C.md`，更新本檔與 `docs/PROJECT_STATUS.md`。記錄 Workers Free、scrypt 實測、正式部署條件及 staging 授權範圍。

## 2026-11-19｜Package 30-DEPLOY-05B 本機帳密與單位帳號管理

- 新增 `0019_staff_identity.sql`、帳密憑證與工作階段服務、Super Admin 初始化工具、登入頁與帳號管理面板、隔離驗收及操作手冊。
- 更新公益 Worker、後台入口、白名單腳本、Wrangler 範本、既有隔離測試與專案紀錄。下一步驗證正式 Cloudflare 執行額度，再申請 Migration、部署與帳號初始化授權。

## 2026-11-19｜Package 30-DEPLOY-04 公益預告與建檔部署準備

- 更新 `backend/christmas/public/index.html`、`src/launch-routes.mjs`、`src/intake-worker.mjs` 及 `wrangler.launch.example.toml`。私人進度查詢改由預設關閉的 `FEATURE_OWNER` 控制。
- 擴充 `backend/christmas/tests/intake-worker.test.mjs`。隔離驗收覆蓋第一階段建檔、送審、審核及直接 API 拒絕，也覆蓋公開後的去識別、履約與切回預告的資料保留。
- 新增 [上線檢查](PACKAGE_30_DEPLOY_04.md)，更新 `PACKAGE_30_LAUNCH.md`、`PROJECT_STATUS.md` 與本紀錄。下一步先核對正式 Access 應用及書屋、NXSPACE 的身分。

## 2026-11-19｜Package 30-DEPLOY-03 正式 D1 初始化

- Wrangler 4.165.0 以 `INTAKE_DB` 綁定帳戶 `ef7489817ea58cdd93bb467313559e9a` 的 `nxspace-christmas-intake-prod`（`66986db2-45bb-4492-843b-2ab4535987b0`），依序套用 18 份 Migration。
- 遠端驗證無待套用項目，61 張應用表與隔離試跑一致，外鍵檢查零違規。只有 `Roles` 的 `nx_admin`、`nx_staff`、`partner_staff` 三筆資料，其餘 60 張表均為空。
- 修改 `docs/CHANGELOG.md`、`docs/PROJECT_STATUS.md`。下一階段待授權核對兩階段 Worker 上線設定。

## 2026-11-18｜Package 30-LAUNCH 本機上線整合

- LAUNCH-A 沿用既有建檔、PIN 認領、收件、交接、送達及紙本文件服務。正式 Worker 以獨立開關控制各階段，預設停用。
- LAUNCH-B 納入完整 V1.0 政策及公開頁，並記錄單位帳號、18 份 migration、告知確認、備份與回復操作。待正式核定後設定生效日期。
- LAUNCH-C 沿用 30-C1 來源打包品牌頁，驗證聯結關閉及模擬開放的 `#order` 導向。下一步是授權後核對實際識別、政策、點餐及部署。

## 2026-11-18｜Package 30-D1 聖誕公益正式建檔準備

- 新增專用建檔 Worker、`staff/` 入口、資產打包腳本、隔離整合測試與 `PACKAGE_30D1_INTAKE.md`。Worker 允許核准帳號建檔、送審及審核，停用公開與履約 API。
- 更新 Access 驗證、Wrangler 模板、心願管理介面、稽核面板及專案紀錄。等待人工驗收與正式部署授權。
- 隔離環境驗證 17 份 migration、建檔至審核、個資授權、帳號撤銷及實際還原。Package 29 回歸 406／406。
- 封存前採用單位帳號與 24 小時登入設定，新增第 18 份 migration、Worker 登出及前端逾時提示。既有 17 份業務 migration 內容維持原樣。

## 2026-11-18｜Package 30-C1 品牌入口網站預覽

- 新增 `preview/brand/index.html`、`brand.css`、`brand.js`、`order-preview.html`，提供獨立品牌首頁、兩個服務入口與 `#order` 的本機相容導向。
- 更新 `docs/PROJECT_STATUS.md` 與 `docs/CHANGELOG.md`。下一步為人工驗收，確認後再進入 Package 30-C2 的正式切換前核對。

## 2026-11-17｜Package 29 本機初始化與封存

- 新增零營運資料初始化CLI，僅套用現有17份Migration，拒絕覆寫已有目錄；不複製測試庫、不新增產品功能。
- 完成60表零業務資料、SQLite完整性／外鍵、完整備份實際還原及獨立副本NX-001送審發布驗證，原初始庫保持乾淨。
- 保留10633加密備份與10634的152筆心願／2筆認領及人工驗收流程；未清理、重置或修改兩套來源。
- 核對既有406／406完整回歸與PIN測試證據有效，不重跑已完成功能。更新初始化／復原文件與P29來源、證據清單，建立本機版本封存；無Push、部署或正式網站變更。

## 2026-11-16｜Package 29 技術收尾（尚未結案）

- PIN公開查詢測試改為欄位白名單／私密欄位拒絕與完整合成個資檢查；含089的UUID不再誤判，保留四位PIN、Email正規化、多筆認領、重設及撤銷測試。未修改認證產品邏輯。
- 瀏覽器測試可指定獨立證據目錄，保留舊失敗紀錄；補排除本機SQLite、DPAPI及程序檔，未加入資料庫或金鑰。
- 全部20份後端測試完整回歸406／406（SQLite／D1，0失敗、0跳過）；最終PIN28／28、首頁11／11、語法185／185；SQLite／D1畫面各4組通過，pageerror均為0，保留全部舊失敗紀錄。
- 10634的152心願／2認領及完整人工流程紀錄保持原狀，兩環境加密備份與逐列還原驗證完成。10633即時記憶體程序已不在執行，未冒險清理；獨立副本NX-001演練成功，不代表營運庫已就緒。
- 未建立結案Commit；未Push、未部署、未接觸正式網站或正式D1。下一步先解決10633來源辨識，再依授權完成清理及結案。

## 2026-11-16｜Package 29 進行中，依使用者指示暫停後續開發

- 基準 ef69d832c6f0d0eba837e26fea7fc13797400ea0；保留中斷前修改，未提交、Push 或部署。
- SQLite／D1專項24／24；兩引擎各4組畫面檢查通過，包含375／768／1280px及CMS。完整回歸尚未結束，已觀察到SQLite既有PIN帳號測試失敗，不宣稱全數通過。
- 304份來源及1945份既有證據備份SHA256差異0。DPAPI備份隔離還原59張應用表、151心願／1認領，逐列差異及外鍵錯誤0；95張表說法未獲證據支持。SQLite／D1隔離清理通過，原10633未清理。
- 使用者最新決策：暫不清理原始資料庫；等待C57～C88原文交叉比對，不擅自結案。正式據點／隱私聲明未提供，據點自行新增管理仍為缺失。詳見PACKAGE_29_OPERATIONS.md。


## 2026-11-16 — Package 28 公益認領、紙本寄送與後台設定

- 新增式 0016 遷移與直接認領 API；四位 PIN 雜湊／pepper、原子限速、工作階段、核身重設、公開心願快照及歷史同意版本。保留 P27 審核、角色與交接，不寄送 Email／LINE。
- 官方 371 筆郵政資料、條件式寄送必填、授權更正與加密差異；寄送快照不被地址更正覆蓋，Excel 保留原需求、不同寄送資料分列並標示本列文件。成功／查詢共用心願卡及瀏覽器列印。
- 同一後台增加聲明版本管理、FAQ 隱藏／恢復；修復隱藏欄位原生驗證阻擋，設定移除額外影響確認，保留日期及既有期限檢查。未變更其他主站頁面。
- 新增 16／修改 22 檔；完整回歸初輪 376／377（VM 參數錯誤已補正通過），最後針對性 33／33，SQLite／D1 畫面各 8 組及三尺寸通過。新增可重現測試 fixtures、官方資料核對工具與獨立本機驗收入口。備份、完整清單、失敗紀錄與人工項目見 PACKAGE_28_OPERATIONS.md。

## 2026-11-16 — Package 27 公益流程與前後台整合

- 延伸0015送審／退回原因、可信姓名與內部發送日；書屋草稿、公開審核及原認領保護串接。公開進度移除收件／送達數。
- 部分交接、缺件與多件送達；獨立紙本進度、下載前筆數、郵寄完整性及聯絡資料不重置製作狀態。Email單次安全重設、角色隔離、直接授權查閱與後端稽核。
- 工作總覽／案件篩選／分頁／內容分頁與三範圍FAQ；主站活動時間分類、餐車空狀態與未來預訂、三館素材共用、關於／查詢／聯絡說明。保留原訂單與場租機制。
- 新增6／修改40檔；353項完整後端及後續針對性回歸、SQLite／D1畫面與三尺寸驗證。初輪及中途失敗保留，Word實機與正式服務未冒稱完成。完整清單、限制與備份見PACKAGE_27_OPERATIONS.md。

## 2026-11-15 — Package 26 公益補強與首頁優化

- 新增0014加法遷移、書屋專屬xlsx、加密郵遞區號及匯出資格，寄送資料完全一致才合併，保留逐願明細；NX及收件據點無法取得名單。
- 新增共用後端稽核、舊紀錄安全摘要、登入與匯出追蹤、不可改寫及過期清理交易；現有操作紀錄頁分開顯示後端與Local Demo資料。
- 公益公開進度由資料庫即時計算；首頁重排八區，重用版位、商家、活動、排班與營業資料，三館共用每小時NT500未稅價目，不改歷史申請金額或訂單成立流程。
- 新增10／修改24檔；後端初輪4項相容性失敗已修復重驗，新增24項、首頁6項、兩引擎畫面回歸、原站59與Origin11項通過。缺真實照片／地址及Word實機驗收明列待確認，未Push或部署。

## 2026-11-15 — Package 25 操作精簡、管理整合及前台優化

- 精簡主視覺與抽卡入口，公開分類改為尚未認領／已認領，搜尋跨類，保留12筆分頁。
- 心願案件整合建立身分、日期預設與審核預覽、理由查閱、四類案件、連續收件、據點交接篩選、書屋專屬送達與紙本文件複選；送達不等待文件結案。
- 新增0013加法遷移，保存建立單位、追加式活動設定及加密紙本交付紀錄；沿用內容草稿／FAQ機制，設定修改保留既有承諾期限與稽核，舊API無法繞過新權限。
- 新增4份／修改15份；後端300項與最終補充、兩引擎瀏覽器各10組、原站59及Origin11項通過。保留全部舊測試服務與中途失敗證據，最終預覽10626，未Push或部署。

## 2026-11-15 — Package 24 聖誕公益介面與操作整合

- 新增0012加法遷移與案件服務：追加式加密問題紀錄、電話輔助查詢限流、內容草稿及修改紀錄、管理員重設後必須換密碼。既有認領與交接資料保留。
- 前台改12筆分頁、原地視窗、紙卡翻閱與減少動畫；移除新版代填、電子文件及可見查詢憑證，改用自然臺灣用語。密碼安全規格尚未確認前維持12–128字元與原有限流。
- NXSPACE三入口、書屋四入口、據點單一收件工作台；同案處理交件、交接、送達、紙本文件及取消。取消說明與重開同交易，聯絡電話變更同步HMAC索引。
- FAQ可增刪排序，草稿經預覽後發布並核對版本；測試中心僅五身分及必要工具，正式隔離保留。
- 後端280項全過；完整瀏覽器、原站回歸、三尺寸及來源清單見PACKAGE_24_OPERATIONS.md。新增12／修改19份，保留舊證據與10623；新版10624供使用者驗收。不Push、不部署、不匯入真實個資。

## 2026-11-14 — Package 23 聖誕公益最終整合

- 新增0010公開內容與0011期限延長遷移，保留既有資料與身份架構；文案編輯僅NXSPACE，期限延長限NXSPACE／書屋、未收件、版本核對及原因稽核。
- 整合主站入口、活動合作資訊、四步驟與12題可編輯FAQ；統一Email＋密碼查詢、補認領日期／編號／交件據點與逾期提醒，修正錯誤OTP的重試操作。
- 新增8種繁體中文本機信件模板；履約或取消確認後才預覽、同鍵去重，NXSPACE專用信箱預覽與手動期限提醒，不發送真實Email。
- 新增20項整合測試與150張心願的完整瀏覽器驗收。最終後端248、SQLite／D1瀏覽器各12組、原站58、Origin11項通過，375／768／1280及獨立10623預覽核對。新增7／修改13份，詳見CHRISTMAS_FINAL_INTEGRATION_20261114.md。
- 基準來源249份復原零差異、591份原證據未變；保存本機版本，不Push／部署。正式Resend、雲端身份／DB與營運資料仍待設定及驗收。

## 2026-11-14 — Phase 1安全保存與Phase 2主要操作畫面

- Phase 1保存e8becbafc13d039e113b64a6f8718ae98c124dce，210來源備份零差異；原始遺失與重建證據繼續分開。
- 餐車訂單送出即成立、橫向狀態工作台；場租鐵花／東海每時500元未稅、人工核准／收款及不寄送Email預覽；獨立Courier角色與合成任務。
- 公益新增Email密碼查詢與核身後重設；本年度用不可任意修改的人工紙本核對紀錄，原子履約及交接不繞過，移除本年度附件上傳／下載。新增0008、0009 Migration，保留歷史資料及相容測試。
- 完整後端228項、SQLite／D1各10組瀏覽器、原站58項、Origin11項、靜態包8組、375／768／1280及10622實際預覽通過；完整驗收、檔案與限制見HANDOFF_PHASE2_OPERATIONS_20261114.md。Phase 2尚未Commit，未接通正式服務／部署。

## 2026-11-14 — 最新交接Phase 0及Phase 1第一批

- 查核並以72a28ac保存V2及先前必要修正，另完成206檔來源備份／bundle及全新目錄復原；20A、main與checkpoint未變。
- 同步使用者完整新需求與差異表，明確列出缺少Package 22A原始指令、密碼與年度無附件等未完成衝突；不開通Gmail、Resend、LINE或雲端服務。
- 新增公開六主選單＋聖誕入口、後台六收合工作區、商家訂單預設頁、四類查詢入口；沿用原子頁／資料／權限，公益單位由已驗證context限制入口。此批尚未提交。
- 導覽8組、公益SQLite18組、Worker關閉21項、Client／模組4項及三尺寸操作驗證；V2靜態產物5組、122檔。
- 如實記錄13份舊SQLite證據被測試腳本覆寫的失誤，原始位元組未恢復；隔離新結果、從V2復原副本建立明確標記的重建驗證，並讓兩個測試腳本拒絕既有目錄。停止新增功能，詳見本次查核報告。

## 聖誕公益Dashboard整合優化 — 第二輪

- 將公益功能整合原Dashboard側欄／手機抽屜，分成八個獨立視圖；建立完成返回心願列表，支援編號／暱稱／禮物搜尋、狀態篩選與單筆編輯。
- 由既有D1計算全部心願、有效認領及臺灣日期2日內未交件，排除實際收件；文件與禮物進度分開。單位回應維持後端權限與範圍隔離。
- 移除現行UI獨立協助認領入口，保留歷史API／Migration／測試；同一Email表單支援共用裝置清除，確認信採獨立單次管理連結。私人欄位及附件回到各業務頁；已發送後補證明沿用發送權限，仍預設私人待審、不改履約狀態。
- 完整後端206項、新版SQLite 18／D1 17＋1組、原21C 16＋21C-R 10組、Origin 11及原站58項通過。詳見CHRISTMAS_DASHBOARD_V2.md與本輪獨立證據；未Commit、Push、Merge或部署。

## 聖誕公益營運介面精簡 — 21C-S延伸

- 新增0007加法Migration，沿用Claims原子認領及權限：五個臺灣日曆日由NX SPACE統一設定，SQL同步驗證日期上限，新增授權取消並重新開放的單一交易及追加式收件點更正。
- 重要操作自動記錄登入單位／時間，承辦人不必填、備註選填；感謝卡與物資證明各自驅動持久狀態，必要作業完成後才結案。
- 後台改左側展開功能選單及心願列表／單筆編輯，不顯示批次匯入；新心願採NX-001起三碼，保留舊編號及分享連結，網站用語統一認領、期限只顯示日期。收件地點由單位自動決定，公開狀態顯示實際收件處。
- Email驗證與無Email協助沿用原交易；新增Email／電話輔助寄送單次找回連結、確認信交件內容，本機只用記憶體信箱，正式供應器／Worker維持關閉。
- 新營運與三Viewport瀏覽器驗收、既有後端及原站回歸見CHRISTMAS_SIMPLIFIED_OPERATIONS.md；舊證據保留，未Commit、Push、Merge或部署。

## Package 22A-1 — 本機預覽連線修復

- browser-server僅對已知HTML入口的頂層GET導覽允許cross-site Fetch Metadata；缺Origin的正常文件導覽可開啟，API、子資源、iframe及寫入不適用例外。
- 本機HTML採same-origin Referrer Policy，讓本機角色切換表單保留正確Origin；API回應維持no-referrer，外部及null Origin寫入不予放行。Host精確比對、127.0.0.1監聽、原API身份權限規則及正式Worker均保留。
- 新增針對性Playwright Chromium驗收，11組通過；重現修正前cross-site文件403及本機表單Origin:null，修正後登入、讀寫與拒絕案例通過。支援本機預覽指定埠，沿用10621；不執行整套回歸、不Commit、不部署。

## Package 21C-S — 單位營運權限與實體禮物交付

- 保存21C-R為本機Commit `d4286e52fa4da9acd1cb37298780cf1598a19d82`；21C-S依後續確認授權保存本機Commit，不Push或部署。
- 恢復額度中斷後續驗的三份文件補充：32項後端／Client、SQLite及D1各10組新版瀏覽器、原16＋10組瀏覽器及原站58項均通過；取消、重新開放及稽核回滾結果完整。補回完整26份檔案清單及正式雲端未驗證項，不重做程式；截圖、日誌與驗收證據不納入本次提交。
- 新增0006、單位營運Repository擴充、Email與協助認養本機替身及前後台營運模組；沿用既有身份、D1、中央原子認領及履約狀態機。
- 五組單位權限與撤銷、承辦人稽核、書屋內部資料與ADMIN公開審核分離；三據點收件、跨據點取件、文件寄送與結案、期限提醒及人工取消重新開放。
- 活動採統一QR，單張紙本卡不含個別QR；保留詳情路由。私人憑證、聯絡及地址不進公開API、URL或瀏覽器持久儲存。
- 原140項後端、新28項及Client／管理4項重驗；新版10組、原26組瀏覽器及原站58項通過。三Viewport證據及正式環境限制見PACKAGE_21CS_OPERATIONS.md。
- 更新既有公益API、頁面、CSS、路由表、白名單、測試與狀態文件。沒有Push、Merge、雲端資源或部署，正式認養保持關閉，不開始22A。

## Package 21C-R — 公益營運與認養體驗補強

- 新增0005加法Migration、campaign-experience服務、營運表單及無依賴QR工具；保留原認養DB、權限、加密、狀態機及履約證據。
- 前台新增公開暱稱、統計、搜尋／篩選、隨機推薦、手機優先認養表單、私人附件及OTP恢復介面。管理端提供心願編輯／審核、附件與祝福審核、文件需求篩選及實體卡列印。
- 真名隔離加密，無瀏覽器真名讀取API；電話單獨不能查詢，公開祝福及附件必須審核。地址蒐集、郵寄、通知、正式驗證、R2及合法捐贈收據仍未啟用。
- 新增fixture、18項後端及瀏覽器驗收、三尺寸／列印證據與21C-R報告；140項後端、原16組瀏覽器及原站58項操作回歸通過，外部圖片替身界線保留。
- 更新21C公益模組、API組裝、驗證器、Repository、共用附件驗證、樣式、白名單、測試及文件。21C／21C-R保留工作區，未Commit、Push、Merge或部署，不開始22A。

## Package 21C — 公益前台、Dashboard與本機整合

- 新增公益API Client、前台／私人查詢／Dashboard模組、CSS與後端管理投影；沿用原路由及殼層，正式Worker維持失敗關閉。
- 新增本機Miniflare／Playwright server、16組瀏覽器情境、4項API／隔離／模組測試及舊回歸wrapper；更新路由、導覽、白名單、本機API組裝與文件，附六張截圖及結果。
- 118既有＋4新增測試及16組瀏覽器驗收通過。原站58項在外部圖片替身下通過；真實外部圖片載入未通過，詳見21C報告。
- 保存21B-3 Commit `83fe2422ed21aec6a8e2783c8e3161ba2b435deb`；21C未Commit、Push、部署或開放正式認領。等待本機驗收，不開始下一Package。

## Package 21B-3 — 公益收件、機構交接及送達

- 新增0004履約Migration、fulfillment模組、共用測試adapter／Migration loader、履約fixture及測試、履約驗收文件。
- 擴充本機安全API、UUID驗證匯出與測試共用；更新README、PROJECT_STATUS及本紀錄；正式Worker／前台／部署不變。
- 沿用既有資料庫，機構權限、收件／交接／送達／異常操作與稽核原子寫入；批次建立不等於簽收，送達不可一般回退。
- 38項新增驗收及原80項回歸，118／118通過，含SQLite／HTTP／Miniflare D1與150份批次；雲端未驗證，詳見本包報告。
- 保存21B-2為 `4227d4b1e3b6296da93a911309e262a066b7315c`；本包未Commit、Push或部署，未開始下一Package。

## Package 21B-2 — 公益身份、權限及個資保護

- 新增Access JWT模組、安全邊界／D1限流／供應商介面、0003安全Migration、20項安全測試及 `docs/PACKAGE_21B_2_SECURITY.md`。
- 擴充crypto、domain、repository及兩份測試fixture；更新backend README、PROJECT_STATUS及本紀錄。
- 實作簽章／issuer／audience／時間／sub驗證、D1角色對應、金鑰版本、授權個資讀取與重新加密、憑證撤銷／期限、到期清除與稽核。
- 原53項回歸加27項新安全驗收，80／80通過（57一般＋23 D1模擬）；雲端未驗證，正式Worker仍失敗關閉。
- 21B-1保存 `a88d784246dab382758bd553e1a862346748352f`；本包未Commit、Push或部署，未開始21B-3。

## Package 21B-1 — 公益認領 Repository 與原子／冪等驗證

- 新增 `backend/christmas/src/crypto.mjs`、`repository.mjs`、`local-api.mjs`、`migrations/0002_capability_rotation.sql`、`tests/repository.test.mjs`、`tests/d1.test.mjs` 與 `docs/PACKAGE_21B_1_VALIDATION.md`。
- 更新 backend README、PROJECT_STATUS及本紀錄；前端、正式Worker入口與部署設定未變。
- 加密聯絡資料、D1 batch／DB trigger／部分唯一索引、冪等與回應遺失恢復、版本控制、取消／逾期不自動重開、憑證輪替及稽核回滾。
- 一般SQLite／本機HTTP共37項、官方Miniflare D1模擬16項通過；雲端D1未驗證，不代表可公開使用。
- 另經使用者授權，官方Miniflare及必要依賴固定版本安裝於專案外，證據亦在專案外；專案依賴未變。
- 21A本機保存 `9e880619e4ea64294fdc9aab0bfda7cfa5f4e4bf`；21B-1未Commit、未Push或部署。下一步由使用者確認21B-2。

## Package 21A — 聖誕公益資料模型、API規格與獨立骨架

- 新增 `backend/christmas/migrations/0001_initial.sql`：14表、複合FK、有效認領部分唯一索引、狀態／證據／機構角色／稽核約束初稿。
- 新增 `backend/christmas/src/domain.mjs`、`validation.mjs`、`worker.mjs`：狀態權限、公開投影、嚴格輸入與串流限制、20個契約路由；所有功能預設不可操作，不呼叫D1／R2或正式API。
- 新增 `backend/christmas/tests/christmas.test.mjs`、`wrangler.example.toml`、`README.md` 與 `docs/CHRISTMAS_21A_SPEC.md`；未啟用任何雲端設定。
- 21項本機測試通過，包含兩個同時寫入的SQLite連線只有一方成功；實際D1交易、身份／加密／限流Provider及R2仍待驗證。
- 修改本文件與PROJECT_STATUS；既有前後台、點餐、部署白名單均未修改。
- 下一個建議Package：21B本機正式Repository與驗證／冪等結果恢復；本次未開始21B、未Commit／Push／部署。

## Package 20C-1G — Demo 回饋一致性與本機測試基線

- 新增 `js/utils/runtime-message.js`：Demo／Production 文案選擇、模擬狀態標示及舊預設備註公開投影；不遷移或更改資料結構。
- 修正 public-inquiry／order 模型的新紀錄及舊紀錄備註，避免 LocalStorage 結果宣稱正式收到、備餐或處理。
- 在已確認的訂單／付款／報名狀態與通知／Audit 標籤加上模式判斷；Dashboard 操作 toast 明示本機測試，不執行付款或寄送。
- 聯絡、訂單、場租、邀請及報名結果採模式文案，保留未來 Production 分支；不更動核心驗證、容量、價格或狀態轉換。
- 發布白名單補入新 helper，共113個檔案；截圖／日誌與驗收工具留在專案外。
- 獨立 Playwright1.56.1／Chromium141.0.7390.37 回歸59項通過；另驗證三個舊預設句精確比對及自訂備註保留。Console僅五筆預期404，無pageerror、正式API或通知請求。
- 新增 `docs/PACKAGE_20C_1G_VALIDATION.md`，更新狀態及20B-2／20C計畫的後續驗收註記。
- 下一步：可經使用者確認作 Package21 的本機開發基線；雲端 Access、Linux打包及正式部署仍需獨立驗收與授權。

## Package 20C-1F — 手機水平溢出修復與瀏覽器驗收（未通過完整驗收）

- 僅修改 `css/components/navigation.css` 的手機選單動畫：以元件內垂直位移取代關閉態 translateX(100%)，不使用全站 overflow 裁切。
- 獨立 Chromium 量測：隱藏的 352px 導覽原位於 x=375–727；停用動畫後移除 X 位移，document 由 727px 回到 375px，還原後再現 727px。
- 九個前台頁面在 375／768／1280px 均通過文件寬度檢查；Hash 導覽／刷新、五個深層 404、聯絡表單與首頁圖片通過。先前同輪 smoke 亦完成 Dashboard 登入、三尺寸與主要模組導覽。
- 場租提交發現 `js/models/public-inquiry-models.js:35` 的舊 publicNote 仍宣稱已收到、將確認申請，與 Demo 頁首矛盾。停止並保留未提交修正；未更動該模型。
- 更新本文件與 PROJECT_STATUS；截圖、尺寸、Console／Network 與完整報告置於專案外測試工具目錄，不納入 Git。
- 下一步：另行核准場租 Demo 回饋修正後重跑完整驗收；無 Commit／Push／部署。

## Package 20C — 測試環境安全修正與部署相容性（本機）

- 前後台新增常駐 Demo／個資提醒，明確區分模擬登入、收付款與通知。
- 聯絡、訂單／查詢、場租／邀請與報名結果改為本機測試紀錄，不承諾送達、預約或收款。
- Demo 模式禁止 Google Sheets／Protected API 遠端 Adapter 讀寫；既有 LINE／Email disabled 邊界保留。
- 404 bootstrap 改用站點根路徑載入資源，返回網址由模組位置推導；未修改兩個 Router 或受保護的 app/layout 檔案。
- 新增 `deploy/pages-files.txt`、`scripts/package-pages.sh`、`scripts/package-pages.ps1`；精確白名單打包並拒絕覆蓋產物。
- 修改：`index.html`、`admin/index.html`、`css/base.css`、`404.html`、`js/404.js`、`js/pages/contact.js`、`js/pages/order.js`、`js/pages/lookup.js`、`js/pages/venue-application.js`、`js/pages/rental-invitation.js`、`js/pages/registration.js`、`js/pages/notification-center.js`、`js/services/data-adapter-service.js`、本文件與 `PROJECT_STATUS.md`。
- 新增驗證紀錄 `docs/PACKAGE_20C_VALIDATION.md`，保留並補充未提交的 `PACKAGE_20B_2_TEST_PLAN.md`。
- 下一階段：完成 Live Server 瀏覽器驗收、Cloudflare 唯讀政策核對，再另行核准版本同步與受保護部署；本次未 Commit／Push／建立雲端資源。

## Beta V1.1 Refinement Package 18 — 整合驗收、通知與 Production Adapter

- 統一 Notification Event Schema，加入本機發送、重試、處理、篩選與 Payload 遮罩。
- 建立 LINE／Email disabled Adapter；未設定 Provider 時不呼叫外部 API，也不標記為 sent。
- 建立 Repository Factory、Production API Client、Authentication、D1／R2／Google Sheets 邊界。
- 完成 Media Adapter 介面、R2 stub、10 組 Schema Registry 與可重複 Migration。
- 新增資料完整性、容量、Permission Key、Audit／LocalStorage 隱私檢查。
- 重建驗收中心，支援 Package 13–18 人工結果、Production Readiness、備份匯入／匯出及安全重置。
- Local Demo 狀態更新為 COMPLETE；Production 維持 NOT STARTED。

## Beta V1.1 Refinement Package 17 — 課程報名、場租收款與營運規則完善

- 新增公開課程活動清單、活動報名頁、報名查詢及截止前自行取消。
- 擴充既有 `activityId` 報名設定，支援講師、海報、名額、候補、費用、取消規則及六類自訂欄位。
- 新增獨立活動報名資料模型、名額 Transaction Pattern、人工／自動錄取、候補、出席及通知事件。
- 新增主辦單位報名名單、狀態管理，以及摘要／明細／聯絡資料 CSV、JSON 匯出。
- 完善場租原始應繳、最終應收、實收、差額、發票、退款、保留款及公開繳費狀態。
- 新增餐車月度應收、延期取消處理、場務設備清單與活動場租營運總覽。
- 新增相關權限、角色 migration、Audit 與 Local Demo Seed。

## Beta V1.1 Refinement Package 16 — 手機 POS、現場點單與訂單營運

- 新增手機優先的現場點單、待處理訂單、全部訂單、今日營業額與顧客歷史頁面。
- 擴充統一訂單 Schema，保留商品、價格、客製化、金額、付款、狀態、釋放與通知快照。
- 新增供應量與時段容量的 Local Demo Transaction Pattern，建單失敗時完整回復。
- 新增取消／拒絕／作廢釋放、實收調整、CSV／JSON 匯出、30 天電話查詢與 Local Notification Event。
- 新增 POS、訂單調整／作廢、顧客歷史與容量覆寫權限及既有角色 migration。
- 補入 8 種狀態、線上／現場來源、重複顧客與作廢訂單的 Demo Seed。

## Beta V1.1 Refinement Package 15 — 店家、商品、通用客製化與供應量管理

- 擴充既有 Commerce Repository，加入店家狀態、營運截止規則、商品狀態、兩級分類及價格 Audit。
- 新增通用客製化範本、選項、商品連結與商品覆寫。
- 新增依 Package 14 餐車活動限制的每日供應量與時段容量 Service。
- 新增預約容量、現場保留量、容量降低保護及釋放現場保留量規則。
- 新增優惠公告與顧客公開期間投影。
- 新增 Local Demo 商品圖片 1:1 裁切與 WebP 壓縮 Adapter。
- 新增 Commerce 管理頁及合作店家手機優先入口。
- 未串接 POS、現場訂單、R2、Worker、D1、正式通知或金流。

## Beta V1.1 Refinement Package 14 — 統一場地活動、場租邀請與費用管理

- 新增統一場地活動 Repository／Service、三場地正式資料及舊 Rental／Event 相容層。
- 新增場地活動管理、Local Demo 場租邀請、租客填寫、餐車月排及費用與發票頁面。
- 活動、繳費及異動狀態分離；新增設備、桌椅、CAMA 需求、發票、收款及公開投影欄位。
- 邀請支援期限、送出鎖定、延長、撤銷、重建連結及重新開放編輯。
- 餐車月排按日期建立獨立活動，合作店家只投影自己的出攤活動。
- 新增 Package 14 權限與繁體中文 Audit 標籤；既有角色 Key 保持相容。
- 未串接 Worker、資料庫、正式 Token、金流、電子發票、LINE、Email 或 R2。

## Beta V1.1 Refinement Package 13 — NXSPACE 營運中心、資訊架構與角色首頁

- 後台名稱統一為「NXSPACE 營運中心」，角色顯示名稱更新為總管理、NXSPACE 管理者、場務管理者、合作店家及檢視人員；底層 Key 不變。
- 新增依角色導向的營運總覽、場務總覽與店家首頁。
- 營運總覽加入八項摘要、今日營運、待處理事項及有效快速入口。
- 店家首頁加入今日訂單、營業額、接單狀態、營運資料、容量摘要及行動優先快速功能。
- 側邊導覽改為分組、權限與角色過濾；後續功能以明確入口及未開放狀態呈現。
- 保留既有 Repository／Service scope、Local Demo Schema、Router 相容路由及 404／無權限頁。
- Beta V1.1 Refinement 尚未整體完成；未串接任何外部服務。

## Beta V1.1 Final Acceptance — COMPLETE

### Accepted

- Package 12 店家營運、容量、售完、Vendor 隔離、角色預覽、通知中心及中文化人工驗收通過。
- 320px 至 1440px、200% Zoom、Tab／Shift+Tab、Escape、焦點管理及 Reduced Motion 驗收通過。
- Packages 10–12 與 Beta V1.1 Local Demo 整體狀態標記為 COMPLETE。

### Production boundary

- 未新增或串接 LINE Token、Google Sheets 私密憑證、Backend 或 Production Database。
- Cloudflare Worker／Backend、正式 Authentication、Production Database、Google Sheets 安全讀寫、LINE 真實發送、Secret Storage、Rate Limit、多人同步及併發控制仍為 Production blockers。

## Beta V1.1 Package 12 — 商店營運完善、全面中文化與正式串接準備

- 新增店家營運首頁、接單切換、容量使用量、商品售完快速操作及拒絕常用原因。
- 新增 Super Admin 唯讀角色／使用者預覽與通知中心。
- 新增 LINE 安全 Payload、Commerce Schema Mapper、Public／Private Projection 與 Write Validator。
- 完成新增介面中文化與操作事件中文標籤；未加入任何 Secret 或正式遠端寫入。

## Beta V1.1 Package 11 — 商店點餐、商品客製化與店家接單核心

- 新增共享 Commerce Repository、商店與菜單資料、客製化選項、購物車、訂單狀態服務與通知事件。
- 新增公開商店路由、日期時段驗證、客製化 Modal、購物車、確認及查詢相容層。
- 新增店家接單中心、狀態操作、merchant scope 與 Local Notification Log。
- 擴充商家與商品管理欄位；未加入 LINE Secret 或遠端寫入憑證。

## Beta V1.1 Package 10 — 中文化與商店登入基礎

### Added

- 新增集中式繁體中文 Label Registry，涵蓋導覽、狀態、角色、權限與操作事件。
- 新增跨部署環境的後台入口 URL helper。

### Changed

- Header、手機導覽與 Footer 新增次要層級「商店登入」入口。
- 登入頁改為商店與管理中心用語，Dashboard 導覽與操作紀錄主要文字中文化。
- 角色權限依中文功能分類，加入搜尋、高風險標示與手機友善分組。

### Security

- 保留既有 Permission Key 與 Guard；未加入 LINE Token、Secret、API Key 或正式登入憑證。

## Consolidated Package 09 — Integration, QA, deployment and Beta V1 acceptance

### Added

- Added Dashboard `#acceptance`, runtime acceptance checks and explicit Production Gate status.
- Added full Local Demo backup plus previewed/confirmed reset that preserves an active Super Admin.
- Added environment metadata, GitHub Pages 404 fallback, Cloudflare Pages headers and final release documentation.

### Changed

- Added lazy loading, async decoding and intrinsic dimensions to reusable card images.
- Added Dashboard no-index and theme metadata; removed four unused zero-content modules and obsolete permission duplication.
- Marked Packages 00–09 and Beta V1 implementation complete, pending final Live Server acceptance.

### Security

- Documented and surfaced the Local Demo versus Production boundary; no Secret or remote write credential was added.

## Consolidated Package 08 — Users, roles, permissions and Google Sheets data layer

### Added

- Added User/Role models and LocalStorage/Memory identity repositories with migration from the Package 06 Demo credential.
- Added multi-user Authentication, password hashes and salts, Session Version, lifecycle status, Last Login, password reset, and audit.
- Added Dashboard Users, Roles, Permission Matrix, data scope, Integrations, Settings, Audit, and safe Backup/Restore pages.
- Added Google Sheets Public Read, Protected Write interface, Local Adapter, Factory, CSV mapper/parser, sync status, timeout/error and fallback boundaries.

### Security

- Added last-active-Super-Admin, self-role-removal, system-role, assigned-role, Session invalidation, permission-denial, and sensitive-reveal safeguards.
- Backup/export excludes credentials, Sessions, private contact data, internal notes, and Secrets.
- Protected writes require a server-side endpoint and cannot accept frontend write credentials.

### Next package

- Package 09 — Integration, QA, deployment and Beta V1 acceptance.

## Consolidated Package 07 — Orders, rentals and complete CMS operations

### Added

- Added Order and Order Item models, status definitions, validation, LocalStorage/Memory repositories, duplicate protection, audit, and adapter boundaries.
- Added complete public pickup order, persistent confirmation, and masked order lookup flows.
- Added Dashboard Orders, Rentals, and Availability routes with search, filters, pagination, status management, notes, conflict rules, bulk updates, safe exports, and sensitive-data reveal auditing.
- Added CMS bulk status transitions and duplicate-to-draft operations.

### Changed

- Public rental conflict logic now consumes Dashboard availability and approved rental records.
- Dashboard Home now includes Order and Rental KPI counts.
- Updated README, Routes, data dictionary, permissions, ledger, status, and security boundaries.

### Next package

- Package 08 — Users, roles, permissions and Google Sheets data layer.

## Consolidated Package 06 — Dashboard shell, authentication and core management

### Added

- Added the `/admin/` static entry, separate Dashboard Hash Router, Login, guarded routes, Unauthorized, and Not Found states.
- Added first-use Local Demo account setup, salted password hashing, one-hour SessionStorage Session, expiration, and logout.
- Added responsive Dashboard Shell, KPI Home, common tables, editor Drawer, confirmation Dialog, Toast, Loading, Empty, image preview, and unsaved-change protection.
- Added complete LocalStorage CRUD for Activities, Vendors, Products, and Banners with search, filter, sort, pagination, status, validation, audit summaries, and persistence.

### Changed

- Published Dashboard collections now feed the public data layer after reload while draft and archived records remain private.
- Updated README, route documentation, data dictionary, permissions foundation, project status, and implementation ledger.

### Security

- No default plaintext password, API key, Secret, or public remote write credential is committed.
- Documented Local Demo versus Production Authentication and repository replacement boundaries.

### Next package

- Package 07 — Orders, rentals and complete CMS operations.

## Consolidated Package 05 — Venue rental and public interaction flows

### Added

- Added complete 鐵花館 and 綠洲場 venue data, details, plans, rules, process, and FAQ.
- Added an accessible availability calendar with single/range dates, presets/custom times, and occupied-slot conflict checks.
- Added validated Rental and Contact models, IDs, status definitions, date/time helpers, and validation schemas.
- Added the Repository interface, LocalStorage Local Mock implementation, MemoryStorage tests, persistence, masking, and duplicate-submit protection.
- Added Rental application, confirmation, public lookup, and functional Beta V1 order lookup flows.

### Changed

- Replaced the Contact information page with a validated, persistent form and Retry flow.
- Expanded Privacy and Terms with LocalStorage, masking, data-purpose, and Production security boundaries.
- Updated Routes, navigation lookup entry, data dictionary, permissions notes, status, and ledger.

### Validation

- Confirmed valid/invalid Rental and Contact validation paths.
- Confirmed past/unavailable dates, reverse ranges, invalid times, capacity, consent, and occupied conflicts.
- Confirmed duplicate protection, storage failure, persistence after Repository recreation, and masked public lookup isolation.
- Confirmed all new Routes and internal links resolve.

### Next package

- Package 06 — Dashboard shell, authentication and core management.

## Consolidated Package 04 — Router, public pages and complete frontend

### Added

- Added the public Route Registry with static and dynamic hash routes.
- Added complete Activity, Vendor, Product, Venue, About, Contact, Privacy, Terms, and Not Found pages.
- Added shared Catalog search, category filter, sort, Load More, live summary, Empty, Error, and Retry behavior.
- Added route Loading/Error states and reusable state views.
- Added responsive public listing, detail, editorial, venue, contact, and state styling.

### Changed

- Moved public page rendering from the App entry into the Router.
- Rebuilt Home Hero and added working banner, quick-entry, featured-content, and venue routes.
- Expanded local public fixture data while preserving accepted Home content and card counts.
- Updated Header, Navigation, Footer destinations so every public link resolves.
- Updated all required project records for the consolidated Package 04–09 roadmap.

### Validation

- Confirmed 13 public route/page cases render and all internal hash links resolve.
- Confirmed Router list, detail, 404, metadata, History listener, and focus behavior.
- Confirmed Catalog search, filter, sort, Empty, Error/Retry, and Load More logic.
- Confirmed JavaScript and CSS dependency checks and responsive foundations.

### Next package

- Package 05 — Venue rental and public interaction flows.

## Roadmap consolidation

- Consolidated the remaining Playbook scope into Packages 04–09 as directed by the project owner.
- Preserved completed Packages 00–03 and their accepted architecture.
- Started Package 04 — Router, public pages and complete frontend.

## Playbook Package 03 — Application shell, header, navigation, footer

### Added

- Added a token-based responsive Footer stylesheet.
- Added public site configuration for brand, navigation, contact, venue, social, and legal content.
- Added a Skip Link and focusable main content target.

### Changed

- Rebuilt Header and Navigation with restrained responsive styling and 44px controls.
- Added a functional Mobile Navigation drawer with focus management, Escape, outside click, backdrop, scroll locking, and resize cleanup.
- Added hash-based current navigation state with `aria-current`.
- Expanded Footer into settings-driven brand, contact, venue, social, and legal sections.
- Corrected the public document title and removed nested Header landmark markup.
- Updated routes and project records for Package 03 completion.

### Validation

- Confirmed all Shell modules load and generate the required landmarks, controls, links, and Footer groups.
- Confirmed CSS and JavaScript imports resolve without cycles or duplicate CSS imports.
- Confirmed the existing Home data and card output remain intact.

### Next package

- Package 04 — Router, route registry, 404 and navigation state.

## Playbook Package 02 — Design tokens and global foundations

### Added

- Added centralized design tokens for typography, spacing, color, shape, elevation, layout, focus, z-index, and motion.
- Added reusable layout, flow, cluster, reading-width, and visually-hidden utilities.

### Changed

- Activated the global reset, responsive layout, utilities, badge styles, and home page styles through `css/main.css`.
- Added a warm neutral canvas, system typography, visible focus rings, 44px controls, and reduced-motion handling.
- Made the home event grid safe at narrow mobile widths.
- Consolidated duplicate quick-entry rules into the dedicated component stylesheet.
- Updated the implementation ledger and project status for Package 02 completion.

### Validation

- Confirmed CSS imports resolve, are unique, and follow the required cascade order.
- Confirmed no CSS import cycle exists.
- Confirmed the existing home module and card output remain intact.

### Next package

- Package 03 — Application shell, header, navigation, footer.

## Playbook Package 01 — Architecture baseline and project ledger

### Added

- Added current and planned route contracts.
- Added the current home fixture and target domain data dictionary.
- Added the permission catalog, default role baseline, and authorization ownership matrix.

### Changed

- Added the project architecture, dependency direction, and local preview guidance to `README.md`.
- Updated the implementation ledger and project status for Package 01 completion.

### Validation

- Confirmed documentation matches the actual workspace and clearly labels future contracts.
- Confirmed active imports resolve and the JavaScript dependency graph is acyclic.
- Confirmed the existing home module and output remain unchanged.

### Next package

- Package 02 — Design tokens and global foundations.

## Playbook Package 00 — Repository intake and safety snapshot

### Added

- Added a normalized repository snapshot with entry points, dependency notes, placeholders, risks, and protected files.
- Added the Playbook implementation ledger and reconciled it with the earlier local Package 17 numbering.

### Changed

- Updated project status to track the Playbook sequence.

### Validation

- Confirmed no runtime application file was modified.
- Confirmed active JavaScript and CSS imports resolve to existing files.

### Next package

- Package 01 — Architecture baseline and project ledger.

## Package 17 — Home Data Layer

### Added

- Added reusable quick-entry card component and styles.
- Added centralized home mock data for quick entries, activities, vendors, and products.
- Added project status and changelog documentation.

### Changed

- Migrated all repeated home card content to data-driven rendering with `map(...).join("")`.
- Removed obsolete hardcoded card calls and the unused `createCard` import from the home page.
- Registered the quick-entry card stylesheet in the main CSS entry point.

### Validation

- Confirmed component imports match their named exports.
- Confirmed `css/main.css` imports `css/components/quick-entry-card.css`.
- Confirmed protected application, router, and main layout files were not modified.

### Next recommended package

- Package 18 — Home responsive and accessibility review.

## Package 30｜最終放行候選（2026-11-23）

- 從已部署的清除版 Worker 與品牌入口封存資產整理出獨立候選，疊加公告、據點及品牌同源認領修正。
- 使用既有 Worker／D1／ASSETS／Supabase 設定。候選新增的正式資料庫相依性為 0025，無需 R2。
- 隔離 Worker/D1 通過公開掛載認領、PIN 查詢、併發互斥、公告發布與據點版本控制。正式角色及書屋參照待管理者回報。
- 下一步完成桌機與手機瀏覽器全流程驗收及正式放行審核。

## 第一階段｜單筆測試案件清理候選

- 0026 只在指定測試案件的完整交易內允許清理。在正式環境仍須獨立核准後才開啟清理設定與操作。舊案件的稽核與不可重用 ID 保留。
- 本階段不套用正式遷移、不執行正式清理。應以候選 Workerd/D1 的正式結構相容性及失敗回復證據審核，再安排正式變更。

## 2026-11-23｜Package 31 聖誕公益前台

- 修改公開掛載 HTML、路由初始化、心願瀏覽、據點及 FAQ 呈現、認領成功提示與公益 CSS。隔離 Chromium 驗收 320、390、1440 px 及認領、查詢流程。
- 保留 Package 30 已部署的後台重新驗證資產。尚未發布正式前台。
## 2026-11-23｜Package 31-B 前台候選精修

- 壓縮手機首屏和心願卡，調整認領表單順序與成功收據。受影響檔案為 christmas.css、christmas-browse.js、christmas-direct.js、christmas.js。
- 以隔離 Chromium 驗證 320／390／1440 px、認領成功與 FAQ 鍵盤操作。正式網站待審閱，下一步為候選畫面與公告資料確認。

## 2026-11-25｜Package 31-C-A 正式營運流程修正候選

- 基準 `f93aea9e53602b5d45a5a5fa17a05529b0c95a4a`。修改 `christmas-content.js`、`christmas.js`、`christmas-direct.js`、`christmas-case-workspace.js`、`direct-claims.mjs`、`unit-operations.mjs`、`direct-claims.test.mjs` 及本兩份狀態文件。
- 公開認領與查詢共用發票提醒。NXSPACE 資料查閱保留權限與自動稽核。無新增 Migration、圖片儲存或正式發布。
- 新增正式 D1 隔離還原與精確鎖定演練，Worker 正式關閉版已鎖定正確案件。D1 既有 0026 特許需另行確認。
- 修正 `direct-worker.test.mjs` 的 Miniflare 設定轉接，保留原測試斷言。完成五種寬度的認領提醒、查詢及管理者查閱驗收。

## 2026-11-25｜Package 31-C-B 品牌內容與圖片候選

- 新增 `campaign-brand.mjs`、`campaign-brand-media.mjs`、`0027_campaign_brand_media.sql`、`brand-image-upload.js`、`campaign-brand.test.mjs` 和 [操作文件](PACKAGE_31_C_RELEASE.md)。
- 修改公益 Worker、公開路由、內容工作區、前台首頁與瀏覽、設定編輯器、公益樣式、打包清單及綁定範本。新增僅影響公益品牌的版本更新及圖片引用，原全站發布旗標保持關閉。
- 下一步為完成正式清除核對及 Cloudflare R2 訂閱，再執行 31-C-C 正式遷移與放行驗收。

## 2026-11-25｜Package 31-C 正式發布

- 正式套用 `0027_campaign_brand_media.sql` 與公開素材桶綁定。新增公開圖片讀取的 Worker 限流設定。私密桶獨立保留。
- Worker `f9ba9ae3-4cdb-45b5-8762-7846a9f906ad` 承接 100% 正式流量。正式網站唯讀驗收及 Lighthouse 通過。
- NX-001 已完成正式清除並復原關閉狀態。正式公開進度為 0，保留舊內部 ID 的封存稽核。Package 32 等待網站營運驗收。

## Package 31-C-R｜正式上線後使用者體驗

- 修改公益首頁、瀏覽與收件日期樣式、內容編輯器、據點管理、媒體容量 API 及既有品牌測試。
- 正式 Worker 已發布。部署來源保存至本機，GitHub 發布分支待核准。正式 D1、素材備份與操作設定留在 Git 忽略目錄。
- 結案補正封面尺寸預留，修正收件投影及交接時間的隔離測試預期。
