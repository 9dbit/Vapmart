# Vapmart CP50 | CSV Header Recovery and Import UI
Date: 2026-11-17
Source: Google Doc "doc airwaybill", updated Nov 17
https://docs.google.com/document/d/1YeXzHILqtBlUqS9kW5bj7KNQTmtLvvU_als98SOa94A/edit

## Source request
The screenshot reports `Header kosong atau ganda` on `/admin/products/import`. The document asks to preserve the nearly finished admin dashboard and move on to storefront and payment gateway afterward. The original uploaded CSV file is not present, so its specific malformed header cannot be independently verified.

## Patch
- CSV parser preserves data across duplicate and empty header names by giving them unique visible labels, rather than rejecting the entire import with a non-actionable error.
- Warn about duplicate column names and identify exact column number; never silently overwrite one column's data with another.
- An unnamed column containing data remains available for manual mapping. Truly empty, unnamed columns, including extra trailing columns from Excel, are omitted with explicit warnings.
- Strict CSV quote, delimiter, encoding and row-length validation remains enforced.
- CSV import UI displays header repair warnings before the mapping step, and can read Excel UTF-16LE BOM files as well as normal UTF-8.
- Unit regression covers an exported Vapmart template roundtrip, duplicate headers, empty headers with data, extra blank columns, and Excel `sep=;` files.
- No changes to admin dashboard, product publication, inventory operations, payment provider, or customer order data.

## QA
- GitHub Actions CP50 must pass API build, unit tests and Next.js build.
- Opening the screenshot's original CSV file in a signed-in admin browser remains an outstanding real-file acceptance test.
- Future CP51: storefront catalog/filter and checkout usability.
- Future CP52: sandbox payment provider adapter/webhook/reconciliation; keep live payments disabled until a provider and credentials are available.
