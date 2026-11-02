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
- Filter controls have explicit accessible names, and the list supports keyboard-operated details and error/retry states.

## Coverage
The available retained snapshots contain 19 records from homepage-20260316 and pod-category-20260414, across five source brands. These do not prove a complete WooCommerce database export. This checkpoint does not claim to reconstruct omitted variants, purchase history, SKU codes, current prices or warehouse inventory. No source rows are overwritten and no brand partnership is inferred from a historic brand name.

## Safety
GET /v1/admin/product-records and Next GET /api/admin/product-records use existing Supabase AdminGuard and private/no-store responses. Parameterized filters, maximum page size 100, source-qualified stable record IDs and deterministic pagination. No new SQL migration or product data mutation is required. No payment, courier, authorization, DNS, storefront or media-binary changes.

## Verification method
- API unit tests: bounded query validation, read-only SQL and AdminGuard metadata.
- Disposable PostgreSQL integration: 19/19 source parity, 19/19 exact private photo joins, five brands, literal search, paging beyond old 150-product cap, no side effects on repeated sync, missing-photo reporting, and no source items in the public product endpoint.
- Browser QA on the current domain with intercepted fixture identity/data: 19 cards in Products & SKU, working search and brand filters, detail dialog, private thumbnails, read-only existing actions, failure/retry behavior and 390px mobile layout.
- Public live HTTP checks: both API and Next product-records endpoints reject anonymous or invalid tokens. No real admin credentials are used by automated UI tests.
- API startup emits VAPMART_EXISTING_PRODUCTS_SYNC with non-sensitive counts and media mapping totals to verify the real deployed database without changing it.

## Verified release result
- Core implementation commit: 15ac6739d56a37ea44da3cb1f8d1a1a42c4fa224. Accessible-filter follow-up: 9774cb1e046736b3b45ea99b940ff9b965bca91d.
- Railway vapmart-api deployment 479db82a-8148-403c-afc4-fe2d3d754eb8: terminal SUCCESS observed.
- Railway vapmart-web deployment 7101cc7e-7b3b-49f8-966b-112bbf366ddb: terminal SUCCESS observed. PostgreSQL remains SUCCESS.
- Actual Railway database verification at 2026-11-02T04:48:41Z logged: total 19, existing 19, managed 0, published 0, existing_brands 5, existing_media_linked 19, existing_media_missing 0. This is an actual live database read, not a browser fixture result.
- Tested repository SHA 3720a724ee40450b97ba9af75ff46bd7c7e92bbc has 11 successful GitHub Actions runs. Changes after the accessible-filter application commit are browser-test refinements only; application deployments do not need to rerun for those changes.
- Existing product synchronization QA run 41391481382, job 125103642030: SUCCESS. Disposable PostgreSQL assertions and browser UI assertions both passed.
- The browser verified 19 decoded private primary images, existing-source read-only controls, name search, brand filtering, detail dialog, simulated API failure/retry and fresh 390px mobile layout without horizontal overflow. Anonymous/invalid-token requests were denied by the live endpoints.
- Final artifact: admin-product-records-qa, ID 13117257279, digest sha256:d0c830bb244255908ad3c21cb2e88d60685bcf82ea0a160794b6efaa5da0b3ff. Desktop and mobile screenshots were downloaded and visually reviewed. Prior screenshot scroll/resize-transition artifacts were corrected in test capture, not by redesigning the application.
- No production administrator password was used, and no real product, stock, brand, order or payment data was changed during QA. Authenticated UI tests used intercepted fixtures; the live database count and linkage validation were verified separately through the deployed API service log.

## Operational result and limits
Open /admin, then Produk & SKU. The combined list now shows all 19 retained existing product records with their primary photos, brand/category labels and preserved historical prices. Use search/filter or Lihat data to inspect each record. Sinkronkan ulang re-reads the same database sources and cannot create duplicate products.

Existing records remain internal/read-only. SKU and stock are not fabricated, historical prices are not current sale prices, and no existing item is automatically made purchasable. Completing a full original WooCommerce migration still requires the original database/export to verify products and variations not represented in these 19 retained records.

The storefront, official logo, 59-image private Media Library, CP35 inventory and CP36 fulfillment remain unchanged. Payment collection and actual courier booking remain OFF. This final checkpoint update changes documentation only.
