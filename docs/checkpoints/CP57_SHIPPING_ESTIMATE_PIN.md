# CP57 — Shipping estimate and Google Maps pin

An anonymous checkout previously never called the shipping API: the rate effect
required an access token, while the summary continued to show “Menunggu estimasi”.

- Public `/v1/shipping/estimate` validates the live catalog and destination before
  requesting provider tariffs. It does not create owned quotes, orders or bookings.
- Login still produces the existing customer-owned, 15-minute checkout quotes.
  Guest estimates are rechecked after login. Provider calls are cached for 30 seconds
  by parcel/destination and bounded to six concurrent calls / 120 new calls per minute.
- Checkout clears stale tariffs when the basket, region or confirmed pin changes.
  Loading, missing destination, unavailable tariffs and provider errors have distinct states.
- A Google Maps pin can be supplied by explicit coordinates, a Maps point/share link,
  or permission-granted device GPS. Customers preview and confirm the point.
  Camera-centre coordinates alone are deliberately rejected.
- The pin is stored on the authenticated quote and order, shown in customer/admin order
  details, invoice revisions and packing slips, and forwarded to Jubelio shipment data.
- Instant / Same Day requires both confirmed destination and warehouse pins, an enabled
  courier service, and a tariff returned by Jubelio. There is no fabricated fallback tariff.
- Admin → Shipping → Pin pickup gudang stores the exact pickup point against the active
  origin area and postcode. An area centroid must not substitute for the warehouse door.
- Booking claim and provider-result persistence use the same per-batch transaction
  lock to prevent concurrent-click deadlocks while retaining exactly-once creation.
- Altered destination pins invalidate quotes. Changed pickup pins invalidate Instant
  quotes. Existing postal orders and regular courier booking remain compatible.

## Validation

- API and Next.js production builds; web type check.
- 116 unit tests, including map parsing, redirect allowlisting and pin binding.
- PostgreSQL 16: all 34 migrations applied twice, conversion and address regression,
  anonymous quote cache/no persistence, pin-bound order/invoice, dispatch/packing-slip
  coordinates, idempotent booking and tracking/stock regression using provider fixtures.
- CI: `.github/workflows/cp57-shipping-estimate-pin.yml`.

No real shipment, pickup or payment is created by this verification.
