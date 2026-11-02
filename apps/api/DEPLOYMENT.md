# Vapmart API deployment
- Node.js >=22 and npm ci with committed package-lock.json.
- Railway staging /apps/api. Build: npm ci --include=dev --no-audit --no-fund && npm run build.
- Predeploy: npm run migrate; reads dist/001_initial.sql, checks checksum, optional staging-only DEMO seeding.
- HTTP readiness: GET /ready. Process liveness: GET /health.
- User authentication: separate Supabase Auth project must be configured before administrative login.
- Product admin endpoints require authenticated admin role in public.staff_roles.
- POST /v1/orders always returns 503; never enable checkout without payment/shipping acceptance.
- Do not seed actual product stock from unverified legacy WooCommerce data or nicotine assets.
