# Vapmart Checkpoint 43 - Promotion Campaign Engine

Date: 4 November 2026, Asia/Jakarta.

## Release identity

- Verified application commit: `a1f0d7c2f7bdca1c66e4b1da333e37f53bbf8e5a`
- Work branch: `work/cp43-promo-campaigns-20261104`
- Release branch: `release/vapmart-stable`
- GitHub Actions run: `41829659633`
- Verification result: SUCCESS
- Verification artifact: `13322301744`
- Artifact digest: `sha256:24c0fedf9bb145165b7e2bb29925ed588eb2b2c13a618e10278f1f4465351e75`

## Promotion Campaign Engine shipped

A dedicated Campaign workspace is now available under Admin -> Voucher & Promo.

Operator routes:
- `/admin/vouchers`
- `/admin/promotions`

Campaign administration supports:
- create and edit campaign;
- draft, published and archived lifecycle;
- scheduled start and end times;
- percentage and fixed-IDR discounts;
- minimum spend;
- optional maximum discount cap;
- maximum paid uses per customer;
- priority;
- automatic checkout application;
- stacking rule: exclusive or combinable with voucher;
- all-product targeting;
- specific-product targeting;
- specific-category targeting;
- ACTIVE-member-only campaigns;
- paid-redemption counter;
- optimistic concurrency through edit versions;
- audit trail for create/update/publish/unpublish/archive;
- responsive desktop and mobile administration UI.

No production campaign is seeded or automatically published by this release.

## Checkout promotion behavior

Checkout now evaluates automatic campaigns after pricing the basket.

Rules:
- at most one automatic campaign is selected per order;
- only Published campaigns inside the active schedule are eligible;
- lower numeric priority wins;
- when eligible campaigns share a priority, the larger calculated discount wins;
- exclusive campaigns are skipped when a voucher is applied;
- campaigns with `with_voucher` stacking can combine with a voucher;
- combined voucher plus campaign discount cannot exceed the merchandise subtotal;
- percentage campaigns can use an optional maximum-discount cap;
- fixed discounts cannot exceed their eligible subtotal;
- product targeting also applies to eligible variants through the parent product;
- category targeting uses product-category relationships;
- member-only campaigns require an ACTIVE membership account;
- per-user limits count verified paid orders only;
- anonymous quotes conservatively skip member-only and per-user-limited campaigns.

Checkout and order records now preserve separate discount attribution:
- total discount;
- voucher discount;
- voucher code;
- promotion discount;
- promotion event ID;
- promotion title.

The checkout UI, admin order detail, and customer order receipt display voucher and automatic promotion savings separately.

## Migration 021

New additive migration:
- `apps/api/sql/021_promotion_campaigns.sql`

It upgrades the existing `promotion.events` model instead of creating a parallel promotion subsystem.

Added campaign controls:
- `auto_apply`;
- `stacking_rule`;
- `scope_mode`;
- `max_discount_idr`;
- `priority`;
- `edit_version`;
- operator and timestamp metadata.

New target tables:
- `promotion.event_products`;
- `promotion.event_categories`.

Order attribution additions:
- `voucher_discount_idr`;
- `promotion_event_id`;
- `promotion_title`;
- `promotion_discount_idr`.

Existing voucher discount data is additively backfilled into `voucher_discount_idr` where applicable.

The migration does not reset or delete product, inventory, order, membership, voucher, or promotion business data.

## Admin API

Guarded promotion endpoints:
- `GET /v1/admin/catalog/promotions`
- `GET /v1/admin/catalog/promotions/:id`
- `POST /v1/admin/catalog/promotions`
- `PATCH /v1/admin/catalog/promotions/:id`

Controls include:
- server-side field validation;
- canonical campaign slug validation;
- duplicate-slug conflict handling;
- target validation;
- published target availability checks;
- row locking during edits;
- optimistic concurrency;
- audit records;
- authenticated optional checkout quotes for member and per-user eligibility.

Public checkout quote remains usable without authentication for campaigns that do not depend on customer identity.

## Verification

Exact application commit `a1f0d7c2f7bdca1c66e4b1da333e37f53bbf8e5a` passed:
- runtime safety gates;
- clean API build and unit tests;
- migration 021 twice on disposable PostgreSQL;
- CP40 private-draft and database constraints;
- CP41 checkout conversion;
- CP42 voucher administration regression;
- CP43 promotion integration;
- automatic promotion selection;
- exclusive voucher behavior;
- voucher-plus-promotion stacking;
- product targeting;
- category targeting;
- ACTIVE-member eligibility;
- per-user paid usage limits;
- duplicate campaign slug guard;
- stale edit-version conflict guard;
- promotion audit records;
- proof that the promotion engine does not capture payments or book couriers;
- catalog regression;
- integrity regression;
- warehouse and fulfillment regression;
- courier regression;
- Hero Banner regression;
- web production build;
- CP39 browser lifecycle;
- CP40 browser lifecycle;
- CP41 browser lifecycle;
- CP42 browser lifecycle;
- CP43 campaign desktop/mobile lifecycle.

All mutating acceptance tests used disposable loopback PostgreSQL and fixture identities, not production business records.

## Railway deployment

Project: `7c01e4d8-6152-4f04-9750-6e7031aa0830`
Environment: `04586a07-99b0-4cfd-95fa-bb6d8f1719e3`

- API deployment: `de4f1032-2db3-4a76-abd5-409495ef2aac` - SUCCESS
- Web deployment: `11be3efa-b77c-48da-8c24-5c94bfb28fab` - SUCCESS
- API source commit: `a1f0d7c2f7bdca1c66e4b1da333e37f53bbf8e5a`
- Web source commit: `a1f0d7c2f7bdca1c66e4b1da333e37f53bbf8e5a`
- Post-release environment: Web, API and PostgreSQL online.
- Running replicas: 1/1 for Web and API.
- Crashed replicas: 0.
- Railway reports no service issues and no recent failed deployments.

## Safety state

- Payment gateway remains disabled.
- Promotion campaigns do not capture payments.
- Order payment status remains governed by the existing verified backend flow.
- No campaign can manually mark an order paid.
- Courier booking remains disabled.
- Shipping-provider webhook activation remains disabled.
- No production promotion was automatically created or published.

## Domain status

### www.vapmart.id
- Ownership verified.
- TLS certificate valid.
- DNS status: PROPAGATED.
- Current CNAME target: `29sdkagc.up.railway.app`.

### vapmart.id apex
- Ownership verified.
- TLS certificate valid.
- DNS status: PROPAGATED.
- Railway route target: `lta5rlv1.up.railway.app`.

The apex DNS issue recorded in CP42 is no longer reported by Railway at this checkpoint.

## Next recommended engine layer

The promotion execution path is now operational. The next useful layer is promotion analytics and reconciliation:
- campaign GMV;
- discount cost;
- paid redemption rate;
- incremental conversion;
- voucher-versus-campaign contribution;
- campaign customer segments;
- per-product/category campaign performance;
- expired/unused campaign diagnostics;
- exportable campaign ledger for finance review.
