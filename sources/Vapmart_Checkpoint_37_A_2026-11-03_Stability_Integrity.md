# Vapmart CP37-A | Stability and Data Integrity

Date: 2026-11-03, Asia/Jakarta. Scope approved by owner: A01, A02, A04, A05, A08 from the post-CP36-R3 audit.
Repository: 9dbit/Vapmart. Candidate branch: work/cp37a-stability-20261103.
Baseline: 579610652a28f45160a9aa3c62b28d5daf73dbdf. Recovery branch: checkpoint/vapmart-pre-cp37a-20261103.

## Implemented
- API/source failure, timeout, malformed data and incomplete pagination no longer become a successful empty catalog. Product and brand sections show an explicit retry notice while original page structure and media remain unchanged. A genuine empty result stays a valid empty catalog. Product details return not-found only on real HTTP 404.
- Historical brand revenue and item reports read order_items.brand_id, product_name and sku snapshots, not the product's current brand/name. Reassigning a product cannot transfer its old sale attribution. Null historical snapshots are not guessed or backfilled.
- Public/admin product and admin order endpoints now return bounded server pagination with deterministic ordering and totals. Workspace/warehouse inputs follow all pages instead of silently stopping at 48/100/150 rows. Collection reads reject partial or changing results. The client has a documented 10,000-record safety ceiling, returning an explicit error rather than truncating; very large catalogs still need server-driven selectors in a later scalability phase.
- Dashboard KPI values come from SQL totals across the database, not the limited list rendered in the browser.
- Master product/brand creation and updates record actor, timestamp and before/after data transactionally. edit_version plus expected_version rejects stale edits with HTTP 409; the browser retains the operator's unsaved text. No history is fabricated for edits preceding this migration.
- Publication is server-validated against required SKU, current price, primary image, description, weight/dimensions, active brand and a verified dispatch warehouse record. New records remain draft with stock zero. Restricted-product guard is unchanged. Existing historical media records cannot be published by this change.
- Isolated candidate CI builds and tests before deployment. Live-domain smoke tests are post-release/manual checks, not pre-build gates that wait for deployment. Both Railway application services are now pinned to the approved exact SHA, decoupling live deploys from development pushes.

## Additive migration 015
apps/api/sql/015_cp37a_integrity.sql adds edit_version to product.products and product.brands, plus private product.master_data_audit and an index. No existing products, brands, stock, historical sale ownership, customer balances, or payment statuses are changed. Supabase and inventory authorization code are unchanged.

## Pre-release evidence
Materialized source commit: 87052e7e1e11c3e2745add2bae6039d8b93d0078.
Isolated candidate run 41519245202: SUCCESS, including 51 API unit tests, additive migrations run twice, PostgreSQL integrity scenarios, CP35/CP36 regression integrations, four read/error tests, API and Web builds, public 390px desktop/mobile error/retry browser tests and an isolated mocked-admin editor test.
The PostgreSQL test checks 205 products and 205 orders, exact database KPI totals, single-winner concurrent edits, audit rollback on invalid publication, historical brand reassignment safety and private brand access boundaries.
The admin browser proves record 205 is selectable in the warehouse, expected_version is sent, and a 409 conflict does not erase unsaved text. All browser identities and data are intercepted fixtures, not real credentials. Test orders and products exist only in disposable localhost PostgreSQL.
Public assets and protected auth/warehouse/shipping/courier source were checked for unchanged hashes/diffs.
Exact tracked release commit ca57e59ab6450ab45e11e4821574bfedee9369e3 subsequently passed pre-release run 41519789231, job 125532544384. This exact-SHA check was observed before the frontend release was initiated.

## Release method and rollback
1. Require a green preflight on the materialized tracked source.
2. Create release/vapmart-stable at the approved SHA.
3. Pin vapmart-api to that SHA, wait for migration 015 and terminal SUCCESS, then pin vapmart-web to the same SHA and wait for SUCCESS.
4. Run CP37A Post-release Verification and read-only live checks against vapmart.id. Check 401 on new private summary/audit APIs, pagination response metadata, official layout, and payment/booking flags OFF.
5. Keep development isolated from the pinned source. Do not apply the old unrelated staged Railway patch.
Rollback uses the pre-CP37-A app SHA; leave additive migration 015 in place. Do not restore or drop the database to revert frontend code. Do not use an unpinned branch head as the rollback target.

## Final release status: DEPLOYED AND AUTOMATED QA PASSED

Both application services use release/vapmart-stable and the same pinned application commit:
`ca57e59ab6450ab45e11e4821574bfedee9369e3`.
The release branch contains this documentation follow-up; the running applications remain pinned to the code commit above.

| Resource | Observed state | Deployment |
| --- | --- | --- |
| vapmart-web | SUCCESS / online | bc5cffda-4fac-48e1-8e8f-9d9127559677 |
| vapmart-api | SUCCESS / online | d04838c3-f64e-4829-ba32-06b7b968b02b |
| Postgres | SUCCESS / online | 19ee1b92-92d7-42c9-a7fc-6cb676bcfa21 |

The web deployment reached SUCCESS at 2026-11-03T04:33:56Z, equivalent to 11:33:56 WIB. The API had reached SUCCESS at 2026-11-03T02:33:35Z, equivalent to 09:33:35 WIB. Railway health read-back reported one running replica per service, zero crashed replicas, and no warnings, criticals or failed deployments in the checked eight-hour window. No unrelated pending Railway patch was applied.

API migration evidence from this release at 2026-11-03T02:32:58Z lists `015_cp37a_integrity.sql` in both the migration ledger and the applied set. The same log reports 59 verified media originals, zero newly inserted media assets, and internal media-library visibility. The API startup synchronization log reports 19 existing records, 19 linked primary photos, five historical source brands, zero missing primary photos, zero managed products and zero published products. Startup counts are not represented as a later authenticated operator session or a complete WooCommerce export.

### Post-release acceptance evidence
- Trigger record: `sources/cp37a-release.json` on work/cp37a-stability-20261103, commit c89eb40e5c5581554005c2ad5be7379c037656f4. This documentation-only marker does not alter the pinned live application source.
- CP37A Post-release Verification run **41580663172**, job **125734477624**: all verification steps completed with **success**.
- Repeat isolated pre-release verification run **41580663200**, job **125734478315**: completed with **success**, including API/Web builds, unit tests, disposable PostgreSQL integrity/concurrency and warehouse/courier regressions, pagination/error handling, local browser tests and protected-source checks.
- Read-only live report timestamp: **2026-11-03T04:53:27.525Z**, equivalent to **11:53:27 WIB**.

| Verification | Result and scope |
| --- | --- |
| Public API and web proxy pagination | HTTP 200 with page/pageSize/total/hasMore metadata; public total 0; page=0 rejected with HTTP 400 |
| Admin summary, audit log and product-record APIs | Both API and custom-domain routes reject anonymous access with HTTP 401 |
| Existing protected routes and unsigned callbacks | Existing HTTP smoke passed authorization-denial checks without authenticated production writes |
| Payment / courier / rate lookup | paymentEnabled=false, bookingEnabled=false, rateLookupEnabled=false; providerConnected=false in checkout smoke |
| Homepage and catalog | HTTP 200; restored structure retained; three hero banners, five category thumbnails and 19 distinct read-only reference gallery images verified |
| Admin entry | Canonical /admin renders login for anonymous users; /admin/login redirects to /admin; no anonymous admin navigation exposure |
| Mobile layout | Home, partner login and admin login passed at 390px with scrollWidth=390; theme test also passed at 360px with zero horizontal overflow |
| Theme and branding | Light/dark/system switching and persistence passed; transparent official logo variants preserved; membership-card aspect ratio about 1.586 retained |
| Admin workspace UI | Nine navigation areas and media entry passed with intercepted fixture identity; 390px drawer navigation passed |
| Existing records UI | 19 records and 19 decoded primary images; search, brand filter, detail dialog, failed-read/retry behavior and read-only controls passed with intercepted fixtures |

Authenticated administrator UI checks used synthetic browser sessions and intercepted data. The API-denial and public read checks contacted the real deployed services. No production administrator password or token was used; no authorized product, inventory, order, wallet, payment or courier mutation was submitted. No customer signup/login or real partner acceptance is claimed.

### Evidence artifact
- Name: `cp37a-live-verification`
- Artifact ID: `13205796045`
- ZIP bytes: `1342619`
- SHA-256: `d03dab483ea6b03634fe5d7ff87c51b66aa47f910c3142b13470dd7dd4c68cdf`
- Files: `cp37a-live/read-only-live-report.json`, `product-records/products-desktop.png`, `product-records/products-mobile.png`.
- The ZIP was downloaded and its digest verified. Desktop and mobile screenshot top sections were visually reviewed; the browser assertions cover all 19 image decodes. These admin screenshots show fixtures, not a real administrator's authenticated database view.
- Pre-release exact-SHA run: https://github.com/9dbit/Vapmart/actions/runs/41519789231
- Post-release run: https://github.com/9dbit/Vapmart/actions/runs/41580663172
- Repeat isolated verification: https://github.com/9dbit/Vapmart/actions/runs/41580663200
- QA artifact: https://github.com/9dbit/Vapmart/actions/runs/41580663172/artifacts/13205796045

## Operational readiness and remaining acceptance gates

Technical release synchronization and automated acceptance are complete. Public commerce activation and real-operator acceptance are not complete.

1. **Source data verification:** the available 19 records and five historic brand labels are retained references, not proof of a complete original WooCommerce export. No SKU, variant, current price, stock quantity, warehouse address or commercial partnership was invented. Full source reconciliation requires the original export/database and supporting operational records.
2. **Operational master data:** live public checks found zero active sale products and zero public operational brands. Historical reference gallery content is separate from sellable products. Verified SKU, current price, description, primary image, weight/dimensions, actual brand and real dispatch-warehouse readiness remain prerequisites for any permitted operational catalog. Existing references are not automatically published.
3. **Real-account UAT:** verify actual authorized admin login/logout, session expiry, partner ownership boundaries and audit/conflict behavior using approved test records and accounts. Prefer a disposable UAT environment for mutation scenarios; do not perform undocumented stock, financial or customer changes on the live database. The completed fixture tests are not a substitute for this gate.
4. **Recovery and access controls:** database backup/restore rehearsal, additional operator RBAC/MFA and partial-return/QC workflows remain outside this checkpoint. No backup or restoration success is claimed.
5. **Activation gate:** payment collection, courier booking and rate lookup remain OFF. No provider keys, DNS/email records or third-party bookings were changed. Any later activation requires a separately reviewed scope, provider validation and explicit owner approval.

## Continuation rules
Continue from the pinned application SHA and this final checkpoint, not the old foundation-branch frontend. Preserve the current official UI and assets. Keep feature development isolated, require passing checks before changing either live pin, and record the new deployment IDs and test scope after every release. Do not merge PR #1 or change main merely to finalize this documentation.
