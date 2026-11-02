# Vapmart Checkpoint 11: WooCommerce Feed Audit, SKU Migration, and Safe Catalog Import

**Completed:** 2026-10-30 (Asia/Jakarta)  
**Project:** Vapmart Rebuild, WordPress to Next.js + NestJS + Railway PostgreSQL + dedicated Supabase Auth  
**GitHub:** https://github.com/9dbit/Vapmart  
**Working branch:** `feat/ecommerce-foundation-20261029`  
**Draft PR:** https://github.com/9dbit/Vapmart/pull/1  
**Code commit:** `d95427a408745d2f908d4167e27f0f489e0c4631`  
**Staging:** https://vapmart-web-staging.up.railway.app/  
**Railway project:** `7c01e4d8-6152-4f04-9750-6e7031aa0830`, environment `04586a07-99b0-4cfd-95fa-bb6d8f1719e3`

## What changed

This checkpoint implements a **read-only audit** of the actual historic Facebook for WooCommerce CSV inside the authorized Hostinger WordPress ZIP backup; a strictly local, draft-only validator for future non-nicotine replacement products; an additive `sku` column and unique index in PostgreSQL; and SKU support in NestJS and the administrative Next.js product form.

No old WooCommerce products, variants, images, prices, inventory or orders have been imported into the active replacement catalog.

## Actual verified WooCommerce data

Archive on authorized SPARK.local device: `/Users/macuser/Downloads/public_html.zip`, approximately 3.828 GB, 57,853 members.

A single feed was discovered under `wp-content/uploads/facebook_for_woocommerce/product_catalog_*.csv`, ZIP entry date 2026-09-17. Its SHA-256 is `277beb9ef8c4375a6414bdf981482306e295cf44c3fb070de557870c21a301be`.

| Dimension | Verified |
|---|---:|
| Feed rows / distinct source IDs | 302 / 302 |
| Grouped source products | 87 |
| Unique titles | 87 |
| Brand values | 9 |
| Pod items | 235 |
| Cartridge items | 40 |
| e-Juice items | 16 |
| Semua Produk items | 11 |
| Availability `in stock` | 251 |
| Availability `out of stock` | 51 |
| Main image file paths matched in WordPress ZIP | **302 / 302** |
| Unique main-image URLs | 272 |
| Records with sale price | 262 |
| Records with quantity-to-sell field | **2** |
| Source feed SKU column | **Absent** |
| Populated GTIN | 0 |

These are archived third-party sync data, not a current, authoritative WooCommerce product export or an inventory count. `in stock` does not provide warehouse quantity. Products are linked to historic nicotine/vape-related categories and **must remain archive-only**. No raw 302-row feed has been committed to the public repository.

The actual script `python3 scripts/catalog_migration.py audit-wordpress --zip /Users/macuser/Downloads/public_html.zip --out /tmp/vapmart-cp11/aggregate-audit.json` executed successfully via Remote Desktop Commander on SPARK.local and independently reproduced **302 rows / 87 groups / 302 matched images** with the same source hash.

Aggregate-only report: `docs/legacy-commerce-feed-audit.json`.

## New code and templates

- `scripts/catalog_migration.py`: read-only `audit-wordpress` of ZIP + CSV; checks ID grouping, category/availability, source hash, and image paths. Also `prepare-replacement` for new non-nicotine SKU CSV. Zero DB writes and zero external network requests.
- `scripts/test_catalog_migration.py`: Python unittest coverage for valid draft, duplicate identifier, restricted goods, old-image reuse, publish gate, category validation, multiline CSV and source asset match.
- `templates/replacement-products.csv`: header-only template for future approved real products. No invented data.
- `docs/CATALOG_MIGRATION_GATES.md`: preparation, operator review, security boundary, and production release requirements.
- `apps/api/sql/002_catalog_sku.sql` and `migrations/002_catalog_sku.sql`: additive nullable SKU column, unique index, format check and restrictions on historical product identifiers.
- `apps/api/src/migrate.ts`: applies both migrations in order within advisory-locked transaction, records SHA-256 checksums, rejects migration drift and does not reseed existing demo rows.
- `apps/api/src/products.ts`: supports valid SKU (nullable for legacy DEMO rows) in validated inserts/patches and API SELECT responses.
- `apps/web/src/lib/types.ts` and `apps/web/src/app/admin/page.tsx`: SKU field in product model and admin editor, subject to existing Supabase admin guard.
- `.github/workflows/ci.yml`: added `catalog-audit` Python test job.

### Preparing future replacement catalog, with no publication

```sh
python3 scripts/catalog_migration.py prepare-replacement \
  --csv /path/to/operator-approved-non-nicotine-products.csv \
  --out /tmp/vapmart-draft-import.json
```

Mandatory columns: `sku,slug,name,description,category,price_idr,stock_qty,image_url,is_active`. Every generated draft sets `is_active=false`. The validator rejects old WordPress product image URLs, `/legacy/` images, restricted goods, duplicates, untrusted image URLs, active-publish flags, unsupported categories and malformed money/stock. Future rows must be approved, sourced, and validated by an authenticated admin before any import.

## Deployment evidence

**Railway staging**
- `vapmart-api` deployment `753c8b16-ebb0-4670-b330-09cdc8154c82`: **SUCCESS**.
- `vapmart-web` deployment `5441b450-be1f-45c0-abfc-e01ce58b9935`: **SUCCESS**.
- Railway Postgres instance: **SUCCESS**.
- API predeploy log: `VAPMART_DATABASE_READY {"migrations":["001_initial.sql","002_catalog_sku.sql"],"applied":["002_catalog_sku.sql"],"seeded_demo_products":0}`. This confirms the new SKU migration was applied; migration 001 remained intact.

**Live API after deployment**
- `GET /ready` returns HTTP 200, database ready.
- `GET /v1/products` returns the four existing non-nicotine DEMO products; each has `sku:null` (as intended until approved replacements are supplied).
- `GET /v1/admin/status` without bearer returns HTTP 401.
- `POST /v1/orders` returns HTTP 503, checkout disabled.
- Web `/api/health` returns HTTP 200.

**GitHub Actions for code commit d95427a**
- Foundation checks backend and frontend: **SUCCESS**.
- New `catalog-audit` Python job: **SUCCESS**.
- Dependency security audit: **SUCCESS**.
- Staging smoke: **SUCCESS**.
- Browser UI smoke: **SUCCESS**.

**Additional actual browser QA after web deployment**
- Desktop 1440px: header **72 px**, banner width **1296 px**, first reference card Y **1007 px**, 12 archive cards and 12 brand logos; zero horizontal overflow or page errors.
- Mobile 390px: header **64 px**, banner width **390 px**, first reference card Y **692 px**, 12 archive cards and 12 brand logos; zero horizontal overflow or page errors.
- Staging metadata: `noindex, nofollow`. Admin route HTTP 200.

## Explicit boundaries and next work

1. **No replacement goods were invented or published.** The owner has not provided verified non-nicotine product SKU, supplier, price, stock, and image catalog.
2. Facebook CSV lacks SKUs and numeric stock for 300/302 rows. It must never overwrite new stock or be imported into `product.products`.
3. This checkpoint did not scrape customer PII or copy orders. WooCommerce production MySQL/export remains unavailable through the local `public_html.zip`.
4. Supabase account inventory on the two linked organizations did not show a project named Vapmart. Do not reuse Tradevice/Pentagon/Agents Command Center authentication for Vapmart. A new dedicated Supabase Auth configuration and verified admin identity remain needed.
5. Payment integration, fulfillment, stock reservations, shipping rates and production cutover remain blocked. Checkout is disabled by design.
6. GitHub `main`, WordPress production, DNS and historical source backup remain unchanged. Draft PR #1 is not ready to merge.

**Next checkpoint:** collect the approved replacement catalog, verify supplier photos and SKU uniqueness, stage approved drafts behind a real Supabase admin identity, and only then independently test product publishing. Retain website visual parity and disabled checkout until the end-to-end commerce release gate passes.
