# Vapmart Checkpoint 36 | Courier & Order Automation

Date: 2026-11-02 (Asia/Jakarta)
Project: Vapmart / 9dbit/Vapmart
Branch: `feat/ecommerce-foundation-20261029`
Target: https://vapmart.id/admin and https://vapmart.id/brand/login

**Release mode:** Courier workflow foundation / internal packaging / provider webhook verification / verified return processing. **Live payment collection OFF, Biteship booking OFF, automated courier pickup OFF, automated refunds OFF, external returns booking OFF.**

## What CP36 delivers

### PostgreSQL migration 013 (append-only, checksummed)
File: `apps/api/sql/013_courier_orchestration.sql`

- `product.courier_manifests` and `product.courier_manifest_items`: one internal package/manifest per fulfillment batch, stored weights, items, operator and pickup plan. Unique request key and batch constraints make retries idempotent.
- `product.courier_tracking_events`: provider event audit with normalized type, status, official waybill, observed price correction, and whether the event was applied. Unique `shipment_id,event_hash` denies duplicate event effects.
- `product.courier_returns`, `product.courier_return_events`: customer-owned RMA, admin review, physical receiving and idempotent restock ledger. **No automatic reimbursement**.
- Warehouse pickup contact name and phone are optional metadata until verified.
- Shipment extensions for provider tracking ID, provider status, status rank, tracking URL (not automatically populated), actual courier fee metadata (not automatically charged).
- `fulfillment_batches.carrier_handover_at`: physical handover is recorded exactly once when verified provider status confirms pickup.
- All tables remain private PostgreSQL; no public or anonymous SQL access granted.

### Internal package preparation
- Admin `Courier Ops` tab displays per-brand/per-warehouse parcel batches, internal readiness blockers, weight and SKU counts.
- `POST /v1/admin/courier/batches/:batchId/manifest` saves a manifest only when a verified paid order is in `ready_for_carrier`. It requires an idempotency UUID, operator notes and optional internal pickup/drop-off plan.
- **Internal packing slip** is available via protected `GET /v1/admin/courier/batches/:batchId/packing-slip`. It includes sender and recipient details for staff and is print-safe. It is NOT a courier shipping label and does NOT contain a fabricated AWB.
- `POST /v1/admin/courier/batches/:batchId/book` **always returns 503** with `COURIER_BOOKING_DISABLED`. Preparing an internal pickup plan never creates a courier order or charges a provider balance.
- Pure `buildBiteshipOrderPayload` maps verified server-owned recipient, warehouse contact/address, shipping service and SKU dimensions to Biteship's documented order schema. It does not perform network calls. External booking needs separate explicit approval and provider credential onboarding.
- Readiness refuses missing verified payment, incomplete address, unknown weight/dimensions, unquoted shipping service, wrong warehouse-origin postcode, and mixed-brand/multi-warehouse checkout based on one global quote. There is no silent use of the CP34 single-origin quote for split shipments.

### Trusted Biteship webhooks
- Supported event types: `order.status`, `order.waybill_id`, `order.price`.
- API `POST /v1/webhooks/biteship` and public-domain relay `POST https://vapmart.id/api/webhooks/biteship` preserve raw body bytes.
- Biteship config supports a configurable **shared-secret HTTP header**, not a body HMAC signature. The API validates configured secret using constant-time comparison and fails closed when `BITESHIP_WEBHOOK_ENABLED` is not `true`. The public web relay only forwards the fixed `x-vapmart-biteship-secret` header to the internal API. Production must configure this exact header key in the Biteship dashboard.
- No arbitrary shipment is created from a webhook. Only `product.shipments` whose `provider_shipment_id` matches an already registered provider order may advance.
- Duplicate payloads are deduplicated by event content hash. Stale state updates cannot overwrite the shipment state or a newer AWB.
- An authenticated provider `picked` event (or later physical transit event) on a verified paid, ready batch atomically subtracts reserved and on-hand inventory **exactly once** and records an immutable warehouse ledger event.
- Official AWB comes from provider events, never an admin textbox.
- `order.price` is saved for reconciliation only: it cannot change the customer's order total, payment status, coin wallet or wallet balance.
- Provider `delivered` is distinct from internal `ready_for_carrier`, and only verified provider status can unlock customer return requests.
- No webhook key or provider API key is committed to GitHub. The webhook stays disabled until provisioned/approved.

### RMA and returns
- Authenticated customer can request a return for **their own provider-delivered shipment**; requests for draft/non-delivered/other-customer orders are rejected.
- Admin can approve/reject with evidence notes, then record physical receipt at an active non-hold warehouse. Receiving does not automatically increase saleable stock.
- An explicit later restock action requires inspection evidence and idempotency key; it adds physical stock once using the CP35 warehouse ledger.
- Nothing in RMA calls Biteship's reverse-shipment API, creates a refund, or updates financial balances.
- Returns continue to be **manual/internal** until Biteship API plan eligibility, return labels and payment refund workflows are separately verified.

### Screens / access
- `/admin`: **Courier Ops** tab, manifests, pickup plan, packing slip, real tracking audit, manual returns processing.
- `/brand`: brand-scoped fulfillment list now includes verified courier status and AWB, but never customer contact/address data.
- `/pesanan/:id`: customer sees internal steps separately from real courier events, official waybill when available, and a return request form only after provider-delivered confirmation.
- Warehouse creation/edit includes contact name and phone for future pickup support.
- All admin operations are protected by Supabase administrator authorization; all customer and partner operations verify ownership/membership in backend SQL. Viewer role cannot mutate fulfillment.

## API surface
Admin:
- `GET /v1/admin/courier/config`
- `GET /v1/admin/courier/batches`
- `GET /v1/admin/courier/batches/:batchId/preview`
- `POST /v1/admin/courier/batches/:batchId/manifest`
- `GET /v1/admin/courier/batches/:batchId/packing-slip`
- `GET /v1/admin/courier/batches/:batchId/events`
- `POST /v1/admin/courier/batches/:batchId/book` (hard-disabled: 503)
- `GET /v1/admin/courier-returns`
- `POST /v1/admin/courier-returns/:id/review`
- `POST /v1/admin/courier-returns/:id/receive`
- `POST /v1/admin/courier-returns/:id/restock`
- `GET /v1/admin/courier-returns/:id/timeline`

Customer:
- `GET,POST /v1/customer-returns`
- `GET /v1/customer-courier/orders/:orderId`
Webhook:
- `POST /v1/webhooks/biteship` (secret header, disabled by default)

Every protected API also has a Next.js route proxy on vapmart.id.

## CI and security checks
- Standard API unit tests validate provider payloads, webhook authorization, internal manifest validation, charge prevention and pure order request mapping.
- `.github/workflows/warehouse-fulfillment-integration.yml` now runs `test/integration/courier-orchestration.ts` in a disposable **localhost PostgreSQL 16** alongside CP35 tests.
- CI builds a fake provider shipment solely in temporary test DB; it never calls Biteship, sends a customer message or modifies Railway production data.
- Integration verifies: no provider shipment from manifest, disabled booking, denied unsigned webhook, physical pickup inventory debit, duplicate event replay, monotonic status, official AWB, carrier price audit without customer charges, customer ownership, RMA review/receipt and exactly-once restock without financial refund.
- Staging HTTP smoke adds CP36 admin/customer API access restrictions and rejection of unsigned webhook requests.
- **Final deployment status and exact GitHub Actions pass/fail must be verified after the checkpoint commit.** Do not claim fully live provider shipping or actual API booking.

## Provider onboarding (requires separate approval)
1. Verify real warehouse dispatch contact, pickup phone, address, postal code, true SKU weights/dimensions.
2. Add separate per-batch/per-origin shipping quotes for split-brand/multi-warehouse carts. The CP34 single-origin quote is not accepted for external booking of multi-origin orders.
3. Obtain a Biteship sandbox API key and review API quotas/possible charges. Do not enable without authorization.
4. In Biteship webhook settings, configure HTTPS endpoint `https://vapmart.id/api/webhooks/biteship` with **Headers Signature Key** `x-vapmart-biteship-secret` and a new long random secret. Configure the identical secret on **Railway vapmart-api only**, with `BITESHIP_WEBHOOK_HEADER_NAME` set to the header name and `BITESHIP_WEBHOOK_ENABLED=true` only after an authorized test plan. Do not paste the secret into chat, screenshots, or GitHub.
5. Verify webhook deliveries and replay behavior in Biteship event logs. This is header-secret validation, not cryptographic HMAC signed payload verification.
6. Confirm Biteship account plan/entitlement for Shipping Label API and reverse Returns API. Do not claim these are available on the current plan without checking.
7. Implement external booking executor under double opt-in with vendor response deduplication, reference_id-based reconciliation, provider request retry protections and quota budget. This executor is intentionally absent/disabled in CP36.
8. Set up signed payment provider webhooks and reconciliation before any real order is paid/charged or courier booking occurs.

## Provider reference
- Biteship Orders API: https://biteship.com/id/docs/api/orders/overview
- Biteship Create Order: https://biteship.com/en/docs/api/orders/create
- Biteship Webhook overview: https://biteship.com/en/docs/api/webhook/overview
- Webhook header configuration: https://help.biteship.com/hc/id/articles/58382023618329-Panduan-Lengkap-Mengenal-Webhook-Biteship
- Biteship Returns: https://biteship.com/en/docs/api/returns/overview
- Plan entitlements: https://biteship.com/en/docs/plans

## Suggested CP37
Payment gateway signed callbacks/reconciliation + per-warehouse rate quoting and explicit, budgeted sandbox booking orchestration. Provider-created AWB and labels can only be activated after account entitlement, configuration, legal/commercial review and owner consent.

Safety: No changes to Pentagon, Tradevice, unrelated Supabase projects, Hostinger DNS, MX records, email or payment secrets.
