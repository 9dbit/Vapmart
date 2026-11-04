# Vapmart CP44 Functional & Anomaly Audit (2026-11-04)

**Scope:** Code and infrastructure review of the live CP44 application, reference revision document, and preserved GitHub Actions QA evidence.  
**Mode:** Read-only diagnostic audit. No production database writes, feature-flag changes, domain changes, or production deployments. This audit report is stored only on its own non-release GitHub branch.

## System baseline

- Last verified live application SHA: `8936d29663a99d859dad7450ba9de5f0d9fb2fe5`.
- Production-facing Railway environment is named `staging`, ID `04586a07-99b0-4cfd-95fa-bb6d8f1719e3`. The production-facing services remain connected to `release/vapmart-stable`.
- Web `463d5ff4-dcbd-429e-beb6-58e205029f2c`, API `6f1a4e17-5b11-48e6-8748-c933a0a2f1da`, PostgreSQL `19ee1b92-92d7-42c9-a7fc-6cb676bcfa21`: all **SUCCESS / ONLINE** with 1/1 replicas, zero crashes, no critical warnings at audit time.
- Latest preserved CP44 CI run `41867156811`: **SUCCESS**. Its evidence has 67 passing unit tests, isolated backend integration cases, and CP39 through CP44 desktop/mobile browser scripts.
- CI operates with fixture identities and disposable PostgreSQL; it does **not** establish real customer sign-up, real payment capture, production order checkout, domain external HTTP reachability, or traffic-load behavior.
- At API startup the read-through product source reported:
  `total=21, managed=2, existing=19, published=1, drafts=1, existing_media_linked=19, existing_media_missing=0, existingPublicationEnabled=false`.
  The 19 archived items remain reference-only, even though their images have been linked.

## Compared against user's original revision document

Source: [Review isi produk vapmart.id](https://docs.google.com/document/d/1jcvSg0hsDdqVZGwk8o2huM7JcSk_3Mkm8N62LCEYT-U/edit).

| Original request | Current evidence | Assessment |
| --- | --- | --- |
| Stock-change notes optional | Warehouse editor explicitly labels note as optional; warehouse ledger remains authoritative. | Implemented; do not confuse this with dimensional fields. |
| Identify which variant is active | Product-family editor supports per-variant `enabled` plus publication validation. | Implemented in code and fixture tests. |
| Independent SKU, price and stock for each variant | Editor and `saveFamily` persist variant SKUs, pricing and warehouse stocks; parent/variant category linkage is explicitly maintained. | Implemented. |
| Cart and Buy CTAs | Public catalog/storefront includes cart actions; backend creates draft physical orders. | Implemented as staging/draft workflow, not as paid commerce. |
| Voucher | CP42 management and checkout usage plus CP43 stacking and automatic campaign. | Implemented in tests. |
| Shipping cost estimate | Fixed shipping fee key is configured; Biteship test rate lookup keys/flag are not present in the API variables. | Fixed estimate may work; provider lookup is not enabled in live environment. |
| Bank transfer without payment gateway | `bank_transfer` is accepted as an order-draft method and assigns `payment_status='pending'`. | Implemented as draft workflow, not bank settlement. |
| Observe created orders in admin | Order list/detail exist, but overview “Draft pesanan” only counts `not_initiated` and misses `pending`. | **Functional discrepancy (F04).** |

## Prioritized findings

### F01 [P1] Legacy product conversion is not complete

**Evidence:** `apps/api/src/admin-product-records.ts` returns `synchronization:read_through_no_copy`, `existingReadOnly:true`, and `existingPublicationEnabled:false`. Live API startup records 19 existing items with images, alongside only 2 managed items and 1 published managed item.

**Effect:** “Operational product catalog” is incomplete; images and archive browsing do not mean 19 ordinary product records can be edited, stocked and published. No evidence that all archival products are sellable.

**Proposed correction:** Implement audited archive-to-managed **private draft** conversion, deterministic idempotency and source linkage, attach existing media, preserve archive provenance, use admin-controlled category/SKU/price/warehouse completion, then publish only eligible products. Never auto-publish an unreviewed imported product or silently overwrite admin-authored data. Test all 19 candidates and report each outcome.

### F02 [P1] Apex DNS not reliably propagated

**Evidence:** Railway custom `www.vapmart.id` has `DNS_RECORD_STATUS_PROPAGATED` and valid TLS; `vapmart.id` returned `DNS_RECORD_STATUS_REQUIRES_UPDATE` with blank `currentValue`, required route `lta5rlv1.up.railway.app`. Some earlier reads transiently reported propagated; do not treat a transient success as closure.

**Effect:** Apex domain may be intermittent or unavailable despite healthy Next.js and API services.

**Proposed correction:** Inspect authoritative DNS provider and existing nameservers; set supported apex ALIAS/flattened CNAME equivalent pointing to the exact Railway target, preserve MX/SPF/DKIM/DMARC and all email records, verify authoritative and multiple public recursive resolvers, both HTTP and HTTPS, canonical redirects and certificate. Do not blindly change nameservers.

### F03 [P1] Two product management routes with inconsistent category models

**Evidence:** `apps/web/src/app/admin/page.tsx` retains legacy product editor and hardcoded `home, lifestyle, decor, accessories, electronics, other` choices. It calls `/api/admin/products` → `ProductsService`. New `/admin/products` uses `/api/admin/catalog/products` → `CatalogWorkspaceService` with category IDs and advanced variants. The legacy editor remains reachable from overview action/navigation functions even though direct URL parameter redirects often select the newer editor.

**Effect:** Admin behavior and available category options vary by entry point; users may edit a product through a simpler editor that cannot represent all current attributes/variants/categories. Both paths have authentication and stock-ledger safeguards, so this is not evidence of a security bypass.

**Proposed correction:** Redirect every legacy product action to the canonical product editor; keep legacy API as a read-only compatibility layer or explicitly deprecate old write endpoints with migration strategy; unify validation, audit and category selection. Browser-test all overview action links, direct URLs, back/forward and SKU modification.

### F04 [P1] Admin overview omits bank-transfer pending orders

**Evidence:** `apps/api/src/checkout.ts` sets `payment_status='pending'` for `bank_transfer`. But `apps/api/src/products.ts` `summary()` defines `pendingOrders` as only `payment_status='not_initiated'`. The overview `apps/web/src/app/admin/page.tsx` renders that number under “Draft pesanan / Belum dibayar”.

**Effect:** Orders that customers just submitted by bank transfer do not appear in that management KPI, and operational staff may underestimate outstanding orders. The detailed orders list remains separate.

**Proposed correction:** Define explicit, separate **draft**, **pending payment**, **paid and verified**, **cancelled/refunded** counters; include `pending` in pending-payment queues; keep status filters and order detail consistent. Test one bank-transfer pending draft, one non-initiated draft and one paid order in a disposable database.

### F05 [P1] Analytics paid semantics differ from Fulfillment payment verification

**Evidence:** CP44 analytics `apps/api/src/promotion-analytics.ts` uses `payment_status='paid'` alone for GMV and discount costs. Fulfillment `apps/api/src/fulfillment.ts` accepts payment as verified only if `status='paid'`, `payment_status='paid'`, and both `payment_provider` and `payment_reference` are present. The CP44 integration fixture directly changes order `payment_status` without adding a provider/reference.

**Effect:** CP44 can report paid merchandise value for an order that Fulfillment explicitly rejects as *unverified*. This is a measurement/trust inconsistency, not proof that a real payment was made.

**Proposed correction:** Decide an authoritative verified-payment predicate and test it against provider events, refunds and order transitions; show unverified paid flags separately as exceptions. Until a verified payment integration exists, avoid calling status-only totals settled revenue or cash. Keep user-facing GMV labels precise.

### F06 [P1] Analytics overview queries lack a consistent reporting snapshot

**Evidence:** `PromotionAnalyticsService.overview()` invokes five independent `DatabaseService.query()` calls via `Promise.all`. Each can observe a different PostgreSQL READ COMMITTED snapshot while live orders change. CSV uses a REPEATABLE READ READ ONLY transaction, but overview does not.

**Effect:** Daily headlines, campaign totals, segment totals, product breakdown and anomaly list can disagree during concurrent payment/refund updates even when each query is individually correct.

**Proposed correction:** Read all overview queries within a single read-only REPEATABLE READ transaction on one client. Add a concurrency fixture that changes order states during report generation and assert cross-view reconciliation. Avoid using a pooling connection per query.

### F07 [P2] Cart quantity cap disagrees with checkout validation

**Evidence:** `apps/web/src/lib/cart.tsx` accepts and retains quantities up to **999**. `apps/api/src/checkout.ts` `parseBasket()` rejects any line with quantity **greater than 99**.

**Effect:** Customers may be able to create a cart state that can never pass quote or checkout validation.

**Proposed correction:** Define shared line limits (1–99) and enforce them on cart restore, add, quantity selector, server quote, shipping estimate and checkout. Show an explicit UI limit rather than surprising rejection.

### F08 [P2/P1 before public marketing launch] SEO is globally disabled

**Evidence:** Root layout metadata declares `robots:{index:false,follow:false}`; `apps/web/src/app/robots.ts` disallows the whole site for all user agents.

**Effect:** Public pages are not intended to be indexed by search engines. Appropriate for temporary staging but not for an indexed public storefront/SEO launch.

**Proposed correction:** Separate production and staging environments and gate robots/indexability by the actual environment and site readiness. Keep checkout/admin/private pages noindex. Review sitemap, canonical URLs and crawlability at launch.

### F09 [P2] Checkout payments and live couriers remain explicitly unavailable

**Evidence:** API environment does not have `SHIPPING_RATE_LOOKUP_ENABLED`, `BITESHIP_API_KEY` or origin postcode keys; `SHIPPING_FEE_IDR` is present but secret values are redacted. `PAYMENT_MODE` is not configured; digital-commerce feature is gated. Physical payment-session API deliberately returns 503. Web checkout exposes bank-transfer draft orders, not verified bank transfers. CP44 tests do not perform live charges.

**Effect:** A draft order can be created in the supported flow, but no real settlement or courier booking is delivered. Customer-facing copy promising manual bank-transfer verification should not imply there is an available admin settlement action.

**Proposed correction:** Keep payment/courier switches disabled; add explicit sandbox copy, no bank account payment instructions, expiry and cancellation states; when authorized, integrate verified payment events with idempotent status transitions and administrative reconciliation before enabling live checkout.

### F10 [P2] Admin summary may overcount active products and low stock

**Evidence:** `ProductsService.summary()` counts all `product.products` rows for `published` and for `lowStock` (condition `stock_qty<=5`) without excluding draft products, variant parent records, or archived records. Admin overview renders these aggregate values.

**Effect:** Future variable-product catalogs or many drafts can inflate published/low-stock KPIs relative to actual purchasable primary products and alert candidates.

**Proposed correction:** Count published parent product families for storefront KPIs; count low-stock at available active SKU level (with clear threshold), exclude archived/demo/draft SKUs, and reconcile warehouse ledger availability. Validate simple and variable product fixtures.

### F11 [P2 scaling] Automatic campaign evaluation considers only first 100 candidates

**Evidence:** `bestAutomaticPromotion()` queries active campaign events ordered by priority with `LIMIT 100` *before* evaluating cart-specific product/category targets and per-user eligibility.

**Effect:** When 100 higher-priority campaigns do not match a cart, a valid lower-priority campaign may never be considered.

**Proposed correction:** Apply scope and user eligibility in SQL before limiting, or iterate through bounded pages until an eligible candidate is found. Test 101st-campaign edge case. Not proven to affect current low-volume production.

### F12 [P2] Dashboard empty-state and reconciliation depth need adjustment

**Evidence:** CP44 UI states no reconciliation differences even when `appliedOrders=0`. The exception predicate only tests order total/discount arithmetic and a few attribution checks. It does not compare the order subtotal against immutable line-item sums or verify payment-provider evidence.

**Effect:** An empty dataset can look “reconciled”, and certain internally consistent but incorrect invoice totals are not detected.

**Proposed correction:** Distinguish “nothing to reconcile” from “0 exceptions across N orders”; add order-item subtotal and verified-payment status mismatch checks. Preserve existing documented limitations for historical category/membership assignments.

### F13 [P1 operational isolation] Public domain serves an environment named staging

**Evidence:** Both custom domains route to Railway environment `staging`, which also contains the production-facing database and service deployments. The digital-commerce gate explicitly checks `RAILWAY_ENVIRONMENT_NAME==='staging'`.

**Effect:** A future experimentation or sandbox flag in the same environment could expose test behavior on the real public domain, and staging vs production separation is difficult to audit.

**Proposed correction:** Create/verify a dedicated production environment with controlled release promotion; isolate disposable test data and payment sandbox from live domains, preserve email DNS and current migration history. Do not move or duplicate production PostgreSQL without a verified backup/cutover plan.

## Working as designed or evidence-backed

- API/Web/Postgres service health and terminal CP44 deployment status are good at the audit read time.
- Admin APIs require verified Supabase Auth roles; catalog/warehouse/ledger tests cover representative protected writes.
- CP40 private-draft, CP41 checkout draft, CP42 voucher, CP43 campaign, CP44 analytics unit/integration/browser fixtures passed.
- Variant `enabled` flags, SKU/price/stock per variation and linkage to their parent categories are explicitly present in product-family save code.
- Local/fixture browser test at 390px reports no horizontal overflow on analytics.
- Existing archive media references: all 19 linked, 0 marked missing by live API startup.
- The payment gateway and courier booking are intentionally disabled and should stay disabled until separate authorized integration work.
- CSV export is admin-only, uses an export-size cap, excludes customer contact PII, preserves UTF-8 BOM, and quotes spreadsheet formula prefixes.

## Validation gaps and limitations

This audit did **not** perform a real authenticated admin/customer session on the production domain, a payment transaction, a production DB write, a production Supabase invitation/login, a real warehouse dispatch, or an end-user-browser network smoke on apex/www. External URL tool access did not establish HTTP reachability, even though Railway reports the services online. The counts above are from the Railway API startup log, not a fresh intrusive SQL scan.

The CI fixtures are passing but do not cover 100+ promotions, real customer concurrency, administrative entry-path divergence, payment-provider reconciliation or the 999-vs-99 cart limit. Findings F05/F06/F11 are source-traced design/edge-case risks, not claims that an actual live customer transaction failed.

## Recommended controlled hardening sequence

1. **CP45-A (data integrity):** fix admin pending/status counters, clarify verified-payment semantics, single-snapshot analytics and reconciliation completeness, shared quantity limits; add focused regression tests.
2. **CP45-B (catalog usability):** consolidate editors, migrate legacy archive references into auditable private product drafts, and reconcile SKU/category/media/warehouse completeness without auto-publishing.
3. **CP45-C (platform readiness):** resolve apex DNS with authoritative checks; separate production/staging environments with backups and a safe release process; keep payments disabled.
4. **CP45-D (launch polish):** refine noindex/SEO release policy, public notices, support links, and promo selection pagination. Require real-browser smoke and QA for both domain variants before public acceptance.

**Readiness recommendation:** **Needs revision for complete live ecommerce.** The deployed CP44 engine is healthy and many fixture paths pass, but “all functions production ready” is not supported by the inspected code, QA, or current Railway evidence.

**Review mode:** audit report only; no deployed fixes or production system modifications.
