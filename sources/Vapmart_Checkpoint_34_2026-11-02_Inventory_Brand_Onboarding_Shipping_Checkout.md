# Vapmart Checkpoint 34 | Inventory Ledger, Brand Onboarding & Shipping Checkout

Date: 2026-11-02 (Asia/Jakarta)
Repository: https://github.com/9dbit/Vapmart
Branch: feat/ecommerce-foundation-20261029
Environment: Railway Vapmart (currently named staging), custom domain https://vapmart.id
**Gateway payments OFF. Courier booking OFF. Sandbox rate lookup OFF unless independently configured.**

## Why CP34
CP33 removed the WordPress legacy catalog from the operational UI, established brand-scoped read-only data and prepared the Biteship adapter. The missing operational pieces were reliable stock changes, verified onboarding, and a durable courier choice bound to the customer and cart.

## Inventory Engine
- Migration 009 adds audited stock movements to existing `product.inventory_events` with `stock_before`, `stock_after`, `notes`, `movement_key` and a unique idempotency index.
- On migration, legitimate pre-existing non-DEMO balances without movement records are labeled **opening_balance** (not mistaken for verified supplier receipts).
- Administrator route `POST /v1/admin/inventory/adjust` requires verified Supabase admin, product UUID, signed integer delta, reason, explanation, and UUID idempotency key.
- Product row is locked with `SELECT ... FOR UPDATE`; the stock counter and movement event are committed together. Insufficient or overflow stock, idempotency collisions and forbidden reasons are rejected.
- Product edits no longer accept direct `stock_qty` patches; new products with initial stock create an atomic opening balance event.
- Admin route `GET /v1/admin/inventory/:productId/movements` and Control Panel **Inventory Ledger** tab show the audit trail and movement form.
- The stock is not reserved when saving a **draft** order. Automatic reservation, warehouse bin-level balances, fulfillment movements and payment-dependent deduction still require separate workflows.

## Verified Brand Onboarding
- Migration 010 adds `product.brand_invitations` with hashed one-time random token, target email, brand, role, creation/expiry, acceptance/revocation audit.
- Admin `POST /v1/admin/brand-invitations/:brandId` generates a manual-delivery invite valid for 48 hours. The clear token is returned once, **not stored** in PostgreSQL or GitHub. Resending replaces prior pending invite for same email/brand.
- Admin can list and revoke invitations; route protected by AdminGuard.
- The partner accepts from `/brand/accept#token=...` via `POST /v1/brand-invitations/accept`. The browser URL hash keeps the token out of the server URL; acceptance requires a verified Supabase account with **the exact invited email**, an unexpired/unrevoked token, and an active brand.
- A row-level lock ensures one-time acceptance. The brand membership and audit are created in the same DB transaction. The current direct UUID setter may change existing membership roles or revoke them, but cannot provision new members without an accepted invitation.
- The administrator sends the invitation manually. **No automatic email delivery has been configured or claimed.** Brand portal remains read-only for every partner role until a separate approval.

## Shipping Checkout: Safe Draft Integration
- Migration 011 adds `product.shipping_rate_quotes` with user UUID, SHA-256 canonical basket fingerprint (SKU product ID, quantity, verified server-side price and weight), origin/destination postcodes, courier/service, sandbox price, 15-minute expiry and one-time order use.
- Biteship Rates adapter still rejects production keys and requires `BITESHIP_API_KEY` starting `biteship_test.`, `SHIPPING_ORIGIN_POSTAL_CODE` and explicit `SHIPPING_RATE_LOOKUP_ENABLED=true`.
- `POST /v1/shipping/rates` now stores accepted sandbox choices and returns short-lived `quoteId` options. This is **rate lookup only**. There is no booking, tracking number, label, pickup or paid transaction.
- Customer checkout has manual **Cek pilihan kurir (sandbox)**; no automatic provider queries.
- Draft checkout accepts only a server-issued UUID `shippingQuoteId`, never a browser-supplied shipping price.
- Server locks the quote, verifies ownership, expiry, postcode, origin, provider, current basket/price/weight fingerprint, and unused status, then snapshots fee and courier/service into a **draft** order atomically.
- If live values changed, reject and request a fresh quote. Quote cannot be used for another order.
- When shipping sandbox is not activated, existing draft-only shipping estimate remains labeled estimate; payment remains OFF and booking remains OFF.
- Provider note: Biteship sandbox Rates API requests **may consume paid quota**. Do not enable key or toggle without owner authorization and cost review. Sources: https://biteship.com/en/docs/sandbox ; https://biteship.com/en/docs/plans ; https://biteship.com/en/docs/api/authentication

## QA
- Backend unit tests added for stock adjustment validation, one-time invite input validation, canonical shipping quote fingerprint and checkout price-field injection rejection.
- Staging smoke augmented to verify unauthorized requests to new inventory/invite APIs return 401.
- Browser smoke augmented to verify isolated brand invitation page.
- GitHub Actions build, suite, Railway web/API deployments must be inspected after the final CP34 code commit. **Do not claim complete if any stage is still building.**
- Real two-brand access isolation and actual courier quote calculation cannot be end-to-end validated until approved verified partner users and a test Biteship key exist.

## Operations checklist / required before public purchasing
1. Create legitimate brands and product records. No seed DEMO should be published.
2. Invite brand contact using Control Panel > Brands > Brand Onboarding; send one-time link securely and verify accepted membership in `/brand`.
3. Use Inventory Ledger for all stock movements, attach invoice/receiving evidence in notes.
4. Complete product weight/dimensions and configure pickup warehouse/origin postcode.
5. Approve a Biteship test account and review Rates API costs, then add key on Railway ONLY. Run sandbox QA with a verified user before involving real customers.
6. Implement multi-warehouse stock reservation, price/stock concurrency under fulfillment, returns and item-level order splits.
7. Implement actual shipping booking/tracking/webhooks after payment confirmation and permitted activation, with explicit owner approval.
8. Payment gateway requires signed webhooks, reconciliation, final pricing, privacy/compliance and owner sign-off. Keep `CHECKOUT_ENABLED=false`, `DIGITAL_COMMERCE_ENABLED=false`.
9. Do not change Pentagon, Tradevice, Hostinger DNS, email, or other projects.

## Links
- https://vapmart.id/admin
- https://vapmart.id/brand/login
- https://vapmart.id/brand/accept (requires invite fragment)
- https://vapmart.id/checkout
- https://github.com/9dbit/Vapmart/actions
