# Vapmart CP48: Direct Airwaybill from Orders
Date: 2026-11-12 (Asia/Jakarta)
Repo: 9dbit/Vapmart
Branch: feat/vapmart-order-awb-modal-20261112
Target: release/vapmart-stable

## Requested source
User uploaded `doc airwaybill.docx` with screenshots (3 pages): clicking Dapatkan Airwaybill currently navigates to Courier Ops with no actionable focus; the order's fulfillment batch is still Reserved, and booking blockers prevent label issuance. The user wants WooCommerce-like order-side AWB request, print, and courier tracking.

## Implementation
- Read-only, admin-authenticated `GET /v1/admin/courier/orders/:orderId` returns complete order-specific batch, manifest, booking, AWB and tracking states. Unlike global Courier Ops, it does not use the latest 200 batches to find one order.
- Orders list and order detail now launch `OrderAirwaybillDialog` instead of redirecting to Courier Ops. Existing invoice and payment operations remain unchanged.
- Modal displays payment verification and provider booking readiness, and clearly explains blockers.
- Explicit reserve, picking, packed, ready-for-carrier and manifest operations are available with operator notes and confirmation, using the existing guarded backend endpoints. No physical state change or stock reservation happens merely by opening the dialog.
- Admin explicitly requests current Jubelio booking preview; only if it passes the provider read, origin, weight, dimension, destination, manifest, payment and stock checks may a booking confirmation be offered.
- The confirm button displays the quoted IDR fee and warns that a real courier pickup and charge can follow. Booking POST has an idempotency key that is retained after uncertain responses; existing backend reconciliation prevents duplicates.
- Booked shipments show official AWB, the latest verified provider state, manual refresh/sync, and secure provider label retrieval with a print/view link.
- More than one fulfillment batch renders separately. Backend split-origin rate blockers remain enforced; no fabricated quote or double booking.
- Existing signed webhook/verified provider reads remain the authoritative source of delivered/cancelled statuses. No manual editing of carrier status.

## Validation and release safety
- CP48 API build, unit tests, idempotent migration, disposable PostgreSQL integration and web build must pass.
- PostgreSQL dispatch test verifies order-scoped AWB before/after a mocked Jubelio booking; no real courier shipment, payment or pickup in CI.
- Release only after GitHub checks green and Railway API/web deployment healthy.
- Production Jubelio configuration may be present as environment variable names but actual activation and provider account balance cannot be asserted without authenticated operational checks.
- There is no claim that a real AWB was issued for the user's screenshot order. It is explicitly blocked until fulfillment and provider prerequisites are satisfied.
