# Vapmart: Checkpoint 09 - WordPress Layout Parity

**Date:** 2026-10-30 (Asia/Jakarta)  
**Repository:** https://github.com/9dbit/Vapmart  
**Branch:** `feat/ecommerce-foundation-20261029`  
**Pull request:** https://github.com/9dbit/Vapmart/pull/1 (draft)  
**Final application commit:** `fdc35d583f0163c4240f3a9bed9213427d65447c`  
**Railway staging:** https://vapmart-web-staging.up.railway.app/  
**Separate DEMO catalog:** https://vapmart-web-staging.up.railway.app/catalog  
**Asset review:** https://vapmart-web-staging.up.railway.app/asset-review

## Goal
Continue Vapmart WordPress-to-full-stack migration by matching original Elementor homepage layout, including actual photo grids, news thumbnails, dark compact header, original banner and brand strip, and responsive mobile composition. Preserve the current NestJS API, PostgreSQL staging, Supabase Auth integration boundary, and disabled checkout.

## Reference reconstruction via RDC
- Authenticated Remote Desktop Commander session on SPARK.local.
- WordPress source archive `/Users/macuser/Downloads/public_html.zip` contains the original theme, Elementor CSS and media.
- An archived public homepage snapshot from 2026-03-16 was rendered against static CSS/assets from the ZIP via a **loopback-only** Python file server on SPARK. No WordPress PHP or administrator code was executed.
- Rendered original at 1440 x 900 desktop and 390 x 844 mobile viewport sizes.
- Baseline measurements saved in `docs/wordpress-visual-baseline-20260316.json`. The current live WordPress domain was not accessible at an earlier audit; this reference is historical, not a certification of its latest state.

## Source-backed image parity
- Previous Checkpoint 08 moved 32 original media assets.
- This checkpoint added **14 additional original files**: 4 archive product thumbnails and 10 WordPress news thumbnails.
- Total image provenance inventory: **46 files**; every entry has original WordPress upload path, byte count, and SHA-256 in `docs/legacy-assets-manifest.json`.
- RDC compared HEAD responses and Content-Length for every migrated asset on Railway staging: **46/46 PASS**.
- The homepage displays 12 archived image cards and 10 archive article thumbnails in the original order, alongside the original 12 partner logos.
- Archived product names/prices are explicitly displayed as *historical visual reference only*. There are no purchase buttons, active SKU/stock mappings, or checkout for these reference cards.
- Four non-nicotine DEMO products were retained for functional QA at `/catalog`, not misassigned to unrelated archived photographs.

## UI changes
- `apps/web/src/app/page.tsx`: rebuilt WordPress-like homepage sections with original single category/promo panel, horizontally scrolling logo row, 12-card feature grid and 10-card news grid.
- `apps/web/src/lib/archived-reference.ts`: exact historical image-to-title references (not active commerce data).
- `apps/web/src/components/site-header.tsx`: compact original-size logo header, functional expandable catalog search, cart drawer and account link; 5-item floating mobile navigation.
- `apps/web/src/app/layout.tsx`: Elementor-inspired footer columns, social icons, Member Support visual, and small Vapmart powered-by mark.
- `apps/web/src/app/catalog/page.tsx`: separate actual DEMO catalog with search, category filtering, item details and local cart.
- `apps/web/src/app/reference.css`: responsive positioning/style overrides against a measured WordPress baseline.
- `apps/web/src/app/asset-review/page.tsx`: original banner, 12 product photos and 10 article thumbnails, noindex.
- `scripts/ui-smoke.mjs`: waits for the exact latest UI marker before running, exercises homepage geometry, archive purchase isolation, demo cart, search, detail, category filter, and mobile overflow.
- `docs/legacy-assets-manifest.json`: 46 mapped media files.

## Geometry validation

| Element | Original desktop (1440px) | Final staging desktop | Original mobile (390px) | Final staging mobile |
|---|---|---|---|---|
| Header height | 72px | **72px** | 64px | **64px** |
| Hero x,y | (72,86) | **(72,86)** | (0,64) | **(0,64)** |
| Hero width,height | 1296 x 405 | **1296 x 405** | 390 x 171 | **390 x 171** |
| First product card y | 1007 | **1007** | 692 | **692** |
| Reference product count | 12 | **12** | 12 | **12** |
| Article count | 10 | **10** | 10 | **10** |

The coordinates above were measured with actual Chromium renders from RDC, not estimated from stylesheet declarations. **Matching these measurements does not establish pixel-perfect parity of every component.** Original product-card dimensions and footer height still have some differences.

## Build, deployment and security gate
- Core homepage/image patch commit: `85052732433279120e70a52ba2830caace726fc4`.
- Final layout correction commit: `fdc35d583f0163c4240f3a9bed9213427d65447c`.
- Railway web deployment `bb99344f-d4ce-4724-b2b2-e945f925d668`: **SUCCESS**, matching final app commit.
- API and PostgreSQL staging unchanged and remain **SUCCESS**.
- GitHub Actions, final app commit: **Foundation checks SUCCESS**, **Staging smoke SUCCESS**, **Dependency security audit SUCCESS**, **Browser UI smoke SUCCESS**. Browser run: https://github.com/9dbit/Vapmart/actions/runs/40931538634
- Staging REST order endpoint `POST /v1/orders` remains disabled (`503`). No payment setup, production DNS cutover, or WordPress production changes made.
- Admin actions remain behind Supabase Auth + staff role verification. Real admin access still requires dedicated Supabase project settings.

## Known boundaries
1. Product card references and article content come from the older snapshot; they are not authoritative current WooCommerce inventory, pricing, permissions or order data.
2. Real WooCommerce product migration requires approved database export or API access. The existing `public_html.zip` does not contain a standard WooCommerce SQL export.
3. Real customer auth, inventory reservations, shipping, payment webhooks/refunds and checkout acceptance remain blocked by deployment gates.
4. The live frontend is staged on the feature branch, not merged to `main`; PR #1 remains draft.
5. UI has a measured visual parity baseline but is not certified identical across every template or screen size.

## Next checkpoint
- Obtain a verified WooCommerce product/SKU/media export, then map each product to the new PostgreSQL `product` schema without guessing descriptions or stock.
- Replace four DEMO products only after the replacement catalog is approved.
- Configure dedicated Supabase Auth and validate the real admin RBAC matrix.
- Rebuild product details/category/archive/cart and account views against real original styles and test at several additional viewport sizes.
- Continue to keep checkout off until secure payments and stock consistency are verified.

