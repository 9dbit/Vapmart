# Vapmart Supabase Auth setup and commerce release gates

Status: **blocked pending selection of the Supabase organization**. Do not reuse the authentication database of unrelated projects such as Pentagon or Tradevice.

## Dedicated Supabase Auth, staging
1. Owner selects the Supabase organization (connected choices observed: **9D** or **Makstudios.id@gmail.com Org**) and authorizes any nonzero project cost.
2. Create a dedicated `Vapmart Auth` project in the selected organization, preferably ap-southeast-1, and confirm ACTIVE_HEALTHY.
3. Retrieve its **project URL** and enabled **publishable key** only. NEVER add `service_role` / `sb_secret_` keys to client variables or GitHub.
4. Railway staging `vapmart-web` vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The variables are compiled into the Next.js browser bundle, so redeploy web and verify updated build.
5. Railway staging `vapmart-api` vars: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`; API invokes the Supabase `/auth/v1/user` endpoint with bearer session token to validate the user.
6. In Supabase Auth, create/confirm a designated admin user through proper verification. Retrieve the user's exact Supabase UUID; never invent one.
7. In Railway PostgreSQL using an authorized operator, insert the verified UUID into the internal `public.staff_roles` table:

   ```sql
   INSERT INTO public.staff_roles(user_id, role, is_active)
   VALUES ('<VERIFIED_SUPABASE_USER_UUID>'::uuid, 'admin', true)
   ON CONFLICT(user_id, role) DO UPDATE SET is_active = excluded.is_active;
   ```

   Replace placeholder only after verifying identity, permissions, and the target staging database. Do NOT expose this table through client APIs.

8. Test access matrix:
   - no bearer token: `GET /v1/admin/status` -> 401
   - valid ordinary user (without role): -> 403
   - valid explicitly approved admin: -> 200
   - authenticated admin can list/create draft/edit/publish/unpublish non-nicotine products
   - malformed/expired token: -> 401
   - checkout: POST `/v1/orders` still -> 503 in staging

## Database and role boundaries
- `product.*` resides in Railway Postgres, **not** Supabase Auth. There is no cross-database foreign key to Supabase `auth.users`.
- `public.staff_roles` is the internal app authorization mapping, not a replacement for Supabase identity.
- Before production, create a **dedicated least-privilege PostgreSQL application account** for API operations, with required grants on `product` and `public.staff_roles`, and separate migration owner credentials.
- Do not connect production API to PostgreSQL superuser or publish database ports publicly.
- Passwords and connection strings belong in encrypted Railway variables, never in GitHub.

## Remaining gates before live ecommerce
- Replace all four clearly labeled staging DEMO entries with lawful verified real non-nicotine product data. Check supplier images, prices, product stock, policies and returns.
- Test rate limiting, audit logging, secure admin authorization and session expiry; enforce MFA for privileged operators where feasible.
- Verify staging catalog/checkout/cart on actual desktop and phone devices, including accessibility.
- Implement and verify **real server-authoritative ordering**, inventory reservations, idempotency and shipping cost calculations; currently checkout is deliberately disabled.
- Contract and integrate a compliant payment gateway, webhook signature verification, refunds, settlement reconciliation and fraud controls.
- Verify backups/restore and run all staging tests before production deploy.
- Explicitly plan any WordPress/Hostinger domain or DNS migration. **No existing production domain may be cut over while gates are open.**

## Evidence already observed at 29 October 2026
- Railway web/API/Postgres running on staging. Database `001_initial.sql` applied and four DEMO objects seeded.
- GitHub Foundation checks, staging smoke, Chromium UI smoke and production dependency audit passed for the lockfile-based foundation commit `495ce9405b96402a7c4a6da61548b53d4ebdf194`.
- Admin product manager source is added on branch after that commit, with separate verification pending.
- Current feature branch: `feat/ecommerce-foundation-20261029` and draft PR #1.
