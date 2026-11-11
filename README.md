# NXSPACE Platform Beta V1

Beta V1.1 Package 11 提供以商店為入口的 Local Demo 點餐、商品客製化、單店購物車、店家接單、訂單進度與 Local Notification Log。正式 LINE Messaging、多人即時同步與遠端寫入仍需受保護 Backend。

Package 12 完成店家營運控制、商品售完、容量釋放、角色唯讀預覽、通知中心、LINE 安全 Payload 及 Commerce Public／Private Projection。Local Demo 可完整驗收，但不等同 Production Backend。

NXSPACE is a static, responsive platform for discovering Taitung activities, partner merchants, products, ordering, and venue rental information. The project uses HTML5, CSS3, and browser-native JavaScript ES Modules and is intended for Live Server, GitHub Pages, and Cloudflare Pages.

## Local preview

Open the repository with VS Code and serve the workspace root with Live Server. The public entry point is `index.html`; the Local Demo Dashboard entry is `admin/index.html`.

No dependency installation or build command is required.

## Architecture

The current structure is preserved and organized by responsibility:

- `js/app.js` is the browser entry and composition root.
- `js/pages/` composes route-level views from components and prepared data.
- `js/components/` contains reusable presentation functions that return HTML strings.
- `js/layouts/` contains public and future admin application shells.
- `js/router/` owns route matching, navigation state, and route rendering.
- `js/services/` owns external integration adapters such as Google Sheets and caching.
- `js/store/` owns shared client-side application state.
- `js/data/` contains temporary local fixtures and presentation-ready home data.
- `js/config/` contains public runtime configuration without credentials.
- `js/utils/` contains domain-neutral helpers.
- `css/main.css` is the only stylesheet linked by `index.html`; component and page styles must be imported through it.

The required dependency direction is:

```text
app / router
    ↓
page or controller
    ↓
repository or service
    ↓
external adapter / data source

page
    ↓
layout and reusable UI components
```

Rules:

- Components do not fetch data, access Google Sheets, decide permissions, or mutate global state.
- Pages coordinate presentation and consume prepared data through repositories/services as those layers are introduced.
- External data access remains behind replaceable adapters; UI modules never call Google Sheets directly.
- Authentication proves identity; permission modules authorize actions. Permission decisions are not embedded in HTML markup.
- Domain models and schemas normalize external records before they reach pages or components.
- Shared state remains in `js/store/`; page-local state remains within the owning page/controller.
- Dependency cycles and imports from lower layers back into UI layers are not allowed.
- Empty architecture folders or modules are added only when a package supplies a real implementation.

Current route, data, and permission contracts are documented in:

- `docs/routes.md`
- `docs/data-dictionary.md`
- `docs/permissions-matrix.md`
- `docs/implementation-ledger.md`

## Local Demo Dashboard

- Open `/admin/` through Live Server.
- On first use, create a local Demo administrator account. No default plaintext password is committed.
- The password is stored only as a salted SHA-256 hash in LocalStorage; the one-hour Session is stored in SessionStorage.
- Activities, Vendors, Products, and Banners persist in LocalStorage and published records are consumed by the public frontend after reload.
- This mode demonstrates UI and workflows only. Production requires hosted authentication, server-side authorization, a database/repository adapter, secure media storage, audit retention, and secret management.

## Beta V1 release

Packages 00–09 are implemented. The public site, venue/order/contact flows, Local Demo Dashboard, CMS operations, governance, adapters, backup/reset and final Acceptance Center are operational. Run the remaining browser checks in `docs/BETA_V1_ACCEPTANCE.md` before publishing.

Deployment requires no install or build command. See `docs/DEPLOYMENT.md`, `docs/OPERATIONS_GUIDE.md` and `docs/USER_GUIDE.md`.

## Production security boundary

- GitHub Pages cannot safely store administrator passwords, API keys, service-account keys, or write credentials.
- Local Demo password hashes and client permission checks are for acceptance only and can be controlled by the browser owner.
- Google Sheets public mode is read-only and must contain published public data only.
- Protected writes require a Cloudflare Worker, Google Apps Script Web App with server-side controls, or another backend API.
- Production must replace Local Authentication, recheck permissions and data scope server-side, protect audit logs, and use a concurrent database or controlled repository.
