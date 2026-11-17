# Vapmart CP53 | Xendit Payments API Sandbox Foundation
Date: 17 November 2026 (Asia/Jakarta)
Repository: https://github.com/9dbit/Vapmart
Branch: feat/vapmart-cp53-xendit-sandbox-foundation-20261117
Environment: Railway staging, domain vapmart.id

## Request and current findings
The Vapmart operator confirms that their business already has a Xendit merchant account. The requested work is to prepare a mature Xendit integration based on Xendit's CURRENT API docs, prior to connecting and activating a merchant account.

Railway `vapmart-api` staging currently exposes NO XENDIT_* variable names. No merchant account connection, live payment or sandbox charge was performed.

Official docs checked (API docs updated November 11, 2026):
- Hosted Payments / one-time payment: https://docs.xendit.co/docs/payment-1
- Create Session POST /sessions: https://docs.xendit.co/apidocs/create-session
- Retrieve Session GET /sessions/{session_id}: https://docs.xendit.co/apidocs/get-session
- Session completed/expired callbacks: https://docs.xendit.co/apidocs/webhook-notification-sent-defined-webhook-url-updates-payment-session
- Notification authenticity: https://docs.xendit.co/docs/handling-webhooks
- Pre-integration setup: https://docs.xendit.co/docs/payments-integration-setup
- Payment capture webhooks: https://docs.xendit.co/docs/payments-api-webhooks
- Refund API v3: https://docs.xendit.co/apidocs/create-a-refund

## Architecture selected
- Use Xendit **Payment Sessions**, `session_type=PAY`, `mode=PAYMENT_LINK`, `currency=IDR`, `country=ID`, `capture_method=AUTOMATIC`.
- Xendit's hosted checkout handles sensitive payment details. Vapmart should NEVER handle card/VA credentials directly.
- Server-side create: POST `https://api.xendit.co/sessions` with BASIC AUTH (secret API key as username, empty password). Never expose a secret in Next.js or a browser.
- Provider response includes `payment_session_id`, `payment_link_url`, `business_id`, status, provider payment references and `expires_at`.
- Return URLs: `https://vapmart-web-staging.up.railway.app/pesanan/{orderId}?payment=return` (sandbox default). **Browser redirect is NOT proof of payment.**
- Xendit webhook events: `payment_session.completed`, `payment_session.expired`. Receive through `https://vapmart.id/api/webhooks/xendit/payment-sessions` (or staging hostname for sandbox). Next.js forwards the exact bytes and `x-callback-token` to NestJS.
- Token compared constant-time, business ID matched, session/reference/amount/currency validated. Private webhook inbox prevents duplicate processing and quarantines unexpected callbacks.
- Before any `paid` transition, retrieve authoritative provider session and validate status, amount IDR, reference, business ID, payment request and unique payment ID, then apply one idempotent DB transaction with audit trail. **CP53 intentionally does NOT mark orders paid**.
- Separate immutable Xendit session and webhook inbox tables in private `product` schema, migration `031_xendit_sandbox_foundation.sql`. No public DB write grants.

## Implemented in CP53
- `apps/api/src/xendit-sandbox.ts`: test-only Basic Auth transport, PAY request schema, safe test hosted URL validation, provider response parser, callback token and event validators.
- `apps/api/src/xendit-payment-sessions.ts`: customer-owned, verified-email, IDR-only session reservation and create behind opt-in sandbox flags. Unknown upstream outcomes lock the payment attempt to avoid double charges. Read-only provider reconciliation.
- `apps/api/src/xendit-webhook-inbox.ts`: authenticated callback inbox; deduplication/quarantine, no payment settlement.
- `apps/api/src/xendit-controllers.ts`: webhook receiver and admin-only readiness check.
- `GET/POST /v1/checkout/orders/:id/payment-session` requires customer authentication.
- `GET /v1/admin/payments/xendit/readiness` requires admin authentication.
- `POST /v1/webhooks/xendit/payment-sessions` is token-authenticated and does not accept customer bearer tokens.
- Next.js proxies at `/api/checkout/orders/:id/payment-session`, `/api/admin/payments/xendit/readiness` and `/api/webhooks/xendit/payment-sessions`.

## Secure Railway variables (API ONLY)
The operator must configure these in Railway's private API service Settings / Variables. **Never paste secrets into chat, docs, GitHub or public frontend env:**

| Variable | Intended value | Required for |
|---|---|---|
| `XENDIT_ENVIRONMENT` | `test` only | sandbox guard |
| `XENDIT_TEST_SECRET_KEY` | Xendit Test Mode secret API key, money-in permission | API calls |
| `XENDIT_BUSINESS_ID` | Merchant's Xendit business ID | merchant matching |
| `XENDIT_WEBHOOK_TOKEN` | Xendit dashboard callback verification token | callbacks |
| `XENDIT_RETURN_ORIGIN` | `https://vapmart-web-staging.up.railway.app` | return URL |
| `XENDIT_SANDBOX_ENABLED` | initially `false` | outbound session API |
| `XENDIT_WEBHOOK_ENABLED` | initially `false` | webhook inbox |
| `XENDIT_SANDBOX_ORDER_ENABLED` | initially `false` | customer session creation |

Do not set live credentials or production key. The source never enables live payments. CP52 continues advertising only the manually confirmed bank-transfer checkout method. The current storefront does not allow submitting Xendit-method orders yet, intentionally.

## Xendit merchant account onboarding
1. Confirm Xendit merchant entity and legal owner are approved for Vapmart's actual **accessories-only** catalog, and complete KYC/KYB.
2. In Xendit Test Mode, generate a separate limited MONEY-IN secret API key at Settings > Developers > API Keys.
3. In Dashboard > Webhooks, retrieve the callback verification token and register the **Payment Session** callback URL; use Test & Save.
4. Verify desired channel availability for Indonesian QRIS, Virtual Accounts and e-wallets. In Live Mode, activate channels explicitly under Payment Channels.
5. Configure test secrets in Railway private API. Ensure no credentials are exposed in a client bundle or logs. First activate sandbox flags only with a disposable test order after E2E checks pass.
6. Validate replays, duplicate callback attempts, concurrency, delayed callbacks, customer ownership, amount mismatch, merchant mismatch, unknown upstream timeouts, provider readback, return/cancel UX, expired sessions, and refunds (future).
7. CP54 will enable Xendit-method order drafts ONLY in sandbox and implement a verified, audited, idempotent `paid` state transition. Do not use real money until authorized release and real-money readiness signoff.

## Known deliberate limitation
Xendit Payment Sessions can create **a payment session**, not a server-confirmed settlement by themselves. Therefore CP53 quarantines callbacks and provides read-only reconciliation; it never updates `product.orders.payment_status` to `paid`. Manual bank-transfer approval remains separate and unchanged. Existing membership/coin payment flows also remain separate.

## QA gates
- API compilation and all unit tests including fake Xendit transport and event proofs.
- Additive migration runs twice safely in disposable PostgreSQL.
- Product order baseline and Xendit schema/inbox isolation integration tests.
- Next.js build and public webhook proxy route compilation.
- GitHub PR checks before merging to `release/vapmart-stable`, then Railway web/API health verification.
- No actual provider API calls or paid booking in CI. No changes to Xendit account or tokens from this workflow.
