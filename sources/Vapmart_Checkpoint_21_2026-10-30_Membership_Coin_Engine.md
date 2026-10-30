# Vapmart Checkpoint 21 - Membership & Gold Coin Engine

**Date:** 2026-10-30 (Asia/Jakarta)  
**Repository:** https://github.com/9dbit/Vapmart  
**Branch:** `feat/ecommerce-foundation-20261029`, PR #1 DRAFT (not merged)  
**Staging:** https://vapmart-web-staging.up.railway.app/  
**API:** https://vapmart-api-staging.up.railway.app/  
**Railway project:** `7c01e4d8-6152-4f04-9750-6e7031aa0830`, environment `04586a07-99b0-4cfd-95fa-bb6d8f1719e3`

## User request

Execute both Option A (actual frontend patches) and Option B (end-to-end build pack) for functional shopping cart, member UI, account login/signup, membership activation Rp100,000 crediting 100,000 Coin on a verified payment, six topup sizes, separate Coin wallet/ledger, campaign benefits, and progressively larger metallic gold coin visuals.

## Implementation in staging code

### Frontend
- `apps/web/src/components/cart-drawer.tsx`: no green emoji; purple outlined SVG bag, compact safe-area-aware bottom sheet, desktop side panel, focus trap, Escape/shade/close controls, real remove/qty actions.
- `apps/web/src/components/cart-page.tsx`: simplified empty state, actual demo and digital line items, transparent summary, protected checkout review.
- `apps/web/src/lib/digital-products.ts`: one membership SKU and six Coin pack SKUs, local cart preview products with quantity=1.
- `apps/web/src/components/coin-visual-stack.tsx`: CSS metallic gold embossed Vapmart 'V' coin layers; 3/5/9/13/19/26 visual coins for packs Rp50k/100k/300k/500k/1m/2m. Real balance representation scales by tier; visuals never imply bonus Coin.
- `apps/web/src/components/member-card.tsx`: virtual dark-purple premium card, original Vapmart logo, masked ID, honest member status, server-backed wallet balance when connected.
- `apps/web/src/components/member-hub.tsx`: responsive Overview, Top Up, Benefits, History; choose pack and add to cart; activation CTA one time; no fake event discounts or fabricated balances.
- `apps/web/src/components/customer-auth-panel.tsx`, `apps/web/src/lib/customer-auth.tsx`: sign in, sign up with email confirmation, reset password, session, signout; error/validation; **honest disabled state when Supabase project not configured**.
- `apps/web/src/components/digital-checkout-action.tsx`: clear SKU/IDR/Coin quote, real user auth gate, order creation disabled by default until payment provider ready.
- `apps/web/src/app/api/member/route.ts`, `apps/web/src/app/api/digital-orders/route.ts`: JWT-forwarding no-store Next.js proxies to NestJS internal API.
- `apps/web/src/app/cp21.css`: unified purple/off-white/gold mobile first layout, purple 3D-looking coins, responsive Member Card and Cart, reduced-motion fallback.
- `apps/web/src/app/page.tsx` and `layout.tsx`: CP21 release markers and CustomerAuthProvider.
- `apps/web/src/components/site-header.tsx`: accessible compact CartDrawer; logo and existing purple liquid nav retained.

### Backend
- `apps/api/sql/003_membership_wallet.sql`: additive `membership`, `commerce`, `wallet` schemas, customer profiles, card, 7 digital SKUs, order price snapshots, unique idempotency per customer, payment events, balance ledger. Staging-only deployment by preDeploy migration; no physical order schema modified.
- `apps/api/sql/004_promotions_gamification.sql`: event campaigns and XP ledger (no promotion is auto-live).
- `apps/api/src/member-commerce.ts`: fixed prices, auth-owned reads, order create with transaction and strict UUID idempotency, 503 payment session when gateway absent.
- `apps/api/src/sandbox-payments.ts`: HMAC-SHA256 raw payload verification and atomic Postgres wallet credits, duplicate prevention, no Coin on pending/failed, activation to ACTIVE only after valid paid event. **Sandbox-only** and disabled unless explicit staging flags.
- `apps/api/src/customer-controllers.ts`: /v1/coin-packs, JWT-protected /v1/member/overview, /v1/digital-orders, disabled payment session, signed sandbox webhook.
- `apps/api/src/auth.ts`: CustomerGuard validates Supabase access token with identity provider; no client-provided user ID accepted.
- `apps/api/src/database.ts`, `migrate.ts`, `module.ts`, `main.ts`: transactions, migration ledger, DI route wiring, raw body for signature.
- `apps/api/test/coin-wallet.test.ts`: SKU, injected client prices, strict UUID, disabled flags, HMAC tampering, payload validation.
- `scripts/ui-smoke.mjs`, `scripts/smoke-staging.mjs`: CP21 regression gates for six gold coin tiers, auth forms, digital cart, 401 guest access, 503 old checkout and release marker.

### Package docs
- `docs/CP21_API_CONTRACT.md`: exact HTTP/JSON API contract and threat model.
- `docs/CP21_ENVIRONMENT.example`: env var inventory (values empty, no secrets).
- This checkpoint MD and `docs/CP21_QA_CHECKLIST.md` describe recovery and release acceptance.

## Business semantics

Signup is free. Membership activation is Rp100,000 exactly once, paired with 100,000 Coin **only after verifiable successful payment**. Separate topups 50,000 / 100,000 / 300,000 / 500,000 / 1,000,000 / 2,000,000 credit exactly that many Coin. Purchased Coin and gamification XP are completely separate; no paid random rewards or fabricated live promotions. Member Card balance is server-calculated, not hardcoded. One payment event cannot credit twice; extra activation payment is rejected for review.

## External dependencies / known limits

1. **No dedicated Vapmart Supabase Auth project exists in either connected Supabase account.** Existing projects belong to Pentagon, Tradevice, etc.; not appropriate to reuse. Do not enable signup/login publicly until an isolated Supabase Auth project is created and configured. Current Login UI correctly states unavailable rather than receiving credentials.
2. **No licensed gateway integration is configured.** Current Railway environment has no Supabase/checkout/sandbox secret variables; checkout remains disabled. No real-money membership payment, live balance top-up or public payment status callback can yet be claimed operational.
3. The **sandbox** webhook engine is for controlled integration tests only. It must not be exposed as a real-money settlement interface; integrate a licensed PSP, refund/dispute rules, reconciliation and Indonesia e-money/store-credit legal review first.
4. The historical WordPress content source was audited in CP17; no historical customer/order import performed in CP21.
5. Old physical `POST /v1/orders` remains HTTP 503 and GitHub `main` + WordPress production untouched.

## Staging verification / deployment status

- GitHub Foundation Checks and Dependency Security Audit for CP21 builds succeeded (to be reconfirmed on final commit).
- CP21 frontend and API application deploys were observed terminal Railway SUCCESS by service metadata, with checkouts still disabled. Verify specific SHA at final test.
- Initial Browser UI and HTTP smoke runs reported failure during mixed-release deploy: stale CP19 page marker and a drawer name assertion from CP19. Scripts were updated to CP21 release and the current accessible dialog label. Recheck final run before marking end-to-end PASS.
- Auth signup/inbound payment live tests remain blocked by missing external configuration, regardless of code compilation.
- No test payments or stored customer financial balances should be manufactured to force a green state.

## Required release acceptance

1. Login/Member/Cart 200, no horizontal overflow at 360px and 390px, no green icon, consistent purple and existing Vapmart logo.
2. Six packs show 3/5/9/13/19/26 gold coins and correct prices; add/remove cart item; digital review shows real amount and disabled checkout state.
3. Guest cannot access /v1/member/overview or create /v1/digital-orders (401). Old physical POST /v1/orders 503.
4. Server price never trusts client. HMAC raw-body tampering fails. Sandbox only if explicitly configured and a suitable controlled test user exists.
5. Signed paid callback posts one ledger entry, replays none, failed/expired zero, unique activation credit; test using disposable staging accounts and independent accounting reconciliation only after Auth setup.
6. Only then select and connect dedicated Supabase project and licensed gateway, after pricing/legal acceptance.
7. Keep PR #1 draft. No WordPress production/merge until real QA and rollback.

**Do not interpret the existence of membership cards or coin visuals as evidence that a paid balance was funded.**
