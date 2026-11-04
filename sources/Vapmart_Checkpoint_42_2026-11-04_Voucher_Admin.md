# Vapmart Checkpoint 42 - Voucher Administration

Date: 4 November 2026, Asia/Jakarta.

## Release identity

- Verified application commit: `6eadbd6dade9967628f7d310712cdd79a2c5592a`
- Work branch: `work/cp42-voucher-admin-domain-20261104`
- Release branch: `release/vapmart-stable`
- GitHub Actions run: `41827198130`
- Verification result: SUCCESS
- Verification artifact: `13321115044`
- Artifact digest: `sha256:392504658886276651df8c19ccc17428e12e3b99cd4ba645b78e9c205425a3b7`

## Voucher administration shipped

A dedicated `Voucher & Promo` workspace is now part of the Vapmart admin navigation.

Admin capabilities:
- create vouchers;
- edit vouchers;
- activate or deactivate vouchers;
- search and filter by lifecycle status;
- fixed IDR or percentage discounts;
- minimum-spend rule;
- optional maximum discount for percentage vouchers;
- optional start and end schedule;
- optional usage limit;
- paid-redemption counter;
- pending-order counter;
- desktop and mobile responsive UI.

Voucher lifecycle labels:
- Active;
- Scheduled;
- Expired;
- Inactive.

## Backend controls

New service: `VoucherAdminService`.

Admin endpoints:
- `GET /v1/admin/catalog/vouchers`
- `GET /v1/admin/catalog/vouchers/:id`
- `POST /v1/admin/catalog/vouchers`
- `PATCH /v1/admin/catalog/vouchers/:id`

Controls include:
- server-side validation;
- uppercase canonical voucher codes;
- duplicate-code conflict handling;
- optimistic concurrency using `edit_version`;
- row locking during updates;
- audit records for create, update, activate and deactivate operations;
- guarded admin access through the existing catalog-admin authentication layer.

No production voucher was seeded by the release.

## Migration 020

New additive migration:
- `apps/api/sql/020_voucher_admin.sql`

It adds:
- `product.vouchers.edit_version`;
- `product.vouchers.updated_by`;
- voucher updated-time index;
- voucher schedule index.

It does not reset, delete, or seed catalog, order, inventory or voucher business data.

## Verification

Exact commit `6eadbd6dade9967628f7d310712cdd79a2c5592a` passed:
- runtime safety gates;
- API clean build and unit tests;
- migration 020 twice on disposable PostgreSQL;
- CP40 private-draft and database guards;
- CP41 checkout-conversion regression;
- CP42 voucher-admin integration;
- duplicate voucher-code guard;
- stale edit-version conflict guard;
- audit trail verification;
- proof that voucher administration creates no additional orders or payment captures;
- catalog regression;
- integrity regression;
- warehouse and fulfillment regression;
- courier regression;
- Hero Banner regression;
- Web production build;
- CP39 browser lifecycle;
- CP40 browser lifecycle;
- CP41 browser lifecycle;
- CP42 voucher-admin desktop/mobile lifecycle.

All mutating acceptance tests used disposable loopback PostgreSQL and fixture identities, not production business records.

## Railway deployment

Project: `7c01e4d8-6152-4f04-9750-6e7031aa0830`
Environment: `04586a07-99b0-4cfd-95fa-bb6d8f1719e3`

- API deployment: `0572e54b-65e9-4567-bbaa-51ee1cea8021` - SUCCESS
- Web deployment: `cb66a86e-47f1-4c24-962c-1bc65cd07355` - SUCCESS
- API source commit: `6eadbd6dade9967628f7d310712cdd79a2c5592a`
- Web source commit: `6eadbd6dade9967628f7d310712cdd79a2c5592a`
- Post-release environment: Web, API and PostgreSQL online; one running replica per service; zero crashed replicas; no recent failed deployments.

## Safety state

- Payment gateway remains disabled.
- Voucher administration never marks an order paid.
- No payment capture or wallet debit was introduced.
- Courier booking remains disabled.
- Shipping-provider webhook activation remains disabled.
- No production voucher was automatically created.

## Domain status

### www.vapmart.id
- Ownership verified.
- TLS certificate valid.
- DNS propagated.
- CNAME target: `29sdkagc.up.railway.app`.

### vapmart.id apex
- Ownership verified.
- TLS certificate valid.
- Railway still reports `DNS_RECORD_STATUS_REQUIRES_UPDATE`.
- Required root DNS target: `lta5rlv1.up.railway.app`.
- Expected record from Railway: apex/root CNAME to `lta5rlv1.up.railway.app`.

The current ChatGPT session is running from iOS and does not have an originating connected browser context for Hostinger DNS mutation. The installed Hostinger connector is mail-only and exposes no DNS-management capability. Therefore the apex record was not modified in this checkpoint.

## Operator paths

- Voucher & Promo: `/admin/vouchers`
- Products: `/admin/products`
- Orders: `/admin/orders`
- Checkout: `/checkout`
- Customer orders: `/pesanan`
