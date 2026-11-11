# NXSPACE Route Registry

## Package 08 governance routes

| Dashboard route | Permission | Purpose |
| --- | --- | --- |
| `#users` | `users.view` | User lifecycle, roles, status and password reset |
| `#roles` | `roles.view` | System/custom roles, Permission Matrix and data scope |
| `#integrations` | `integrations.view` | Adapter mode, Dry Run, sync status, retry/fallback details |
| `#settings` | `settings.view` | Local system settings and safe backup/restore |
| `#audit` | `audit.view` | Authentication, identity, permission and governance events |
| `#acceptance` | `settings.view` | Runtime checks, Production gate, full backup and protected Demo reset |

Navigation is permission-filtered. Route entry is checked again before rendering; unknown Dashboard routes retain the existing 404 behavior.

## Package 07 operational routes

| Surface | Route | Purpose |
| --- | --- | --- |
| Public | `#order` | Product selection, cart, pickup details, validation and submission |
| Public | `#order/confirmation/:id` | Persistent order number and pickup summary |
| Public | `#lookup` | Rental and order lookup using ID plus Email or phone last four |
| Dashboard | `#orders` | Order table, detail, statuses, notes, bulk updates and export |
| Dashboard | `#rentals` | Rental review, status, notes, conflict checks and export |
| Dashboard | `#availability` | Venue blocked, maintenance, event and open date settings |

Public order confirmation and lookup are LocalStorage-backed and remain available after refresh in the same browser.

## Package 06 Dashboard entry and routes

Dashboard uses the static-host-compatible `/admin/index.html` entry and a separate Hash Router. Opening `/admin/` through Live Server or GitHub Pages resolves the directory index without changing the accepted public Router.

| Route | Access | Purpose |
| --- | --- | --- |
| `/admin/` | Public entry | Login or guarded Dashboard redirect |
| `#dashboard` | `dashboard.view` | KPI, recent activity, quick actions |
| `#activities` | `events.view` | Activity search, filter, sort, pagination and CRUD |
| `#vendors` | `merchants.view` | Vendor search, filter, sort, pagination and CRUD |
| `#products` | `products.view` | Product search, filter, sort, pagination and CRUD |
| `#banners` | `banners.view` | Banner search, filter, sort, pagination and CRUD |
| `#unauthorized` | Authenticated | Accessible 403 state |
| unknown Dashboard hash | Authenticated | Dashboard 404 state |

Unauthenticated access renders Login. A valid Local Demo Session is required before protected route rendering. Packages 07–08 extend the same Dashboard Router contract.

## Routing strategy

- Public routing uses static-host-compatible hash URLs.
- `js/router/routes.js` owns route metadata and page bindings.
- `js/router/router.js` owns matching, History events, loading/error handling, metadata, focus, and rendering.
- `js/app.js` mounts the Shell once and delegates page rendering to the Router.
- Hash changes and browser Back/Forward are supported through `hashchange` and `popstate` with frame-level de-duplication.
- Unknown paths and missing dynamic records render the public Not Found state.
- Every successful route updates the document title and meta description.

## Implemented public routes

| Route | Page | Interaction/status |
| --- | --- | --- |
| `#home` | Home | Hero, banner, quick entries, featured activities/vendors/products, venue CTA |
| `#activities` | Activity listing | Search, category filter, sort, Load More |
| `#activities/:slug` | Activity detail | Date, time, location, contact CTA |
| `#vendors` | Vendor listing | Search, category filter, sort, Load More |
| `#vendors/:slug` | Vendor detail | Category, location, hours, products CTA |
| `#products` | Product listing | Search, category filter, price/name sort, Load More |
| `#products/:slug` | Product detail | Price, vendor, availability, contact CTA |
| `#venue` | Venue overview | Capacity, facilities, contact CTA |
| `#venue/:slug` | Venue detail | 鐵花館／綠洲場特色、方案、設備、規則、流程與 FAQ |
| `#venue/apply` | Rental application | Generic venue/date/time/application flow |
| `#venue/apply/:slug` | Preselected rental application | Opens the application with a selected venue |
| `#venue/confirmation/:id` | Rental confirmation | Persistent result, masked summary, copy ID, next steps |
| `#lookup` | Public lookup | Rental ID verification and Beta V1 order lookup state |
| `#about` | About NXSPACE | Editorial content and contact CTA |
| `#contact` | Contact | Validated, persistent Local Repository inquiry form |
| `#privacy` | Privacy statement | Data purpose, LocalStorage, masking, Production boundary |
| `#terms` | Terms | Public use and rental inquiry conditions |
| `#order` | Order/rental entry | Working bridge to rental and order lookup |
| unknown hash | Not Found | Accessible 404 state and Home action |

## Route record contract

| Field | Purpose |
| --- | --- |
| `path` | Exact or `:slug` hash pattern |
| `title` / `getTitle` | Static or record-aware document title |
| `description` | Route meta description |
| `render` | Pure page HTML renderer |
| `afterRender` | Optional page interaction initializer |

## Navigation state

- Main navigation derives its current state from the hash.
- Dynamic details keep their parent Activity, Vendor, or Product navigation item active.
- `aria-current="page"` communicates the active item.
- Mobile Drawer links close the panel and move focus to the main route target.

## Public flow route sequence

```text
#venue
  → #venue/:slug
  → #venue/apply/:slug
  → #venue/confirmation/:id
  → #lookup
```

Confirmation routes read from LocalStorage and remain available after refresh in the same browser unless site data is cleared.

## Static deployment fallback

- `404.html` redirects unknown server paths to the correct GitHub Pages project base and `#home`.
- Public and Dashboard application routes remain hash-based; direct refresh requires no rewrite rule.
- Package 09 is the final Beta V1 route set; no future route is implied.
# Beta V1.1 商店點餐路由

- `#shops`：公開商店列表
- `#shops/:slug`、`#shops/:slug/order`：商店資訊、日期時段、菜單與客製化
- `#order/cart`：單店購物車與顧客資料
- `#order/confirmation/:id`：訂單確認及狀態時間軸
- `#lookup`：遮罩後公開訂單查詢
- `/admin/#merchant-orders`：受權限及 merchant scope 保護的店家接單中心
- `/admin/#notifications`：本機通知中心與安全重試基礎
- `/admin/#role-preview`：Super Admin 唯讀角色／使用者預覽
