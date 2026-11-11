# NXSPACE Permissions Matrix

The executable catalog is `js/data/permission-data.js`. Permission keys use `module.action`. Authentication proves identity; `PermissionService` resolves roles, filters navigation, guards routes/actions and applies record scope. Production must repeat every check server-side.

## Default roles

| Role | Scope | Default access |
| --- | --- | --- |
| Super Admin | `all` | Entire catalog, governance, integrations, settings, audit and Acceptance Center |
| Admin | `all` | Entire catalog except protected root deletions |
| Manager | `assigned` | Content plus assigned orders, rentals and availability operations |
| Vendor | `own` | Own vendor/products and related read operations |
| Viewer | `read_only` | Granted `*.view` routes only |

## Executable modules

| Module | Actions |
| --- | --- |
| Dashboard | `dashboard.view` |
| Activities/Events | view, create, update, delete/archive, publish, bulk |
| Vendors/Merchants | view, create, update, delete/archive, publish, bulk |
| Products/Banners | view, create, update, delete/archive, publish, bulk |
| Orders | view, create, update, delete, status, export |
| Rentals | view, update, approve, reject, delete, export |
| Availability | view, manage |
| Users | view, create, update, delete, reset-password, assign-role |
| Roles | view, create, update, delete, assign-permission |
| Settings/Integrations | view, update |
| Audit/Sensitive data | view, export, reveal |

`#acceptance` uses `settings.view`; Demo Reset therefore remains limited to accounts allowed to inspect system settings. The reset service additionally refuses to remove the final active Super Admin.

## Safeguards

- Final active Super Admin cannot be disabled, deleted or stripped of the root role.
- A user cannot remove their own final root role; system roles cannot be deleted; assigned roles cannot be deleted.
- Password/status changes invalidate affected Sessions through `sessionVersion`.
- Permission denial returns the 403 route without protected content.
- Sensitive reveal and governance actions create Local Audit events.
- Public lookup requires ID plus Email or phone last four and returns a masked whitelist only.
- Export/backup formats disclose only their documented scope. Full Acceptance backup contains Local identity hashes and must be handled as sensitive.

## Enforcement ownership

| Layer | Responsibility |
| --- | --- |
| Hosted identity/backend | Verify Session, authorize every request, protect Secrets and enforce record scope |
| Permission service | Resolve role permissions and client navigation/action state |
| Router/page | Block unauthorized route/action UX before reading or mutating data |
| Repository/adapter | Validate records and re-enforce authorization in Production |
| Component | Render already-authorized state; never grant access |

Static GitHub/Cloudflare Pages and LocalStorage cannot provide Production authentication or authorization. See `PRODUCTION_SECURITY.md`.
# Beta V1.1 店家資料範圍

`orders.view` 允許進入店家接單中心；Repository Query 與 Mutation 仍必須套用使用者獲指派的 `merchantId`。Super Admin／Admin 可使用全商店 scope，Vendor 無法以 Hash 或訂單 ID 讀寫未指派商店。

`roles.preview` 僅授予 Super Admin。預覽期間一律唯讀，並以預覽角色／使用者重新計算 Navigation、Route、Page、Action 與 merchant scope。
