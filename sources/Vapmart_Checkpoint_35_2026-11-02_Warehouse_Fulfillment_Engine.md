# Vapmart Checkpoint 35 | Warehouse & Fulfillment Engine

Date: 2026-11-02 (Asia/Jakarta)
Repository: https://github.com/9dbit/Vapmart
Branch: `feat/ecommerce-foundation-20261029`
Project/Environment: Railway Vapmart / staging (custom domain `vapmart.id`)
Target: Multi-warehouse stock by physical location, safe reservations, fulfillment batches per brand and internal shipment lifecycle.
**Payment collection, courier booking and external tracking OFF**.

## Implementation summary

### 1. PostgreSQL migration 012
`apps/api/sql/012_warehouse_fulfillment.sql` is an additive, migration-checksummed change applied through the trusted Railway predeploy migration runner.

Tables introduced:
- `product.warehouses`: physical location and dispatch eligibility, with mandatory verified address and postal-code shape before dispatch.
- `product.warehouse_stock`: product + warehouse on-hand, reserved, available.
- `product.warehouse_stock_events`: transaction-linked, immutable before/after stock movements with actor and idempotency.
- `product.warehouse_transfers`: physical location-to-location transfer records.
- `product.fulfillment_preparations`: per-order unique idempotency control.
- `product.fulfillment_batches`: per-order, per-brand, per-warehouse fulfillment.
- `product.fulfillment_lines`: SKU quantities and the order line being fulfilled.
- `product.fulfillment_tracking_events`: internal warehouse state timeline.
- Order-item `brand_id` snapshot, for stable brand ownership during fulfillment.
- Optional shipment-to-batch FK to support future tracking without booking a shipment now.

**Legacy stock treatment:** prior non-DEMO on-hand quantities are copied into `LEGACY-HOLD`, an immutable non-dispatchable virtual warehouse. Those balances are **not destroyed** or treated as verified dispatch stock. `product.products.stock_qty` is recalculated from verified, active, dispatch-enabled warehouse available balances only. This means previously displayed stock may become **0 available** until checked and transferred to a physical warehouse. This is intentional fail-closed behavior and must be disclosed to operators.

### 2. Stock and warehouse operations
- Admin-only location creation, address updates and explicit dispatch toggling.
- Strong validation for code, address, city, province and five-digit postal code.
- Row-locked PostgreSQL transactions plus a shared advisory lock for CP35 inventory writes.
- Receipt, adjustment, returns, and physical transfer, all with audit notes.
- Transfer debits unreserved stock in source and credits destination within the same transaction; cannot manufacture total stock.
- Stock event and transfer idempotency prevents retried requests from doubling quantities.
- Global Product & SKU edit no longer accepts stock quantity changes. New products are created with stock 0; stock is received into physical warehouses.
- Dispatch deactivation is blocked while an affected warehouse has outstanding reservations.
- No hidden auto-seeding of warehouse addresses, brand owners, product inventory or sample shipments.

### 3. Fulfillment safety and lifecycle
- Admin order plan shows real by-location availability and missing brand assignment.
- Reserving stock requires `orders.status='paid'`, `payment_status='paid'`, non-empty payment provider and payment reference. A draft order or unverified payment cannot reserve stock.
- The server locks the order and inventory, splits lines into brand + warehouse batches, increments reserved counts and decrements saleable availability atomically.
- If any SKU is short, all partial allocations roll back. Replaying the same preparation key returns the original batches.
- Internal status progression is `reserved -> picking -> packed -> ready_for_carrier` only. No manual shipped, delivered, paid, tracking number or provider booking status.
- A refunded, cancelled order with an unpicked batch can release the reservation exactly once, restoring availability.
- Internal status changes after payment cancellation/refund are blocked.
- `product.shipments` remains empty for a new batch until a separate verified carrier booking implementation exists.

### 4. Control Panel and partner/customer access
- Admin `/admin` adds **Gudang & Stok** and **Fulfillment** tabs, responsive balance cards, per-location tables, warehouses and address maintenance, receipts/adjustments, transfer tools, order plans and internal timelines.
- Brand partner `/brand`: stock, sales and per-warehouse balances remain read-only and scoped to the authenticated user's assigned brand. For internal fulfillment only, assigned **owner/manager** may advance their own reserved batches through picking, packed and ready-for-carrier using an audit note. **Viewer** remains read-only. No customer contact/address data.
- Customer order `/pesanan/:id`: internal fulfillment activity for owned orders only; courier AWB and external tracking remain explicitly unavailable.
- All mutation endpoints require Supabase admin authorization. Brand and customer read endpoints enforce server-side ownership, not UI filtering.

### 5. Endpoint reference
Admin:
- `GET /v1/admin/warehouses`
- `POST /v1/admin/warehouses`
- `PATCH /v1/admin/warehouses/:warehouseId`
- `POST /v1/admin/warehouses/stock/adjust`
- `POST /v1/admin/warehouses/stock/transfer`
- `GET /v1/admin/warehouses/:warehouseId/stock/:productId/events`
- `GET /v1/admin/fulfillment/batches`
- `GET /v1/admin/fulfillment/orders/:orderId/plan`
- `POST /v1/admin/fulfillment/orders/:orderId/prepare`
- `GET /v1/admin/fulfillment/batches/:batchId/timeline`
- `POST /v1/admin/fulfillment/batches/:batchId/state`
- `POST /v1/admin/fulfillment/batches/:batchId/release`

Partner and customer:
- `GET /v1/brand-portal/:brandId/warehouses`
- `GET /v1/brand-portal/:brandId/fulfillment`
- `POST /v1/brand-portal/:brandId/fulfillment/:batchId/state` (Owner/Manager only; checks membership inside a transaction and brand match on batch)
- `GET /v1/customer-fulfillment/orders/:orderId/tracking`

Next.js API bridges exist for all endpoints. Return `401` without authorization.

## QA
- Foundation checks: API and Web builds, catalog audit.
- Existing staging smoke, browser UI smoke, theme, dependency security, coin wallet integration remain in place.
- New **Warehouse & Fulfillment PostgreSQL Integration** workflow uses an ephemeral Postgres 16 service (`127.0.0.1`, disposable DB and password) with payment and courier rate lookup disabled. No production data or keys are used.
- CI performs migrations twice to verify migration idempotency.
- Integration checks physical receipt and transfer conservation, inventory cache, dispatch readiness, reservations only after fixture-verified paid order, atomic insufficient-stock rollback, prepare idempotency, warehouse deactivation guard, unauthorized brand scope, viewer denial and manager-only brand-scoped state changes, owned customer tracking, immutable event ordering, internal state progression, release after refunded cancellation, and absence of courier shipments.
- Workflow: https://github.com/9dbit/Vapmart/actions/workflows/warehouse-fulfillment-integration.yml
- At authoring time new integration workflow and Foundation checks PASS, Railway API deployment SUCCESS; final frontend Railway verification must be checked separately before declaring full live release.
- Real-user end-to-end warehouse receipt, shipping quote, payment confirmation, or provider shipment tracking is **not** claimed.

## Operations: first warehouse onboarding
1. Login at https://vapmart.id/admin using the verified Supabase administrator.
2. Add a legitimate brand and new SKU (initial stock always 0).
3. In **Gudang & Stok**, create a warehouse with real address and postal code. Initially Dispatch OFF.
4. Perform a physical count. For imported legacy stock, transfer the confirmed amount out of LEGACY-HOLD into the actual warehouse with audit reference. For new physical purchases, record receipt into the actual warehouse.
5. Confirm on-hand, reserved and available totals, then intentionally enable Dispatch.
6. Brand members can then review their own inventory at https://vapmart.id/brand/login.
7. Draft orders never reserve; do not activate payments or courier bookings without provider integration, signed webhooks, reconciliation, shipping costs, returns/refunds, concurrency QA, security review and explicit owner approval.

## CP36 / Pending
- Signed payment gateway/webhook + reconciliation and payment-to-reservation orchestration. All payment switches currently OFF.
- Carrier API credential onboarding, live rate resolution per warehouse origin, separate multi-brand shipments, pickup/label/AWB booking, carrier webhook signature verification, tracking updates and RTO/returns. Provider API calls may involve quota/billing; require separate approval.
- Handling on-hand decrement on confirmed carrier handover, partial dispatch, refunds and returns; inventory stocktake/transfer approval workflows.
- Warehouse per-SKU ABC reporting, minimum-stock replenishment, backorder alerts, pagination and CSV exports.
- Test live with two authorized partner users and a verified test carrier account before production commerce activation.

Safety: no changes to Pentagon, Tradevice, DNS, email, Supabase organizations, or payment gateway secrets.
