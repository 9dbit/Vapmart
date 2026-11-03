# Vapmart CP40: Private Draft Editing

Date: 3 November 2026, Asia/Jakarta.
Status: candidate under verification; NOT YET DEPLOYED.
Baseline release: 10bc9335cf65559cfdf13b847b1877edd9e1a1e3.
Application candidate: 130e910b12d824a8b8c3bbb3a66b632d712d7705.
Work branch: work/cp40-private-drafts-20261103.

## Scope
The latest reviewed private-draft candidate is continued, not an unrestricted storefront change. The new manual product editor can retain unreviewed wording in an internal draft, including name, description, SKU and variation fields. Draft prices can be 0. Saved drafts remain private, non-purchasable and absent from public product selection.

Publication and edits of active products validate the stored content. Activation-only legacy requests also validate the stored record. Parent and enabled variation publication paths remain checked. File validation, permissions, SKU formatting/uniqueness, numerical checks, inventory ledger, version conflicts and audit records are retained.

Only two production backend files change: catalog-workspace.ts and products.ts. No schema migrations, asset conversion, archive publishing, stock reset, price reset, payment activation, courier booking, DNS/email changes or authentication changes are included. Category/import validation and the legacy editor are not relaxed. The separate CP39-R1 public Rp0 placeholder candidate is NOT included.

## Verification gates
The original local candidate's source checksums are matched before committing. The initial CI run failed before code execution because the PostgreSQL service healthcheck used single-quote grouping unsupported by the runner; the workflow was corrected without changing application code.

Run 41655122404 verifies exact committed source using clean dependency installs, API build/unit tests, migrations twice, real disposable PostgreSQL/HTTP tests, prior catalog/integrity/warehouse/courier/banner regressions, Web build, prior browser lifecycle and a new desktop/mobile private-draft lifecycle.

All mutating tests use named loopback databases and synthetic test identities. No production operator credentials, paid provider calls or authorized live business writes are used. Release requires terminal SUCCESS for the exact candidate, followed by read-only deployed acceptance. A successful CI run is not a claim of real-operator UAT.

## Operator flow
Open /admin/products/new, enter product information, upload an image, enter 0 as the draft price when not yet set, and save the draft. Reload and continue editing later. Publication is a separate action after completing and validating the record. This release does not make the read-only historical archive editable or purchasable.
