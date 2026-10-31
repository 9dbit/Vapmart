# Vapmart Checkpoint 03 - 29 October 2026, 23:31 WIB

## Changes since checkpoint 02
- Patched Next.js dependency from `15.5.3` to `15.5.9` after Railway security blocking `15.5.3` (CVE-2025-66478 and others). Code commit: `d1d34f63d2252d31caebc4047dbc039b73005b60`.
- Railway previous web build FAILED due blocked vulnerable Next version. Earlier API build FAILED because obsolete command `build:api` was not in new package scripts.
- Updated `vapmart-web` and `vapmart-api` configuration in staging: build command `npm install --no-audit --no-fund && npm run build`, start command `npm run start`, service roots `/apps/web` and `/apps/api`, respective healthchecks `/api/health` and `/health`.
- Verified updated Railway configuration by `describe_service`.
- Active deployments of patched commit at last check: web `6485a5e8-77b0-4772-8cae-3c64f0ca60dc` BUILDING, API `abd6c95b-f21f-4cd6-8f8b-f22339cbab46` BUILDING. Their terminal status is not yet verified. Changed Railway build commands may not affect snapshots that started before the change; verify and initiate new deployment after config if necessary.

## Gate status
- PostgreSQL SUCCESS with persistent disk.
- API/web not yet verified SUCCESS.
- Migration not applied; no real catalog rows.
- Supabase authorization not configured.
- CI and smoke tests not verified.
- Checkout intentionally disabled.
- Never claim staging preview ready until live healthcheck returns 200.

## Next
Verify active deployments, triage errors, rebuild under corrected commands, apply DB migration after backup, confirm Auth and admin, test catalog and mobile preview.
