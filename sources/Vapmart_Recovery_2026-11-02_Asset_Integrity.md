# Vapmart Recovery: Asset Integrity and Preservation

Date: 2026-11-02 (Asia/Jakarta)
Status: FILE PRESERVATION VERIFIED; PUBLIC STOREFRONT NOT RESTORED
Scope: read-only asset backup, source reconciliation and regression evidence.

## Release boundaries
- Production/deployment branch remains `feat/ecommerce-foundation-20261029` at commit `4594fd4bad366ff0916da6b0e8e2bfa078b2a2ee` as observed at the start of this recovery.
- This separate review branch is `recovery/asset-integrity-20261102`.
- No changes to application code, database records, migrations, deployment configuration, Supabase, DNS, payments, member balances, warehouse stock, or courier integrations were made in this recovery.
- This is NOT a completed storefront restoration, product migration, or production deployment.

## Verified asset integrity
The existing `docs/legacy-assets-manifest.json` contains 56 media files. Every file was downloaded from the pinned repository revision and compared against both its expected byte size and SHA-256 digest. Every live media URL was checked against the same reference.

| Directory | Files | Repository integrity | Live integrity |
|---|---:|---|---|
| banners | 7 | 7/7 match | 7/7 match |
| categories | 12 | 12/12 match | 12/12 match |
| brands | 13 | 13/13 match | 13/13 match |
| products | 14 | 14/14 match | 14/14 match |
| news | 10 | 10/10 match | 10/10 match |
| Total | 56 | 56/56 match | 56/56 match |

The banners group includes 3 desktop images, 3 mobile images and 1 CTA image. The categories directory contains 5 category icons and 7 product photographs; it does NOT imply 12 storefront categories. The brands directory includes 12 primary brand images and one detail asset. The products directory includes 12 primary photographs and two detail/gallery assets.

An initial request for `products/archived-09.jpg` encountered a connection reset. A subsequent request returned HTTP 200, 38,319 bytes and SHA-256 `611a93b4a4865f68ce46a37e3949f047b160d2f663840a0d1a421c7af2f86411`, matching the reference. The original observation and retry are preserved separately, rather than hiding the initial network error.

The audit covers these 56 indexed assets only. It does not certify every WordPress upload or the completeness of the original site database.

## Preserved product references
- The unchanged migration `apps/api/sql/006_unified_catalog.sql` contains 19 historical reference rows.
- All 19 referenced image paths exist in the verified backup.
- Their source snapshots and `archive-catalog.ts`, `archived-reference.ts`, `merchandising.ts` and `hero-carousel.tsx` remain available.
- These are captured reference records, not a complete WooCommerce export. Prices, stock, variants, SKUs, category ownership and publication status are NOT reconstructed or inferred.
- The Railway database itself was NOT queried or modified in this recovery. This report does not assert a current database row count.

## Root cause confirmed by source comparison
Baseline before CP33: `73f4ec5a73c74baacecc967008e008050d41d18d`.
Current observed release: `4594fd4bad366ff0916da6b0e8e2bfa078b2a2ee`.

The earlier homepage imports `HeroCarousel` and `homepageCategoryTiles`; the current homepage does not. The current homepage substitutes a generic hero, five text-only categories and an empty published-catalog state. Its public product API returned `{ "items": [] }` during the audit. Therefore the observed screenshot is consistent with removed UI references and an empty public product response, not missing media bytes.

An empty public product response is not evidence that all products have been deleted from the database. It may reflect publication filtering and the earlier reference-source removal. No database deletion is claimed.

## Backup
A private preservation ZIP was written on the authorized SPARK device:

`Documents/Vapmart-Recovery/Vapmart_CP36_Asset_Backup_20261102_6t57eehc.zip`

- Size: 4,430,034 bytes.
- SHA-256: `c36ae85eeca6f159c84e4110fcd5fdababcd7d95cc326f8b8f78649b3bfb7613`.
- Contains all 56 original media files, the source manifest, current source snapshots, the pre-CP33 homepage source, first-pass observations, retry evidence and the local integrity-validation result.
- This is an asset/source backup, NOT a PostgreSQL or WooCommerce database backup.
- The ZIP is not published on the storefront or embedded in this repository.

## Read-only validator
Added `scripts/verify_preserved_assets.py`. It checks file bytes and hashes, path containment, duplicate manifest paths, preserved 19-row source records, their images and required source files. It performs no network calls or database changes and cannot publish content.

Run against a local checkout:

```bash
python3 scripts/verify_preserved_assets.py --root . --output asset-integrity.json
```

The validator was run against the recovered files. Result: exit code 0; 56 asset hashes matched; 19 reference rows and 19 image references present; no missing source files.

A passing result explicitly reports `storefront_restored=false` and `content_published=false`. Asset integrity MUST NOT be reported as visual or operational acceptance of the website.

## Current public safety switches
Read-only live checks observed:
- `/api/products`: HTTP 200, empty `items` array.
- `/api/shipping/config`: rate lookup OFF, booking OFF, payment OFF.
- `/api/checkout/config`: provider disconnected, payment OFF, draft-only orders.

No switch was changed.

## Unfinished work and publication boundary
The public homepage remains unchanged by this recovery. The original media inspected includes vape promotional material. Preservation and internal audit do not authorize republishing regulated-product advertising or activating sales. This branch does not restore such promotions, add purchase links, or populate active inventory.

The next permitted technical work is neutral layout repair and source-data reconciliation after an approved non-promotional public content specification. Do not substitute another generic design without the owner's approval. Do not roll back CP36 wholesale or remove its authentication, warehouse, fulfillment and courier safeguards.
