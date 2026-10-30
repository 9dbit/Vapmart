# Vapmart Checkpoint 23 - Light / Dark / System Mode

**Date:** 2026-10-30 (Asia/Jakarta)  
**Repository:** https://github.com/9dbit/Vapmart  
**Branch:** `feat/ecommerce-foundation-20261029`  
**PR:** https://github.com/9dbit/Vapmart/pull/1 (draft)  
**Staging:** https://vapmart-web-staging.up.railway.app/  
**Railway project:** `7c01e4d8-6152-4f04-9750-6e7031aa0830`  
**Environment:** `04586a07-99b0-4cfd-95fa-bb6d8f1719e3`

## Request

Add an explicit dark mode option for the full Vapmart ecommerce experience without replacing the light design, original logo/WordPress assets, compact floating nav, product/Member UI or staging commerce safety policies.

## Implemented

- **Light:** current warm light theme remains the default for users who have not selected a mode.
- **Dark:** near-black `#0e0e12`, graphite `#19191e`, clear text `#f5f0f9` and Vapmart purple accents; no navy or visually distracting gradients.
- **Ikuti Sistem:** resolves theme from `prefers-color-scheme` and listens for real-time device changes.
- **Theme UI:** accessible 43px/40px icon selector next to search and cart in all headers, with real Light/Dark/Ikuti Sistem menu, selected checkmark, 52px touch items, outside click / Escape dismissal and keyboard focus support.
- **Persistent:** `localStorage['vapmart.color-mode.v1']`; cross-tab `storage` synchronization.
- **No flash:** an inline, static, non-user-generated script sets the root `data-vapmart-color-mode` before hydration, and the React provider adopts it after mount. `theme-color` meta reflects the current resolved theme for mobile browser chrome.
- **Brand:** original `/branding/vapmart-logo.png` remains unchanged and unfiltered. Dark header and footer use simple solid white plates to keep the dark wordmark readable.
- **Member Card:** retains the CP22 ISO ID-1 1.586:1 shape, original purple/charcoal artwork, real authenticated balance fields, and 3 functional shortcut tiles. Dark mode changes the surrounding Member Hub, 6 Coin pack cards, campaign cards and transaction history, not the card proportions or ledger.
- **Catalog:** categories, archived cards, brand logos, archive thumbnails, news, filters, search suggestions, favorites and product details have dark surfaces and accessible text contrasts, with original WordPress imagery unmodified.
- **Shopping/account:** cart page, open drawer, quantities, empty state, login/signup/forgot-password forms, disabled checkout status and staging messaging remain functional in both themes.
- **Mobile:** dark floating frosted bar preserves CP19 solid-purple liquid active pill with adapted dark glass backdrop, no extra navigation item or displaced logo; reduced-motion remains supported.

## Files

| File | Purpose |
|---|---|
| `apps/web/src/lib/theme.tsx` | Persistent React theme provider, system change listener and storage sync |
| `apps/web/src/components/theme-switcher.tsx` | Accessible three-mode selector |
| `apps/web/src/components/site-header.tsx` | Theme entry in header desktop/mobile |
| `apps/web/src/app/layout.tsx` | Provider wrapper, CSS imports, no-flash initializer, theme-color metadata and CP23 marker |
| `apps/web/src/app/cp23.css` | Theme controls, tokens, dark header/home/catalog |
| `apps/web/src/app/cp23-details.css` | Dark detail gallery, brand directory and readable descriptions |
| `apps/web/src/app/cp23-member.css` | Dark member sections, wallet/coin packs, promo and history |
| `apps/web/src/app/cp23-commerce.css` | Dark auth, cart page and cart drawer |
| `apps/web/src/app/cp23-shell.css` | Dark original-logo footer and frosted bottom mobile navigation |
| `scripts/theme-smoke.mjs` | Browser test of system mode, persistence, pages, member ratios and mobile fit |
| `.github/workflows/theme-mode-browser.yml` | Independent Chromium QA for 3 theme modes |

## Behavior and safety

- The theme is client-side only: no DB migration, no API payload changes, no customer balance fabrication, no payments.
- The physical checkout API remains 503 and the digital payment gateway remains non-operational until provider configuration and verification.
- The original WordPress production and GitHub `main` are untouched. PR #1 remains draft.
- Dark mode does not invert/replace logos or product/banner photos.
- Safari iPhone device visual review is still desirable; Chromium CI is the automated acceptance gate.

## Acceptance

1. Light default, Dark explicit, System tracks OS color changes.
2. The choice survives route change, reload and other tabs; no white flash on dark reload.
3. Full-width mobile hero unchanged and five-item liquid navigation still works.
4. Member ISO 1.586:1 geometry unchanged, no invented Coin balance.
5. Cart drawer, logo and buttons readable at 360px and 390px without horizontal overflow.
6. Existing Foundation/Security/Staging HTTP/Browser UI/Ledger CI remain passing.
7. Independent theme browser QA green, Railway web deployment terminal SUCCESS.

**Deployment and final check status:** verify exact final SHA in Railway and CI before declaring successful production rollout. This is staging-only.
