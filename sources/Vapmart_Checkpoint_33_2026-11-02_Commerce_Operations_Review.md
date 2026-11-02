# Vapmart Checkpoint 33 | Commerce Operations, Brand Portal & Courier Readiness
Date: 2026-11-02 (Asia/Jakarta)
Status: CODE DEPLOYED / RELEASE QA PASS / PROVIDER ONBOARDING PENDING
Repository: https://github.com/9dbit/Vapmart
Environment: Railway Vapmart staging, custom domains vapmart.id and www.vapmart.id
Payment collection: **OFF**

## Why the old Katalog Arsip was removed
The CP32 archive was a migration/evidence snapshot from WordPress, **not** a commerce/stock source. It had 19 historical product references and was never meant to be purchasable. CP33 removes it from the Admin Control Panel, homepage, brand partner fallback, public archive API, and product/category detail routes. Legacy category and asset-review routes redirect to `/catalog`. The immutable historical PostgreSQL backup is retained out of the operational UI for a reversible migration. No business data was destructively deleted.

Four demo seed products were explicitly unpublished by migration 007, excluded from storefront and admin inventory lists, and future demo seeding was removed. Do not treat old DB seed records as live inventory.

## Operational features implemented this checkpoint
1. Admin Control Panel continues at `/admin` with dedicated `/admin/login`, brand, products/SKU, order draft review and a new `Pengiriman` tab.
2. Public storefront uses the active PostgreSQL catalog and active brands only; no inherited WordPress product/brand fallback. Homepage is a modern purple brand-centric commerce layout with category links and an honest empty-catalog state when no verified SKUs are live.
3. Additive DB migrations:
   - `007_decommission_demo.sql`: no demo inventory is published.
   - `008_brand_shipping_foundation.sql`: brand membership, brand-access audit, product weight/dimensions, inventory event ledger schema and shipment lifecycle tables. Database backup remains intact.
4. Brand member access is tied to Supabase Auth users via `product.brand_memberships(brand_id,user_id,role,is_active)` and granted by the Vapmart administrator only. Roles: owner, manager, viewer.
5. Dedicated `/brand/login` and `/brand` UI. Brand dashboards show **only brand-scoped** SKU stock, total products, low-stock counts, and aggregate paid sales by SKU. No customer PII is sent to brand dashboards. Draft orders are excluded from revenue, and verified paid orders must have provider and payment reference.
6. Admin Brands tab includes brand-account UUID assignment, role selection, revoke/reactivate, and immutable brand-access audit writes. Actual brand users first create and verify their Supabase account; admin must assign them. Do not share passwords or assign by email string alone.
7. Biteship sandbox Rates API integration prepared under `POST /v1/shipping/rates`, requiring signed-in, email-confirmed customer, server-owned product values, real product weight and origin/destination postal code. No client-supplied price or weight. Public `GET /v1/shipping/config` reports bookingDisabled/paymentDisabled. The Admin Pengiriman tab provides readiness and a sandbox rate check form.
8. Sandbox rate lookup stays disabled until explicit `SHIPPING_RATE_LOOKUP_ENABLED=true`, valid `biteship_test.` token at Railway `BITESHIP_API_KEY`, and `SHIPPING_ORIGIN_POSTAL_CODE`. Production Biteship tokens deliberately cannot be used by this sandbox-only endpoint.
9. No courier order creation, pickup, label, airwaybill (AWB), payment, settlement, or fulfillment was enabled.

## Verified QA
- Foundation checks: API build PASS, web build PASS, catalog audit PASS.
- Browser UI smoke PASS with the modern storefront, brand login, admin isolation, legacy removal, shipping auth boundaries and 390px mobile width checks.
- Theme mode browser QA PASS.
- Coin wallet ledger integration PASS.
- Dependency security audit PASS.
- Staging smoke PASS, including API and brand data authentication boundaries.
- GitHub Actions workflow group on commit `43abe2eb8ab83d1b4fe39b72cdea8bad06710fc9`:
  https://github.com/9dbit/Vapmart/actions?query=branch%3Afeat%2Fecommerce-foundation-20261029
- The web and API services were confirmed SUCCESS during this checkpoint, with the final API rebuild monitored separately.
- Live `https://vapmart.id/`, `/brand/login`, `/admin/login`, `/api/shipping/config`: HTTP 200; unauthenticated `/api/brand-portal/me`: HTTP 401.
- No brand ownership or customer sale was fabricated. Live E2E cross-tenant testing requires at least two genuinely verified partner users and two brands; not yet performed.

## Operational backlog, prioritized
P0 - Before any real transactions
- Confirm corporate/brand onboarding & compliance, privacy/terms, customer service, inventory sourcing.
- Finish product variant/SKU model, import mapping, duplicate detection, photo CDN/R2, slug controls, categories and server-side pagination.
- Add multi-warehouse origins and per-SKU stock ledger transactions with row-level locking, reservations/releases, returns and low-stock alerts. The events table is **schema only** at this checkpoint, not a production-grade inventory engine.
- Configure exact brand memberships with verified Supabase user UUIDs, ideally via an invitation/acceptance workflow and audit trail. Test unauthorized/other-brand access on real accounts.
- Select a shipping aggregator (Biteship adapter now in test-only mode; RajaOngkir/Komerce remains an alternative), agree plan/billing, supply sandbox key in Railway only, verify real dimensional weights, warehouses, area ID/address resolution, fee/tax rules, retries, and API rate limits.
- Integrate selected shipping quote into **server-side checkout order total**, including quote expiry, chosen courier/service, idempotency and snapshot. Current checkout still uses `SHIPPING_FEE_IDR` flat estimate; DO NOT TURN ON PAYMENTS with that logic.
- Securely integrate gateway with signed webhooks, reconciliation, idempotent paid transitions, refunds/disputes, settlement journal and split per-brand order lines. Keep existing `CHECKOUT_ENABLED=false`, `DIGITAL_COMMERCE_ENABLED=false`.

P1 - Fulfillment & finance
- Courier booking after payment confirmed, AWB, pickup, shipping label, webhook tracking events, failed delivery, RTO and returns.
- Brand portal: 7/30/90-day sales, SKU movement, low-stock thresholds, order fulfilment summary without customer PII, settlements/commissions only after actual payment data.
- Admin: order timeline, support & dispute actions, customer CRM, operator RBAC, audit events, analytics and payment reconciliation.
- Multi-brand single order splits into vendor shipments and financial allocation.

P2 - Scale & content operations
- Bulk CSV/XLSX import with dry-run and schema validation; SKU variants, promotions, SEO and activity scheduling.
- Warehouse dashboard, inventory forecasts, exports, R2 media storage, granular API rate limiting, backups/retention.

## Provider notes
- Biteship official Rates API: https://biteship.com/id/docs/api/rates/retrieve and https://biteship.com/en/docs/api/authentication
- RajaOngkir/Komerce V2: https://www.rajaongkir.com/docs. Shipping Delivery requires an Enterprise plan per official documentation.
- All provider costs/credentials require explicit approval; none were purchased or stored in GitHub.

## Open blockers / next verification
1. No real partner brands exist yet (previous admin showed Brand=0). Admin must add genuine brand & SKU records.
2. Create verified Supabase brand user(s), then Admin > Brands > Login per brand assigns verified User UUID to brand. The roles currently share read-only SKU/sales visibility; role-based editing and invitations remain future work.
3. Add real weight/dimension and origin warehouse; configure Biteship sandbox credentials. Rate tests must be sandbox-only and carry no shipping booking.
4. Connect checkout to locked courier quote and verified payment provider before real commerce.
5. Do not delete the hidden historical backup until backup retention and migration reconciliation are approved.

## Safety guarantees
- No changes to Pentagon.
- No provider secrets committed.
- Old archives and demo catalog are hidden from customer-facing commerce.
- No shipping booking, payment capture, member-crediting, paid-order mutation or disbursement was enabled.
