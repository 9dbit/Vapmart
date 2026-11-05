# Jubelio resi, pickup and tracking

Admin flow: Courier → select a packed, paid fulfillment batch → prepare a manifest → Periksa tarif & pickup → review current fee → Buat resi & minta pickup. Booking uses the Jubelio account balance, not the customer's payment gateway. The confirmation shows the current estimate and warns that measured carrier fees can differ. Customer order totals are never changed by carrier fees.

This release supports one fulfillment batch from the configured origin postcode/area and an immediate pickup request. The origin postcode must resolve unambiguously to that area. It does not send a future internal pickup date to Jubelio, support instant/sameday without coordinates, or book split origins. Courier acceptance and arrival are confirmed through tracking; a booking is not proof of physical pickup.

## Deployment settings

- Existing `SHIPPING_PROVIDER=jubelio`, client ID/secret, origin postcode/area and rate lookup settings remain.
- `JUBELIO_BOOKING_ENABLED=true` enables the guarded admin booking endpoint.
- `SHIPPING_SENDER_EMAIL` defaults to the verified store mailbox `hello@vapmart.id`.
- `JUBELIO_WEBHOOK_ENABLED=true` and `JUBELIO_WEBHOOK_TOKEN` (at least 40 random characters) enable the callback.
- Register POST `https://<api-host>/v1/webhooks/jubelio/<opaque-token>` in Jubelio Developer → Webhook → Resi; subscribe to all shipment statuses. Treat this callback URL as confidential. Do not publish it in screenshots, tickets or reports.
- Leave checkout, digital commerce and payment gateway settings unchanged.

The callback uses an unguessable capability URL. It does not claim to validate an undocumented Jubelio HMAC: notification fields are only identifiers, and status/fees are retrieved again with the server's authenticated Jubelio API client. Unregistered shipments and test notifications are acknowledged without updating orders. Provider errors cause a non-2xx response so delivery can be retried. Admin can also refresh tracking manually.

## Failure recovery

An attempt is durably recorded before a chargeable POST, with an immutable reference `vapmart-<batch UUID>`. Concurrent clicks and client retries return this same attempt. A timeout or unverified response keeps booking locked. After 30 seconds, Periksa hasil booking searches for an exact reference and verifies provider details before attaching its AWB. It never issues another create request. If the provider has no matching record or multiple matches, operations must investigate in Jubelio; the system does not automatically unlock or charge again.

Booking creates a shipment, not an inventory deduction. Only authenticated provider pickup/delivery status consumes reserved stock, once. Duplicate and out-of-order events are audited, terminal delivery does not regress, cancellations cannot resurrect a shipment. Holds and issues appear in the event audit for review. Returns do not automatically refund or restock.

## Verification

The integration suite uses disposable PostgreSQL and a mocked provider; no real shipment, pickup, charge or customer notification is created. It covers paid/packing gates, refreshed fees, simultaneous booking, ambiguous result recovery, secret validation, forged notification status, unknown shipment, duplicate/stale events, exactly-once stock, cancellation, customer ownership, and label URL checks. Existing checkout and Biteship orchestration regressions remain in CI. Migration 024 is applied twice to check the migration runner's idempotency.

Live verification uses the provider's Test Webhook, health endpoints and the admin UI. A real shipment remains an operational action by an admin against an actual paid order.
