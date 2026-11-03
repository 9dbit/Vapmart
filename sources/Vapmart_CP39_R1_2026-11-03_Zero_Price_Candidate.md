# Vapmart CP39-R1: Zero-price placeholder candidate

Date: 2026-11-03, Asia/Jakarta.
Status: SOURCE SAVED; NOT TESTED OR DEPLOYED.

## Request and changes
User requested a dummy price of 0, with actual operational prices to be updated by administrators later.

Application candidate commit: 608d30594b9fba7a4033d7537c38827c22386eba.
Work branch: work/cp39-r1-zero-price-20261103.
Baseline release branch commit: 10bc9335cf65559cfdf13b847b1877edd9e1a1e3.

- Read-only reference cards display formatted Rp0 with 'Harga belum ditetapkan'. The accessibility label explicitly says this is not a free product.
- Existing reference labels and no-transaction behavior are retained. No product links, cart controls or offer structured data are added to reference cards.
- New operational product forms initialize the normal price to 0. Existing product values are hydrated unchanged. New variants inherit the draft value using the existing logic.
- Admin price fields explain that Rp0 is a dummy value and an operational draft can be updated using Edit Produk or Edit Cepat before publication.
- No existing business prices are bulk-reset. No archive records are converted into operational products. Reference-card zero is a presentation placeholder, not an admin-editable legacy price field.
- Backend, authentication, publication validation, payment settings, stock, original media and database schema are unchanged.

## Verification and blocker
GitHub write results and compare confirmed four application file changes, one browser test script and a read-only postrelease workflow.
Creation of the prerelease verification workflow was blocked by the connector safety check. The blocked action was not retried through another route.
No build, browser-test or runtime visual success is claimed. The postrelease workflow has not been triggered.

## Live state read back after the blocker
Railway vapmart-web remains on a52c1c4e70080c8ef25e58e4d6792d239618ee54.
Deployment: 95c800ee-03b8-4774-8eb7-2a1847899492, SUCCESS (previous CP39 deployment).
Project: 7c01e4d8-6152-4f04-9750-6e7031aa0830.
Environment: 04586a07-99b0-4cfd-95fa-bb6d8f1719e3.
No release ref or Railway source pin was changed for this task.

## Remaining work
Resolve the verification block through an approved path, run the candidate's build and price checks, inspect desktop/mobile output, then deploy the verified frontend and read back live status. Do not report Rp0 as visible on the live website before that verification.
