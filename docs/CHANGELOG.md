# Changelog

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
