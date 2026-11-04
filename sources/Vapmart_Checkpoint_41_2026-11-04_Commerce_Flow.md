# Vapmart Checkpoint 41 - Commerce Flow Upgrade

Date: 4 November 2026, Asia/Jakarta.

## Release identity

- Runtime application commit: `9d8a7d3b99d027c356959ee112ccb5627b611058`
- Verified work branch: `work/cp41-commerce-flow-20261104`
- Release branch was fast-forwarded from `10bc9335cf65559cfdf13b847b1877edd9e1a1e3` to the verified runtime commit before deployment.
- GitHub Actions verification run: `41823626800`
- Verification conclusion: SUCCESS
- Verification artifact: `13318476301`, digest `sha256:cf04bbc23529c536f50f91266a44664699b8ae0b2dae15b5f852636b33cacdbd`

## Source review implemented

The upgrade follows the 4 November product-review notes:
- physical stock adjustment notes are optional;
- active/inactive variant identity is explicit;
- each variant exposes its own SKU, price, sale price, image and warehouse stock;
- product detail has clear cart and buy-now calls to action;
- checkout can apply an available voucher;
- checkout displays shipping estimation;
- manual Bank Transfer can create a testable pending-payment order without a payment gateway;
- the resulting order is visible in the admin order dashboard.

## Engine changes

### Product and variant editor
- Physical weight/dimensions are labelled optional.
- Variants inherit parent dimensions when their override is blank.
- Each variant card shows AKTIF/NONAKTIF, options, SKU, price and stock summary.
- Stock adjustment notes can be left blank; the backend writes an automatic audit note while keeping operator/time/ledger history.

### Storefront CTA
- Product detail exposes two primary actions: Tambahkan ke keranjang and Beli sekarang.
- Buy now adds the selected simple/variant SKU to cart and routes to checkout.
- Zero-priced or unavailable items do not become free purchases; transactional CTA remains disabled when the effective product cannot be purchased.

### Voucher
- Migration 019 adds `product.vouchers` and order voucher/discount fields.
- Voucher calculation is server-side and supports fixed or percentage discount, minimum subtotal, optional maximum discount, schedule and usage limit.
- No production voucher was seeded by this release.
- Checkout displays applied voucher discount in the order summary.

### Shipping estimate
- Checkout copy and controls expose shipping estimation before order creation.
- Existing shipping engine is preserved.
- Live courier booking and provider webhook activation remain disabled.

### Manual Bank Transfer test flow
- `bank_transfer` is an accepted order payment method.
- It creates a draft order with `payment_status='pending'`.
- No payment provider/reference is created.
- No bank account/instructions are emitted by the test flow.
- It never marks payment as paid automatically.
- Admin and customer order detail display the pending bank-transfer state.

## Database

Migration added:
- `apps/api/sql/019_checkout_conversion.sql`

Runtime migration list now includes 019. Railway API pre-deploy command remains `npm run migrate`. Migration 019 is additive: it creates the voucher table, adds order discount/voucher columns, and expands the order payment-method constraint. It does not reset existing products, prices, inventory or orders.

## Verification

Exact commit `9d8a7d3b99d027c356959ee112ccb5627b611058` passed:
- runtime safety flag gate;
- clean API build and unit tests;
- migration twice on disposable PostgreSQL;
- CP40 private-draft tests;
- CP41 voucher / manual bank-transfer / admin-dashboard integration;
- catalog, integrity, warehouse, fulfillment, courier and Hero Banner regressions;
- Web production build;
- CP39 browser lifecycle;
- CP40 browser lifecycle;
- CP41 browser lifecycle including desktop/mobile CTA, checkout and variant-state visibility.

All mutating CI tests use disposable loopback PostgreSQL and synthetic fixture identities. They are not production business writes.

## Railway deployment

Project: `7c01e4d8-6152-4f04-9750-6e7031aa0830`
Environment: `04586a07-99b0-4cfd-95fa-bb6d8f1719e3`

- API deployment `caa4351c-311f-4f94-8d44-ea0c86c2e0f5`: SUCCESS.
- Web deployment `b16aa2ee-0efb-4693-8dd9-b8d9c85cdb0d`: SUCCESS.
- Postgres deployment remains online.
- Post-release Railway health: all three services online, one running replica each, zero crashed replicas, no recent failed deployments.

## Safety / operational boundary

- Payment gateway remains disabled.
- No payment capture or wallet debit is introduced.
- Manual Bank Transfer is a pending-order test/manual workflow only.
- Courier booking remains disabled.
- No shipping provider webhook was enabled.
- No production voucher was seeded.
- No production catalog/order mutation was used for acceptance testing.
- Existing publication/content controls from CP40 remain in place.

## Domain note

- `www.vapmart.id`: Railway DNS propagated, ownership verified, TLS certificate valid.
- `vapmart.id` apex: ownership and TLS are valid, but Railway reports `DNS_RECORD_STATUS_REQUIRES_UPDATE`; required root target remains `lta5rlv1.up.railway.app`.
- The apex DNS issue is separate from this CP41 application release.

## Operator paths

- Products: `/admin/products`
- Orders: `/admin/orders`
- Checkout: `/checkout`
- Customer orders: `/pesanan`
- Hero banners: `/admin/banners`

