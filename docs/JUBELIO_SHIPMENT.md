# Jubelio Shipment integration

Vapmart uses the Jubelio Shipment API for destination regions and live shipping quotes. The client authenticates on the server using the new account credentials; secrets and access tokens are never returned to browsers. Token expiry and one 401 refresh are handled automatically.

## Active capabilities

- Authenticated destination lookup by postal code, with explicit kelurahan selection for ambiguous postcodes.
- Quotes calculated from live catalog prices, stock, gram weights, centimetre dimensions and quantities.
- Standard courier services; instant and same-day services are excluded until validated map coordinates are collected.
- Base tariff plus quoted insurance. Conditional promotions are excluded because promotion reservation/redemption is not implemented.
- Quotes expire after 15 minutes and belong to one verified customer, parcel, origin and destination. Checkout rejects other customers, changed dimensions/price/quantity, mismatched region/city/province, and expired quotes.
- Admin connection check and rate diagnostics. No real order or chargeable shipment is required to verify the connection.

## Server configuration

Set only on vapmart-api (never NEXT_PUBLIC variables):

| Variable | Meaning |
| --- | --- |
| SHIPPING_PROVIDER | jubelio |
| JUBELIO_SHIPMENT_CLIENT_ID | Account client ID; secret configuration |
| JUBELIO_SHIPMENT_CLIENT_SECRET | Account client secret; secret configuration |
| SHIPPING_RATE_LOOKUP_ENABLED | true |
| SHIPPING_ORIGIN_POSTAL_CODE | 10150 |
| JUBELIO_SHIPMENT_ORIGIN_AREA_ID | 3171011002 |
| SHIPPING_ORIGIN_LABEL | Vapmart · Cideng, Jakarta Pusat |

Migration 023 extends quote snapshots without changing existing order data. Migration checksums and the migration lock remain in use.

## Operational limits

Payment, chargeable AWB creation, pickup, courier cancellation and tracking webhooks remain inactive. Internal manifests/packing slips are not courier labels. This release does not call /shipments/create. The approved origin is one store location; split-origin fulfillment requires warehouse-specific quotes before carrier booking is implemented. To turn on dispatch later, integrate booking, idempotent shipment reconciliation, provider webhook authentication and label retrieval, and validate them together with the existing paid-order gate.

## Contract and verification

Contract verified from Jubelio’s published WordPress plugin v2.1.0: https://wordpress.org/plugins/jubelio-shipment/ and its official distribution at https://downloads.wordpress.org/plugin/jubelio-shipment.latest-stable.zip. Source was inspected, not executed or copied into this repository.

API host: https://api-shipment.jubelio.com

- POST /auth/webstore
- GET /regions?name=POSTCODE
- GET /courier-services/list
- POST /webstore/rates/all

Read-only account checks succeeded: authentication, 68 available courier services, origin/destination resolution, and 21 quotes for a 1 kg Cideng–Bandung parcel. These are point-in-time results, not a guarantee of courier availability.

Tests cover input validation, insurance totals, excluded promotions, redacted upstream errors, token refresh/cache, destination selection, dimensional fingerprints, database persistence and authenticated checkout. The GitHub workflow uses a disposable PostgreSQL service and mocked provider responses for database integration. It never loads live credentials or creates a real shipment.
