# Vapmart Checkpoint 46 | Automatic Shipping Quotes & Courier Operations

Date: 2026-11-06 (Asia/Jakarta)  
Project: Vapmart / 9dbit/Vapmart  
Branch: `feat/vapmart-courier-checkout-20261106`  
Target branch: `release/vapmart-stable`

## Implemented in this branch

- Checkout requests live shipping rates automatically after a customer signs in, enters a valid five-digit destination postcode, and selects an exact Jubelio destination area when the postcode is ambiguous.
- A 350 ms debounce reduces unnecessary rate requests while the address is being typed. Previous requests are aborted when the address, destination area or cart changes.
- Courier services are presented in one compact solid-color selector instead of a long stack of option cards. The lowest live quote is selected by default; the customer can choose another available service.
- For live-rate checkout, the order summary does not substitute a fallback shipping amount while the provider quote is missing. The order cannot be submitted until a valid quote is selected.
- The shipping quote remains customer-, parcel-, origin- and destination-bound and expires after 15 minutes, as enforced by the existing API.
- Customer order receipts, admin order lists and order details expose the stored courier and service display names, with provider codes retained as a diagnostic fallback.
- Courier Ops displays the selected courier/service, quoted amount, AWB and tracking state. A compact readiness strip shows the configured provider, booking flag and webhook endpoint readiness.
- Courier manifest preview now returns the selected courier/service names and amount and reports the actual booking feature flag.
- A Sentral Cargo unit regression test verifies that display labels `Sentral Cargo` and `Regular` remain separate from provider codes `31` and `NEDLL`, and from the live provider service ID.

## Existing dispatch controls retained

- A real Jubelio booking still requires a verified-paid order, a packed `ready_for_carrier` fulfillment batch, a matching warehouse-specific quote and a prepared immediate-pickup manifest.
- The admin must explicitly review the current provider fee and confirm **Buat resi & minta pickup**.
- Booking attempts remain idempotent. Ambiguous outcomes stay locked for reconciliation and are never automatically re-posted to the carrier.
- The existing authenticated webhook handler treats callback data as a hint and re-reads authoritative shipment status from Jubelio.
- The existing integration test uses a mocked provider and disposable PostgreSQL. It does not create a real shipment, charge, pickup or customer notification. Its current dispatch fixture is not yet a Sentral Cargo end-to-end fixture; the new Sentral Cargo assertion is at the rate-normalization unit-test layer.

## Not changed

- Payment gateway activation, payment status, manual bank-transfer confirmation rules and order totals.
- Provider API credentials, webhook secrets, production data, store profile, domains, DNS, MX records or email.
- No database migration is required; the current quote table already stores courier/service names, provider codes and provider service IDs.

## Verification and deployment

- GitHub branch CI must run API build/tests and web build/tests after the pull request is opened.
- The existing Jubelio/PostgreSQL integration workflow is available for a separate run; this feature branch does not change that workflow's test credentials or trigger configuration.
- The Railway project currently exposes one environment named `staging`, attached to the Vapmart web and API services and the public custom domains. It is not a separately named Railway `production` environment.
- Do not claim a successful deployment until GitHub checks pass, the pull request is merged, Railway deployments are healthy, and public checkout/admin smoke checks pass.
- Webhook endpoint readiness in the UI does not prove that the callback has been registered in Jubelio Developer. Provider-side registration must be checked separately.
