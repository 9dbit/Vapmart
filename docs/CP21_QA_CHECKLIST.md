# Vapmart CP21 - QA Checklist and Recovery Runbook

## Frontend (Chrome and iOS Safari)

- [ ] 360px and 390px cart empty: no green icon; purple SVG bag; compact spacing; no fake subtotal/checkout button.
- [ ] Cart with regular demo item: quantities enforce available stock, remove works, route navigation closes dialog, focus stays inside modal.
- [ ] Member page guest: Premium Member Card, status Preview, not a fake 100,000 balance; sign in and sign up links.
- [ ] Member page authenticated (dedicated Vapmart Supabase needed): real identity, status, Coin balance and history from API.
- [ ] Coin pack selection: visual gold coin counts exactly 3, 5, 9, 13, 19, 26 for ascending packs.
- [ ] Coin pack selection and add to cart: only one local digital SKU; correct rupiah price and Coin number.
- [ ] Digital checkout review: never claims a paid state when gateway is missing.
- [ ] Signup: valid name, password min 8, match confirmation, verification email, duplicate email safe handling.
- [ ] Signin: valid password, failed password, persistence, logout, password reset.
- [ ] Member benefits: no fabricated active promo. Empty message when no approved events.
- [ ] Reduced motion, focus/contrast, no overflow or obscured bottom actions at 360/390/tablet/desktop.
- [ ] Original purple logo on header, footer and virtual card.

## API and database

- [ ] /ready returns 200 after 003/004 migrations applied to Railway staging.
- [ ] /v1/coin-packs returns seven SKUs with prices and checkoutEnabled false by default.
- [ ] Anonymous GET /v1/member/overview and POST /v1/digital-orders -> 401.
- [ ] Physical POST /v1/orders remains 503.
- [ ] Product/admin safety checks still pass; no leaks of secrets.
- [ ] Verify migration ledger: 001,002,003,004 checksum stable.
- [ ] Dedicated Vapmart Supabase project created in authorized organization after explicit billing choice.
- [ ] User A cannot read User B balance/order.
- [ ] Browser prices are ignored/rejected; fixed server price and unique SKU.
- [ ] Idempotency: duplicate request returns same order; reused key with different SKU rejected.
- [ ] Wrong/missing HMAC, wrong amount, invalid provider event -> no Coin ledger credit.
- [ ] Sandbox paid activation Rp100k -> +100000 Coin exactly once and ACTIVE.
- [ ] Replayed paid event -> no extra; second activation prevented.
- [ ] Sandbox topup at all six packages -> exact credits after verified signed event.
- [ ] Failed/expired -> zero credited Coin.
- [ ] Gateway reconciles provider rows to wallet ledger if a licensed provider is connected.
- [ ] Promo engine time bounds and member eligibility; never hardcode campaigns as active.
- [ ] No real money transactions on staging.

## Rollout and rollback

1. Feature branch: feat/ecommerce-foundation-20261029, keep PR #1 draft.
2. Confirm Railway web/API deployment terminal SUCCESS and readiness.
3. Run Foundation, Security, Staging HTTP and Browser UI tests.
4. Use release-aware tests when deploying concurrently.
5. Create dedicated Supabase Auth project after approved organization and costs; test verification and recovery before enabling checkout.
6. Sandbox mode only if strictly needed for test users; high entropy secret, staged environment, audit webhook.
7. Production PSP adapter must replace sandbox, after legal review, refunds and reconciliation.
8. Physical checkout 503 until independently approved.

Recovery: disable DIGITAL_COMMERCE_ENABLED before troubleshooting. Never drop accounting tables or manually change Coin balances. Roll UI back to last known good frontend if necessary. Do not publish customer data or credentials.
