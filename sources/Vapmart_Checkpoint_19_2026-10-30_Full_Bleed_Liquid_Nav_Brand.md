# Vapmart Checkpoint 19 - Full Bleed Hero, Liquid Glass Nav & Original Partner Logos

**Date:** 2026-10-30 (Asia/Jakarta)  
**Repository:** https://github.com/9dbit/Vapmart  
**Feature branch:** `feat/ecommerce-foundation-20261029`  
**Draft PR:** https://github.com/9dbit/Vapmart/pull/1  
**Staging:** https://vapmart-web-staging.up.railway.app/  
**Railway project:** `7c01e4d8-6152-4f04-9750-6e7031aa0830`  
**Railway environment:** `04586a07-99b0-4cfd-95fa-bb6d8f1719e3`  

## User intent

Implement immediately, no image preview: full-width edge-to-edge mobile hero banner without rounded frame, brand logos sourced from the real archived Vapmart WordPress assets, frosted/liquid-glass floating mobile navigation with a single solid purple sliding active pill, and consistent menu behavior throughout mobile/desktop.

## Implementation

- **Mobile hero**: final CSS rules in `apps/web/src/app/trendora.css` enforce zero margins, zero border radius, zero frame/border, viewport-width carousel on mobile (<=767px). Source imagery and carousel arrows/dots/play-pause remain unchanged. Desktop retains rounded framed 90%-width hero.
- **Original partner logos**: examined all 12 existing logo image files from `apps/web/public/legacy/brands/brand-01.png` to `brand-12.png`. A number are white wordmarks, previously displayed on white tiles. `apps/web/src/lib/merchandising.ts` now maps each verified brand name to the explicit original file, without substituting generated artwork.
- **Brand rails and directory**: `apps/web/src/components/brand-rail.tsx` provides a horizontally scrolling, snap-aligned branded rail with next/previous 44px controls. Homepage uses `BrandRail`. Brand Partner page uses the same source objects in a responsive labeled grid with links from homepage to anchored brand tiles. White original wordmarks are displayed against a dark inset, with legible names below each image. The eighth source asset's visual content remains the original file, with text label for clarity.
- **Liquid nav**: `apps/web/src/components/site-header.tsx` uses a real five-item mobile navigation with route-aware active index, including correct handling of detail/category/product/account routes. The Cart item navigates to `/keranjang-2`; header cart still opens an accessible drawer. `vm-liquid-active-pill` is one absolutely positioned indicator inside a blur+saturate translucent bar, animated via CSS `--vm-active-offset`. Reduced-motion disables transitions.
- **Menu behavior**: header popover search closes on outside press, Escape or route change; cart drawer closes on route change and locks document scrolling while open. Search, category and favorite filter states receive purple focus/hover styling; route/back navigation remains accessible. Active cart badge and current-page state are explicit.
- **Safety**: archived WordPress product pages remain read-only; checkout stays disabled and no modifications to order API, PostgreSQL or WordPress production. GitHub main unchanged; PR remains draft.
- **Release markers**: homepage `data-vapmart-ui="cp19"`; body `data-vapmart-theme="liquid-cp19"`.

## Regression acceptance gates

1. Mobile 360px and 390px: hero starts after header, occupies full viewport width, no radius or border, no horizontal overflow.
2. 390px: bottom nav has five links, glass background, one solid-purple animated indicator; home -> brand -> member -> cart -> catalog -> home route transitions correctly update active index.
3. Brand directory and homepage: 12 logo references from original `/legacy/brands/brand-XX.png`, white artwork legible on dark inset, no stretched logos.
4. Product/archived detail, catalog, member and cart navigation works; cart drawer maintains layering, modal Escape and checkout disabled.
5. Desktop 1440px: hero retains rounded desktop framing, brand logo rail scroll controls functional and no page overflow.
6. Reduced-motion setting: slide animation is disabled and decorative parallax remains disabled at reduced motion.
7. GitHub Foundation, Staging, Security, Browser UI smoke all SUCCESS on final revision.
8. Railway `vapmart-web` latest application deployment reaches terminal SUCCESS before reporting release complete.

## Deployment state

At initial checkpoint writing, final UI code was committed, and Railway builds and GitHub workflows were in progress. This note must be updated with terminal verification rather than assuming success.

## Next after this checkpoint

Consolidate legacy/modern CSS into stable component design tokens after visual acceptance; polish partner directory, full-width banner crop control for future responsive imagery, and measured LCP/CLS. This checkpoint does **not** require SPARK or historical customer/database import.

## Final staging evidence (2026-10-30)

- `vapmart-web` application deployment `b05bb581-1809-415a-9896-9730cd53e2e6` on code SHA `cbf6feea0c21eda96ac4677e6b47bb3457c10aaa` reached Railway terminal **SUCCESS**.
- Subsequent commits `0387532f...` (browser regression only) and initial checkpoint documentation were intentionally **SKIPPED** for Railway because they did not change application files.
- GitHub source/test commit `0387532f1561b1ae471dfc33b9ea3a70d8997653` checked:
  - Foundation checks: **SUCCESS** (both runs)
  - Dependency security audit: **SUCCESS**
  - Browser UI smoke: **SUCCESS** (job 123944800748)
  - Staging HTTP smoke: still in progress at first final QA read; report separately once terminal.
- Browser UI test includes 390px **zero-radius, zero-border, full-width** hero; 360px horizontal overflow; 12 original brand image sources; dark inset for white wordmarks; one blurred navigation glass plate; 5 route links and sliding active indicator; Home → Brand → Member → Keranjang → Katalog → Home; desktop hero, catalog, product detail, wallet-free cart simulation, reduced motion.
- Original WordPress production and GitHub `main` remain unchanged. Draft PR #1 remains open.
