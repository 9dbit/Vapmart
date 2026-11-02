# Vapmart CP36-R3 | Existing products in Control Panel

Date: 2026-11-02 (Asia/Jakarta)
Parent: 5a96be5d45e8925dcbcb4fee0cfbe1528b12eb80
Repo: 9dbit/Vapmart
Branch: feat/ecommerce-foundation-20261029
Entry: https://vapmart.id/admin?tab=products

## Cause
The existing 19 source records were already preserved in PostgreSQL product.legacy_archive by migration 006. The Control Panel queried only product.products and therefore showed an empty list despite the retained source records. The private Media Library stored original_path as apps/web/public/... while catalog image_path starts with /legacy/..., so the internal linkage must use that exact prefix, not filename guessing.

## Fix
- One admin-only read-through product index combines operational product.products records and all retained existing source records, without creating a second physical copy.
- Produk & SKU shows both source types by default, with source/status/brand/category/search filters, pagination, details, thumbnails and a Sync Again action that re-reads PostgreSQL.
- Overview total includes existing records and explicitly separates them from operational SKUs and published products. A source read failure is shown as unavailable, never a fabricated zero.
- Exact path joins map each existing primary photo to content.media_library_assets. Thumbnails are fetched via the authenticated private content endpoint; bearer tokens are not placed in image URLs.
- Existing names, categories, brand names, slugs and historical price strings are preserved verbatim. Missing SKU, stock, variants, description and weight remain unverified/NULL. Price ranges are not flattened into invented current prices.
- Existing records are for internal review only. They have no publication/edit/checkout actions and are not inserted into sellable product.products. Existing operational product controls remain available for actual managed products.
- No extra archive navigation menu was introduced. The official Vapmart logo and current layout are unchanged.

## Coverage
The available retained snapshots contain 19 records from homepage-20260316 and pod-category-20260414, across five source brands. These do not prove a complete WooCommerce database export. This checkpoint does not claim to reconstruct omitted variants, purchase history, SKU codes, current prices or warehouse inventory. No source rows are overwritten and no brand partnership is inferred from a historic brand name.

## Safety
GET /v1/admin/product-records and Next GET /api/admin/product-records use existing Supabase AdminGuard and private/no-store responses. Parameterized filters, maximum page size 100, source-qualified stable record IDs and deterministic pagination. No new SQL migration or data mutation is required. No payment, courier, authorization, DNS, storefront or media-binary changes.

## Verification plan
- API unit tests: bounded query validation, read-only SQL and AdminGuard metadata.
- Disposable PostgreSQL integration: 19/19 source parity, 19/19 exact private photo joins, five brands, literal search, paging beyond old 150-product cap, no side effects on repeated sync, missing-photo reporting, and no source items in the public product endpoint.
- Browser QA on the current domain with intercepted fixture identity/data: 19 cards in Products & SKU, working search and brand filters, detail dialog, private thumbnails, read-only existing actions, failure/retry behavior and 390px mobile layout.
- Public live HTTP checks: both API and Next product-records endpoints reject anonymous or invalid tokens. No real admin credentials are used by automated UI tests.
- API startup emits VAPMART_EXISTING_PRODUCTS_SYNC with non-sensitive counts and media mapping totals to verify the real deployed database without changing it.
- Do not claim release complete until Railway Web/API terminal SUCCESS and QA pass are recorded below.
