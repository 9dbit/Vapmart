# Vapmart Checkpoint 45: Transaction Integrity & Catalog Consolidation

**Date:** 2026-11-04 (Asia/Jakarta)
**Result:** GitHub Actions **SUCCESS**; API, Web, PostgreSQL Railway deployments **SUCCESS / online**.

## Exact verified release

- Source repository: `9dbit/Vapmart`
- Work branch: `feat/cp45-integrity-catalog-20261104`
- Release branch: `release/vapmart-stable`
- **Verified, deployed application commit:** `151b5a5a8810539e142f3526b95d9b1c5563abac`
- GitHub Actions run: https://github.com/9dbit/Vapmart/actions/runs/41873407787 (**completed/success**)
- QA artifact ID `13346595978`, SHA-256 `9993d6a00d943961efc2da9db9093fbd5a38e987e9edc389f5878227894bc456`
- Draft PR: https://github.com/9dbit/Vapmart/pull/3
- API Railway deployment: `5a250274-7eff-498d-bc0b-606b54e892af` (**SUCCESS**)
- Web Railway deployment: `7538b2c9-97bc-4856-b0e4-1212aa7da4cb` (**SUCCESS**)
- PostgreSQL Railway deployment: `19ee1b92-92d7-42c9-a7fc-6cb676bcfa21` (**SUCCESS**)
- Railway project `7c01e4d8-6152-4f04-9750-6e7031aa0830`; environment `04586a07-99b0-4cfd-95fa-bb6d8f1719e3` (named staging, publicly-facing domains).

Non-force release fast-forward from `c2f93566e949a1bc2dceb9263486eb6566a73eec` to verified application commit was performed only after CI terminal success. API and Web source pointers were inspected in Railway staged changes independently, each containing exactly one non-destructive source.commitSha modification. API was deployed first, then Web after API passed health/startup checks. Both online with identical SHA. Staged change queue empty.

## CP45-A: Transaction integrity

1. Administrative order overview now counts `pending` bank-transfer draft orders as outstanding in addition to `not_initiated` drafts and separates both counts in the return payload. No settlement is performed.
2. Catalog overview counts published parent product families and low-stock active purchasable SKU records rather than unsaleable variable parent records and non-public drafts.
3. Cart quantity is capped at 99 units per SKU on rehydration, add and update, matching the API basket validation.
4. Finance Analytics has a strict paid verification predicate requiring `status='paid'`, `payment_status='paid'`, nonempty `payment_provider` and `payment_reference`. Orders with an unverified paid label are excluded from verified GMV and discount cost, and separately flagged as reconciliation exceptions.
5. Five Analytics summary/segment/campaign/line/anomaly queries execute under one read-only REPEATABLE READ PostgreSQL snapshot. The CSV path already used the same read-only snapshot isolation.
6. Reconciliation checks order subtotal against the immutable sum of order item unit prices times quantities; additionally checks discount/total arithmetic and incomplete payment evidence.
7. Dashboard and CSV expose line delta and verified-vs-unverified payment status; empty period does not masquerade as a successful reconciliation.

**Interpretation:** Verified paid merchandise GMV is an accounting proxy using persisted order/provider metadata, not a live bank statement or independently reconciled cash settlement. Incremental causal conversion remains unmeasurable without exposure/control data.

## CP45-B: Operational product consolidation

1. Legacy admin product navigation and product action entry points redirect to canonical `/admin/products` and `/admin/products/:id`, not the legacy editor; static-category editor is no longer an ordinary navigation path.
2. New dedicated admin **Produk & SKU → Arsip & Konversi** page at `/admin/products/arsip`. The operational SKU list no longer embeds a costly archived-image list.
3. Admin-only `POST /v1/admin/product-records/:slug/convert` and Next proxy `/api/admin/product-records/:slug/convert` convert **one confirmed archival record** into a **new, unpublished, internal product draft**. The original read-only source row remains immutable.
4. Conversion is idempotent through `product.catalog_source_rows` (`legacy_archive_v1` namespace) and an inventory transaction advisory lock.
5. Archived image bytes are SHA-256 checked against protected media library and transformed by Sharp to web-optimized WebP before being saved to the operational media asset store. The new SKU may reference the copied image while the archive original remains untouched.
6. Initial sale data: price Rp0; on-hand stock 0; SKU NULL; description blank; brand NULL; provisional `other` category. Name/provenance recorded. **No auto-publication, auto-activation, payment capture or courier booking.** Admin must verify SKU, price, description, category, weights/dimensions and warehouse inventory before publishing.
7. Legacy record rows display converted-product linkage and a direct path to the editor, instead of creating duplicate records.

## Verification completed

GitHub Actions on the exact candidate SHA passed:
- Clean NestJS TypeScript compilation and unit tests.
- Re-applying migrations on disposable PostgreSQL.
- CP40–CP44 checkout, voucher, campaign, analytics regression tests.
- CP45 verified-payment, unverified paid exception, item subtotal mismatch, pending bank-transfer counts and expanded CSV assertions on isolated PostgreSQL.
- CP45 archived-record conversion, immutable archival source, idempotent replay, media checksums, admin authorization, private-draft publication guard and no public listing.
- Catalog, warehouse, courier, private-draft and banner regression suites.
- Next.js optimized production build.
- Playwright Chromium browser suites CP39–CP45.
- CP45 browser report: `pass=true`, archived conversion=true, `noAutoPublication=true`, initial price zero, blank SKU, canonical admin navigation=true, viewport 390/scroll width 390, JavaScript errors=[], payment captured=false, production writes=false.
- QA artifact saved at run `41873407787` and digest above.

## Railway production-facing health

Post-cutover `environment_status` confirmed:
- `vapmart-api`: online, running 1/1, crashed 0, warnings 0, critical 0; `VAPMART_DATABASE_READY`, NestJS startup success.
- `vapmart-web`: online, running 1/1, crashed 0, warnings 0, critical 0; Next.js `Ready` runtime log.
- `Postgres`: online, running 1/1, crashed 0, warnings 0, critical 0.
- Web + API both exactly `151b5a5a8810539e142f3526b95d9b1c5563abac`.
- No pending staged Railway changes.

## Outstanding infrastructure and product-readiness gates

- **Apex DNS unresolved:** Railway `vapmart.id` certificate valid but DNS status `DNS_RECORD_STATUS_REQUIRES_UPDATE`; expected apex/flattened CNAME target `lta5rlv1.up.railway.app`, currentValue blank. **Do not claim apex is publicly reachable** until DNS is corrected at authoritative DNS provider and externally tested. `www.vapmart.id` is verified, TLS valid and DNS PROPAGATED to `29sdkagc.up.railway.app`.
- **Environment isolation unresolved:** live domains still point to environment named `staging`. A separate production environment and tested backup/cutover plan are needed for stronger isolation; no risky cross-database migration was attempted during CP45.
- **Live payment and courier booking remain disabled**, deliberately. There has been no live payment/checkout transaction verification or production DB write from the QA fixture.
- **SEO launch gate:** global robots noindex/disallow remains until production launch and page readiness.
- **Campaign scaling:** first-100 candidate promotion limit remains a future edge-case hardening task.
- A live authenticated end-user browser and real public-domain HTTP smoke were not established by isolated browser QA. Runtime and provider DNS statuses above are the verified evidence.

## Admin use

Visit [Admin archived products](https://www.vapmart.id/admin/products/arsip) after signing in with an authorized admin account. Select a source row, choose **Jadikan draft**, confirm, and complete the new product editor fields. The archive will not publish itself.

---
Generated after terminal CI SUCCESS and Railway API, Web, and PostgreSQL health verification. It documents verified CP45 scope, not completion of CP45-C/D.
