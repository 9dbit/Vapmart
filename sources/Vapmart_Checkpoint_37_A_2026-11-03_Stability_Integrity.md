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
- Isolated candidate CI builds and tests before deployment. Live-domain smoke tests are post-release/manual checks, not pre-build gates that wait for deployment. Railway source will be pinned to an approved exact SHA after green verification, decoupling live deploys from development pushes.

## Additive migration 015
apps/api/sql/015_cp37a_integrity.sql adds edit_version to product.products and product.brands, plus private product.master_data_audit and an index. No existing products, brands, stock, historical sale ownership, customer balances, or payment statuses are changed. Supabase and inventory authorization code are unchanged.

## Pre-release evidence
Materialized source commit: 87052e7e1e11c3e2745add2bae6039d8b93d0078.
Isolated candidate run 41519245202: SUCCESS, including 51 API unit tests, additive migrations run twice, PostgreSQL integrity scenarios, CP35/CP36 regression integrations, four read/error tests, API and Web builds, public 390px desktop/mobile error/retry browser tests and an isolated mocked-admin editor test.
The PostgreSQL test checks 205 products and 205 orders, exact database KPI totals, single-winner concurrent edits, audit rollback on invalid publication, historical brand reassignment safety and private brand access boundaries.
The admin browser proves record 205 is selectable in the warehouse, expected_version is sent, and a 409 conflict does not erase unsaved text. All browser identities and data are intercepted fixtures, not real credentials. Test orders and products exist only in disposable localhost PostgreSQL.
Public assets and protected auth/warehouse/shipping/courier source were checked for unchanged hashes/diffs.

## Release method and rollback
1. Require a green preflight on the materialized tracked source.
2. Create release/vapmart-stable at the approved SHA.
3. Pin vapmart-api to that SHA, wait for migration 015 and terminal SUCCESS, then pin vapmart-web to the same SHA and wait for SUCCESS.
4. Run CP37A Post-release Verification and read-only live checks against vapmart.id. Check 401 on new private summary/audit APIs, pagination response metadata, official layout, and payment/booking flags OFF.
5. Keep development isolated from the pinned source. Do not apply the old unrelated staged Railway patch.
Rollback uses the pre-CP37-A app SHA; leave additive migration 015 in place. Do not restore or drop the database to revert frontend code.

## Explicitly not claimed
This is not payment/courier activation, a full WooCommerce import, MFA/operator-RBAC implementation, a database backup or restore drill, or partial-return/QC handling. The 19 existing records stay internal/read-only and 59 media originals remain intact. Actual administrator login/writes need a separately authorized operator acceptance test. Authentication fixtures do not prove that a real administrator completed a workflow.

## Final release status
Pending exact tracked-source rerun and Railway rollout. Update this section with deployed SHA, terminal service statuses, migration log and post-release test results only after observation.
