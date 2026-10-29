# Vapmart Catalog Migration Gate (Checkpoint 11)

## Verified source
A read-only scan of the authorized Hostinger `public_html.zip` found one Facebook for WooCommerce catalog CSV in `wp-content/uploads/facebook_for_woocommerce/`. File timestamp: **2026-09-17**. It contains **302 distinct item IDs** grouped into **87 products**, and **302/302 product main-image URLs match files inside the archive**. There are 251 rows labelled `in stock` and 51 `out of stock`, but only **2 rows contain numeric stock quantities**. SKU and GTIN values are missing.

This is an archived commerce feed, **not current WooCommerce inventory**, and its old vape/nicotine merchandise is **not authorized for the active non-nicotine replacement catalog**. The public repository contains only aggregate findings, not raw product rows or private customer records.

## Workflow
Run read-only ZIP audit (source remains local to the operator):

```sh
python3 scripts/catalog_migration.py audit-wordpress --zip /path/to/private/public_html.zip --out /tmp/vapmart-archive-audit.json
```

Prepare new non-nicotine replacement products from verified real suppliers:

```sh
python3 scripts/catalog_migration.py prepare-replacement --csv /path/to/approved-replacements.csv --out /tmp/vapmart-draft-import.json
python3 -m unittest discover -s scripts -p 'test_catalog_migration.py'
```

Use `templates/replacement-products.csv` as the exact schema. Required: unique upper-case SKU, unique URL slug, product name, description, one of the six non-nicotine categories, integer IDR price and verified integer stock. Images must use approved fresh HTTPS assets, not archival `/legacy/` or WordPress uploads.

The preparation script is strictly offline, makes **zero database writes**, rejects restricted product descriptions, invalid prices, duplicate identifiers, untrusted images, and `is_active=true`. It emits draft JSON where each `is_active` is false.

## Postgres and API integration
- Railway PostgreSQL remains a separate database; Supabase Auth is used only for authenticated identities and the admin guard.
- The additive migration `002_catalog_sku.sql` creates nullable `product.products.sku`, a unique partial SKU index, an identifier safety check, and preserves existing four DEMO products as `sku=NULL`.
- The migration operator runs `001_initial.sql` and `002_catalog_sku.sql` in order with checksum tracking under `vapmart_meta.migrations`. Checksum drift is an error, not silently overwritten.
- The API validates SKU on create/update and returns SKU in product JSON. New admin products still begin as drafts.
- Importing drafts requires a real configured **Supabase admin identity**, a reviewed inventory/photo manifest, and operator-controlled create calls. Do **not** run bulk inserts against production or set publication flags based on the historical feed.
- Customer login, stock reservation, shipping, checkout and payments remain gated; `POST /v1/orders` stays disabled.

## Acceptance gates for activation
1. Receive an independently approved non-nicotine replacement catalog, including real SKU, price, inventory and images.
2. Confirm database migration 002 applied on Railway staging, `GET /ready` succeeds and the admin guard denies anonymous writes.
3. Import validated drafts only, compare submitted SKU count and media to the supplier-approved file, check no duplicate products and no unsafe images.
4. Manually publish the correct items only after QA, preserving user-approved catalog and storefront parity.
5. Production DNS, WooCommerce retirement, payment webhook, shipping and order acceptance require separate explicit release gate. **No production cutover in this checkpoint.**
