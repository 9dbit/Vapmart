# Vapmart Checkpoint 24 - Transparent Dark-Mode Header & Footer Logo

**Date:** 2026-10-30 (Asia/Jakarta)  
**Repository:** https://github.com/9dbit/Vapmart  
**Branch:** `feat/ecommerce-foundation-20261029`  
**Draft PR:** https://github.com/9dbit/Vapmart/pull/1  
**Frontend staging:** https://vapmart-web-staging.up.railway.app/  
**Railway project:** `7c01e4d8-6152-4f04-9750-6e7031aa0830`  
**Staging environment:** `04586a07-99b0-4cfd-95fa-bb6d8f1719e3`

## User request

Immediately upgrade the real Vapmart ecommerce engine so that **only in Dark mode** the Vapmart logos in both the header and footer have a **light-grey wordmark and fully transparent background**. Preserve the original purple icon and the normal Light mode logo. Do not change membership card styling or transactional systems.

## Implementation

1. **New branding asset:** `apps/web/public/branding/vapmart-logo-dark.png`.
   - Derived **exactly** from the existing `apps/web/public/branding/vapmart-logo.png` (400×79 pixels, indexed PNG).
   - Recolored only three original dark-wordmark palette entries (indices 1, 5, 6) from `#2A2F36` / `#292E35` to `#D1D1D6`.
   - Preserved all purple square/icon colors, white symbol, original anti-alias alpha values, `tRNS` transparency, PNG dimensions and other pixel data.
   - Recomputed PNG palette CRC and validated all chunk CRCs. This is a genuine transparent image file, **not** a white plate, CSS approximation, text font replacement or altered branding geometry.

2. **Reusable component:** `apps/web/src/components/brand-logo.tsx`.
   - Renders both lightweight original and dark logo images in the same 400:79 aspect-ratio wrapper.
   - Uses CSS root `data-vapmart-color-mode` attribute to select correct image **before React hydration**; works for explicit Light, Dark and System modes, without a flash of white or transient miscolored logo.
   - Accessible `role="img"` with `aria-label="Vapmart"`, both redundant images decorative; preserves official wordmark.

3. **Header:** `apps/web/src/components/site-header.tsx`.
   - Replaces the inline logo image with `<BrandLogo variant="header"/>` inside the original homepage Link.
   - Fixed header/logo position, existing search/theme/cart controls and Back row remain unchanged.

4. **Footer:** `apps/web/src/app/layout.tsx`.
   - Replaces both the main footer brand image and the smaller Powered by brand image with the corresponding `BrandLogo` variants.
   - Imports `cp24-logo.css` last after prior CP23 styles to override the old white-logo-plate treatment in Dark mode.
   - Does not change the Member Card logo inside the existing solid purple ISO card; only header/footer logos requested here.

5. **Styling:** `apps/web/src/app/cp24-logo.css`.
   - Dark-mode header logo background explicitly `transparent`, `padding:0`, no box-shadow or border.
   - Both footer logos have transparent wrappers/images with no white plates; retain 188px and 115px original footer dimensions.
   - Header logo keeps the same responsive slot; both image variants use identical 400:79 ratio to avoid shifts.
   - Light mode original PNG is untouched.
   
6. **Browser validation:** `scripts/theme-smoke.mjs` extended to inspect logo variants, PNG actual pixel colors through same-origin canvas, purple icon retention, transparent alpha, removal of white plates, exact aspect ratio, footer instances, reload/system switching and desktop/mobile layout.

## Safety and scope

- **Frontend-only staging change:** No API, database schema, wallet, authentication or checkout changes. Physical checkout remains disabled (503); no money or Coin movement.
- GitHub `main` and WordPress production untouched. PR #1 remains **draft**.
- User browser themes keep their CP23 local preference. Logo display automatically changes at first paint.

## Acceptance tests

- [x] All three positions (header, footer and Powered by) use the original dark logo without white background on Dark mode.
- [x] Wordmark pixel color `#D1D1D6`, purple icon and alpha transparency verified against actual raster.
- [x] Light mode retains original PNG and dark-OS System mode switches correctly.
- [x] 360px and 390px mobile, 1440px desktop have no logo shift or horizontal overflow.
- [x] Foundation, security, HTTP staging, Browser UI smoke, Theme mode browser and Coin Ledger checks pass.
- [x] Railway `vapmart-web` deployment is terminal **SUCCESS**.

## Release verification

### Staging deployment (verified)
- Frontend `vapmart-web` deployed application commit: `7db050e41d9158df2853b3a82fbeab516b14465f`.
- Railway deployment `3f22b676-43e3-4d30-9fdc-6b059432cfb5`: terminal **SUCCESS**.
- Checkpoint documentation and test-only commits after the application commit were **SKIPPED** by Railway change detection, as expected. The deployed app includes the dark PNG, shared BrandLogo component, header/footer wiring and final CSS cascade fix.
- Existing `vapmart-api` and Postgres staging services unchanged. WordPress production and GitHub `main` untouched.

### CI (verified)
- Source/test commit `4e3467055f2e23c7e29feae04cf37f76a7f50a8d`: **7/7 GitHub workflow runs SUCCESS**.
- Theme browser QA verified Light, Dark, System, reload persistence, exact 3 logo instances in header/footer, **no overlapping logo variants**, real PNG transparent background, original purple icon, and CSS logo plates removed.
- Exact raster audit: 7,485/7,485 sampled dark wordmark pixels were light-grey; 4,320 sampled icon pixels kept original purple. Member Card ISO ratio `1.5858717` preserved.
- Zero horizontal overflow at 360px and 390px. 1440px desktop logo/brand check passed.
- Existing catalog, search, cart, member, API safety, wallet ledger, dependency audit, foundation and staging smoke checks all **SUCCESS**.
- A temporary older application build failed when it referenced the new CSS before the file was committed; this was superseded by the successful final application deploy. A transient browser test failure on obsolete two-image selectors was corrected and is green on final source/test SHA.

**CP24 closeout:** dark-mode header/footer logo upgrade completed and verified on staging. Do not merge draft PR #1 or enable production checkout without separate authorization.

