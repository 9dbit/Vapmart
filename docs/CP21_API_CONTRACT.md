# Vapmart CP21 - Auth, Member Card, Digital Coin API Contract

**Scope:** staging-only modular ecommerce foundation. Production checkout remains closed.
**Database:** Railway PostgreSQL, authenticated by Supabase Auth from a dedicated Vapmart project (not yet configured).

## Public endpoints

`GET /v1/coin-packs`
Returns `{items:[{sku,type,priceIdr,coinCredit}],checkoutEnabled:boolean}`.
Contains activation SKU `MEMBER-ACTIVATION` and six `COIN-050,100,300,500,1000,2000`.
The client cannot set prices or credited Coin values.

## Authenticated customer endpoints

`GET /v1/member/overview` with `Authorization: Bearer <Supabase access token>`.
Returns `{status, balanceCoin, cardLast4, name, benefits, transactions}`. Values come from Railway PostgreSQL. Promo list is empty when no current published member campaigns.

`POST /v1/digital-orders` with verified JWT and JSON:
```json
{"sku":"COIN-100","idempotencyKey":"a3cd1a2b-6619-49c7-aabf-e5020e4b2740"}
```
Only strict allow-listed SKU and UUID. The backend reads price from `commerce.digital_catalog`; it ignores/refuses browser-supplied amounts. Creates one pending order when sandbox mode is explicitly enabled, and never credits Coin immediately.

`GET /v1/digital-orders/:id` checks the owner, returning order status.

`POST /v1/digital-orders/:id/payment-session` currently deliberately returns `503 PAYMENT_PROVIDER_NOT_CONNECTED`. Real gateway integration is not part of this test-stage implementation.

## Signed test-only webhook

`POST /v1/payments/sandbox/webhook` is disabled unless all of these are true:
- `RAILWAY_ENVIRONMENT_NAME=staging`
- `DIGITAL_COMMERCE_ENABLED=true`
- `PAYMENT_MODE=sandbox`
- `SANDBOX_WEBHOOK_SECRET` present and at least 32 characters.

Header `x-vapmart-signature` must equal `sha256=<HMAC_SHA256(secret, exact raw request body)>`, verified constant-time. Valid body:
```json
{"eventId":"test-event-00001","orderId":"a3cd1a2b-6619-49c7-aabf-e5020e4b2740","status":"paid","amountIdr":100000}
```
Supported statuses are `paid`, `failed`, `expired`. This is an **offline test provider**, not a real payment settlement proof.

Paid: transactionally locks the order, requires matching IDR amount, records unique provider event, posts exactly one `wallet.ledger_entries` credit, updates `wallet.accounts`, marks order paid, and if activation converts Member status to ACTIVE and creates card. A second paid activation is rejected. Failed/expired: changes order status without wallet credit.

The webhook is unsuitable for real cash payments; an external licensed gateway with a provider-verified settlement API must replace the sandbox test scheme before live use.

## Frontend proxies

- `GET /api/member` forwards JWT to NestJS, no caching.
- `POST /api/digital-orders` forwards JWT and SKU/idempotency key, never browser price.
- Sign-in/signup/reset are implemented in `customer-auth.tsx` through `@supabase/supabase-js`; they require public URL + publishable key for the **dedicated Vapmart project**.

## Auth safety

All `/v1/member/*` and `/v1/digital-orders` endpoints use `CustomerGuard`; each order read is owner-scoped. Admin order/product permissions remain separate. Never expose Supabase service_role or Railway DB credentials in `NEXT_PUBLIC_*` variables.

## Migration

`apps/api/sql/003_membership_wallet.sql` and `004_promotions_gamification.sql` are registered in the migration checksum ledger. Railway API service has a `preDeployCommand` that runs migrations on the **staging** database. Schema is additive and does not alter existing `product.orders` checkout gate.

Wallet fields use integer Coin, not floating-point. `wallet.ledger_entries` has a unique `(order_id,entry_type)` constraint, and provider events have unique `event_id`. Never directly trust client-declared balances.

## Pending external configuration

1. Confirm which Supabase organization will host a dedicated Vapmart Auth project. Do **not** borrow Pentagon or Tradevice identity projects.
2. Set correctly scoped public Auth variables on web and URL/publishable key on API.
3. Add licensed gateway integration and legal review before enabling real IDR payments.
4. Test sandbox with signed callbacks, duplicate event delivery, failed and expired orders, zero-leak cross-account access, and full ledger reconciliation.
5. Keep physical `POST /v1/orders` returning 503 until separately authorized.
