# Vapmart Checkpoint 32 | Unified PostgreSQL Catalog
Date: 2026-11-02 (Asia/Jakarta)
Status: IMPLEMENTED IN GITHUB, RAILWAY DEPLOYMENT/QA IN PROGRESS

## Request
Verify CP31, audit frontend sources, unify PostgreSQL with Control Panel and storefront, retain legacy read-only and all payment flags OFF.

## Verified CP31
Railway web, API, and PostgreSQL services were all SUCCESS when CP32 began. CP31 presented 19 historical references separately from four seed demo products. The existing archive was authored as TypeScript arrays in `apps/web/src/lib/archive-catalog.ts` and `archived-reference.ts`; public Next.js page and admin previously read separate sources.

## CP32 implementation
1. Added additive migration `apps/api/sql/006_unified_catalog.sql`. Creates `product.legacy_archive` for 19 historical references and one `product.catalog_overview` view with both active inventory and legacy archives.
2. Legacy archive records preserve historical names, slug, brand, category, photo path, source snapshot, historical prices. `is_sellable=false` is enforced by a PostgreSQL CHECK constraint. Legacy records are **never inserted** into `product.products`, and there is no archive publish/checkout route.
3. Added migration 006 to the trusted Railway pre-deploy migration sequence. Applies idempotently: `ON CONFLICT (slug) DO NOTHING`; prior migrations unchanged.
4. Added read-only `GET /v1/archive` endpoint through NestJS, with public Next.js bridge `/api/archive`. Response sets `readOnly:true`, `paymentEnabled:false`.
5. Added shared Next.js `getArchivedProducts()` from the same PostgreSQL endpoint.
6. Homepage, category pages, product archive metadata/detail and recommendations now read PostgreSQL archive items. Admin Control Panel Archive tab and archive KPI use `/api/archive`, not frontend arrays.
7. Live inventory remains managed through `product.products` and admin Brands/Products/SKU APIs, with customer storefront getting active products from `/v1/products`.
8. No DNS, mail, Supabase Auth, Pentagon, Tradevice, member Coin, provider configuration or payment flags altered.

## QA and rollout conditions
- GitHub Actions workflow run: https://github.com/9dbit/Vapmart/actions/runs/41335778643 (Foundation checks, check conclusion when available).
- Latest CP32 commit: `2b82dce439f697714e6b1a98d113dd5cb1cda6c3`.
- At checkpoint authoring time Railway API was BUILDING, web QUEUED. DO NOT claim production deployment complete until both show SUCCESS.
- Confirm migration log `006_unified_catalog.sql` applied, GET /v1/archive returns 19 read-only records and no active payment, Admin Archive has 19 cards, public legacy page loads with purchase disabled.
- Verify web build type checking and mobile layout. Confirm legacy archive links and images still resolve.
- If an archive HTTP fetch fails, UI should fail closed (no archive checkout). The archive has no catalog stock counts.
- End-to-end customer purchase and payment remain intentionally unavailable until gateway onboarding.

## Next
CP33: catalog import/editor, product variants, asset media, bulk CSV with validation, configurable categories, server-side pagination and single-source read model. Archives must remain read-only until separately approved for any legal merchandise migration.

## Post-deployment verification (2026-11-02)
- Railway `vapmart-web`, `vapmart-api` and PostgreSQL: all **SUCCESS**, CP32 web deployed commit `2b82dce`.
- Live `https://vapmart.id/api/archive`: HTTP 200, **19** items, `readOnly=true`, `paymentEnabled=false`.
- Public homepage, `/admin/login`, legacy category and legacy product detail: HTTP 200.
- `/api/checkout/config`: HTTP 200; checkout remains payment-disabled.
- Browser UI smoke originally failed because an old assertion expected a disabled checkout button, whereas CP26 introduced a checkout review link; patched smoke expectation.
- Staging smoke originally failed because it looked for the retired Admin Studio title; patched to match Control Panel.
- GitHub Actions retests queued as of this note. Do not claim PASS until their new jobs conclude.
