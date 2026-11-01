# Vapmart Private Media Library

Scope: internal storage and asset review only. No public promotion, storefront replacement, payment or catalog publication.

## Stored assets
All 59 raster files under the pinned `apps/web/public` source are bundled with the API and copied byte-for-byte into `content.media_library_assets` in PostgreSQL. The original 56-file source manifest validates byte size and SHA-256; three additional site-logo files are retained. Total original bytes: 4,534,238.

Kinds: 7 banners, 5 category icons, 13 brand images, 21 product/detail photos, 10 article images, 3 Vapmart site logos. Directory names do not imply SKU/category counts.

No original static file is deleted, modified or silently published. Original source bytes remain unchanged in Git. These are media records, not verified inventory, active SKU records or a full WooCommerce database restoration.

## Access
- `/admin/media`: a dedicated Media & Aset page within Vapmart Control Panel.
- Existing `/admin` now has a shared navigation link without rewriting the Control Panel page.
- Categories, filename/source search, paginated thumbnails, larger private preview, original download, title/notes and audit trail.
- `GET /v1/admin/media-library`, `GET /v1/admin/media-library/:id/content`, `PATCH /v1/admin/media-library/:id` all use AdminGuard.
- The Next.js binary proxy forwards administrator bearer authorization; tokens are never put in image URLs. Browser previews use revocable object URLs. All responses are no-store and non-sniffable.
- Media visibility is constrained to `internal`; metadata edits cannot change content, publication, SKU or storefront visibility.

## Release
Additive migration 014 creates a private content schema. The existing pre-deploy migration transaction imports files once and rejects checksum drift. Existing titles/notes are preserved on repeat deployment.

API build bundles original resources within the API root, independent of the web service and remote PCs. The running service reads PostgreSQL; SPARK is not required for runtime access.

Frontend homepage, banners, categories, pricing and public catalog are not changed by this release. CP36 admin, authentication, brand scope, inventory, warehouse, courier and payment safeguards remain in place.

## QA gates
Local API build, unit tests and Next.js production build; disposable PostgreSQL integration with twice-applied migration, 59 byte comparisons, title/notes audit, no publication endpoint and no product seeding; anonymous live API rejection; confirm Railway deployment and importer counts before claiming stored/live completion.

## Limit
This restores internal asset access, not the previous public storefront. The source contains vape marketing; it is retained privately for preservation and review and is not republished. No nicotine-content claim is inferred from device photos.
