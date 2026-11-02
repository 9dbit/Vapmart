# Vapmart Checkpoint 30 - Vapmart Control Panel Login

## Scope
- Renamed heading from Admin Studio to **Vapmart Control Panel**.
- New direct admin entry: `https://vapmart.id/admin/login`.
- Customer login stays at `https://vapmart.id/login`, with no need to navigate from the storefront to sign into Control Panel.
- `/admin` redirects unauthenticated or forbidden sessions to `/admin/login` and keeps backend role authorization through `/api/admin/status` and NestJS `AdminGuard`.
- Admin routes hide the customer-facing navigation, cart, and footer. Authentication is still Supabase, with backend role authorization in Railway PostgreSQL.
- No changes to checkout, payments, DNS, Supabase, or Pentagon.

## Release gates
- GitHub Actions Next.js build, browser smoke and Railway web deployment must pass.
- Verify `/admin/login` renders new design, login rejects non-admin users, and `/admin` cannot expose privileged API data without admin bearer role.
- Primary admin email `hello@vapmart.id` is verified in Supabase, but staff role must still be provisioned in Railway PostgreSQL; this code change alone does not grant admin.
- Payment gateway remains disabled.
