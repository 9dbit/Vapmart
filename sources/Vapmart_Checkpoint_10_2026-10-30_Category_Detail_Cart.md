# Vapmart Checkpoint 10: Product Detail, Category, Member, Cart

**Date:** 2026-10-30 (Asia/Jakarta)  
**Project:** Vapmart | WordPress to Next.js + NestJS + PostgreSQL  
**Repository:** https://github.com/9dbit/Vapmart  
**Branch:** `feat/ecommerce-foundation-20261029`  
**PR:** https://github.com/9dbit/Vapmart/pull/1 (draft)  
**Railway staging project:** `7c01e4d8-6152-4f04-9750-6e7031aa0830`  
**Environment:** `04586a07-99b0-4cfd-95fa-bb6d8f1719e3`

## URLs
- Home: https://vapmart-web-staging.up.railway.app/
- Verified Pod category reference: https://vapmart-web-staging.up.railway.app/product-category/pod
- Original product-detail reference: https://vapmart-web-staging.up.railway.app/product/into-mission-replacement-pods
- Brand Partner: https://vapmart-web-staging.up.railway.app/brand-partner
- Cart: https://vapmart-web-staging.up.railway.app/keranjang-2
- Customer login preview: https://vapmart-web-staging.up.railway.app/login
- Member preview: https://vapmart-web-staging.up.railway.app/member-2
- Functional non-nicotine DEMO catalog: https://vapmart-web-staging.up.railway.app/catalog

## Accomplished
1. Accessed authorized user's SPARK.local backup `public_html.zip` using Remote Desktop Commander. Reconstructed actual HTML/CSS of original WordPress product detail (2026-03-16) and product category Pod (2026-04-14) with original static assets, using a loopback-only temporary reference server (not WordPress PHP or checkout execution).
2. Recovered original Elementor/WooCommerce card hrefs, 12 Pod category products, existing featured product slug, brand and category CSS classes. Used source data, **not inferred classifications from file names**.
3. Added `apps/web/src/lib/archive-catalog.ts` with verified slugs/category/brand fields; `archive-card.tsx` and `archive-gallery.tsx` for reference-only cards and image gallery.
4. Implemented `/product-category/[slug]`, styled to match category. Pod renders its original 12-card snapshot order; Mod/Cartridge/Liquid use only available verified subset and clearly note incomplete archive records. Archive cards link to matching historical slug in `/product/[slug]`.
5. Rebuilt `/product/[slug]` to show read-only historical product details for verified archive records, while keeping API-backed DEMO product detail and AddToCart functional without checkout. The archive detail has disabled purchase buttons, visual variants where explicitly verified, historical price label, partner info and links to related archive cards.
6. Added `/brand-partner` archive logo grid; updated homepage category links to historic category routes. Added `/login`, `/akun` alias, `/member-2` member preview, and actual client-side `/keranjang-2` with quantity change, delete and subtotal for DEMO items. Customer login inputs stay disabled until real Auth is configured.
7. Updated the site header with responsive subpage back link/title and original-style compact mobile header. Added `checkpoint10.css` with product/category/cart/login/member styles.
8. Added **nine** original source-backed static image assets (seven Pod category photos, primary gallery image derivative, and secondary gallery image) plus the actual `INTO` 100x100 partner logo, for **56 total** media files in `docs/legacy-assets-manifest.json`.
9. Corrected the second product gallery image after discovering duplicate filename `7-1` in older WordPress directories. Correct source is `wp-content/uploads/2025/06/7-1.png`; compressed 5000x5000 image to 600x600 and stored checksum/transform information. Correct INTO logo is `wp-content/uploads/2025/04/Brand-Partner-6-100x100.png`.
10. Enhanced `scripts/ui-smoke.mjs` to test category/detail/partner/login/member/cart, purchase-button disabled states, real original gallery and brand images, and WordPress geometry at desktop/mobile. Added a release-aware wait to prevent CI from testing the previous Railway deployment.

## Source and staging geometry

| Element | Original WordPress | Railway staging |
|---|---|---|
| Desktop Pod card (x,y,w,h), 1440px | (72,166,208,301) | (72,166,211,285) |
| Mobile Pod card (x,y,w,h), 390px | (0,103,191,276) | (0,104,192,272) |
| Desktop product-gallery x/y | (72,133) | (72,133) |
| Mobile product-gallery x/y | (0,57) | (0,57) |
| Mobile main image | 390 × 390px | 390 × 390px |
| Pod category cards | 12 | 12 |
| Archive purchase controls | N/A on original | Disabled on staging |

**Scope of parity:** first-card positions, first hero position, visual layout, original media, and responsive grids are verified. Differences remain in card height, desktop gallery container height, footer/content typography, and some details. This is **not** certified 1:1 pixel parity for the whole site.

## Build, deployment, CI
- Main UI patch: `4122f72c4ddf3588199fd6d5b3657ac957d126cb`.
- Correct gallery and INTO partner logo: `29f4d0f04d687380f993def438928d936374aa10`.
- Release-aware browser QA fix: `b6ef78eb86f3b74d4eb897467549a51fa79265c0` (CI only; Railway web SKIPPED because app files unchanged).
- Railway web application deployment: `20979abf-f797-4069-b0d3-b37e67f7f967` on code commit `29f4d0f...`, status **SUCCESS**.
- Railway `vapmart-api` and PostgreSQL status: **SUCCESS** (untouched).
- GitHub Actions on `b6ef78e...`: **Foundation checks SUCCESS**, **Staging smoke SUCCESS**, **Dependency security audit SUCCESS**, **Browser UI smoke SUCCESS**.
- Browser QA: reference product gallery main and second image load; INTO logo loads at naturalWidth 100; disabled archive purchase; robots `noindex,nofollow`; category Pod at x=72 y=166 desktop / x=0 y=104 mobile; product detail at y=133 desktop / y=57 mobile; account/cart no horizontal overflow at 390px.
- Asset integrity: **56/56** HEAD HTTP 200 and Content-Length matching manifest.

## Boundaries / risk gates
- Historical gallery image contains a nicotine warning on source packaging, kept solely for source-backed visual reference on noindex staging; not published as an active product for sale. New actual product catalog remains non-nicotine.
- Original WordPress archived login/cart pages could not be fetched (HTTP 429). Their staging designs use the verified Vapmart design system and remain previews, not an exact screenshot match.
- `public_html.zip` does not contain an exportable WooCommerce product SQL database. Complete SKU, category, stock, image and current price mapping must come from WooCommerce API or database export.
- Customer Supabase Auth is not configured for this new environment; no login credentials are accepted.
- Checkout/payment remains **disabled**, order API intentionally `503`, no order submission or stock reservation. Cart persists for demonstration in browser localStorage only and is not a trusted payment total.
- GitHub `main`, WordPress original production and production DNS have not been changed. PR #1 remains draft.

## Next checkpoint
1. Source current WooCommerce data via approved API/database export to map all SKU and media without guessing.
2. Finish customer login via dedicated Supabase Auth project and role separation admin/customer.
3. Audit responsive typography, footer, menu/cart behavior, and remaining category pages against a current WordPress visual reference when accessible.
4. Re-enable purchase/order flow only after stock, payment, security, customer auth, shipping and finance QA gates pass.
