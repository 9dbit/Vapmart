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

## Verified deployment results
Code commit: `aef321e69edae12635decd02c6ca67ad7e6c8887`.

- Local tested Git tree exactly matched the published Git tree `e6e06d3a93bea3b27b597672c4e71c26e0aaa374`.
- Local API build and 49 unit tests passed; Next.js production build passed.
- GitHub Foundation checks run `41347633669`: API build/tests, web production build and catalog audit PASS.
- GitHub Private Media Library Integration run `41347633773`: disposable PostgreSQL migration twice, all 59 byte-for-byte comparisons, private metadata editing audit, idempotent import, and no sellable product seeding PASS.
- Railway API deployment `e3a39da8-02d4-4d7f-81d2-868ed2b1ca1b` SUCCESS. Its pre-deploy log confirmed migration 014 applied and `mediaLibrary={verifiedOriginals:59,inserted:59,storedBytes:4534238,visibility:'internal'}` after COMMIT.
- Railway web deployment `df6cd8c9-3286-4565-836b-9206640902ed` SUCCESS; PostgreSQL remained SUCCESS.
- Live `https://vapmart.id/admin/media` returned HTTP 200.
- Anonymous requests to `/api/admin/media-library` and `/api/admin/media-library/:id/content` returned HTTP 401. The backend equivalents returned HTTP 401 as well.
- Live shipping config kept rate lookup, booking and payment false; checkout provider remained disconnected and draft-only.
- No real user password/token was collected or used. Interactive visual acceptance under the owner's logged-in admin account was not performed.

All 59 files are stored in the private library, not merely referenced by their public URLs. Existing public source files were not deleted or relocated; this release does not claim that earlier public URLs are now private. Only the new library's API and editor are administrator-restricted.
