# NXSPACE Data Dictionary

## Package 08 identity and integration schema

### users

`id`, `username`, `displayName`, `email`, `phone`, `roleIds`, `status`, `passwordHash`, `passwordSalt`, `sessionVersion`, `lastLoginAt`, `preferences`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.

Allowed status: `active`, `inactive`, `suspended`, `pending_activation`. Password plaintext is never stored. Reset increments `sessionVersion`, invalidating old Sessions.

### roles and role permissions

Roles contain `id`, `name`, `description`, `system`, `permissions`, and `dataScope`. System roles are Super Admin, Admin, Manager, Vendor, and Viewer. Data scope values are `all`, `assigned`, `own`, and `read_only`.

### Google Sheets mapping contract

Target sheets: `users`, `roles`, `role_permissions`, `activities`, `vendors`, `products`, `banners`, `orders`, `order_items`, `rentals`, `availability`, `audit_logs`, `system_settings`.

Each sheet requires a primary key, explicit field names/types, required/default/allowed values, public/private and read/write classifications, validation, `updated_at`, `updated_by`, and `version`. Public CSV/GViz reads must exclude users, password fields, Sessions, private Orders/Rentals, internal notes, and Audit details.

### Adapter modes

- `local`: complete Beta V1 LocalStorage adapter.
- `google-read`: public CSV/GViz read-only adapter with timeout and normalized errors.
- `protected-api`: write interface requiring a server-side endpoint; no browser credential support.

Sync metadata records state, last attempt, count/error, and time. Failures preserve Local Repository fallback.

## Package 07 operational data

### orders

Storage key: `nxspace.beta.v1.orders`.

| Field | Purpose |
| --- | --- |
| `id` | `NXO-YYYYMMDD-XXXXX` public order identifier |
| `status` | `pending`, `confirmed`, `preparing`, `ready`, `completed`, `cancelled` |
| `paymentStatus` | `unpaid`, `paid_on_site`, `refunded`, `not_required` |
| `fulfillmentStatus` | `pending`, `ready`, `picked_up`, `no_show` |
| `customerName`, `phone`, `email` | Pickup contact information |
| `pickupDate`, `pickupTime` | Requested pickup window |
| `items` | Immutable product name, quantity, unit price and subtotal snapshots |
| `total` | Order total in TWD |
| `publicNote`, `internalNote` | Public-safe and Dashboard-only notes |
| `fingerprint` | Two-minute duplicate-submit detection |
| `createdAt`, `updatedAt` | Lifecycle timestamps |

### availability

Storage key: `nxspace.beta.v1.availability`. Records contain `id`, `venueId`, `type`, `startDate`, `endDate`, `note`, and timestamps. Types are `open`, `blocked`, `maintenance`, and `event`. Overlapping settings for the same venue are rejected.

### operations audit

Storage key: `nxspace.beta.v1.operations.audit`. Stores the latest 100 local create, update, delete, status and sensitive reveal summaries. Export omits phone, Email, fingerprint, and internal notes.

The LocalStorage repositories implement the Beta V1 interfaces only. Package 08 replaces them with Google Sheets or backend adapters; public JavaScript must never contain write credentials.

## Package 06 Dashboard Local Data

### Demo credential and session

| Record | Storage | Fields |
| --- | --- | --- |
| Demo credential | LocalStorage `nxspace.beta.v1.demo-credential` | `username`, random `salt`, `passwordHash`, `role`, `createdAt` |
| Demo session | SessionStorage `nxspace.beta.v1.admin-session` | `id`, `username`, `displayName`, `role`, `issuedAt`, `expiresAt` |

No plaintext password is stored. This client-side hash is a Demo boundary, not Production Authentication.

### Dashboard collections

Storage keys use `nxspace.beta.v1.dashboard.{activities|vendors|products|banners}`. Each record includes stable `id`, unique `slug`, `status` (`published`, `draft`, `archived`), `createdAt`, and `updatedAt` in addition to its public content fields. Numeric price, stock, capacity, and priority values are normalized before save. Banner records may include `publishStart` and `publishEnd`.

`nxspace.beta.v1.dashboard.audit` stores the latest 50 local create/update/delete summaries. Published Dashboard records become the public Activity, Vendor, Product, and Banner source after the public page reloads. Draft and archived records are not exposed by the public data layer.

## Data boundary rules

- Google Sheets is the Beta V1 CMS but must remain behind a replaceable service/repository adapter.
- UI components accept prepared values and never fetch external data.
- External rows are normalized and validated before reaching pages.
- Mutable records require `id`, `status`, `created_at`, `updated_at`, and `updated_by`, except mapping tables where those fields do not apply.
- Dates are stored in an interoperable format and displayed in the Asia/Taipei timezone.
- Multiple IDs or URLs stored in Sheets require a documented serialization format before implementation.
- No password, private token, service credential, or sensitive endpoint secret may be stored in public client configuration.

## Current home data

Source: `js/data/home-data.js`. These are trusted local fixtures, not persisted domain records. Package 04 expands them into the complete public frontend dataset.

### quickEntries

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `icon` | string | Yes | Decorative entry icon |
| `title` | string | Yes | Entry label |
| `description` | string | Yes | Short destination summary |
| `href` | hash route | Yes | Working public destination |

### activities

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `image` | URL string | No | Card image |
| `tag` | string | No | Activity category label |
| `title` | string | Yes | Activity title |
| `description` | string | Yes | Short card summary |
| `date` | display string | No | Current fixture date label |
| `location` | string | No | Venue display name |
| `id` | string | Yes | Stable local record ID |
| `slug` | string | Yes | Dynamic route key |
| `content` | string | Yes | Detail-page description |
| `time` | display string | Yes | Activity time |
| `sortDate` | ISO date string | Yes | Deterministic list sorting |

### vendors

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `image` | URL string | No | Merchant card image |
| `tag` | string | No | Merchant category label |
| `title` | string | Yes | Merchant display name |
| `description` | string | Yes | Short merchant summary |
| `id` | string | Yes | Stable local record ID |
| `slug` | string | Yes | Dynamic route key |
| `content` | string | Yes | Detail-page description |
| `location` | string | Yes | Public location label |
| `hours` | string | Yes | Public opening-hours label |

### products

| Field | Type | Required | Purpose |
| --- | --- | --- | --- |
| `image` | URL string | No | Product card image |
| `tag` | string | No | Product category label |
| `title` | string | Yes | Product display name |
| `description` | string | Yes | Short product summary |
| `price` | display string | No | Current fixture price label |
| `id` | string | Yes | Stable local record ID |
| `slug` | string | Yes | Dynamic route key |
| `content` | string | Yes | Detail-page description |
| `priceValue` | number | Yes | Sortable numeric price |
| `vendor` | string | Yes | Public vendor label |
| `availability` | string | Yes | Public supply status |

### Public supporting records

| Record | Core fields | Purpose |
| --- | --- | --- |
| `homeBanner` | eyebrow, title, description, label, href | Home announcement banner |
| `heroContent` | eyebrow, title, description, actions, highlights | Data-driven Home Hero |
| `venue` | name, summary, description, image, capacity, facilities, action | Public venue overview and CTA |

### Package 04 fixture counts

- 4 quick entries
- 7 activities
- 7 vendors
- 7 products
- IDs are unique across public entities; slugs are unique within each entity group.

## Target domain entities

The following contracts remain the target operational entities. Consolidated Package 08 owns executable models, schemas, repository adapters, and Google Sheets mapping; Packages 05–07 may introduce local workflow records earlier through mock repositories.

| Entity | Required core fields | Purpose |
| --- | --- | --- |
| `users` | `id`, `username`, `email`, `display_name`, `status`, `role_ids`, `merchant_ids`, timestamps | Account identity, status, roles, and merchant scope |
| `roles` | `id`, `name`, `description`, `is_system`, `status`, timestamps | Named permission collections |
| `role_permissions` | `role_id`, `permission_key`, `allowed`, `updated_at`, `updated_by` | Role-to-permission mapping |
| `events` | `id`, `slug`, `title`, `summary`, schedule, venue/media fields, `status`, timestamps | Public activities and event publishing |
| `merchants` | `id`, `slug`, `name`, category, contact/media fields, `status`, timestamps | Partner merchant identity and publishing |
| `products` | `id`, `merchant_id`, `slug`, `name`, pricing/availability fields, `status`, timestamps | Merchant-owned product discovery and ordering |
| `banners` | `id`, `placement`, title/media/CTA fields, schedule, priority, `status`, timestamps | Scheduled promotional placements |
| `venues` | `id`, `slug`, `name`, capacity/facility/pricing/media fields, `status`, timestamps | Rentable space information |
| `rental_inquiries` | `id`, `venue_id`, applicant/contact/request fields, `status`, timestamps | Venue inquiry workflow |
| `orders` | `id`, `order_number`, customer/fulfillment/total/status fields, timestamps | Order header and lifecycle |
| `order_items` | `id`, `order_id`, `product_id`, snapshot name, quantity, unit price, subtotal | Immutable order line snapshots |
| `settings` | `key`, `value`, `value_type`, `group`, `is_public`, update fields | Typed site and feature configuration |
| `audit_logs` | `id`, actor/action/entity fields, before/after summaries, `created_at` | Operational history |

## Status and validation baseline

- Entity status values must be explicit enumerations defined by Package 05, not free-form UI strings.
- IDs and slugs must be stable and unique within their entity.
- Prices and totals are numeric domain values; currency formatting occurs at the presentation boundary.
- Public queries return only published/active records.
- Merchant-scoped users may access only assigned merchant records after authorization.
- Media URLs require protocol and allow-list validation before rendering external data.

## Package 05 public interaction models

### venues

Source: `js/data/venue-data.js`.

| Field | Type | Purpose |
| --- | --- | --- |
| `id`, `slug`, `name` | string | Stable identity and Route key |
| `summary`, `description` | string | Public venue content |
| `capacity` | object | Seated, standing, and recommended capacity |
| `features`, `suitableFor` | string arrays | Venue characteristics and activity fit |
| `facilities`, `services` | string arrays | Equipment and included service labels |
| `plans` | object array | Duration, display price, and plan note |
| `unavailableWeekdays` | number array | Closed weekdays using JavaScript weekday numbers |
| `unavailableDates` | ISO date array | Fully unavailable local fixture dates |
| `occupiedSlots` | object array | Date/start/end conflict fixtures |

### rentalApplications

Storage key: `nxspace.beta.v1.rentals`.

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | string | Public ID in `NXR-YYYYMMDD-XXXXX` format |
| `status`, `statusLabel` | string | Workflow state and public label |
| `applicantName`, `phone`, `email` | string | Necessary follow-up and lookup verification data |
| `organization` | string | Optional company/group name |
| `venueId`, `venueName` | string | Requested venue snapshot |
| `activityType` | string | Public activity type selection |
| `dateMode` | `single` or `range` | Date selection mode |
| `startDate`, `endDate` | ISO date string | Requested date or range |
| `startTime`, `endTime` | `HH:mm` | Requested daily time interval |
| `expectedPeople` | integer | Capacity validation input |
| `equipment` | string array | Requested equipment labels |
| `activityDescription`, `notes` | string | Activity and optional requirements |
| `publicNote` | string | Administrator-safe public query note |
| `fingerprint` | string | Local duplicate-submit detection only |
| `createdAt`, `updatedAt` | ISO datetime | Local lifecycle timestamps |

Public lookup returns a strict whitelist and masks name, phone, and Email. It excludes organization, equipment, activity description, internal notes, and fingerprint.

### contactInquiries

Storage key: `nxspace.beta.v1.contacts`.

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | string | Local inquiry ID in `NXC-YYYYMMDD-XXXXX` format |
| `status`, `statusLabel` | string | Received state |
| `name`, `contact` | string | Necessary response information |
| `subject`, `type`, `message` | string | Inquiry classification and content |
| `fingerprint` | string | Local duplicate-submit detection |
| `createdAt`, `updatedAt` | ISO datetime | Local lifecycle timestamps |

### Repository boundary

- `PublicInquiryRepository` defines rental save/read/latest/lookup and contact save operations.
- `LocalPublicInquiryRepository` is the complete Beta V1 Local Mock implementation.
- `MemoryStorage` supports isolated tests and environments without LocalStorage.
- A future Google Sheets or backend Adapter must implement the same interface without exposing write credentials to the browser.
- LocalStorage data is browser-local, is not synchronized, and is removed when the user clears site data.

## Package 09 release and reset records

| Record | Fields | Persistence |
| --- | --- | --- |
| Environment summary | `appName`, `version`, `releaseDate`, `mode`, `hosting`, `basePath`, `adapterMode`, `productionReady` | Runtime constant; no Secret |
| Acceptance result | `checkedAt`, `environment`, `checks[]`, `passed` | Runtime only |
| Full Demo backup | `schemaVersion`, `createdAt`, `environment`, `collections` | User-downloaded JSON; contains identity data and must be protected |

Demo Reset removes `nxspace.beta.v1.*` operational/content/inquiry/audit/settings collections, preserves system roles and exactly one active Super Admin, and never resets unless that safeguard can be satisfied.
# Beta V1.1 Commerce Collections

Local Demo 新增 `merchants`、`products`、`product_option_groups`、`product_options`、`orders`、`notification_events` 與 cart。商店、商品、使用者指派、訂單及通知統一使用 `merchantId`。訂單保存 merchant/customer/items/customization/price snapshots、狀態歷程與公開／私人備註。

Package 12 增加特殊休息日、臨時營業日、日期／時段封鎖、待確認容量策略、schemaVersion、updatedAt、updatedBy 與 conflictMetadata。
