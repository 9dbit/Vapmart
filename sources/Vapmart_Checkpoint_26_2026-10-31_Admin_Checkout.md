# Vapmart Checkpoint 26 | Admin Studio & Checkout Draft Flow
Date: 2026-10-31 | Asia/Jakarta
Status: **DEPLOYED TO RAILWAY STAGING / PAYMENT DISABLED**

## Release
- GitHub repo: https://github.com/9dbit/Vapmart
- Source PR: https://github.com/9dbit/Vapmart/pull/2 (merged)
- Base release commit: `21fc03e1e85a3f60088e0d04c0d012709f6f3bb8`.
- Follow-up: checkout POST /v1/checkout/quote now responds HTTP 200 (commit `7916c677df5928853e1dc6b81117911263b308c2`); extended staging smoke adjusted for rolling deployments (commit `61b8e8b90ddf321832689ca78a5cbcf042513aa1`).
- Railway project: Vapmart, environment `staging`.
- Service `vapmart-web` deployment `97cbd344-2913-433d-a6a3-9c21ab7f3284`: SUCCESS.
- Service `vapmart-api` deployment `96807c40-648c-4488-bf79-4ea3ac342055`: SUCCESS.
- PostgreSQL migration 005 applied successfully. API deploy log reported:
  `VAPMART_DATABASE_READY {"migrations":["001_initial.sql","002_catalog_sku.sql","003_membership_wallet.sql","004_promotions_gamification.sql","005_admin_checkout.sql"],"applied":["005_admin_checkout.sql"],"seeded_demo_products":0}`.
- Railway domain check: `vapmart.id` and `www.vapmart.id` verified, DNS propagated, HTTPS certificates VALID. No DNS or email records modified as part of this checkout release.

## Implemented
1. New protected Admin Studio with Overview, Products & SKU, Brands, photo upload/brand gallery, publication controls and read-only draft-order list. No manual mark-paid button.
2. Cart for physical products routes to `/checkout`. Digital Coin / membership flow remains separate from shipping.
3. Checkout: address/contact details, server-owned current price/stock quote, standard shipping estimate when configured, QRIS / Virtual Account / E-Wallet *preference only*.
4. Draft order: verified customer email, per-user order lookup, server-side totals, idempotency key, 24-hour expiry reference, no payment capture.
5. Order detail at `/pesanan/[id]`, with payment button disabled.
6. No active sales of legacy nicotine/tobacco archives; only replacement catalog is eligible.

## Verification evidence
- Merge commit's seven GitHub Actions pipelines: PASS (Foundation checks, staging smoke, wallet ledger integration, security dependency audit, theme QA, browser UI smoke and PR foundation checks).
- New CP26-specific staging smoke: PASS, https://github.com/9dbit/Vapmart/actions/runs/41176755896.
- Additional smoke checks: deployed Checkout/Admin Studio HTML, quote 200 with server price, QRIS/VA/E-Wallet config reports providerConnected=false and paymentEnabled=false, admin endpoints deny unauthenticated users (401), order creation denies anonymous users (401), malformed/empty quote rejected (400).
- Real signed-in customer draft order and Admin CRUD remain **UNTESTED / BLOCKED** because a dedicated Vapmart Supabase Auth project has not been connected. Passing public smoke tests do not substitute for end-to-end authenticated testing.

## Outstanding release gates
1. Choose either Supabase organization `9D` or `Makstudios.id@gmail.com Org` for a **new dedicated Vapmart Auth project**. Do not reuse unrelated Pentagon, Tradevice or other Auth identities.
2. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` on web; `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` on API, through Railway variables only. No secrets in public GitHub repository.
3. Complete verified signup, login, password reset, admin role provisioning in `public.staff_roles`, order write/replay and customer-order isolation tests.
4. Replace flat `SHIPPING_FEE_IDR` estimate with destination-aware carrier quote, confirm taxes/fees and fulfilment policy before live payment.
5. Choose authorized payment gateway. Build provider-agnostic payment sessions, signed webhook verification, amount/currency reconciliation, idempotent state transitions, refunds/failures, and separate physical-order vs member-Coin fulfilment. Keep real payments off until sandbox and compliance checks pass.
6. Move interim Postgres image bytea storage to object storage such as R2 before large-scale use; stress-test duplicate concurrent checkout submissions.

## Payment state machine (target)
`Cart -> Server Quote -> Shipping -> Payment Preference -> Draft Order -> Payment Session (future) -> Pending -> Verified Paid -> Fulfilment`.

Only stages through **Draft Order** are currently implemented; the payment-session endpoint is deliberately blocked with `PAYMENT_PROVIDER_NOT_CONNECTED`. Member/Coin balance must never be credited from frontend success alone. Keep `CHECKOUT_ENABLED=false`, `DIGITAL_COMMERCE_ENABLED=false`; no external transaction, payout, or fulfilment was activated.

## Next checkpoint
CP27: dedicated Supabase Auth + customer/admin authenticated QA, then payment gateway adapter in sandbox only.
