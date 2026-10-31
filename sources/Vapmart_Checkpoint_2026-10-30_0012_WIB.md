# VAPMART - Checkpoint 05: UI Parity Investigation

Snapshot: 30 October 2026, approximately 00:12 WIB (Asia/Jakarta).
Scope: Restore original Vapmart WordPress marketplace information architecture on a Next.js staging frontend. No legacy nicotine inventory is imported.

## Why the original UI differed
The first Next.js storefront was a completely new editorial design rather than a recreation of the old WordPress Astra/Elementor storefront. It introduced a dark 3D sphere hero, lime accent, different header, different menu and no legacy category/promo/member/points/brand/news structure. Backend migration was completed before sufficient legacy visual auditing. This is not 1:1 visual parity.

## Reference and audit sources
- Existing public website: https://vapmart.co.id/
- Previously identified Hostinger WordPress files: Astra, Elementor / Elementor Pro, WooCommerce and related plugins in public_html.
- Public website content showed home sections: Kategori Produk, Promo, Member, 0 Points, Brand Partner, Produk Pilihan, News, footer support/menu.
- An automated Playwright screenshot attempt for the WordPress host returned ERR_NAME_NOT_RESOLVED. The web crawl is cached; actual live CSS, banners, logo image and fonts remain unverified.
- A follow-up attempt against www.vapmart.co.id is recorded in GitHub Actions visual reference capture; inspect its results before making exact-parity claims.

## Implemented, staging only
- Replaced generic editorial hero/abstract shapes with a marketplace section hierarchy matching the legacy site.
- Added header with cart/login indicators and a responsive five-destination mobile nav.
- Reintroduced category tiles, Promo, Member, Points, Brand Partner, Produk Pilihan, News and footer sections.
- Kept new non-nicotine categories: Home, Lifestyle, Decor, Accessories, Electronics; original nicotine-related categories are not ported.
- Kept synthetic DEMO-only catalog with cart/search/product detail and server checkout HTTP 503. Brand partner logos and editorial posts show honest placeholder states.
- Added /akun as a closed customer-account placeholder; admin Auth still requires a dedicated Supabase project and admin role grant.
- Built category tile navigation using Next.js searchParams so clicking a tile filters actual catalog; added browser regression assertions.
- Source branch: https://github.com/9dbit/Vapmart/tree/feat/ecommerce-foundation-20261029
- Draft PR: https://github.com/9dbit/Vapmart/pull/1
- Structural UI commit: f13895cd3ac6fbbfcd3bd47185e93a4af491ce55
- Category filter and QA commit: 55b5e560abd9dae0ffb3348317fd9f291beb5184
- Updated staging smoke test: 9b56b71de010d45badf824fa2d33f59ed5a0efe5
- Visual reference capture fallback: 723ed2692aa9e8439d0eff1684ad2a1b27d50f36

## Verified results
- GitHub Actions Foundation checks, production dependency audit, staging API smoke test and Chromium desktop/mobile UI smoke: SUCCESS for the UI foundation and updated assertions.
- Browser UI test reported legacySections=true, categoryNavigation=true, horizontal overflow 390/390 (none).
- Latest Railway web deployment of the filtering UI reported SUCCESS; API and Postgres previous live deployments remain SUCCESS.
- A separate reference-capture workflow cannot yet verify the original WordPress pixels because of DNS resolution failure from the automated browser.

## Not finished - IMPORTANT
1. This is STRUCTURAL parity, NOT pixel-perfect parity. Colors, spacing, logo, icon art, category imagery, banners, WordPress header/footer breakpoints and other assets are still approximations.
2. Do not present invented logos, brands, images or offers as real. Existing nicotine-related imagery and catalog content must not be migrated into the replacement store.
3. Get Hostinger read-only file access in Work mode, or obtain original desktop/mobile screenshots plus Elementor site kit export and wp-content/uploads assets, then measure and reproduce original styles.
4. Compare both sites at desktop 1440 px and mobile 390 px, inspect header/home/category/product/cart/account screens, and adjust CSS/assets until approved.
5. No production DNS/cutover changes. Supabase Auth not configured; checkout/payments remain disabled.

## URLs
- Original: https://vapmart.co.id/
- Staging: https://vapmart-web-staging.up.railway.app/
- Admin staging: https://vapmart-web-staging.up.railway.app/admin
- GitHub PR: https://github.com/9dbit/Vapmart/pull/1

Next checkpoint: original Elementor CSS/logo/banner collection and pixel-difference review. Commit the checkpoint markdown to GitHub sources/ and back up the same file in Library /Vapmart/sources/. This does not attach a file to ChatGPT Project Sources.