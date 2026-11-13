# Vapmart CP49 | Fix Jubelio AWB Label Printing
Date: 2026-11-13 (Asia/Jakarta)
Source: https://docs.google.com/document/d/1YeXzHILqtBlUqS9kW5bj7KNQTmtLvvU_als98SOa94A/edit
Branch: feat/vapmart-awb-label-print-20261113
Target: release/vapmart-stable

## User-documented symptoms (grounded in doc)
- "Airwaybill sudah di buat, tetapi belum bisa cetak airwabill di frontend"
- "Di sini juga tidak ada bisa cetak resi"
- "Status Alamat label Jubelio belum terverifikasi"
- "Ini untuk no order terlalu panjang di dasbord jubelio"
- "Di back admin tidak panjang agar kita tahu orderan mana di dasbord jubelio"

The shipment already exists. The priority is to retrieve and print the existing official label, not to create a second paid booking.

## Root cause in current code
- `JubelioDispatchService.label` validated an HTTPS signed `file_url` from authenticated Jubelio against only four old hostname suffixes: `jubelio.com`, `jubelio.store`, `amazonaws.com`, `cloudfront.net`.
- Legitimate signed storage domains outside that list were rejected as "Alamat label Jubelio belum terverifikasi."
- Both admin UIs exposed a two-click "get label then open" sequence, but Orders list/detail did not prominently say Print.
- New booked shipment references used `vapmart-` plus the entire batch UUID (44 characters), unlike the short order number shown in Vapmart.

## Changes implemented
1. Validate label URLs returned by authenticated Jubelio, allowing rotating public HTTPS CDN hostnames. Reject non-HTTPS, credentials, custom ports, fragments, malformed hostnames, literal IPs and local/private hostname suffixes. The server never follows or fetches the destination URL, so this cannot act as a server-side request forgery.
2. In Orders -> AWB dialog, clicking Cetak label AWB opens a viewer tab directly from the click, then navigates to the safe URL returned by the server. Signed URLs are fetched fresh per click and never stored in Vapmart database. If popup is blocked, an explicit link remains available.
3. Add visible print actions to Orders list/detail and Courier Ops; keep secure admin-only access. No label URLs are shown to customers.
4. Store a visible `provider_reference` alongside the AWB in the admin dialog so warehouse staff can cross-reference Jubelio.
5. For NEW bookings only, use `VM-{orderId first 8 hex}-{batchId first 12 hex}`, 24 characters total, stable and traceable to Vapmart's short order ID. Historical bookings retain their original `reference` in DB; readback/reconciliation supports both old and new formats. No migration or rewriting of old shipments.
6. No booking, cancellation, pickup, refund or payment gateway state is changed by clicking print.

## QA acceptance
- Unit: signed Google Cloud Storage, CDN and S3 URLs pass; localhost, IPs, non-HTTPS and injected links are blocked.
- Unit: new reference deterministic 24 characters; both old and new references accepted for provider readback.
- PostgreSQL integration: mocked provider books exactly once; returned label link is accepted; user-facing order overview displays the stored reference; ambiguous provider recovery still works.
- Web: Next.js production build and route compilation pass.
- Deploy API/web only after all CI checks pass and verify Railway health. No paid carrier calls in CI.
- An authenticated user must manually click an EXISTING booked order's print action for the final live end-to-end acceptance test; a build pass alone cannot establish label rendering at the provider URL.
