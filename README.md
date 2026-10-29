# Vapmart ecommerce foundation

**Status:** staging candidate, not production commerce. Checkout/payment is intentionally disabled. No nicotine/tobacco products.

## Architecture

- `apps/web`: Next.js 15 frontend with responsive catalog, product details, cart and admin sign-in.
- `apps/api`: NestJS 10 catalog API, admin guard, disabled orders.
- `migrations/001_initial.sql`: Railway PostgreSQL schema `product` and internal `public.staff_roles`.
- Supabase Auth is the identity provider; there is **no** parallel auth schema in Railway PostgreSQL.

## Local

Use Node.js 22 and npm:

```bash
cd apps/api && npm install && npm run build && npm test && npm run dev
cd apps/web && npm install && npm run build && npm run dev
```

Environment examples are in `apps/api/.env.example` and `apps/web/.env.example`. Set API_INTERNAL_URL to the private API URL from Railway for web. Do not expose database passwords or Supabase service-role keys to the browser. When DATABASE_URL is unset the API returns an empty catalog.

Apply `migrations/001_initial.sql` **only after database access is validated and a backup exists**. There are no automatic migrations during boot. API will not show product data until migration is applied. To grant an initial admin, an authorized operator must insert the Supabase user's UUID into `public.staff_roles` after separately verifying identity.

## Security and commerce gating

- Products are drafts by default.
- Admin writes require Supabase access-token verification **and** an active row in `public.staff_roles`.
- `POST /v1/orders` returns HTTP 503. No checkout or charges.
- Catalog blocks nicotine/tobacco terms and limits categories.
- Use a dedicated least-privileged PostgreSQL API role before production; never expose Postgres credentials in frontend.
- Staging has `noindex` metadata.

## Railway

Existing project `Vapmart`: `7c01e4d8-6152-4f04-9750-6e7031aa0830`, environment `staging` `04586a07-99b0-4cfd-95fa-bb6d8f1719e3`. `vapmart-web` uses root `/apps/web`, `vapmart-api` uses root `/apps/api`. Database `Postgres` deployed via Railway template. Set `DATABASE_URL` to a private network reference after confirming DB service, `API_INTERNAL_URL` to API private URL and Supabase keys when available.

## Checkpoints

See `sources/`. All claims about deployment must be backed by Railway SUCCESS and smoke tests.

## Repeatable staging migrations

The API build bundles \`sql/001_initial.sql\` into \`dist/001_initial.sql\`. Railway API predeploy runs \`npm run migrate\`, which holds a PostgreSQL advisory lock, verifies the SHA-256 checksum and records a one-time application in \`vapmart_meta.migrations\`. It refuses migration drift. A fresh staging database may enable \`SEED_DEMO_CATALOG=true\` to add 4 clearly labeled non-commercial demo products if the catalog is empty; production must not enable this switch. Product prices are numeric JSON values and backend checkout always returns 503.

In the staging environment, readiness endpoint is \`GET /ready\`, which requires installed database tables; \`GET /health\` is process liveness. CI runs \`scripts/smoke-staging.mjs\` and protects the admin/checkout boundaries.

**Do not reuse Supabase projects from unrelated applications.** Provision a dedicated Vapmart Auth project after selecting the intended organization and reviewing its cost. Then set Supabase public URL/key on web and API. No initial admin is granted automatically.
