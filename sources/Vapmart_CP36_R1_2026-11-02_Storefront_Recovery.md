# Vapmart CP36-R1 | Storefront parity restoration

**Date:** 2026-11-02 (Asia/Jakarta)
**Repo:** https://github.com/9dbit/Vapmart
**Branch:** `feat/ecommerce-foundation-20261029`

## Incident / root cause
The CP33 homepage rewrite replaced the prior CP22/CP32 `vm-trendora-home` structure with a generic `vm-commerce-home` hero (large “v”), five text-only cards and a conditional blank collection message. The original static assets did not disappear; they remained in the Git source and were also copied to the PostgreSQL **private** Media Library. However, front-end references to the original carousel, category photos, historic gallery, brand-image rail and editorial preview were severed.

## Exact recovery reference
`f0e80331003b` (pre-CP33 layout) preserves these visual sections in order:
1. Real responsive `HeroCarousel` with original 3 desktop + 3 mobile asset sources, swipe/dots/keyboard controls and reduced-motion guard.
2. Five original thumbnail categories in the responsive grid.
3. Featured product area, separated from the verified live PostgreSQL inventory.
4. Member panel.
5. Brand image rail.
6. News image grid.
7. Header/navigation and footer inherited from CP22/23/24 layout and CSS.

## What changed
- `apps/web/src/app/page.tsx`: reassembles the old homepage structure and CSS hooks. Removes generic gradient “v” hero. Preserves accurate asset dimensions and mobile layout.
- `apps/web/src/components/reference-visual-grid.tsx`: historical images displayed as read-only visual references without price, product links, add-to-cart or payment actions.
- `apps/web/src/app/catalog/page.tsx`: brings back the reference gallery in a dedicated section with read-only category selection, while keeping live products sourced only from authenticated PostgreSQL-backed published records.
- `apps/web/src/app/brand-partner/page.tsx`: shows original brand logo graphics as historic references if no verified active brands have been entered; distinguishes them from real active partners.
- `apps/web/src/app/restored-home.css`: narrowly scopes archive presentation, brand/logo rail spacing and desktop/mobile/dark-mode finishing without changing Admin CP, Supabase Auth or checkout styles.
- `scripts/smoke-staging.mjs` and `scripts/ui-smoke.mjs`: add regression assertions for three carousel slides, five category images, historical read-only gallery, brand imagery, editorial grid, absent sample commerce records, security and mobile overflow.
- Original media binaries in `apps/web/public` are **unchanged**. The authenticated 59-file PostgreSQL Media Library is retained.

## Noncommercial archive versus active product truth
Original source references are display-only. Historic visual images and product names in WordPress snapshots **do not prove active SKUs, stock, current prices, origin, or payment eligibility**. No archived record is silently imported to `product.products` and there is no archived purchase endpoint. `/api/products` remains the only public active catalog source. Images and original banners are identified as historical media, not orderable offers.

Product SKUs must be deliberately approved for any future publication through Control Panel, with correct product type, stock and current metadata. Keep restricted/age-gated categories outside an unauthenticated commerce funnel.

## Unchanged
- PostgreSQL schema and warehouse quantity balances.
- Supabase session, admin/brand login and RBAC.
- CP35 multiwarehouse fulfillment and CP36 courier/RMA.
- Member account engine and mobile navigation.
- Payment, courier booking, rate lookup and automated refunds OFF.

## Verification checklist
1. GitHub API + Next.js Foundation checks PASS.
2. Playwright desktop 1440x900 shows carousel, category images, products reference block, brand rail, news, menu and footer.
3. Playwright 390x844 shows no horizontal overflow; carousel uses mobile source images.
4. `/catalog` shows active PostgreSQL products only when published, plus read-only nontransactional asset references.
5. `/brand-partner` displays original historic logos separately from approved active brands.
6. Root and category links work; no archive product card links to checkout.
7. Railway `vapmart-web` is terminal SUCCESS and / returns 200.
8. /api/shipping/config confirms payment/bookings OFF.
9. No unrelated backend, DNS, email or credential changes.

## Next product-data step
Audit and reconcile individual existing product records against a verified non-restricted product catalog supplied by owner. Create approved SKUs and product-media associations through Control Panel, not from historical archive prices or inferred stock.

**Do not rollback the whole repository**: only the storefront was structurally regressed.
