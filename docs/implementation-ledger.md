# NXSPACE Implementation Ledger

## Package numbering

This ledger follows `NXSPACE_Codex_Sequential_Implementation_Playbook.docx`. Earlier workspace documentation used a separate local sequence in which “Package 17” meant Home Data Layer. That completed work is preserved as existing implementation evidence, but it does not mark Playbook Packages 01–17 complete.

## Package status

| Package | Name | Status |
| --- | --- | --- |
| 00 | Repository intake and safety snapshot | COMPLETE |
| 01 | Architecture baseline and project ledger | COMPLETE |
| 02 | Design tokens and global foundations | COMPLETE |
| 03 | Application shell, header, navigation, footer | COMPLETE |
| 04 | Router, public pages and complete frontend | COMPLETE |
| 05 | Venue rental and public interaction flows | COMPLETE |
| 06 | Dashboard shell, authentication and core management | COMPLETE |
| 07 | Orders, rentals and complete CMS operations | COMPLETE |
| 08 | Users, roles, permissions and Google Sheets data layer | COMPLETE |
| 09 | Integration, QA, deployment and Beta V1 acceptance | COMPLETE |
| 10 | 中文化與商店登入基礎 | COMPLETE |
| 11 | 商店點餐、商品客製化與店家接單核心 | COMPLETE |
| 12 | 商店營運完善、全面中文化與正式串接準備 | COMPLETE |

## Beta V1.1 final acceptance

- Status: **COMPLETE**
- Completed: 2026-07-17
- Scope: Local Demo
- Runtime behavior changed by final closeout: No

Packages 10–12 的 Live Server、響應式、鍵盤、焦點、200% Zoom、資料隔離、容量、角色預覽與通知中心人工驗收均已通過。Beta V1.1 Local Demo 正式完成；Production 串接不屬於本完成狀態。

## Consolidated roadmap mapping

Starting with Package 04, the original Playbook roadmap is consolidated into six delivery packages while preserving its architecture and acceptance requirements.

| New package | Consolidated original scope |
| --- | --- |
| 04 | Original Packages 04, 07–12, 28, plus public discovery portions of 05 and 29 |
| 05 | Original Packages 06, 12–13, and public form/recovery portions of 29 |
| 06 | Original Packages 14–20 and Dashboard UI portions of 27 and 29 |
| 07 | Original Packages 17–22 plus complete operational CRUD portions of 29 |
| 08 | Original Packages 05–06, 14, 23–26, 32, and adapter/security boundaries from 35 |
| 09 | Original Packages 27–35 for integration, QA, deployment, acceptance, and roadmap handoff |

## Package 00 — Repository intake and safety snapshot

- Status: COMPLETE
- Completed: 2026-07-16
- Runtime behavior changed: No

### Files created

- `docs/repository-snapshot.md`
- `docs/implementation-ledger.md`

### Files updated

- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`

### Decisions

- Preserve the current folder structure and existing public home implementation.
- Use the Playbook sequence for all packages recorded from this ledger onward.
- Treat the previous local Package 17 Home Data Layer as existing work to assess and preserve, not as completion of Playbook Package 17.
- Defer all runtime fixes and architecture changes to their applicable packages.

### Verification

- Inspected the complete workspace tree and all file sizes.
- Identified entry points, active imports, CSS imports, data sources, placeholders, and protected files.
- Confirmed active JavaScript relative imports resolve to existing files and named exports.
- Confirmed declared CSS imports resolve to existing files.
- Confirmed no application runtime file was changed by Package 00.

### Blockers and follow-up findings

- Live URL and deployment state are not recorded.
- Git CLI and browser automation are unavailable in the current environment.
- Global, layout, and home page CSS files are not imported by the current CSS entry point.
- Many planned pages and infrastructure modules are empty placeholders.

## Package 01 — Architecture baseline and project ledger

- Status: COMPLETE
- Completed: 2026-07-16
- Runtime behavior changed: No

### Files created

- `docs/routes.md`
- `docs/data-dictionary.md`
- `docs/permissions-matrix.md`

### Files updated

- `README.md`
- `docs/implementation-ledger.md`
- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`

### Decisions

- Preserve the existing feature-oriented folders and define their ownership before adding new implementation.
- Retain `js/store/` as the shared state boundary instead of creating a duplicate `js/state/` folder.
- Let `js/services/` host external adapters until Package 06 introduces concrete repository boundaries; UI modules may not access Google Sheets directly.
- Add models, repositories, authentication, permissions, or validation modules only with the packages that implement them.
- Use hash routes as the static-host-compatible baseline until deployment requirements justify a documented change.

### Verification

- Confirmed architecture documentation matches the current workspace and distinguishes planned modules from implemented modules.
- Confirmed all active JavaScript imports and CSS imports resolve.
- Confirmed the active JavaScript dependency graph is acyclic.
- Loaded the existing home ES Module and verified expected home card output.
- Confirmed no HTML, CSS, or JavaScript runtime file changed.

### Blockers and follow-up findings

- Runtime route registry, models, repositories, authentication, and permissions remain scheduled work.
- CSS entry omissions remain assigned to Package 02.
- Automated browser validation remains unavailable; Live Server acceptance is required.

## Package 02 — Design tokens and global foundations

- Status: COMPLETE
- Completed: 2026-07-16
- Runtime behavior changed: Yes — global foundations and previously inactive layout/page styles are now loaded.

### Files created

- `css/tokens.css`
- `css/utilities.css`

### Files updated

- `css/base.css`
- `css/layout.css`
- `css/main.css`
- `css/components/section.css`
- `css/components/quick-entry-card.css`
- `css/pages/home.css`
- `docs/implementation-ledger.md`
- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`

### Decisions

- Centralize new color, typography, spacing, radius, elevation, layout, z-index, focus, and motion constants in `css/tokens.css`.
- Load CSS in foundation-to-feature order through the single `css/main.css` entry point.
- Preserve existing component appearance and defer the remaining component-library token migration to Package 07.
- Consolidate conflicting quick-entry selectors into the dedicated component stylesheet while preserving the existing content and responsive column counts.
- Use system fonts and a neutral warm canvas with restrained green brand accents.
- Make focus visibility, reduced motion, 44px controls, and 360px-safe grids global requirements.

### Verification

- Confirmed every CSS import resolves and each stylesheet is imported once.
- Confirmed tokens precede foundations, components, and page styles.
- Confirmed no CSS `@import` cycle exists.
- Confirmed the home grid minimum cannot exceed its available width at 360px.
- Loaded the existing home ES Module and verified all expected cards still render.
- Confirmed JavaScript imports remain valid and unchanged.

### Blockers and follow-up findings

- Existing components outside Section and Quick Entry still contain legacy hard-coded values; Package 07 owns full component-library token migration.
- Header/mobile navigation accessibility belongs to Package 03.
- Automated browser validation remains unavailable; Live Server acceptance is required.

## Package 03 — Application shell, header, navigation, footer

- Status: COMPLETE
- Completed: 2026-07-16
- Runtime behavior changed: Yes — the public shell now includes responsive navigation interactions and a settings-driven footer.

### Files created

- `css/components/footer.css`

### Files updated

- `index.html`
- `js/app.js`
- `js/config/config.js`
- `js/layouts/main-layout.js`
- `js/components/header.js`
- `js/components/navigation.js`
- `js/components/footer.js`
- `css/tokens.css`
- `css/layout.css`
- `css/main.css`
- `css/components/header.css`
- `css/components/navigation.css`
- `docs/routes.md`
- `docs/implementation-ledger.md`
- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`

### Decisions

- Keep `js/app.js` as the composition root and initialize navigation only after its markup is rendered.
- Use the existing `js/config/config.js` for non-sensitive public brand, navigation, contact, venue, social, and legal settings.
- Replace the nested header landmark with a neutral mount node while preserving semantic Header, Main, and Footer landmarks.
- Use an off-canvas mobile navigation at 48rem and below; desktop navigation remains inline.
- Derive current navigation state from the URL hash while leaving route rendering to Package 04.

### Verification

- Loaded Header, Navigation, Footer, Layout, Config, and Home modules successfully.
- Confirmed the Shell includes a Skip Link, focusable main target, unique navigation ID, and no nested header landmark.
- Confirmed navigation exposes four configured links and Footer exposes contact, venue, social, and legal content.
- Confirmed Mobile Navigation implements open/close, Escape, focus trapping and restoration, outside click, backdrop click, scroll locking, and responsive close behavior.
- Confirmed CSS and JavaScript imports resolve, CSS imports are unique, and no dependency cycle exists.
- Confirmed all expected Home cards still render.

### Blockers and follow-up findings

- Navigation hashes other than Home do not render pages until Package 04 implements the route registry.
- Login, social, and legal destinations are placeholders pending their owning packages.
- Automated browser interaction remains unavailable; Live Server keyboard and mobile acceptance is required.

## Package 04 — Router, public pages and complete frontend

- Status: COMPLETE
- Completed: 2026-07-16
- Runtime behavior changed: Yes — all public pages are now Router-driven and interactive.

### Files created

- `js/router/routes.js`
- `js/components/state-view.js`
- `js/pages/catalog-page.js`
- `js/pages/products.js`
- `js/pages/venue.js`
- `js/pages/about.js`
- `js/pages/contact.js`
- `css/pages/public-pages.css`

### Files updated

- `js/app.js`
- `js/router/router.js`
- `js/config/config.js`
- `js/data/home-data.js`
- `js/components/hero.js`
- `js/components/quick-entry-card.js`
- `js/components/header.js`
- `js/components/navigation.js`
- `js/pages/home.js`
- `js/pages/activity.js`
- `js/pages/vendors.js`
- `js/pages/order.js`
- `js/pages/not-found.js`
- `css/main.css`
- `css/components/hero.css`
- `css/components/navigation.css`
- `css/components/quick-entry-card.css`
- `css/pages/home.css`
- `docs/routes.md`
- `docs/data-dictionary.md`
- `docs/permissions-matrix.md`
- `docs/implementation-ledger.md`
- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`

### Decisions

- Preserve the accepted Shell and make `js/router/router.js` the only public page renderer.
- Keep public content in local fixtures until the repository layer is introduced; retain the same entity contracts for later adapters.
- Use a shared Catalog controller for Activity, Vendor, and Product search, filter, sort, Load More, Empty, and Error behavior.
- Use dynamic hash routes for details and retain parent navigation state.
- Keep the legacy `#order` route as a working bridge; complete public inquiry and lookup workflows in Package 05.
- Add baseline Privacy and Terms routes so every existing Footer link resolves; Package 05 expands the policies with form workflows.

### Verification

- Rendered 13 route/page cases and confirmed every output is non-empty.
- Confirmed all generated internal hash links resolve to a static or dynamic route.
- Confirmed valid Activity, Vendor, and Product details render and invalid slugs return Not Found.
- Executed Router runtime checks for list, detail, 404, metadata, History listeners, and focus.
- Executed Catalog logic checks for keyword search, category filter, price sorting, and Load More boundary.
- Confirmed public fixture IDs and slugs are unique and required fields are present.
- Confirmed CSS/JavaScript imports, exports, syntax, cycles, selectors, and responsive constraints.
- Confirmed Home retains 4 quick entries and 3 featured cards per content group.

### Blockers and follow-up findings

- Venue inquiry submission, confirmation IDs, duplicate-submit protection, and public lookup belong to Package 05.
- Data remains local fixture data until Packages 05 and 08 introduce repositories and adapters.
- Automated browser interaction is unavailable; Live Server route, keyboard, and breakpoint acceptance is required.

## Package 05 — Venue rental and public interaction flows

- Status: COMPLETE
- Completed: 2026-07-16
- Runtime behavior changed: Yes — venue rental, confirmation, public lookup, and Contact submission flows are operational through LocalStorage.

### Files created

- `js/data/venue-data.js`
- `js/utils/id.js`
- `js/utils/date-time.js`
- `js/models/public-inquiry-models.js`
- `js/validation/public-forms.js`
- `js/repositories/public-inquiry-repository.js`
- `js/components/availability-calendar.js`
- `js/pages/venue-application.js`
- `js/pages/lookup.js`
- `css/pages/rental-flows.css`

### Files updated

- `js/config/config.js`
- `js/router/routes.js`
- `js/pages/venue.js`
- `js/pages/contact.js`
- `js/pages/order.js`
- `js/pages/about.js`
- `css/main.css`
- `docs/routes.md`
- `docs/data-dictionary.md`
- `docs/permissions-matrix.md`
- `docs/implementation-ledger.md`
- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`

### Decisions

- Store Beta V1 public submissions only in browser LocalStorage behind a replaceable Repository interface.
- Do not include any remote write endpoint, API key, Secret, credential, or Production authentication assumption.
- Support single-day and date-range selection with a keyboard-operable availability calendar plus native date inputs.
- Treat calendar availability and occupied slots as preliminary conflict checks; final booking remains subject to NXSPACE confirmation.
- Use application ID plus Email or phone last four digits for public lookup and return only masked, whitelisted fields.
- Detect identical Rental and Contact submissions within a two-minute window and return the existing record.

### Verification

- Confirmed both venue detail pages, plans, rules, process, FAQ, and application CTAs render.
- Confirmed past dates, reverse ranges, invalid time order, over-capacity attendance, missing consent, unavailable dates, and occupied slots are rejected.
- Confirmed valid Rental and Contact models save, duplicate submissions are blocked, and storage failures propagate to Retry states.
- Confirmed a newly constructed Repository can read the same persisted record.
- Confirmed Email and phone-last-four lookup succeed while invalid verification returns no record.
- Confirmed public lookup masks identity and excludes private description, equipment, notes, and fingerprint fields.
- Confirmed all 18 public Routes, imports/exports, dependency graph, CSS imports/tokens, and responsive layouts.

### Blockers and follow-up findings

- LocalStorage is a single-browser Demo persistence layer and is not suitable for Production multi-user writes.
- Availability is fixture-based and final conflict authority requires the Dashboard/backend workflow in Packages 07–08.
- Public order lookup intentionally returns a clear no-record state until Order data is introduced.
- Automated browser interaction remains unavailable; Live Server form, calendar, persistence, and breakpoint acceptance is required.

## Package 06 — Dashboard shell, authentication and core management

- Status: COMPLETE
- Completed: 2026-07-16
- Runtime behavior changed: Yes — `/admin/` and four persistent management workflows are operational.

### Files created

- `admin/index.html`
- `js/admin/admin-app.js`
- `js/config/admin-config.js`
- `js/services/auth-service.js`
- `js/repositories/dashboard-repository.js`
- `js/router/admin-router.js`
- `js/pages/admin-pages.js`
- `css/pages/dashboard.css`

### Files updated

- `js/layouts/admin-layout.js`
- `js/components/modal.js`
- `js/store/app-store.js`
- `js/utils/validator.js`
- `js/data/home-data.js`
- `js/pages/home.js`
- `README.md`
- `docs/routes.md`
- `docs/data-dictionary.md`
- `docs/permissions-matrix.md`
- `docs/implementation-ledger.md`
- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`

### Decisions

- Preserve the public entry and Router; use `admin/index.html` with a separate Dashboard Hash Router for static hosting.
- Require first-use local account creation so no reusable plaintext Demo password is committed.
- Store only a random-salted password hash in LocalStorage and keep the one-hour Session in SessionStorage.
- Keep all Dashboard reads and writes behind a Repository interface; Package 08 replaces the adapter for Production.
- Reuse Package 02 tokens and share one schema-driven controller across all four content modules.

### Verification

- Confirmed correct and incorrect password, Session creation/expiry contract, logout, and credential hash storage.
- Confirmed seed, create, update, unique Slug, delete, audit, persistence, validation, and public published-data filtering.
- Confirmed Login, Home, four management pages, Unauthorized, and Not Found HTML render.
- Confirmed JavaScript import/export paths, dependency cycles, CSS imports/variables, responsive breakpoints, and absence of inline handlers.

### Known limitations

- Static client authentication and permission checks are for Local Demo acceptance only and are not Production security.
- LocalStorage is single-browser data; concurrent writes, shared media storage, server audit, and backup are unavailable.
- Orders, rental operations, and complete publishing workflows belong to Package 07; users/roles and secure adapters belong to Package 08.
- Automated browser interaction is unavailable in this environment; Live Server acceptance is required.

## Package 07 — Orders, rentals and complete CMS operations

- Status: COMPLETE
- Completed: 2026-07-16
- Runtime behavior changed: Yes — public ordering and Dashboard operational workflows are active.

### Files created

- `js/data/operations-data.js`
- `js/models/order-models.js`
- `js/validation/order-validation.js`
- `js/repositories/operations-repository.js`
- `js/pages/admin-operations.js`

### Files updated

- `js/pages/order.js`
- `js/pages/lookup.js`
- `js/pages/admin-pages.js`
- `js/admin/admin-app.js`
- `js/config/admin-config.js`
- `js/router/routes.js`
- `js/repositories/dashboard-repository.js`
- `js/utils/date-time.js`
- `css/pages/rental-flows.css`
- `css/pages/dashboard.css`
- `README.md`
- `docs/routes.md`
- `docs/data-dictionary.md`
- `docs/permissions-matrix.md`
- `docs/implementation-ledger.md`
- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`

### Verification

- Confirmed Order validation, `NXO` IDs, totals, duplicate protection, persistence, status transitions, masked lookup, and invalid verifier rejection.
- Confirmed Rental approved-time collision and Availability overlap rules reject conflicts.
- Confirmed public rental calendar reads managed Availability and approved Rental records.
- Confirmed CMS bulk update, duplicate-to-draft, local audit, safe export field filtering, and Dashboard permissions.
- Confirmed JavaScript modules, imports/exports, dependency graph, CSS variables/imports, responsive rules, and no inline handlers.

### Known limitations

- Orders support local pickup only; online payment, delivery, real stock reservation, and multi-user consistency require a backend.
- LocalStorage audit and permissions are Demo-only and can be changed by the browser owner.
- Production Authentication, users/roles, Google Sheets/backend adapters, concurrency, and secure media storage belong to Package 08.
- Automated browser interaction is unavailable; Live Server acceptance is required.

## Package 08 — Users, roles, permissions and Google Sheets data layer

- Status: COMPLETE
- Completed: 2026-07-16
- Runtime behavior changed: Yes — multi-user governance and adapter selection are operational.

### Files created

- `js/data/permission-data.js`
- `js/repositories/identity-repository.js`
- `js/services/commerce-service.js`
- `js/pages/order.js`
- `js/services/permission-service.js`
- `js/services/data-adapter-service.js`
- `js/pages/admin-governance.js`

### Files updated

- `js/services/auth-service.js`
- `js/config/admin-config.js`
- `js/layouts/admin-layout.js`
- `js/admin/admin-app.js`
- `css/pages/dashboard.css`
- `README.md`
- `docs/routes.md`
- `docs/data-dictionary.md`
- `docs/permissions-matrix.md`
- `docs/implementation-ledger.md`
- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`

### Verification

- Confirmed account creation, unique Username/Email, password hashing, status login rules, Last Login, reset-password Session invalidation, and login audit.
- Confirmed five system roles, custom role filtering, permission resolution, Navigation/Route/Action guards, and assigned/own/read-only scope behavior.
- Confirmed final active Super Admin, self role, system role, and assigned role safeguards.
- Confirmed CSV parsing, Local adapter, Protected API endpoint requirement, sync failure fallback, and no Secret storage.
- Confirmed safe Backup schema validation and collection allow-list.
- Confirmed JavaScript modules, imports/exports, dependency cycles, CSS variables/imports, responsive rules, and no inline handlers.

### Production replacement requirements

- Replace Local Authentication and client Sessions with hosted identity and secure cookies/tokens.
- Enforce permission and data scope server-side for every read/write.
- Place Google credentials and protected write logic only in Worker, Apps Script Web App, or backend secret storage.
- Replace LocalStorage with a concurrent persistent repository and protected audit retention.

## Next package

None — Packages 00–09 are implemented. Complete the Package 09 Live Server acceptance checklist before release.

## Package 09 — Integration, QA, deployment and Beta V1 acceptance

- Status: COMPLETE
- Completed: 2026-07-16
- Runtime behavior changed: Yes — Acceptance Center, protected Demo Reset and static deployment fallback are active.

### Files created

- `js/config/environment.js`
- `js/services/acceptance-service.js`
- `js/services/demo-reset-service.js`
- `js/pages/admin-acceptance.js`
- `js/404.js`
- `404.html`
- `_headers`
- `docs/BETA_V1_ACCEPTANCE.md`
- `docs/DEPLOYMENT.md`
- `docs/PRODUCTION_SECURITY.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/BETA_V2_BACKLOG.md`
- `docs/PRODUCTION_ROADMAP.md`
- `docs/OPERATIONS_GUIDE.md`
- `docs/USER_GUIDE.md`

### Files removed

- `js/components/loading.js`
- `js/services/cache-service.js`
- `js/services/sheet-service.js`
- `js/utils/format.js`

These four files were zero-content and had no imports.

### Decisions

- Keep both accepted Hash Routers and add only the final permission-guarded `#acceptance` route.
- Derive hosting/base-path metadata at runtime without environment Secrets or build-time tooling.
- Require reset preview and explicit confirmation; provide full export first and preserve an active Super Admin plus system roles.
- Keep Production readiness false until hosted identity, server authorization, durable repositories and Secret storage replace Local Demo adapters.

### Verification

- Checked JavaScript syntax/module imports, exports, cycles, CSS imports/custom properties, routes, links, duplicate IDs and empty files.
- Exercised Local repositories, auth/permission safeguards, backup/reset preservation, storage health and acceptance results with isolated adapters.
- Checked static deployment paths, 404 base handling, security headers, image loading metadata and responsive source constraints.
- Browser visual and assistive-technology validation remains the explicit Live Server checklist in `BETA_V1_ACCEPTANCE.md`.

## Package 13 — NXSPACE 營運中心、資訊架構與角色首頁

- Status: COMPLETE
- Completed: 2026-07-24
- Runtime behavior changed: Yes — 角色登入首頁、分組導覽及三種角色總覽已啟用。

### Files modified

- `js/admin/admin-app.js`
- `js/config/admin-config.js`
- `js/data/label-registry.js`
- `js/layouts/admin-layout.js`
- `js/pages/admin-pages.js`
- `js/pages/merchant-center.js`
- `js/services/permission-service.js`
- `css/pages/dashboard.css`
- `docs/implementation-ledger.md`
- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`
- `docs/KNOWN_LIMITATIONS.md`

### Decisions and scope

- 保留既有角色 Key、Permission Key、Repository、Service 與 LocalStorage Schema，只更新集中顯示標籤。
- 總管理、NXSPACE 管理者與檢視人員使用營運總覽；場務管理者使用場務總覽；合作店家直接使用店家首頁。
- 導覽依角色及權限先行過濾，合作店家與場務管理者不顯示無關的全平台功能。
- 新流程僅提供相容入口及明確 Empty State；未宣稱場租邀請、費用、POS、供應量或容量管理已完成。

### Next package

Package 14 — 統一場地活動、場租邀請與費用管理

## Package 14 — 統一場地活動、場租邀請與費用管理

- Status: COMPLETE
- Completed: 2026-07-24
- Runtime behavior changed: Yes

### Files added

- `js/services/venue-activity-service.js`
- `js/pages/venue-activity-admin.js`
- `js/pages/rental-invitation.js`

### Files modified

- `js/admin/admin-app.js`
- `js/config/admin-config.js`
- `js/data/label-registry.js`
- `js/data/permission-data.js`
- `js/data/venue-data.js`
- `js/pages/merchant-center.js`
- `js/repositories/identity-repository.js`
- `js/router/routes.js`
- `css/pages/dashboard.css`
- `css/pages/rental-flows.css`
- `docs/implementation-ledger.md`
- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`
- `docs/KNOWN_LIMITATIONS.md`

### Decisions and scope

- 以單一 Venue Activity Repository 統一餐車、場租、課程、講座、會議及既有 Event／Rental 投影。
- 場地活動、繳費及異動狀態分離；Public Projection 排除聯絡資料、內部備註與未開啟的匯款欄位。
- Demo 邀請 Token 僅為本機流程能力，不宣稱具正式安全性；到期、撤銷及送出鎖定均由 Repository 驗證。
- 餐車月排逐日建立獨立 activityId，明確排除原月份訂單、收款、發票與供應量。
- 5% 稅率集中於場地活動 Service；應收與實收差額必須附調整原因。
- 系統角色沿用既有 Key，啟動時可重複安全補入 Package 14 Permission Key。

### Next package

Package 15 — 店家、商品、通用客製化與供應量管理

## Package 15 — 店家、商品、通用客製化與供應量管理

- Status: COMPLETE
- Completed: 2026-07-24
- Runtime behavior changed: Yes

### Files added

- `js/services/media-storage-service.js`
- `js/pages/commerce-management.js`

### Files modified

- `js/admin/admin-app.js`
- `js/config/admin-config.js`
- `js/data/commerce-data.js`
- `js/data/label-registry.js`
- `js/data/permission-data.js`
- `js/pages/order.js`
- `js/repositories/identity-repository.js`
- `js/services/commerce-service.js`
- `css/pages/dashboard.css`
- `docs/implementation-ledger.md`
- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`
- `docs/KNOWN_LIMITATIONS.md`

### Decisions and scope

- 擴充既有 Commerce Repository 與原 LocalStorage Key，不建立第二套商品或訂單來源。
- 店家、商品、分類、客製化、供應量、容量及公告寫入均需 Permission 與 merchant scope。
- 每日供應量與時段容量只接受 Package 14 已確認、同 merchantId 且啟用商品銷售的餐車活動。
- 商品客製化採範本連結加商品覆寫；更新範本不會移除既有覆寫。
- 圖片依現有商品卡 1:1 比例於瀏覽器裁切並輸出 WebP，Local Adapter 限制檔案大小且明確不代表 R2 儲存。
- Package 16 才會完成 POS、現場訂單與線上／現場容量的完整占用及釋放。

### Next package

Package 16 — 手機 POS、現場點單與訂單營運

## Package 16 — 手機 POS、現場點單與訂單營運

- Status: COMPLETE
- Completed: 2026-07-24
- Runtime behavior changed: Yes

### Files added

- `js/services/order-operations-service.js`
- `js/pages/pos-operations.js`

### Files modified

- `js/admin/admin-app.js`
- `js/config/admin-config.js`
- `js/data/permission-data.js`
- `js/data/label-registry.js`
- `js/repositories/identity-repository.js`
- `js/services/commerce-service.js`
- `js/pages/order.js`
- `css/pages/dashboard.css`
- `docs/implementation-ledger.md`
- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`
- `docs/KNOWN_LIMITATIONS.md`

### Decisions and scope

- 沿用 `nxspace.beta.v1.orders` 與既有 Commerce、通知、Audit 資料，不建立平行訂單系統。
- 透過 Normalizer 讓既有訂單可讀取為 Package 16 Schema，保留歷史訂單。
- 現場建單一次寫入訂單、每日供應量與時段容量；任一步驟失敗即回復三個集合。
- Vendor Scope 在 Service 與頁面路由雙層檢查；Viewer 只取得 `.view` 權限。
- LINE、Email、金流、正式後端鎖定與雲端匯出仍屬 Production Foundation。

### Next package

Package 17 — 場地租借、收款與營運規則精修

## Package 17 — 課程報名、場租收款與營運規則完善

- Status: COMPLETE
- Completed: 2026-07-24
- Runtime behavior changed: Yes

### Files added

- `js/services/registration-service.js`
- `js/services/venue-finance-service.js`
- `js/pages/registration.js`
- `js/pages/registration-admin.js`

### Files modified

- `js/router/routes.js`
- `js/admin/admin-app.js`
- `js/config/admin-config.js`
- `js/data/permission-data.js`
- `js/data/label-registry.js`
- `js/repositories/identity-repository.js`
- `css/pages/public-pages.css`
- `css/pages/dashboard.css`
- `docs/implementation-ledger.md`
- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`
- `docs/KNOWN_LIMITATIONS.md`

### Decisions and scope

- 報名設定直接擴充既有 Venue Activity，主鍵維持 `activityId`；報名紀錄獨立於餐點訂單。
- 名額及候補以參加人數計算，建立時重查名額並在失敗時回復 LocalStorage。
- 場租財務保留原始應繳，另存最終應收、差額原因、實收、退款、保留款與發票資料。
- 所有主辦單位操作由 Service 驗證 organizer scope，匯出另行驗證明細及聯絡資料權限。
- 外部通知、金流、電子發票、R2、D1 與正式跨裝置同步留待 Package 18。

### Next package

Package 18 — 整合驗收、通知與 Production Adapter
# Beta V1.1 Package 11

已建立共享 Commerce Repository、商店點餐路由、日期時段、商品客製化、LocalStorage 購物車、訂單快照、受控狀態服務、店家接單中心、merchant scope 與 Local Notification Log。

## Beta V1.1 Package 12

完成營業例外、容量策略、售完快速操作、店家營運首頁、拒絕常用原因、角色唯讀預覽、通知中心、LINE Adapter Payload 與 Commerce Adapter Projection。
# Package 18 — 整合驗收、通知與 Production Adapter

Status: COMPLETE  
Local Demo: COMPLETE  
Production: NOT STARTED

## Added

- `js/services/production-adapters.js`
- `js/services/schema-registry.js`
- `js/services/integrity-service.js`

## Modified

- `js/services/notification-service.js`
- `js/services/media-storage-service.js`
- `js/services/demo-reset-service.js`
- `js/services/venue-activity-service.js`
- `js/services/acceptance-service.js`
- `js/pages/notification-center.js`
- `js/pages/admin-acceptance.js`
- `css/pages/dashboard.css`
- `docs/PROJECT_STATUS.md`
- `docs/CHANGELOG.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/PRODUCTION_ROADMAP.md`
- `docs/BETA_V1_ACCEPTANCE.md`
- `docs/implementation-ledger.md`

## Delivered

- 統一通知事件與 Local／LINE／Email Adapter 狀態。
- Production Repository／API／Auth／Storage 邊界。
- Schema Registry、Migration、資料完整性與隱私驗收。
- Package 13–18 驗收紀錄、Production Readiness、備份與 Demo Reset。

## Validation

- 目標 ES Module 匯入通過。
- 通知、Adapter、Migration、完整性、隱私與備份拒絕測試通過。
- 未加入 Secret、外部 API 呼叫、套件或建置工具。
