# Vapmart storefront deployment
- Node.js >=22 and npm ci with committed package-lock.json.
- Railway staging /apps/web. Build: npm ci --include=dev --no-audit --no-fund && npm run build.
- Healthcheck: GET /api/health. Catalog via private API_INTERNAL_URL.
- Public staging URL: https://vapmart-web-staging.up.railway.app
- Non-indexable preview only, DEMO products are non-commercial placeholders.
- Supabase publishable credentials and matching project URL required for admin login.
- Frontend cart is a local preview; amounts are not authoritative for any future purchase.
- Checkout disabled and no customer payment collection.
