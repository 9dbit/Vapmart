# Vapmart Checkpoint 31 | Frontend vs Control Panel Product Audit

Date: 2026-11-02

## Root cause
The current frontend renders legacy WordPress product references from `apps/web/src/lib/archive-catalog.ts` and `archived-reference.ts`; the admin list reads only `product.products` in Railway PostgreSQL. Thus four DEMO database products are visible in the admin while 19 historical frontend product references are not. The records are intentionally separate because archived products are not verified inventory.

## Implemented
- New **Katalog Arsip** section in Vapmart Control Panel displaying all 19 frontend product references, matching the public frontend's data source, with image, brand, category, historical price, archive status, and link to public reference page.
- Counter for historical frontend references, separate from database inventori.
- Search archive; responsive grid for desktop and mobile.
- No automatic import into saleable SKU inventory, no inferred quantities, no checkout enabled for archival items.
- The existing PostgreSQL products/brands/SKU editor remains unchanged for eligible inventory.

## Pending
- Confirm Next.js web build, Railway deployment, Safari/mobile QA.
- For new unrestricted products: import real product/SKU records and verified images into Railway PostgreSQL via the existing admin workflow, ensuring each product is published intentionally.
- The static legacy archive is not yet fully unified with editable database source; migration into a historical read-only DB table is a future option.
- Payment remains disabled; historical archive items remain not for sale.
