# Vapmart Checkpoint 29 - Admin Identity

Date: 2026-11-01

## Selected primary administrator
- Email: `hello@vapmart.id`
- Supabase project: `rxcqbgzmiygxsqhhlhoe` (9D)
- Supabase Auth lookup: no user exists yet for this email.
- Status: **PENDING SIGNUP AND EMAIL VERIFICATION**. No privileged role was assigned.

## Operational state
- Railway `vapmart-web`, `vapmart-api`, PostgreSQL: SUCCESS.
- Pentagon remains ACTIVE_HEALTHY, untouched.
- Checkout and real payment remain disabled.

## Safe onboarding
1. In Supabase Vapmart dashboard, set Authentication > URL Configuration Site URL to `https://vapmart.id`, add redirect URLs for `/login` and `/login?mode=reset` on both apex and www domains.
2. Verify `hello@vapmart.id` receives email and sign up through `https://vapmart.id/login`. Use a private strong password, never share it through chat.
3. Confirm the signup message via the actual inbox and log in.
4. Query Supabase Auth for the newly created, email-confirmed UUID. Provision a matching row in **Railway PostgreSQL** `public.staff_roles` with `role='admin'` and `is_active=true`. This is a privileged step and requires verified user identity.
5. Verify AdminGuard 401/403, admin login, brand/SKU/product/photo CRUD and orders, customer order isolation, and checkout draft creation.

No Supabase user was fabricated, no direct auth.users insert, and no staff admin role assigned based on email alone.
