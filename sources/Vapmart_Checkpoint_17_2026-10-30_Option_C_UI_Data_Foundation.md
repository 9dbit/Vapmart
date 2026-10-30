# Checkpoint 17 - UI/UX + Legacy Ecommerce Data Foundation

**Date:** 2026-10-30 (Asia/Jakarta)  
**Repo:** https://github.com/9dbit/Vapmart  
**Branch:** `feat/ecommerce-foundation-20261029` (PR #1 draft)  
**Frontend:** https://vapmart-web-staging.up.railway.app  
**Scope:** parallel track C (storefront UX implementation + read-only legacy source extraction and data-contract design).

## 1. High-level status

| Track | Item | State | Artifact / verification |
|---|---|---|---|
| UI | Homepage existing banner, 5 verified category icons, Trendora UI | Existing CP16 | `apps/web/src/app/page.tsx` |
| UI | Local preview wishlist + heart toggles | Implemented in code CP17 | `wishlist.tsx`, `favorite-button.tsx` |
| UI | Favorite-only catalog filter and empty state | Implemented in code CP17 | `product-grid.tsx` |
| UI | Product detail favorite toggle | Implemented in code CP17 | `product/[slug]/page.tsx` |
| UI | Catalog/detail route loading skeletons | Implemented in code CP17 | `catalog/loading.tsx`, `product/[slug]/loading.tsx` |
| UI | Visual polish without new overlay file | Implemented in code CP17 | appended `trendora.css` |
| UI | End-to-end wishlist regression | Added, must verify final workflow | `scripts/ui-smoke.mjs` |
| Data | Source ZIP inspectable | Verified on authorized SPARK.local | `public_html.zip`, read-only |
| Data | SHA-256 of 56 tracked UI assets | **55 exact**, **1 intentionally transformed** | `docs/legacy-source-capture-cp17.json` |
| Data | Native original hero source dimensions | **6 sources present** | capture JSON |
| Data | Original category thumbnails | **5 of 5 exact**, each 1080×1080 | capture JSON |
| Data | Unified source mapping for homepage | Implemented in code CP17 | `apps/web/src/lib/merchandising.ts` |
| Data | Proposed normalized PostgreSQL schema | Review-only, **not executed** | `docs/sql/cp17_merchandising_schema_REVIEW_ONLY.sql` |
| Data | Complete customer/order/options MySQL export | **Unavailable in public_html.zip** | requires authorized Hostinger MySQL export |

## 2. UI/UX Task List

### Completed in CP17
- [x] Single client-side wishlist provider, local to this browser, bounded to 100 saved IDs. It intentionally is not claimed to be account-synced.
- [x] Accessible heart buttons for demo catalog cards and demo detail; `aria-pressed` reflects save state.
- [x] Favorite-only filter combined with query/category/sort; visible count and reset.
- [x] Responsive 44px+ controls and warm pill style to match Trendora.
- [x] Skeleton layouts for Next.js catalog and product routes, including reduced-motion fallback.
- [x] Move repeated homepage categories, brand names and hero slides into provenance-indexed module.
- [x] Add browser regression covering filter, saved persistence and detail toggle.

### Next after QA
- [ ] Confirm Next.js build and E2E latest SHA; fix any CI regressions.
- [ ] Recheck 360/390/1024/1440 breakpoints including sticky navbar, drawer and typography.
- [ ] Reduce legacy CSS cascade only after full visual diff approval; avoid treating another overlay as consolidation.
- [ ] Replace large original hero assets with derivative responsive formats only after mobile/desktop LCP profiling.
- [ ] Add wishlist account sync only when identity and authorization are approved.

**UX acceptance criteria:** six demo views load with no JS errors, no overflow at 360/390, five original category icons unchanged; favorites persist on reload but never accept sensitive data; favoriting does not trigger checkout; order POST stays 503 and anonymous admin API stays 401.

## 3. Legacy source verification

Read-only extraction performed on `/Users/macuser/Downloads/public_html.zip` on authorized SPARK.local. ZIP members: 57,853. Reference manifest: `docs/legacy-assets-manifest.json`.

- 55 of 56 tracked source media exactly match SHA-256 and byte length.
- 1 original hero/gallery asset is documented as transformed/downsampled, so derivative SHA is intentionally not expected to match its WordPress source.
- Five original category thumbnails match the archived sources exactly, all at 1080×1080.
- Original desktop hero sources: 3200×1000, 3200×1000, 1600×500.
- Original mobile hero sources: 3200×1400, 3200×1400, 1600×700.
- 41 Elementor generated stylesheets; Astra source styles present; 30 installed plugin directories. Installed plugin presence **does not establish activation**.
- No full MySQL SQL dump found in ZIP. No `wp-config.php` contents, customer rows or credentials were read.

Source report: `docs/legacy-source-capture-cp17.json`. Keep public report source-only and PII-free.

## 4. Source-to-PostgreSQL contract

**Already in working staging:** `product.products`, `product.orders`, `product.order_items`, `public.staff_roles`; existing product.category is a single enum-like text field.

**Proposed additive schema in review-only SQL** (nothing applied):
- `product.categories`: normalized name/slug/parent ID, thumbnail, source key, sort order, archive/reference visibility.
- `product.brands`: normalized brand name/slug, logo, WordPress source ID if available.
- `product.product_category_links`: explicit many-to-many product taxonomies.
- `product.product_media`: ordered media, alt text, source SHA and external ID.
- `product.product_variants`: SKU, attributes JSON, optional price, stock and source variation ID.
- `storefront.hero_slides`: desktop/mobile images, order, CTA, reference-only disabled-by-default.
- `storefront.posts`: title, slug, excerpt, content, cover and source WordPress ID.

Category, brand and homepage hero entries in the **current UI** are curated static references, not operational database records. The draft SQL intentionally has `is_reference_only=true` and visibility/enabled flags false. No legacy orders or active products are inserted.

### WordPress schema that must be acquired from MySQL separately

| Legacy source tables | Downstream target or mapping |
|---|---|
| `*_terms`, `*_term_taxonomy`, `*_term_relationships`, `*_termmeta` | categories/brands, parent ID, ordering, assignments |
| `*_posts`, `*_postmeta` | media attachment IDs, posts/pages, product variation attributes, Elementor layout JSON |
| `*_options` | banner/site options and actual plugin activation (config review, values redacted) |
| `*_users`, `*_usermeta` | identity migration design ONLY, no public export |
| `*_woocommerce_order_items` and order item meta; Woo HPOS `*_wc_orders*` if enabled | private commerce/order history migration, after security review |
| plugin-defined tables discovered via read-only `information_schema` | feature-by-feature retention decision, **not assumption** |

### Quality / safety gates

1. **Provenance**: asset SHA, source path, reference ID and exact snapshot date required for every imported media record.
2. **Uniqueness**: slug unique within category/brand/post; variant SKU unique; source WP ID uniqueness conditional on actual presence.
3. **Completeness**: verify required fields, missing thumbnail rate, IDs, price type/units, full coverage of variation/media relations.
4. **Integrity**: no category orphan relationships; media must reference a known product; variant belongs to the parent product.
5. **Temporal**: snapshot freeze date and WordPress last-modified dates reconciled before import or cutover.
6. **Separation**: source media and safe public metadata may be committed; credentials, customer/order/payment data must remain encrypted and private.
7. **No premature activation**: SQL draft NOT wired to automatic migration script; no auth/checkout changes.

## 5. Dependency order

```text
WP ZIP media index & checksums [PASS] ──> Static merchandising source map [DONE]
                │                                      │
                └──> design asset QA ──> UI skeleton + wishlist [IMPLEMENTED]
                                                      │
                                           browser regression + Railway release
                                                      │
HOSTINGER AUTHORIZED MYSQL EXPORT [PENDING] ──> schema/table counts ──> data quality
                                                      │
                                        review-only PostgreSQL contract [DRAFT]
                                                      │
                                  migration approval + rollback + staging import
                                                      │
                                backend read API + account/order safety acceptance
```

## 6. Acceptance / release gates

- [ ] Latest frontend deployment reaches Railway terminal `SUCCESS`.
- [ ] Latest GitHub foundation, security, staging and browser UI workflows pass.
- [ ] On real Chromium verify favorites saved/reloaded/removed, filtering, cart, checkout, desktop/mobile overflow.
- [x] Legacy 56 tracked asset sources verified (55 exact, one known transformed original).
- [x] Original 3 desktop + 3 mobile hero candidates inventoried without changing images.
- [x] Database contract draft in repository, **not executed**.
- [ ] Authorized secure MySQL export obtained; table inventory, row counts and HPOS detection done.
- [ ] Schema migration explicitly reviewed and applied to staging with backup/rollback evidence, before any live data import.

## 7. Continuity notes

This checkpoint does not merge PR #1, touch WordPress production, export protected customer data, execute the schema draft, enable payments, or accept live orders. New frontend use of legacy assets stays read-only. Track any pending/latest QA result before declaring CP17 complete.
