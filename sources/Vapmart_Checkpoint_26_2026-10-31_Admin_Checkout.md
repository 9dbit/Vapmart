# Vapmart Checkpoint 26 | Admin Commerce + Checkout (Payment-Ready)
Date: 2026-10-31 Asia/Jakarta

## Development snapshot
- Feature branch: `feat/admin-checkout-workflow-20261031`.
- Current Railway domain services remain attached to `feat/ecommerce-foundation-20261029`; no DNS changes.
- Admin dashboard now has Overview, Products & SKU, Brands and Orders. Authentication remains Supabase Auth backed by `public.staff_roles`, never local hardcoded credentials.
- Brand manager supports add/edit/activate, product-brand association, gallery images. JPEG, PNG and WebP uploads capped at 1.5 MiB and validated by content signature. Small media assets are stored in a private Postgres table for this interim build; migrate to S3/R2 before large-scale media usage.
- Cart routes physical products into dedicated checkout; digital/membership products are intentionally kept in their own feature-gated flow. Checkout requests server-owned prices and stock, displays shipping estimate and QRIS/VA/e-wallet preference.
- Authenticated customers can create draft orders with stable idempotency keys and read order status. Payment session endpoint returns 503 while no provider is connected.
- No order is marked `paid` by the frontend. There is no admin "mark paid" shortcut.

## Current hard gates
1. Dedicated Vapmart Supabase Auth is not configured in Railway; do not reuse an unrelated project's Auth UUID or key.
2. New SQL migration 005 must execute against Railway PostgreSQL before enabling new admin and checkout APIs.
3. Choose and integrate a licensed payment gateway with secure signature verification, webhook idempotency, reconciliation, and a sandbox E2E QA pass. Keep `CHECKOUT_ENABLED=false` and `DIGITAL_COMMERCE_ENABLED=false`.
4. Shipping integration is currently a flat estimate from `SHIPPING_FEE_IDR`. Confirm live postal-code-dependent shipping, tax and policy before opening payment.
5. No change to domain DNS, mail records, historical WordPress assets, or payment secrets.

## Verification required
- Run API build and tests; web build and smoke QA.
- Verify 401/403 admin authorization rejection; no public SKU/media writes.
- Test brand and product CRUD, image upload, published gallery, pricing updates, insufficient stock, duplicate idempotency and order isolation between users.
- Verify all displayed "pay" actions remain unavailable without an installed provider.
- Confirm HTTPS domain and API health after any eventual deployment.

## Payment design
`Cart -> Server Quote -> Address & Shipping -> Payment Preference -> Draft Order -> (future gateway payment session) -> Provider Pending -> Verified Paid -> Fulfilment`.

Checkpoint 26 implements up to Draft Order only. No payment collection or dispatch is activated. Historical nicotine items remain non-purchasable archives.
