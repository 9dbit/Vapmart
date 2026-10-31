# VAPMART - Continuity Checkpoint 04

**Snapshot:** 29 Oktober 2026, 23:50 WIB (16:50 UTC)
**Scope:** full-stack ecommerce STAGING, legal non-nicotine catalog only.
**Result:** storefront, NestJS API and PostgreSQL staging are deployed and operational; automated smoke/browser tests and security checks passed. Production commerce remains gated.

## Identitas sistem

| Component | Identifier |
| --- | --- |
| GitHub repository | https://github.com/9dbit/Vapmart |
| Feature branch | `feat/ecommerce-foundation-20261029` |
| Draft pull request | https://github.com/9dbit/Vapmart/pull/1 |
| Head at snapshot | `4d11c7fb1fe7a447c6bf317f09ba30ae6523cab3` |
| Railway project | `7c01e4d8-6152-4f04-9750-6e7031aa0830` |
| Railway staging environment | `04586a07-99b0-4cfd-95fa-bb6d8f1719e3` |
| Web service | `5d178ac7-32f5-4c52-b974-241594dc06b0` |
| API service | `73a61220-cfbe-4c08-99f3-abeb23a7d2e5` |
| Postgres service | `69ff22d7-3d9d-4c7b-83f5-aabd6be412b7` |
| Web URL | https://vapmart-web-staging.up.railway.app |
| API URL | https://vapmart-api-staging.up.railway.app |
| API readiness | https://vapmart-api-staging.up.railway.app/ready |
| Admin preview | https://vapmart-web-staging.up.railway.app/admin |

## What changed in this continuation

1. Verified initial Railway web, API and Postgres deployments were terminal `SUCCESS`, not merely queued.
2. Completed NestJS/Postgres migration runner in `apps/api/src/migrate.ts`: database checksum ledger, advisory transaction lock, migration verification and safe repeat execution. `001_initial.sql` was applied in staging; logs said `VAPMART_DATABASE_READY {"migration":"001_initial.sql","applied":true,"seeded_demo_products":4}`. Staging contains exactly four synthetic, clearly marked **DEMO** products for browser acceptance, not real inventory.
3. Corrected admin authentication status check from a POST side-effect to dedicated GET, using Supabase `/auth/v1/user` bearer validation and `public.staff_roles` role guard in NestJS.
4. Added `GET /ready`, which checks schema presence rather than only process liveness. API migration is the Railway pre-deploy command, and readiness is the Railway healthcheck.
5. Fixed `bigint` -> JSON product price handling by casting price to integer within database queries (schema limits price to <= 2 billion IDR).
6. Implemented Next.js storefront: catalog, category filtering, search, product detail, client-side cart and checkout-disabled notice. Added non-indexing robot metadata/robots route for staging.
7. Added Product Manager admin source for product listing (draft/published), draft creation, editing, price/stock/image changes and publication toggles. Admin remains fail-closed until a dedicated Vapmart Supabase Auth project is configured and an approved admin UUID is mapped. The new admin functionality cannot yet be tested with a real authenticated operator.
8. Updated Next.js to `15.5.28`, NestJS to `12.3.2`, and PostCSS override to `8.5.32` following dependency audit findings. Evidence: production `npm audit --omit=dev` for both API and web returned **0 total vulnerabilities** after upgrades.
9. Generated and committed `apps/api/package-lock.json` and `apps/web/package-lock.json` via GitHub Actions, switched CI and Railway build commands to `npm ci`, and confirmed successful deploys from pinned dependency graphs.
10. Added GitHub Actions staging smoke, Chromium desktop/mobile UI smoke, and security audit jobs. Added `watchPatterns` so docs-only pushes do not rebuild Railway.
11. Added `docs/SUPABASE_AUTH_AND_PRODUCTION_GATE.md` for secure ownership selection, admin RBAC bootstrap and production release checklist.
12. Opened draft PR #1; **did not merge to `main`, migrate legacy WordPress products, redirect domains or enable payments.**

## Verified deployment receipts

At the snapshot, Railway reports:

| Service | Latest relevant successful deployment | Status |
| --- | --- | --- |
| API (includes Product Manager endpoints) | `c2b7bce7-b32b-49fd-bad2-9e606f291413` | `SUCCESS` |
| Web (includes admin frontend import fix) | `edfcbafc-f45e-4546-b499-6d2f27e8cd5f` | `SUCCESS` |
| Postgres + persistent volume | `19ee1b92-92d7-42c9-a7fc-6cb676bcfa21` | `SUCCESS` |

The latest docs/test-only commits were correctly `SKIPPED` by Railway path filters; this is not a deploy failure.

## GitHub Actions test evidence

- Basic build, TypeScript, unit tests: https://github.com/9dbit/Vapmart/actions/runs/40915220207 (SUCCESS after admin route fix).
- Staging API/web/catalog + admin-anonymous denied + orders HTTP 503: https://github.com/9dbit/Vapmart/actions/runs/40915443882 (`SUCCESS` on extended smoke test).
- Chromium desktop and mobile (~390px) catalog/cart/search/detail journey: https://github.com/9dbit/Vapmart/actions/runs/40915207347 (`SUCCESS`). No horizontal overflow measured; this is **browser simulation, not physical-device acceptance**.
- Production dependencies audit: https://github.com/9dbit/Vapmart/actions/runs/40915443959 (`SUCCESS`, no high/critical; prior full audit observed zero vulnerabilities on web and API).
- Browser UI and Foundation workflows for last test-script-only commit might still be running at the precise snapshot; inspect current GitHub Actions before calling every latest commit green.

The previous route import duplication briefly broke web builds and was repaired in commit `04fdf979d1be0c9ad2dcdcd0d52771577b24eb2a`. Current web and API Railway deployments have terminal SUCCESS; prior FAILED/NEEDS_APPROVAL events are historical and not reasons to call currently active services offline.

## Security and state boundaries

- `product.*` is a separate Railway PostgreSQL schema.
- Supabase Auth is *external identity*. Do not copy its `auth` schema into Railway PostgreSQL.
- API write permissions require valid Supabase bearer identity and an explicit `public.staff_roles` admin mapping. Anonymous admin access is rejected.
- User's multirole goal is currently satisfied by app-level `admin`/`customer` mappings only; **dedicated least-privilege PostgreSQL role accounts are NOT yet provisioned**. Fix before production.
- DEMO products are synthetic; none reflect verified warehouse inventory, prices or supplier rights.
- `POST /v1/orders` returns HTTP **503** by design. No checkout, payment, shipping or production customer orders are enabled.
- Next.js frontend does not contain Supabase secret/service-role keys. Never insert them in `NEXT_PUBLIC_*` variables.
- Hostinger/WordPress site and domains untouched by this checkpoint.

## Pending decisions and work (honest release gates)

**Blocker A: dedicated Supabase project ownership.** Two connected organizations are available: **9D** or **Makstudios.id@gmail.com Org**. There is no dedicated Vapmart Supabase Auth project yet. Ask the project owner to choose one. Do not silently reuse Pentagon, Tradevice or other auth projects. Check project creation cost and obtain confirmation for any nonzero charge. After creation, set publishable key+project URL in Railway web/API, verify initial operator UUID, grant `public.staff_roles` admin through authorized DB credentials, then test valid-user 403 / admin 200 / anonymous 401 and full admin CRUD with actual user.

**Blocker B: business release.** No real lawful non-nicotine products, stock synchronization, payment processor, shipping rates, customer account tests, server-authoritative orders, returns, refund reconciliation, end-to-end order test or backup/restore acceptance. Remain staging-only. No production cutover until all gates are closed and explicitly approved.

**Other:** Audit dedicated PostgreSQL least-privilege roles, rate limits, admin MFA, media hosting, deployment backups, real-device mobile checks. The existing production WordPress storefront must remain unchanged until migration plan and domain release approval.

## Next execution checkpoint

1. Confirm all latest GitHub Actions on checkpoint branch, especially extended admin unauthenticated and browser tests; investigate any failed test without bypass.
2. Ask for Supabase organization choice (9D or Makstudios) and any required billing approval, then configure Vapmart-only Auth.
3. Verify operator login and Product Manager CRUD end-to-end with actual admin, including draft -> published -> draft and price/stock modifications, then document test receipts.
4. Replace DEMO items with verified non-nicotine products; add image/storage integrations.
5. Design and test order/payment/shipping engine offline or staging. Do not accept funds until payment and operational safety checks are complete.
6. Write the next timestamped Markdown checkpoint to **GitHub `sources/`**, and copy it to **ChatGPT Library `/Vapmart/sources/`**. Note: Library backup is not the same as attaching directly to the ChatGPT Project's Sources surface; direct Project Source uploads require a supported Project attachment operation.
