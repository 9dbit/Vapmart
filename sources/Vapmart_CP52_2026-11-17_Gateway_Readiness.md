# Vapmart CP52 | Payment Gateway Readiness (No Real Gateway Activated)
Date: 2026-11-17
Request: Google Doc "doc airwaybill" asks "Mulai kembangkan storefront dan konek payment gateway".
Source: https://docs.google.com/document/d/1YeXzHILqtBlUqS9kW5bj7KNQTmtLvvU_als98SOa94A/edit

## Audit result
- Railway `vapmart-api` staging exposes none of the usual Midtrans/Xendit/Duitku/Genesis payment credentials by environment variable name.
- Physical checkout has a working manual transfer draft and admin verification flow, but `CheckoutService.paymentSession()` explicitly returns `PAYMENT_PROVIDER_NOT_CONNECTED`.
- Previously the UI still let customer select QRIS, VA or e-wallet although no way existed to start a gateway session, producing unusable unpaid drafts.

## Implemented
- The provider-neutral readiness contract always reports `connected:false` until a gateway adapter, keys, signed callbacks and settlement tests are actually complete. A provider name in configuration alone can never imply a connected merchant.
- Physical checkout config and quotes advertise only the actually working `bank_transfer` method.
- QRIS, VA and e-wallet remain visible in checkout but cannot be selected. Backend rejects forged non-bank order drafts before touching the DB.
- Manual bank transfer still uses existing pending/approve flow with operator verification.
- A future webhook signature primitive is available with constant-time signature comparison and strict gross-amount matching, tested with tampering and wrong amounts.
- The code does not accept a webhook as paid, move funds, create charges or store fake payment tokens.

## Provider onboarding still required
1. Select the gateway provider and provide an authorized merchant sandbox account.
2. Configure server credentials securely and review the provider's API contract.
3. Add sandbox token/payment-session endpoint behind strict user/order authorization and idempotency.
4. Implement signed webhook validation, authoritative provider status readback, amount/currency checks, immutable audit and paid state transition.
5. Test duplicate callbacks, reconciliation, expiry, refunds, failed payments, and cross-customer access.
6. Activate real payments only after sandbox QA and explicit approval.

For a possible Midtrans adapter, official references:
- https://docs.midtrans.com/docs/snap-snap-integration-guide
- https://docs.midtrans.com/docs/https-notification-webhooks
- https://docs.midtrans.com/docs/get-status-api-requests

## QA / release
- CP52 branch workflow compiles API, runs all API unit tests and builds Next.js frontend.
- Existing checkout and payment routes remain non-chargeable for gateway methods.
- No production/sealed keys are read or changed by this checkpoint.
