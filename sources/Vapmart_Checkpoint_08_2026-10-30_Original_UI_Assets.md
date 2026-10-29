# Vapmart Checkpoint 08: Original WordPress UI & Assets

**Date:** 2026-10-30 (Asia/Jakarta)  
**Repository:** https://github.com/9dbit/Vapmart  
**Staging branch:** `feat/ecommerce-foundation-20261029`  
**Open PR:** https://github.com/9dbit/Vapmart/pull/1 (draft)  
**Latest application commit:** `0c2d0ebd4568832e66e35782235619c76f695150`  
**Railway project:** `7c01e4d8-6152-4f04-9750-6e7031aa0830`  
**Staging environment:** `04586a07-99b0-4cfd-95fa-bb6d8f1719e3`  
**Web preview:** https://vapmart-web-staging.up.railway.app/  
**Asset review:** https://vapmart-web-staging.up.railway.app/asset-review

## User goal

Patch the existing `9dbit/Vapmart` repository directly and deploy to Railway staging, using assets and CSS from the user's actual Hostinger WordPress `public_html` backup to align the storefront as closely as practical with its original appearance. Do not change the original WordPress production site.

## Authentic source examined

- Authoritative local archive: `SPARK.local:/Users/macuser/Downloads/public_html.zip`, about 3.83 GB.
- Home layout reconstructed against an archived 2026-03-16 HTML snapshot of `https://vapmart.co.id/`.
- Elementor CSS recovered from `wp-content/uploads/elementor/css/post-5148.css` (global kit), `post-28475.css` (homepage), `post-34787.css` (header), and `post-35034.css` (footer).
- Elementor brand palette: `#8B5CF6`, `#A855F7`, `#6B46C1`, dark `#121212`, `#1A1A1A`, and `#2D2D2D`; Poppins type.
- Original image carousel settings from archived Elementor HTML: 3 slides, 1 visible, autoplay 2000 ms, animation 500 ms, navigation arrows, infinite, pause on hover/interaction.
- Elementor's original *mobile* carousel uses `1-1024x448.png`, `2-7-1024x448.png`, and `1600-x-700-1024x448.png`; the *desktop* carousel uses `1-1-1024x320.png`, `2-8-1024x320.png`, and `1600-x-500-1024x320.png`.

## Assets copied from backup and committed to GitHub

Exactly **32 original public image files** (3,222,813 bytes total) imported into `apps/web/public/legacy/`:

| Group | Count | Description |
| --- | ---: | --- |
| Desktop banners | 3 | Original WordPress desktop hero slides |
| Mobile banners | 3 | Original WordPress mobile hero slides |
| Benefits / CTA banner | 1 | Original support/COD benefit strip |
| Category illustrations | 5 | Original WordPress category artwork |
| Brand logos | 12 | Original WordPress partner logo images |
| Product photo references | 8 | Archived product photographs, not attached to SKU or prices |
| **Total** | **32** | Source files imported as binary Git blobs |

Original horizontal Vapmart logo had already been migrated in Checkpoint 07.

For each of these 32 assets, the path in the WordPress ZIP, exact byte length, and SHA-256 are recorded in `docs/legacy-assets-manifest.json`. No WordPress PHP application files, database passwords, ZIP, or other secrets were added to the public repository.

## Frontend patch contents

- `apps/web/src/components/hero-carousel.tsx`: new React carousel, authentic desktop/mobile image sets, 2-second autoplay, 500-ms sliding transition, navigation arrows, hover pause, touch swipe, reduced-motion support.
- `apps/web/src/app/page.tsx`: original hero and mobile CTA, original five category illustrations and names, original 12-logo brand section, retained staging catalog.
- `apps/web/src/app/parity.css`: image strip/grid geometry and higher-specificity palette fixes, dark header for white logo, readable card colors, mobile bottom spacing.
- `apps/web/src/app/layout.tsx`: imports parity CSS after existing stylesheet sources.
- `apps/web/src/app/asset-review/page.tsx`: noindex visual-review page for three original desktop banners and eight original product photographs, with no buying controls.
- `scripts/ui-smoke.mjs`: tests for original banner images, correct desktop/mobile selection, brand count, category count, working cart/search/detail, horizontal overflow, and WCAG-style text/background contrast checks.
- `docs/legacy-assets-manifest.json`: provenance inventory and SHA-256 data for all imported assets.

## Commit history for this checkpoint

1. `d6d800d2856b92be25744bf8e8fbb8235e08c4b3` — WordPress original banners, brand imagery, asset manifest and image review.
2. `0c2d0ebd4568832e66e35782235619c76f695150` — fix CSS contrast for white-on-white header and cards, add browser contrast regression test.

## Verified deploy and QA

- Railway staging **vapmart-web** deployment `1be9d8c3-f034-4762-8648-8894eb688feb`: **SUCCESS**, at commit `0c2d0eb...`.
- Existing vapmart-api and Railway Postgres: online, unchanged by UI-only commits.
- GitHub Actions final commit: Foundation checks SUCCESS; dependency security audit SUCCESS; staging smoke SUCCESS; Browser UI smoke SUCCESS (run `40928388420`, attempt 2).
- The initial browser runs happened before Railway had finished deploying, so they saw previous CSS/markup and failed; the same UI check passed after deployment.
- Actual Chromium screenshots captured by RDC at 1440×900 and 390×844.
- New image carousel: all 3 slides present, desktop loads `desktop-01.png` (1024 px natural width), mobile loads `mobile-01.png` (1024 px natural width).
- 12 partner logos and 5 category images present on both form factors.
- No horizontal overflow at 390 px in the browser UI smoke test.
- Header computed background is `rgb(18, 18, 18)` and logo visible after the CSS correction.
- Staging `/asset-review` returns HTTP 200 and shows 3 banners + 8 archived product thumbnails.

## Important limits, not yet complete

- **Not pixel-perfect across all pages**: brand/banner/header/logo assets are original, but Elementor spacing and each WooCommerce template still need side-by-side QA with the original site.
- The homepage product grid still shows four DEMO products. The eight archived product images are safely in the source tree and asset review, **not assigned to unrelated demo SKU, price, or stock**. The WordPress ZIP does not contain an exportable WooCommerce SQL dump. Accurate product migration needs WooCommerce API or database export.
- Original category labels and images are a visual parity reference, not a verified mapping onto new non-nicotine product taxonomy.
- Payment, checkout and production domain cutover remain disabled. `POST /v1/orders` intentionally responds with 503.
- No migration or deployment to the GitHub `main` branch; PR #1 remains draft while commerce/data/auth gates are incomplete.
- The production WordPress website remains untouched.

## Next engineering tasks

1. Match Elementor header/footer/mobile responsive spacing against a live authenticated WordPress screenshot; remove remaining legacy CSS overrides when confirmed.
2. Obtain WooCommerce product export to map image IDs, titles, SKU, categories and prices with provenance. Keep staged payment disabled until verified.
3. Replace unrelated DEMO catalog fixtures with verified replacement non-nicotine products, as directed by the store owner.
4. Finish Supabase Auth admin configuration and full role matrix.
5. Repeat build, security, browser/functional smoke, and save the next Markdown checkpoint under `sources/`.
