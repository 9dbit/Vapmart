# Vapmart Checkpoint 15 - Existing Source Extraction Attempt

**Date:** 2026-10-30 (Asia/Jakarta)  
**Repo:** https://github.com/9dbit/Vapmart  
**Branch:** `feat/ecommerce-foundation-20261029`  
**Draft PR:** https://github.com/9dbit/Vapmart/pull/1  
**Scope:** retrieve original WordPress UI source and legacy ecommerce database, without changing production.

## Confirmed existing baseline

Prior verified archive location on the authorized SPARK.local device: `/Users/macuser/Downloads/public_html.zip`. Checkpoint 14 recorded:
- ZIP entries: 57,853 (directories included).
- WordPress upload entries: approximately 17,291.
- Elementor generated stylesheets: 41.
- Installed plugin directories: 30; **installed does not mean enabled**.
- Astra theme detected.
- Original hero sources: `wp-content/uploads/2025/07/1-1.png`, `2025/07/2-8.png`, `2025/05/1600-x-500.png`.
- 56 selected static UI/media assets already have a manifest and prior source verification in `docs/legacy-assets-manifest.json`.
- Complete WordPress/MySQL export was absent from the previously inspected ZIP. Plugin-internal .sql templates are not the application database.

These facts are historical checkpoint observations, not a new live export.

## Completed during this checkpoint

1. Verified GitHub PR #1 still OPEN and DRAFT, on the expected feature branch. Production `main` untouched.
2. Developed an independent, read-only `extract_legacy_source.py` toolkit supporting archive aggregate audit, curated CSS/media extraction, checksum manifests and non-secret DB availability preflight.
3. Validated synthetic ZIP tests (2/2 pass) verifying selected CSS/images are captured while secret config, logs, user/order records, font binaries and dangerous ZIP paths are excluded. The downloadable toolkit contains this script, tests, README, SQL and checkpoint notes.
4. Added `scripts/legacy-mysql-inventory.sql` to this branch. It contains only SELECT statements against `information_schema` and returns WordPress table/column metadata for a controlled Hostinger phpMyAdmin inventory.
5. Checked a second connected device, TRADEVICEPC. Neither default candidate path contained the old `public_html.zip`.

## Explicit access blocker

- SPARK.local was initially listed ONLINE but remote shell requests timed out; subsequent device-status inspection showed **OFFLINE**. Hence the toolkit **was not executed on the actual WordPress ZIP in this checkpoint**.
- Connected Hostinger browser context stopped being accessible in this Chat surface. The browser could not be used to click Hostinger File Manager or phpMyAdmin, and there is no connected Hostinger hosting/database API tool here.
- No full MySQL data export, customer/order/table count reconciliation, credential extraction, database write, or live file-manager extraction was performed. Do not claim the migration or data acquisition completed.

## Reproduction handoff

Use the packaged `extract_legacy_source.py` on SPARK when online:

```bash
python3 extract_legacy_source.py all \
  --zip /Users/macuser/Downloads/public_html.zip \
  --manifest /path/to/Vapmart/docs/legacy-assets-manifest.json \
  --out /Users/macuser/Documents/Vapmart/private-source-capture-cp15
```

Outputs: `source_inventory.json`, `vapmart_legacy_ui_capture.zip`, `ui_capture_manifest.json`, `database_preflight.json`. The toolkit never includes font binaries or sensitive records.

For SQL:
- Run `scripts/legacy-mysql-inventory.sql` only in the selected authorized Hostinger WordPress MySQL database.
- Export the full database separately through hPanel/phpMyAdmin to a private, encrypted destination outside `public_html` and outside the public GitHub repo.
- Confirm old vs HPOS order storage and plugin-specific tables. Determine active plugins from database rather than filesystem.

## Next recovery and validation

1. Restore SPARK Desktop Commander or use Work mode to interact with logged-in Hostinger UI.
2. Run the existing source audit/export; validate selected asset SHA-256 vs `docs/legacy-assets-manifest.json`, record high-res UI media and CSS mapping.
3. Collect a protected full MySQL snapshot and schema inventory. Keep customer/payment data in the private migration workspace, not in the repository.
4. Build a redacted mapping/coverage report for `product`, `commerce`, accounts, shipping, coupons, wallet, points and affiliate records.
5. After source readiness, implement new migrations in staging with checkout remaining disabled until safe.

**Status:** extraction toolkit finished and tested; fresh real source capture and complete MySQL export are blocked by connection availability.
