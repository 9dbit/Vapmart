# Vapmart Checkpoint 20 - Membership, Coin Wallet, Checkout & Gamification
**Status:** PROPOSAL / PLAN ONLY. No feature code, database migration, live payment, or checkout deployment authorized by this checkpoint.
**Date:** 2026-10-30 (Asia/Jakarta)
**Repository:** https://github.com/9dbit/Vapmart
**Branch:** `feat/ecommerce-foundation-20261029`; PR #1 remains draft.
**Staging:** https://vapmart-web-staging.up.railway.app/

## 1. User intent

- Fix the Cart drawer / Cart page and Member page from user screenshots. Keep authentic purple Vapmart branding; **no green interface elements**.
- All cart and member content should be meaningful, accessible, legible, visually consistent, responsive, and functional.
- Show a premium virtual Vapmart member card and **real, event-dependent benefits**, without claiming promotions are currently active.
- Real signup/signin/logout/password recovery and authenticated membership account management.
- Member activation checkout is Rp100,000: upon **verified successful payment**, grant a one-time Rp100,000-denominated **100,000 Coin balance** and activate membership. No duplicate activation credits.
- After free registration, users may choose either membership activation or an independent coin pack top-up. Six packages: Rp50,000, Rp100,000, Rp300,000, Rp500,000, Rp1,000,000, Rp2,000,000.
- Every pack is a digital SKU, with transparent quantity and checkout, authenticated payment attempts, receipt, transaction status, ledger posting and refund/reversal handling.
- Make acquisition/recharge visually playful through deterministic progress and reward animations, but never paid random rewards or misleading success states.

## 2. Audit of present implementation

- `apps/web/src/app/login/page.tsx` has hard-disabled fields and no functional customer auth.
- `apps/web/src/app/member-2/page.tsx` has three static placeholder tiles and hardcoded `0 Points`.
- `apps/web/src/components/site-header.tsx` renders a cart drawer with green-rendered system emoji `✳`, multiple stacked controls and a tall empty-state layout.
- `apps/web/src/components/cart-page.tsx` and `apps/web/src/lib/cart.tsx` work only with DEMO items in browser `localStorage`. They are not orders or accounting records.
- `apps/api/src/auth.ts` can verify Supabase user JWT, but the current customer UI is not wired to it. Existing AdminGuard is staff-only.
- `apps/api/src/controllers.ts` blocks `POST /v1/orders` with 503, and both `/health` and `/ready` advertise checkout disabled.
- `apps/api/sql/001_initial.sql` includes `product.orders` and `product.order_items`, whose line items currently FK to physical product records, not digital membership/coin packs.
- Supabase Auth is an external identity service; Railway PostgreSQL is product/commerce storage. Do not create foreign keys across these two databases.
- Source WordPress production and protected customer order history remain outside this scope.

## 3. Business rules / clear product semantics

### Account vs membership
- Signup is **free**. Email verification (OTP or verified link) is required before purchases.
- A verified, non-paying account is `REGISTERED` and may buy coin packs independently of membership (subject to compliance approval).
- `MEMBERSHIP_ACTIVATION` costs **Rp100,000 exactly once** and activates `ACTIVE` membership on payment confirmation. It grants **100,000 spendable Coins exactly once**, not 100,000 Coins plus a second separately charged fee.
- Repeat activation should be blocked or converted to wallet refill only with explicit customer consent; never grant a second activation credit.
- Do not invent subscription renewal or expiry. Proposed initial policy: no recurring charge; membership validity and balance expiry require terms/legal approval before release.
- Coin represents prepaid in-store purchasing power in the proposed UI, at `1 Coin = Rp1`. It is not XP, cash-out, money transfer, marketplace cross-merchant money, or exchangeable crypto.
- Paid wallet Coins and promotional Reward XP are **separate ledgers and user-facing balances**. An earned promotion discount is not automatically added to the prepaid wallet.
- The legal classification of stored value, refund rights, custody/float obligations and required licensed partner arrangements must be reviewed **before monetary activation**.

### Coin packs
| Pack SKU | Charge | Credited Coins | Note |
|---|---:|---:|---|
| COIN-050 | Rp50.000 | 50.000 | purchasable after signup |
| COIN-100 | Rp100.000 | 100.000 | separate from one-time member activation |
| COIN-300 | Rp300.000 | 300.000 | optional |
| COIN-500 | Rp500.000 | 500.000 | optional |
| COIN-1000 | Rp1.000.000 | 1.000.000 | confirmation and risk limits |
| COIN-2000 | Rp2.000.000 | 2.000.000 | confirmation and risk limits |

No hidden paid bonus coins, chance-based multipliers, or guarantees of active discounts. The six nominal amounts are editable in an authorized admin configuration, with changes auditable and existing orders price-snapshotted.

### Promotion event engine
- Every campaign specifies `starts_at`, `ends_at`, member eligibility, published status, eligible SKU/categories, discount/voucher calculation, minimum spend, per-user limit, global budget, max discount, stacking/exclusion rules and timezone.
- Non-member account may see an offer preview, but eligibility is checked server-side before checkout.
- Member-only benefit proposals: event discounts, limited-member coupons, early access, member-only bundle. Rates are examples to configure, not approved currently.
- If no approved live campaign exists, show **"Belum ada promo member aktif"** rather than a fabricated percentage.

### Gamification
- Each eligible purchase earns transparently defined **XP** or an achievement; do not conflate purchased Coin with reward points.
- UI may feature a progress bar, milestone meter, fixed unlock badges, animated coin stack on **confirmed** credit, a purchase-history timeline and event challenges (rules visible before participation).
- The animations are visual only. No paid randomized box, roulette, gacha or surprise odds.
- Respect `prefers-reduced-motion` and maintain clear static states.

## 4. Screen layouts

### A. Cart drawer and full cart
- Header: `Keranjang`, item count, 44px close, drag handle on mobile, brand purple icon in place of `✳`.
- Mobile: bottom sheet max 84-88dvh with dedicated scrollable line items, sticky purchase-summary footer, safe-area padding, no giant empty white space. Desktop: right drawer ~420-460px.
- Empty: compact custom SVG shopping-bag/cart image, message `Keranjang masih kosong`, one strong purple CTA `Jelajahi katalog`; hide subtotal/checkout and duplicate CTA until relevant.
- Filled: item photo, type (merchandise/membership/coin pack), title, quantity where meaningful (activation always qty=1), price, clear remove button, optional voucher line, subtotal, total and primary action.
- `Lihat keranjang` is secondary when drawer filled. No fake enabled checkout. Legacy physical product order API remains blocked; digital checkout is a separate gated flow.
- Navigation behind modal is inert/focus managed; close with Escape/shade/button, no visual overflow at 360px or 390px.

### B. Login / signup
- Use original supplied Vapmart purple logo, not legacy white logo with darkening filter.
- Responsive pill tab: `Masuk`, `Daftar`, plus `Lupa password`.
- Email/password OR email OTP verification through a dedicated Supabase Auth project (only after confirmed configuration). Support resend, expired verification code, duplicate email, weak password, loading/error and logout.
- After signup: free Account → choose `Aktifkan Member Rp100.000` OR `Top Up Coin` OR `Jelajahi Katalog`.
- Never silently process a payment on account registration. Supabase service-role credentials never shipped to client.

### C. Membership hub
- One premium virtual Vapmart card at top, visually consistent with logo: dark charcoal/metal purple, subtle specular violet border, high-contrast white typography, no green UI.
- Card: member display name, masked number, membership state `Belum Aktif`/`Aktif`, Coins available, XP as separate small field. Optional QR uses short-lived server-signed card token if later needed.
- Status CTA: `Aktifkan Member • Rp100.000` for unactivated, `Top Up Coin` for eligible accounts.
- Benefit section with actual approved event offers, eligibility and expiration, or informative empty state.
- Suggested tabs: `Overview`, `Top Up`, `Promo`, `Riwayat`. Display pending/paid/failed topups and credited/debited history.
- No empty fixed-height tiles, white-on-white titles, unverified point balances or fake promo countdown.

### D. Pack shop / checkout
- Six clean digital-product cards, arranged 2 columns mobile; amount prominent, `+50.000 Coin`, `+100.000 Coin`, etc.
- Selected pack animates with purple liquid border; live order summary `Harga`, `Coin didapat`, `Biaya` if applicable, `Total`; no hidden fees.
- Payment method through a licensed payment partner: e.g., QRIS, virtual account, supported wallets. Status `Menunggu pembayaran`, `Berhasil`, `Kedaluwarsa`, `Gagal`, `Refund`.
- Never credit on button click, client callback, URL querystring, or screenshot. Server verifies the payment-provider notification and optionally payment-status query.
- After PAID and an atomic ledger posting, show a concise coin-drop animation and the new **server-calculated** balance. On pending/failed, show no credited balance.

## 5. Technical architecture

**Frontend:** Next.js React. Existing `/login`, `/member-2`, `/keranjang-2`, cart drawer updated via reusable design system components: `MemberCard`, `BalanceSummary`, `CoinPackGrid`, `DigitalCheckout`, `PromoEventCard`, `PaymentStatus`, `WalletHistory`.

**Identity:** Supabase Auth is the identity provider; auth UUID is a reference key in Railway Postgres. Customer routes and APIs verify user identity; server-side auth checks own-resource access independently of UI visibility. Use secure session cookie / SSR setup and CSRF protections as appropriate.

**Backend:** NestJS orchestrates purchase orders, quote validation, payment sessions/provider callbacks, membership activation and wallet accounting. Restrict digital checkout with a separate feature flag; keep current `POST /v1/orders` HTTP 503 for existing merchandise until safe.

**Railway PostgreSQL, proposed additive schemas** (review-only until approved):
- `public.customer_profiles`: immutable external auth UUID, display name, contact status and policy consent.
- `membership.accounts`: customer UUID, state, activation order reference, activation timestamp, eligibility.
- `membership.cards`: unique card number/token reference, display name and immutable audit metadata.
- `commerce.digital_catalog`: SKU `MEMBER-ACTIVATION`, and six coin packs, price/coin grant, active status, max qty.
- `commerce.orders`, `commerce.order_lines`: immutable order price snapshot, order type, state machine and customer ownership.
- `commerce.payment_attempts`: processor ID, status, amount, signature verification state and expiry.
- `commerce.payment_webhook_events`: unique provider event IDs, verified callback metadata; retries safe.
- `wallet.accounts`: one per user per currency/asset class, locked/available state.
- `wallet.ledger_entries`: immutable integer Coin credits/debits with signed deltas, linked to order/payment, idempotency key, and balance reconciliation.
- `promotion.events`, `promotion.rules`, `promotion.redemptions`: event configuration, eligibility and redemption limits.
- `gamification.xp_ledger`, `gamification.missions`, `gamification.awards`: non-monetary progress and explicit achievement rules.
- `audit.events`: sanitized security and administrative change audit.

Avoid directly writing `balance=100000`. Instead post the one-time `+100000` ledger entry once and calculate the materialized/current balance transactionally. Guard with unique `(source_payment_id, credit_type)` or equivalent and a database transaction.

## 6. Payment state machine and safeguards

```text
REGISTERED → (Membership activation OR Coin pack) → ORDER_CREATED
→ PROVIDER_PENDING → verified provider PAID
→ transactionally: PAYMENT_POSTED + WALLET_CREDITED (+ MEMBER_ACTIVE if activation)
→ RECEIPT → UPDATED_MEMBER_CARD

PROVIDER_PENDING → FAILED / EXPIRED: no Coin credited
PAID → REFUND / DISPUTE: compensating ledger transaction + review as needed
```

- Webhook signature/HMAC, provider order binding, verified amount/currency, timestamp freshness, idempotent event IDs, duplicate delivery safety.
- Separate wallet credit ledger from paid user XP or promotional awards.
- Rate-limit attempts, detect order replay and duplicate callback, enforce spend caps, per-day risk limits and suspicious balances. Do not expose real topups until regulatory and merchant-account checks pass.
- Funds flow, refunds, forfeiture, dormant balances and Coin expiry require approved written terms and compliance review.
- Full reconciliation between gateway PAID transactions and Postgres ledger, plus automated failed/missing-credit alerts. No web-admin manual balance editing without guarded audited compensating entries.
- Staging must use test-mode gateway credentials; do not process real payments in early UI tests.

## 7. Proposed NestJS API surface

- `GET /v1/me`, `PATCH /v1/me` (validated profile).
- `GET /v1/member`, `GET /v1/member/card`, `GET /v1/member/benefits`.
- `GET /v1/wallet`, `GET /v1/wallet/transactions`.
- `GET /v1/coin-packs`, `POST /v1/digital-orders` (body allow-listed digital SKU + idempotency token).
- `POST /v1/digital-orders/:id/payment-session`, `GET /v1/digital-orders/:id`.
- `POST /v1/payments/<provider>/webhook` (provider-signed; no customer JWT needed, but robust provider verification).
- `GET /v1/promotions/eligible`; customer never controls event eligibility or price.
- Admin-only event/pack configuration APIs, with staff role verified in database and audited.

## 8. Dependencies, phase order, QA exit gates

**Phase A - UI cleanup**: no green icons or UI state; fix cart drawer, compact empty state, fixed text contrast, purple CTA, MemberCard preview with honest `Belum Aktif`. Keep transactional controls disabled until enabled.

**Phase B - Auth**: configure dedicated Supabase Auth project, SSR session, signup/signin/verification/reset/logout, customer profiles and ownership enforcement. Test on iOS Safari.

**Phase C - Digital commerce + ledger**: review payment regulations and merchant integration, create digital SKUs, review/apply schema migration to staging, implement gateway test checkout and idempotent ledger. End-to-end tests must show one-and-only-one +100,000 Coin after paid membership, exact topup package credits, zero credits on pending/failed, correct refund/reversal.

**Phase D - Campaign + deterministic gamification**: admin event editor, eligible benefit cards and expiry, XP/achievement progression, transparent animation, empty states. Disable fake promos.

**Phase E - Hardening and release**: financial reconciliation, abuse/fraud review, role and RLS tests, CSRF and webhook signature tests, device/mobile QA (360,390, tablet, desktop), a11y contrast, analytics and Web Vitals. Keep physical checkout disabled until independently audited.

**Acceptance examples**:
- New user registered → card `Belum Aktif`, Coin=0.
- Verified user pays activation Rp100,000 through test provider → exactly 100,000 Coin, Member Active.
- Same PAID webhook delivered 10 times → same balance, exactly 1 credit event.
- New verified user may top up Rp50,000 without membership; no member-only promotions until active.
- Paid member purchases Rp300,000 pack → 300,000 additional Coin.
- Pending/expired/failed order → no Coin.
- Guest and User A cannot access User B balance or card.
- No false active promo and no green UI or invisible text.
- Physical product `POST /v1/orders` still HTTP 503 until separately approved.

## 9. Legal and product release gate

Indonesia's Bank Indonesia **PBI 10/2025** and **PADG 32/2025**, both in force 31 March 2026, define current framework for payment services and electronic-money-like stored value. A closed-loop designation or `Coin` label **does not itself exempt Vapmart from licensing, consumer protection or safeguarding requirements**. Before receiving funds, obtain classification advice on whether this is a store-credit/voucher arrangement or regulated payment/e-money product, consider licensed PJP partnership, define dispute/refund policy, and have payment terms approved.

Official:
- https://www.bi.go.id/id/publikasi/peraturan/pages/pbi_102025.aspx
- https://www.bi.go.id/id/publikasi/peraturan/pages/padg_322025.aspx

## 10. Decisions for feature signoff

1. Activation Rp100,000 is one-time and fully represented as 100,000 Coin (proposed).
2. Signup and verified-user Coin topups can occur without paid membership (proposed interpretation of user request).
3. Coin not transferable or cash-out in MVP; legal/compliance approval required (proposed).
4. No recurring membership fee or Coin expiry until written policy and legal approval.
5. Event-specific benefits configured from admin, never hardcoded or auto-claimed active.
6. Payment provider/merchant account and credentials must be connected through approved secure configuration before financial activation.

**This file is a specification, not deployment evidence. No application code, migration, production WordPress or live checkout is changed by writing this plan.**
