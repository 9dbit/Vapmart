# Vapmart Checkpoint 44 - Promotion Analytics & Reconciliation

**Release date:** 4 November 2026 (Asia/Jakarta)
**Result:** PASS — verified source released and deployed.

## Verified identity

| Item | Value |
| --- | --- |
| Verified application SHA | `8936d29663a99d859dad7450ba9de5f0d9fb2fe5` |
| Work branch | `work/cp44-promotion-analytics-20261104` |
| Release branch | `release/vapmart-stable` |
| GitHub Actions run | `41867156811` |
| GitHub Actions conclusion | **SUCCESS** |
| QA artifact ID | `13341794902` |
| QA artifact digest | `sha256:488b2d634668cc988756c160a33c06f00aba261c3b40d625b034c3e57f7963f3` |
| Live Railway API deployment | `6f1a4e17-5b11-48e6-8748-c933a0a2f1da`, SUCCESS |
| Live Railway Web deployment | `463d5ff4-dcbd-429e-beb6-58e205029f2c`, SUCCESS |
| PostgreSQL deployment | `19ee1b92-92d7-42c9-a7fc-6cb676bcfa21`, SUCCESS |

Release source was fast-forwarded non-force from CP43 release docs commit `d51a4daa36753b61f9aac4b896565f6b977b6a49` (21 commits ahead, 0 behind), after terminal GitHub Actions success on exact code SHA.

## Delivered application functionality

### Admin

- New menu item **Voucher & Promo → Analytics**.
- Route: `/admin/promotions/analytics`.
- Purple-branded desktop/mobile dashboard, responsive at 390px with no horizontal overflow in browser QA.
- Date range, campaign filter, 7/30/90 day presets, and refresh.
- Headline: paid merchandise GMV; voucher and campaign discount cost; net merchandise value; paid share of attributed orders; pending order count; reconciliation exceptions.
- Trend views for daily paid GMV and separated daily promotion/voucher discount costs.
- Campaign-level paid GMV, applied/paid/pending/redemption, stacking and diagnostics.
- Product and category performance with deterministic proportional allocation of paid discounts from immutable order-item snapshots.
- Current membership ACTIVE versus other/unknown segment comparison.
- Operational reconciliation exception list for mismatches in stored order discount or total formulas.
- Paginated finance ledger with voucher and campaign recorded separately.
- Excel-friendly UTF-8 BOM CSV export with export size cap, escaping, and no customer contact PII.

### Admin API

`GET /v1/admin/catalog/analytics/summary`

`GET /v1/admin/catalog/analytics/ledger`

`GET /v1/admin/catalog/analytics/ledger.csv`

All routes are protected by the existing admin guard and proxied via the existing authenticated Next.js catalog admin API. JSON responses are private/no-store. CSV bytes are forwarded without decoding to preserve Excel BOM.

### SQL

- New additive index migration `apps/api/sql/022_promotion_analytics_indexes.sql`.
- No business rows are seeded, deleted, or altered.
- Migration applied successfully as part of API startup as indicated by `VAPMART_DATABASE_READY`.
- No change to membership, order/payment status, checkout capture, or courier booking logic.

## Financial definitions and limitations

The reporting population is orders with a checkout idempotency key and at least one promotion or voucher attribution. One order remains one order when a voucher and campaign are stacked.

- **Period:** `product.orders.created_at` interpreted in `Asia/Jakarta`; date boundaries inclusive.
- **Paid GMV:** sum of `subtotal_idr` from `payment_status='paid'` attributed orders, excludes shipping.
- **Paid voucher discount:** sum of `voucher_discount_idr` on paid attributed orders.
- **Paid campaign discount:** sum of `promotion_discount_idr` on paid attributed orders.
- **Paid net merchandise:** paid GMV minus paid voucher and campaign costs.
- **Paid rate:** paid attributed orders / all attributed orders within the selected order creation-date interval; it is not the conversion rate of site visitors.
- **Pending:** shown as order pipeline but not revenue.
- **Refunded:** represented in status totals but excluded from paid GMV and discount costs; refund cash movement is not proven.
- **Current member segment:** joins membership status *at report time*, not a historic order-date snapshot.
- **Category allocation:** uses current deterministic primary category; category history is not in the checkout snapshot.
- **Incremental conversions/lift:** not computed; data lacks impression and randomized control-group evidence. Do not interpret the paid/order share as a causal uplift metric.

## Verification evidence

The full exact-commit CI workflow passed on `8936d29663a99d859dad7450ba9de5f0d9fb2fe5`:

- API TypeScript build and existing unit tests.
- Migration 022 twice on disposable PostgreSQL.
- CP40, CP41, CP42 and CP43 checkout, voucher, promotion and private-draft regression tests.
- New isolated CP44 analytical integration tests verifying independent accounting sums, correct product/category discount allocation, WIB date boundaries, campaign filter, refund exclusion, membership segments, keyset ledger pagination, anomaly detection, admin authorization, no customer PII in CSV and Excel formula-injection escaping.
- Catalog, integrity, warehouse, courier and banner regressions.
- Next.js production build.
- CP39, CP40, CP41, CP42, CP43 and new CP44 Chromium desktop/mobile browser lifecycles.
- CP44 browser report: `pass=true`, desktop+mobile=true, filters=true, `csvExport=true`, financeLedger=true, JavaScript errors=[], productionWrites=false, paymentCapture=false. Mobile viewport=390 and scrollWidth=390.
- QA ZIP artifact: `13341794902`, SHA-256 `488b2d634668cc988756c160a33c06f00aba261c3b40d625b034c3e57f7963f3`.

Browser snapshots and test reports are included in the ZIP. Tests ran with fixture identities and disposable loopback databases only.

## Railway cutover and health

Railway project `7c01e4d8-6152-4f04-9750-6e7031aa0830`, environment `04586a07-99b0-4cfd-95fa-bb6d8f1719e3` named `staging` but serving the live vapmart.id domains.

1. Stage and inspect API diff: only commitSha changed, non-destructive.
2. Commit API staged change, confirm terminal SUCCESS, `VAPMART_DATABASE_READY`, NestJS startup healthy.
3. Stage and inspect Web diff: only commitSha changed, non-destructive.
4. Commit Web staged change, confirm terminal SUCCESS, Next.js `Ready` log.
5. Verify both service sources point to exact same SHA.
6. Environment status: Web, API and Postgres **online**, 1/1 running replica each, 0 crashed, 0 warnings/criticals, 0 deployment failures, no pending staged work.

### Domains

- `www.vapmart.id`: verified, valid TLS, Railway DNS PROPAGATED.
- `vapmart.id`: verified, valid TLS, Railway DNS PROPAGATED on follow-up read. A preceding immediate status read transiently returned REQUIRES_UPDATE, but recheck returned PROPAGATED.

### Safety

Payment gateway remains disabled. No payment is captured by CP44; no courier booking or external shipping webhook is activated. Existing products, orders and memberships were not overwritten by the reporting migration. Dashboard access remains limited to authenticated verified admins.

## Next logical checkpoint

CP45 could add event-based campaign attribution instrumentation, an explicit user consent/privacy model for behavioral measurement, and experimental holdout assignment to distinguish true visitor conversion and incremental campaign impact from the existing paid-order share. Implementation requires a new event schema, definitions, and opt-in measurement plan rather than deriving unsupported causal claims from stored orders.

---
Generated after terminal CI success and Railway deployment health verification.
