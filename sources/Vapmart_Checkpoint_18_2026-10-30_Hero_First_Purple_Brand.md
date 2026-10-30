# Vapmart Checkpoint 18 - Hero First and Authentic Purple Branding

**Date:** 2026-10-30 Asia/Jakarta
**Repository:** https://github.com/9dbit/Vapmart
**Branch:** `feat/ecommerce-foundation-20261029` (draft PR #1)
**Staging:** https://vapmart-web-staging.up.railway.app/

## User-required change

Delete the *entire* red-sketched home intro including `VAPMART / DISCOVER`, `Find your next favorite.`, subtitle, home search box, and intro CTA. Keep the real Vapmart hero carousel as the first homepage section immediately under the site header. Replace the header and footer branding with the user's supplied 2026 Vapmart purple icon/dark wordmark image. Replace peach accents with authentic vivid Vapmart purple while retaining the airy Trendora card geometry, original banners, original category icons, and safe disabled checkout.

## Implementation

1. `apps/web/src/app/page.tsx`: deleted `vm-home-intro` JSX entirely. The `vm-hero-stage` is the first descendant of the homepage main. Retained hero carousel, original category rail, archive reference cards and remaining homepage layout.
2. `apps/web/public/branding/vapmart-logo.png`: transparent PNG asset derived directly from the supplied original logo screenshot, cropped and optimized with aspect ratio preserved. This is not a redesigned/reimagined logo, and the original PNG in the conversation is not modified. Optimized Git blob SHA `fc3a6b07325476d9a2bfbc7d666feb1138d69add`.
3. `apps/web/src/components/site-header.tsx`: use `/branding/vapmart-logo.png` rather than the original white-only logo asset.
4. `apps/web/src/app/layout.tsx`: both footer logo instances switched to supplied logo; theme release marker `purple-cp18`.
5. `apps/web/src/app/trendora.css`: replacing peach styling with purple for navigation pills, button backgrounds, active states, carousel dots, catalog filters, wishlist, badges, account/checkout preview and footer icon surfaces. Preserved white/off-white cards and dark text. Added logo sizing and explicitly disabled darkening filters for the supplied logo.
6. `scripts/ui-smoke.mjs`: regression updated to expect deleted intro, release marker and new logo. Mobile search now verified through existing header search disclosure rather than the removed introductory search.
7. No changes to NestJS API, PostgreSQL, original WordPress production, user records, checkout enablement, or GitHub main.

## QA gates

- Inspect latest Railway frontend deployment for `c27ed0fd75ab0b6fa53c306587199b173d4565e4` (or a newer frontend build).
- Confirm GitHub foundation, security, staging HTTP and browser UI smoke green.
- Visual test: 390px mobile, 1440px desktop, original hero immediately beneath header and five category icons remain visible, no horizontally overflowing cards or navbar.
- Confirm `/branding/vapmart-logo.png` loads successfully at HTTP 200 and appears unfiltered at correct ratio on header and footer.
- Check order API remains 503 and account preview remains disabled.

**Important:** when this note was first created, Railway deployment status was still being monitored; do not claim success until terminal status is independently observed.

## Scope boundaries

Staging only. Draft PR #1 remains unmerged. Source WordPress production untouched. No accounts, payments or orders created.
