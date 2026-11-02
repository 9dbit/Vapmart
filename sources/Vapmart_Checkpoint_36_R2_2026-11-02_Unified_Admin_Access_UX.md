# Vapmart Checkpoint CP36-R2 | Unified Admin Access & Operations UX

Date: 2026-11-02 (Asia/Jakarta)
Repository: https://github.com/9dbit/Vapmart
Working branch: `feat/ecommerce-foundation-20261029`
Entry point: **https://vapmart.id/admin**
Legacy bookmark: `/admin/login` now HTTP-redirects to `/admin`.
Scope: Web/Control Panel only. No changes to Supabase keys, payment, inventory, fulfillment or PostgreSQL state.

## Purpose
Merge confusing two-step admin links into one canonical destination. Upgrade the dashboard so operators can read larger typography, quickly find tools, use mobile navigation comfortably and avoid risky one-click publication.

## Changes
1. **One URL:** `/admin` handles signed-out login, authenticated-but-unprivileged denial, network verification errors, and verified admin dashboard. `/admin/login` is a temporary server redirect to `/admin`, not a second login page.
2. **Security gate:** Existing `useCustomerAuth()` Supabase session is verified using `GET /api/admin/status` (backed by NestJS Supabase verification, confirmed-email enforcement and PostgreSQL `staff_roles` admin assignment). The dashboard requires a freshly verified access token matching the current token and fails closed on auth errors; no user metadata is used to assign roles.
3. **Safe account switch:** Non-admin users can switch accounts without being offered admin content. Session expiry and network failures have separate explanations and explicit retry/switch options. Logout returns to the same `/admin` route.
4. **Readable unified login:** Branded split layout, 16px email/password controls, autocomplete, visible label, password toggle, busy state, validation errors, and no hard-coded credentials.
5. **Dashboard shell:** Sticky compact topbar, admin identity, session status, nine-entry sidebar menu, responsive mobile overlay + close control, keyboard skip link and reduced-motion CSS.
6. **Contextual routing:** Tabs may be bookmarked with `?tab=products`, `?tab=warehouses`, `?tab=orders`, etc. Back/Forward browser navigation restores a valid tab; invalid values return to Overview.
7. **Media Library:** `/admin/media` retains its admin-only gate but uses the identical workspace shell/navigation. The old redundant top pill navigation is removed.
8. **Font and control sizes:** Dashboard sections, KPI labels, tables, product editor, warehouse and fulfillment tools, media details and control buttons use larger, more readable type and touch targets. Existing purple-magenta Vapmart palette, dark mode and storefront identity preserved.
9. **Operational guide:** On empty product catalogs, the Overview provides four interactive onboarding steps: Brand, Media, SKU, Warehouse, with no invented product data.
10. **Safety confirmations:** Publishing/unpublishing a product and activating/deactivating a brand now ask for confirmation. Actual server-side authorization is unchanged and remains mandatory.

## Source files
- `apps/web/src/app/admin/page.tsx`
- `apps/web/src/app/admin/login/page.tsx`
- `apps/web/src/app/admin/media/page.tsx`
- `apps/web/src/app/admin/layout.tsx`
- `apps/web/src/components/admin-access.tsx` (new)
- `apps/web/src/components/admin-workspace.tsx` (new)
- `apps/web/src/app/admin-v27.css` (new)
- `scripts/ui-smoke.mjs`
- `scripts/smoke-staging.mjs`
- `scripts/admin-ui-smoke.mjs` (new)
- `.github/workflows/admin-control-panel-browser.yml` (new)

## Testing and release gates
- Foundation Next.js/TypeScript and NestJS builds.
- Browser UI smoke: anonymous `/admin/login` redirects to `/admin`; login form is properly isolated from storefront and admin data; input font >=16px, password hidden by default, mobile 390px without overflow.
- Staging smoke: both legacy and canonical URLs resolve to a unified login; all anonymous privileged APIs return HTTP 401; payment/booking disabled.
- New Admin Control Panel responsive QA: isolated **mock Supabase session** with API read responses intercepted in a browser context (no real admin credentials). Confirms nine sidebar modules, URL tab routing, larger product labels, Media Library navigation, mobile open/close drawer and no overflow.
- Existing Browser UI, Theme, Security Audit, Coin Ledger, Private Media Library, Warehouse & Fulfillment integration workflows must continue to pass.
- **Do not claim production administrator end-to-end login tested:** No real admin password or real authorized session was used. Browser QA mocks the verified role, whereas production API role enforcement is separately validated by anonymous 401 tests.
- Railway **must** reach terminal SUCCESS on `vapmart-web`; the deployed Git commit must include these UI files. Verify `https://vapmart.id/admin` and the redirected legacy path after release. Mark final results after tests settle.

## Explicitly unchanged
- Public storefront and historic-media visual recovery from CP36-R1.
- 59-file authenticated Media Library storage and original media bytes.
- PostgreSQL products, order drafts, CP35 inventory, CP36 fulfillment/returns, Supabase user roles and security policies.
- `paymentEnabled=false`, courier booking OFF and API shipping quote lookup OFF.
- No changes to DNS, email, Hostinger, other projects, tokens, or billing.

## Operator acceptance test
1. Open `https://vapmart.id/admin`. When logged out, see the secure login form.
2. Sign in with an approved admin Supabase account; the page remains `/admin` and shows the dashboard.
3. Open sidebar: Produk, Media, Brand, Gudang, Pesanan, Fulfillment, Courier Ops and Pengiriman.
4. On mobile, open/close the sidebar and check that form fields are readable without horizontal scrolling.
5. Sign out and confirm dashboard data disappear; switching to a non-admin customer session must show Access Denied rather than admin content.
6. No real buying, money movement, stock changes or courier requests are needed for this acceptance test.

## Rebuild safety
This is a frontend UX/auth routing upgrade within the same Next.js/NestJS/PostgreSQL system. The CP36-R1 source snapshot remains available at `checkpoint/vapmart-cp36-r1-20261102`. Roll back **only** the admin UI files if required; do not revert backend migrations.

## Final verified deployment and UI quality gates
- **Application build SHA deployed to Railway Web:** `82a8940ce7d768702313bcb1b9e30a78937fc597`. Deployment ID `59b4159a-4d91-45c7-99c8-2ab81bb51d04` ended in **SUCCESS**.
- **Latest tested feature commit (test/doc only after build):** `f1be6629fe2faad52d0458b1d73959954421ccef`. GitHub compare `82a8940...f1be6629` shows **only** `scripts/admin-ui-smoke.mjs`, `scripts/smoke-staging.mjs`, and this checkpoint MD changed. Therefore no application source changes were omitted from the successful deployed Web build.
- Railway API `e3a39da8-02d4-4d7f-81d2-868ed2b1ca1b` **SUCCESS**, PostgreSQL `19ee1b92-92d7-42c9-a7fc-6cb676bcfa21` **SUCCESS**. No CP36 database or payment configuration change occurred.
- All **10/10** GitHub Actions workflows on `f1be6629` **PASS**, including Foundation checks (2), Browser UI smoke, Staging smoke, Theme mode browser QA, Dependency security audit, Private Media Library Integration, Coin Ledger Integration, Warehouse/Fulfillment PostgreSQL integration, and the new Admin Control Panel responsive QA.
- Staging smoke run `41351558400` **PASS**. Explicitly verified both Railway and `https://vapmart.id/admin` render the anonymous login, `/admin/login` resolves to `/admin`, and anonymous users cannot access the admin navigation or privileged APIs. Checkout/payment and courier booking OFF.
- Admin Control Panel responsive QA run `41351558391` **PASS** using local browser-only mocked identity and API data; verified 9 navigation items, selected tabs/query URLs, Media Library, product form label font, 390px mobile drawer open/close, no horizontal overflow.
- Authenticated *real* human admin acceptance remains necessary; no production admin credentials were used to sign in or mutate any customer data.
- This checkpoint does **not** signify a new Railway deployment. Subsequent commits after the last compiled Web SHA contain only test documentation and checks.
