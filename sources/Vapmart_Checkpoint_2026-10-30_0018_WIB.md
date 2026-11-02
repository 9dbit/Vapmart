# VAPMART CHECKPOINT 06 - BRAND CSS FORENSICS

Date: 2026-10-30 00:18 WIB (approx). Project: Vapmart staging rebuild.
Repository: https://github.com/9dbit/Vapmart
Branch: feat/ecommerce-foundation-20261029
Change commit: 4db45efe39d520a5e9514d0b2b4a9401c757bb17

## User requirement
Visual parity to existing Vapmart website, including exact CSS, authentic logo, brand palette, banners, layout.

## Verified source and findings
- Live https://vapmart.co.id and www host: DNS unresolved (verified from connected SPARK machine and prior Chromium test). No reliable live screenshot.
- Wayback snapshot exists at https://web.archive.org/web/20260316150749id_/https://vapmart.co.id/ (16 March 2026). Archived HTML is 363190 bytes.
- WordPress Astra theme CSS main.min.css v4.12.4, Elementor v3.35.4, Elementor page CSS post-5148.css and header-footer Elementor; WooCommerce.
- Archived stylesheet referenced Poppins 400/500/600/700.
- Verified inline Astra tokens: --e-global-color-astglobalcolor0 #0067FF, color1 #005EE9, color2 #0F172A, color3 #364151, color4 #E7F6FF, color5 #FFFFFF, color6 #D1DAE5, color7 #070614, color8 #222222.
- The archived HTML referenced actual logo `/wp-content/uploads/2025/01/Logo-White-scaled.webp` and `Logo-White-scaled-120x26.webp`, plus `/2025/11/logo-v2-nobg.png`. These binary assets did not resolve from Wayback (CDX showed no captured records). NO verified original logo binary.
- Other old banner references: `/wp-content/uploads/2025/07/1-1024x448.png`, `2-7-1024x448.png`, `1600-x-700-1024x448.png`, and older 1024x320 slides; binary files not available. Legacy catalog/images depicted nicotine products and MUST NOT be reintroduced to replacement store.
- Archived Elementor page stylesheet post-5148.css is indexed in CDX September 2025 but requesting archived content returned HTTP 404. Therefore exact element-level CSS parity cannot yet be certified.

## Work performed
- Kept NextJS/NestJS/PostgreSQL staging stack and checkout disabled.
- Added recovered Astra primary/secondary/dark/subtle/border palette and Poppins font family to `apps/web/src/app/legacy.css`.
- Adjusted header, cards, promo tile, product category buttons, footer, and mobile nav to use actual archived color tokens.
- Added non-nicotine promotional banner scaffold in `apps/web/src/app/page.tsx` rather than old nicotine advertisement.
- Committed to GitHub branch `feat/ecommerce-foundation-20261029` at 4db45efe39d520a5e9514d0b2b4a9401c757bb17.
- Railway web deployment was BUILDING and GitHub workflow checks were QUEUED at last status read. Do not claim terminal SUCCESS without a new read.

## Important limitations
- Not pixel-perfect; authentic logo and banner binaries not recovered. Text brandmark remains temporary.
- Existing site may have changed since March 16, 2026; snapshot not guaranteed current.
- Must inspect WordPress Hostinger file-manager `wp-content/uploads/`, theme CSS, Elementor CSS page/template and screenshot with authorized Work browser access; exact logo/banner image exports can then be committed to `apps/web/public/legacy/`.
- Need test final load of new CSS and pixel-diff desktop and mobile.
- Do not activate payment, orders or real nicotine product data.

## Next checkpoint
1. Obtain authorized Hostinger file manager read access or original visual asset files; recover and verify hashes, dimensions and rights.
2. Port real layout CSS/font and banner/logo from originals; no speculative approximation.
3. Run Railway deploy, web/mobile browser QA, capture screenshot comparison.
4. Save next timestamped markdown in GitHub `sources/` and Library copy.
