# Vapmart CP44: Promotion Analytics & Reconciliation Candidate

**Date:** 2026-11-04 (Asia/Jakarta)  
**Status at drafting:** Candidate committed to work branch, GitHub Actions verification pending. Not yet a production release.

## Scope

CP44 extends CP43 campaign and voucher functionality with a read-only, admin-authenticated analytical workspace:

- UI: `/admin/promotions/analytics` under existing Voucher & Promo navigation.
- Admin API: `GET /v1/admin/catalog/analytics/summary`.
- Paginated finance ledger: `GET /v1/admin/catalog/analytics/ledger`.
- Finance CSV: `GET /v1/admin/catalog/analytics/ledger.csv`.
- Optional filters: `from=YYYY-MM-DD`, `to=YYYY-MM-DD` (inclusive dates in Asia/Jakarta), `campaignId=UUID`.
- Maximum reporting interval: 366 calendar days.
- Ledger paging is keyset-based, with a maximum of 200 rows per API response.
- CSV export is capped at 10,000 rows and fails clearly when the requested period is too large.
- CSV is admin-only, does not include customer contact information, and escapes spreadsheet formula prefixes.
- Reporting-only migration `022_promotion_analytics_indexes.sql` adds indexes and does not modify business data.

## Source-of-truth and definitions

**One order is one ledger row.** A stacked voucher-plus-campaign order does not become two financial orders.

The report population is orders with a checkout idempotency key and either a voucher or campaign ID. Periods use `product.orders.created_at` in Asia/Jakarta, not payment settlement dates.

- **Applied orders**: population rows regardless of payment status.
- **Paid orders**: population rows with `payment_status='paid'`.
- **Paid GMV**: sum of `subtotal_idr` on paid rows, excluding delivery.
- **Voucher cost**: sum of `voucher_discount_idr` on paid rows.
- **Campaign cost**: sum of `promotion_discount_idr` on paid rows.
- **Total paid discount cost**: voucher cost plus campaign cost.
- **Net merchandise value**: paid GMV less both recorded discount components. This is not cash settlement or profit.
- **Paid rate**: paid orders divided by attributed orders in the selected creation-date cohort; not visitor conversion.
- **Pending and refunded rows**: shown in operational counts and ledger, excluded from paid GMV/costs.
- **Reconciliation exception**: order-level mismatch between `discount_idr` and component discounts, or `total_idr` and `subtotal_idr - discount_idr + shipping_fee_idr`, or malformed attribution.

For the product and category breakdown, each paid order's discount is allocated to immutable order item price-and-quantity snapshots using cumulative proportional integer allocation. The allocated values sum to the original order amounts even when the division has an IDR remainder.

Category labels are resolved from the **current** catalog, with one deterministic primary category per item. Historical category membership at order time is not stored in CP43.

Membership segments use **current** membership status, not historical status at checkout.

## Known measurement gaps

Traffic impressions and a control group are not recorded in this dataset. Accordingly, causal incremental conversion, campaign lift, clickthrough conversion, and historical membership status are **not measurable** from this release. The UI labels the observed paid/order ratio explicitly, without substituting it for experimental conversion.

The existing payment provider remains disabled. An order marked `pending` does not produce recognized paid metrics. Refund status is visible; this dashboard does not claim to reconcile actual refunded cash because no refund cash ledger is supplied.

## Candidate identity and release gate

- Source branch: `work/cp44-promotion-analytics-20261104`.
- Baseline: `release/vapmart-stable` at `d51a4daa36753b61f9aac4b896565f6b977b6a49`.
- Application candidate SHA before documentation: `d31f1bcc3ed0f9c8bfc29b280d4500e2864e7c63`.
- GitHub Actions: https://github.com/9dbit/Vapmart/actions/runs/41865249589
- Workflow: `.github/workflows/cp44-promotion-analytics.yml`.

Required before Railway cutover:

1. Clean API TypeScript build and unit tests.
2. Migration 022 applied twice on disposable PostgreSQL.
3. CP40-CP43 integration and browser regressions.
4. New CP44 isolated PostgreSQL reconciliation integration: GMV, independent discount cost, exact product/category allocation, date boundary, refunds, exception detection, access control, and CSV.
5. Next.js production build.
6. Desktop and mobile CP44 browser lifecycle, including CSV download.
7. Entire workflow terminal SUCCESS on the exact code SHA.
8. Fast-forward release branch; stage and inspect API source diff, deploy API and verify terminal SUCCESS; then the same process for Web; verify both are online at matching SHA.
9. Confirm payment gateway, live courier booking and courier webhook remain disabled.

No synthetic campaigns, purchases, or payment status updates have been written to production for this checkpoint.
