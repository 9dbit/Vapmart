# Vapmart Checkpoint 12 - Pill UI, Rounded Corners, Parallax

**Date:** 2026-10-30 (Asia/Jakarta)  
**Repository:** https://github.com/9dbit/Vapmart  
**Branch:** `feat/ecommerce-foundation-20261029`  
**Draft PR:** https://github.com/9dbit/Vapmart/pull/1  
**Frontend staging:** https://vapmart-web-staging.up.railway.app/  
**Railway project:** `7c01e4d8-6152-4f04-9750-6e7031aa0830`  
**Staging environment:** `04586a07-99b0-4cfd-95fa-bb6d8f1719e3`

## User request
Upgrade the rebuilt full-stack Vapmart ecommerce UI to a more user-friendly design with pill-shaped controls, rounded corners and parallax effects. Preserve original Vapmart brand identity, previous WordPress assets and checkout-disabled safety limits.

## Final changes

1. **Pill header and navigation** (`apps/web/src/components/site-header.tsx`): original Vapmart horizontal white logo, compact dark frosted header, active desktop navigation pills (Beranda, Katalog, Brand, Member), always-visible desktop search field, rounded purple account link, circular cart icon with count, and functional mobile search.
2. **Floating mobile nav**: five destinations in a frosted purple glass pill with clear labels, 55px click targets, active white selection, cart count and safe-area spacing. Available on homepage and subpages. Fixed a CSS cascade collision that initially enlarged text labels to 20px; corrected to 10px. Bottom padding prevents covering page content.
3. **Modern hero with authentic banners** (`apps/web/src/components/hero-carousel.tsx`): unchanged WordPress banner images, 28px rounded desktop frame, 21px mobile frame, softened shadow, circular arrows, interactive dot indicators, keyboard arrow support, touch swiping, explicit play/pause, and longer 5.5-second autoplay.
4. **Parallax ambient layer** (`apps/web/src/components/parallax-ambient.tsx`): decorative radial violet glow behind banner only. Passive scroll + resize listeners, requestAnimationFrame throttling, clamped GPU transforms (max 42px), no transforms on banner text/buttons. Automatically disabled for viewports <=767px, inactive document visibility and `prefers-reduced-motion: reduce`. CSS fallback added for browsers without arithmetic transforms.
5. **More breathable layout**: richer category tile hit areas, compact member/catalog CTA, rounded brand logo tiles, pill-shaped section CTAs, cleaner section labels and spacing. Cards receive soft elevation and hover feedback while preserving historic image order.
6. **Product and news cards**: 18-21px corners, visible `ARSIP` labels on read-only product references, higher-contrast descriptive text, consistent shadows and subtle hover lift. Historical prices remain historical, not active offers.
7. **Customer sections and storefront styles**: modern rounded category/detail galleries, variation chips, account/member preview, cart summary, modal controls, product search and filter pills; no customer credentials or payments accepted.
8. **Footer clarity**: replaced duplicate legacy headings with `Jelajahi` and `Informasi`; removed misleading inactive payment/order links and 24/7 support claim. Links route to real staging pages, not fictitious live features.
9. **Modal stacking fix**: increased cart drawer to z-index 120, above sticky header and mobile floating bar, gave close control 44x44 touch target, preserved Escape dismissal and restored reliable close action.
10. **Design tokens**: `apps/web/src/app/modern.css` and `modern-fixes.css`, appended last in layout. Colors based on Vapmart purple #8B5CF6 / #A855F7, near-black surfaces and lilac highlights; radius scale 14/20/28, action pills 999px. Existing Elementor and WordPress source CSS remain in repository for audit.

## GitHub commits
- `bff6b7c507b824db7e0eab83b6e30836074ff2e4`: new UI shell, parallax, hero carousel, mobile navigation, archive cards and stylesheet.
- `e8db03efca2359a40239c71545295329d1935e1a`: mobile label fix, drawer modal stacking, footer clarity.
- `b70ab61e3fb9b36e869ed9baf7d90dbb249bf691`: staging heading matcher and reduced-motion browser regression test.
- `7efae60d6390edb4daa8ca1a4bda79d5fb3c9605`: release-aware staging QA, requiring final footer text before running.

## Actual Railway deployment

**Frontend `vapmart-web`**: application deployment `f7177364-7a16-4c2c-ac5f-ae2159912d85` from `e8db03e...` **SUCCESS**. Next.js healthcheck succeeded. Subsequent test-only commits were SKIPPED by Railway change detection because no application files changed.

**Other services**: `vapmart-api` **SUCCESS**, Railway PostgreSQL **SUCCESS** (unchanged).

**GitHub workflow checks**: Foundation checks (web/API/catalog audit), dependency security audit, staging HTTP smoke and browser UI smoke **SUCCESS** on the test fix commit `b70ab61e...`; final test-only commit `7efae60...` also passed browser UI smoke, staging HTTP smoke, and security audit.

## Browser and visual QA (RDC, actual Chromium)

| Viewport / route | Result |
|---|---|
| Desktop 1440 x 900, homepage | HTTP 200, header 82px, hero radius 28px, product card radius 21px, 12 archive cards, no page error, no overflow |
| Tablet 1024 x 768, homepage | HTTP 200, responsive layout, no page error or horizontal overflow |
| Mobile 390 x 844, homepage | HTTP 200, header 66px, floating pill nav radius 999px, label 10px, 12 archive cards, no page error or overflow |
| Small mobile 360 x 780 | HTTP 200, floating nav works, no overflow |
| Mobile 390px, catalog | HTTP 200, accessible search/filter/cart controls, no overflow |
| Mobile 390px, archived product detail | HTTP 200, floating navigation visible, archive purchase controls disabled |
| Mobile 390px, cart | HTTP 200, no overflow; drawer shown above header with z-index 120 and can be dismissed by close button |
| Scroll parallax | Decorative CSS offset moved from 14.9px to 42.0px during desktop scroll |
| Reduced motion | Chromium media query `reduce` true, parallax display `none` |
| Footer | `Jelajahi` and `Informasi` headings present, inactive link descriptions removed |

Chromium screenshots were generated on the authorized RDC device in `/tmp/vapmart-cp12-*.jpg` for visual inspection, but not committed to public GitHub to avoid extra archived promotional artwork copies. All original design images and 56 verified asset manifest items are preserved.

## Behavior and safety gates

- **Original website / WordPress production untouched**. GitHub `main` untouched. The PR remains draft.
- **No WooCommerce plugins** deployed to Railway; Next.js, NestJS and PostgreSQL continue running independently.
- Archived WordPress products and banners are reference-only, display archived-price labels and no purchasing controls. Actual replacement non-nicotine inventory still requires approved supplier data.
- Supabase customer login is a disabled preview; anonymous admin access remains forbidden.
- Checkout is disabled at the UI and order API, which returns 503. No payments or fulfilled orders were created.
- Browser smoke checks cover cart add/close/quantity/remove, search, category navigation, image assets and mobile tap sizing.
- Using CSS overlay files remains a temporary refactor strategy; consolidate the legacy CSS cascade once more UI review is approved.

## Next checkpoint proposal

1. Final visual UX review at 390px mobile and large desktop, especially banner imagery suitability for the future replacement catalog.
2. Refine real user flows: search suggestions and empty state, SKU-backed product details, account onboarding and secure login after dedicated Supabase project is connected.
3. Add Web Vitals profiling (LCP, CLS and scroll performance) and validate against real devices before production.
4. Prepare approved non-nicotine product data and images via the draft-only catalog migration gate. Keep checkout off pending finance, inventory and order safety tests.
