# Vapmart Checkpoint 14 - Legacy Public HTML Gap Audit (Ecommerce, UX, Database)

**Date:** 2026-10-30 (Asia/Jakarta)  
**Repository:** https://github.com/9dbit/Vapmart  
**Branch:** `feat/ecommerce-foundation-20261029`  
**PR:** https://github.com/9dbit/Vapmart/pull/1 (draft)  
**Staging:** https://vapmart-web-staging.up.railway.app/  

## Scope and evidence

This checkpoint is an **audit and migration extraction plan**, not a code deployment, DB import, live checkout release, or change to WordPress production.

Evidence inspected:
- GitHub repository: `docs/legacy-assets-manifest.json`, `docs/legacy-commerce-feed-audit.json`, Checkpoints 08–13, `apps/web/src/app/layout.tsx`, `apps/api/sql/001_initial.sql`, `002_catalog_sku.sql`, `apps/api/src/controllers.ts`, `apps/api/src/products.ts`, and account/cart components.
- Hostinger File Browser tab read-only: root folder `public_html` present.
- Authorized SPARK.local backup `/Users/macuser/Downloads/public_html.zip` read-only ZIP index (no extraction/DB connection).

## Confirmed source inventory

| Source | Confirmed inventory |
|---|---:|
| ZIP members | 57,853 |
| `wp-content/uploads/` entries | 17,291 including directories |
| `wp-content/uploads/elementor/css/` files | 41 |
| `wp-content/uploads/fonts/` files | 36 |
| `wp-content/uploads/elementor/google-fonts/` files | 88 |
| Installed plugin directories | 30 |
| Theme directories | `astra` |
| Selected media already in rebuilt frontend and verified in prior checkpoints | 56 |
| Complete business MySQL database export inside ZIP | **Not found** (plugin-internal .sql templates do not count) |

Present high-resolution original banners:
- `wp-content/uploads/2025/07/1-1.png`
- `wp-content/uploads/2025/07/2-8.png`
- `wp-content/uploads/2025/05/1600-x-500.png`

These coexist with smaller 1024-pixel-derived banner assets currently shown in staging. Inspect original aspect ratios/dimensions, source authenticity, media licensing, and choose responsive resized WebP/AVIF assets; do not import every upload.

## UX and design assets still worth extracting (from public_html)

**P0:**
1. High-resolution originals for home hero, mobile hero and all *currently visible* section graphics, verified against asset manifest.
2. Astra theme styling, header/footer base layout and responsive breakpoints; `wp-content/themes/astra/`.
3. Elementor generated page styles in `wp-content/uploads/elementor/css/post-*.css`, scoped to real page IDs. **Mapping page IDs and source Elementor JSON requires WordPress DB** (`_elementor_data` and templates), CSS alone cannot reconstruct editable layouts.
4. Source typography: actual font-family, weights, sizes and icons from Elementor font asset directories and `wp-content/uploads/fonts/`. Only licensed and required font subsets should be shipped.
5. Visible customer journeys: actual desktop/mobile states for search, account, cart, checkout, order confirmation, coupon, wallet/points and profile. Source screenshots/rendering cannot be derived from ZIP alone because WordPress pages are dynamic.

**P1:**
6. Category templates, detail galleries, image zoom, variation controls, recommendation blocks, reviews/rating components and empty/error states.
7. Reusable UI snippets: footer, account menu, member profile, banners, modals, price formatting, notification feedback, loading skeletons and mobile sticky actions.
8. Search/SEO frontend behavior: URL and permalink paths, legacy redirect rules from `.htaccess` (read-only), `robots.txt`, page title/metadata, category taxonomies.

Do not migrate WordPress executable PHP/plugin code into Next.js. Record source selector, screenshot reference, new component mapping, checksum, and extraction status.

## Installed plugin feature candidates (not evidence that they were active)

- Search: `ajax-search-for-woocommerce`
- Wallet/loyalty: `woo-wallet`, `mycred`
- Coupons: `wt-smart-coupons-for-woocommerce`
- Reviews: `customer-reviews-woocommerce`
- Affiliates/vendors: `indeed-affiliate-pro`, `wc-vendors`
- Checkout/custom fee: `flexible-checkout-fields`, `checkout-fees-for-woocommerce`
- Fulfillment/integrations: `jubelio-shipment`, `jubelio-shipment-hpos`, `woo-xendit-virtual-accounts`
- UI: `elementor`, `elementor-pro`, `astra-addon`, `header-footer-elementor`, `ultimate-elementor`.
- Analytics/SEO: `all-in-one-seo-pack`, `official-facebook-pixel`, `facebook-for-woocommerce`.

Before implementation, confirm current **active plugin list, configured settings and business usage** from DB and admin read-only audit. Installed directory alone is insufficient.

## Database export that cannot be obtained from public_html

**Obtain separately and securely from Hostinger's MySQL database / approved WooCommerce export**, preserving native table prefix:
- WordPress `*_posts`, `*_postmeta`, `*_terms`, `*_term_taxonomy`, `*_term_relationships`, `*_termmeta`, `*_options` for pages, taxonomies, navigation, Elementor templates, source settings.
- WooCommerce products/variations/attributes, media attachment relationships, product metadata and category relationships (exact source rows via DB, not a partial sync feed).
- Customer identity: `*_users`, `*_usermeta` and WooCommerce customer tables. Protected export only, no raw user data in public repository.
- Orders: detect HPOS `*_wc_orders`, `*_wc_order_addresses`, `*_wc_orders_meta`, `*_wc_order_operational_data`; also legacy `*_posts`, `*_postmeta`, `*_woocommerce_order_items`, `*_woocommerce_order_itemmeta` as applicable.
- Related rules and records for coupons, shipping zones, payment methods, refunds, tax, wallet, loyalty, affiliates, vendor and review systems. Plugin-specific table names **must be discovered** by a read-only schema inventory; do not assume.
- List and count tables, version/charset, foreign relationships, approximate row totals and key column names. Produce a sanitized schema-only review first, followed by an encrypted, access-controlled migration export.

**Never** commit `wp-config.php`, live credentials, payment API keys, personal addresses, raw orders, user records, logs or invoices to public GitHub. Do not directly import WordPress password hashes as Supabase Auth accounts; use a verified identity migration / password reset flow.

## Current rebuilt engine vs expected ecommerce architecture

**Already present**: Next.js storefront; branded homepage, category and detail references; basic server-backed product list/detail; client-side catalog filter and autocomplete; browser-only cart; admin catalog create/update/publish API and SKU; `product.products`, `product.orders`, `product.order_items`, `public.staff_roles`; staging auth guard. Customer login preview and payment/order creation are not yet active.

**Needed, in order:**

| Priority | Backend and database increment | UI/UX increment |
|---|---|---|
| P0 | Auth/role mapping, media/variant/category/attribute tables, server-side search/pagination and indexed SKU | Complete catalog filters, product variations, responsive media and reusable design tokens |
| P0 | Customer profiles, addresses, carts/cart_items persistence and authorized account endpoints | Customer account and cart sync across devices |
| P1 | Transactional order state machine, immutable price snapshots, stock reservations, idempotency, payment audit | Checkout wizard, shipping/address selection, order review and status |
| P1 | Delivery integrations, promotions, refunds and receipts | Coupons, shipping estimation, order detail/tracking |
| P2 | Wallet/loyalty/review/affiliate/vendor extensions **only if source usage is verified** | Member, review and partner dashboards |
| P2 | Audit/event logs, backups, retention, metrics/observability | Search analytics, Web Vitals QA, accessibility, error and loading states |

Respect existing schema separation: product data in `product`, operational/transactional data in a dedicated schema proposed as `commerce`, application roles in an access-controlled schema, and Supabase Auth as identity provider. Do not install WooCommerce plugins into Railway services.

## Important current UI code gap

`apps/web/src/app/layout.tsx` imports nine consecutive CSS files including multiple legacy and checkpoint overlays. This is functional as a temporary strategy but risks cascade collisions. After source capture, consolidate style tokens, components and route styles, preserving mobile nav/hero/drawer behavior. Checkpoint 13 autocomplete is currently client-side over fetched products, while API `GET /v1/products` is capped at 48 products: implement indexed, paginated server search as catalogue size increases.

## Next concrete extraction procedure

1. **P0 read-only capture**: make a targeted inventory and checksum list of current hero originals, fonts, critical Astra/Elementor styles and layout JSON mapping; preserve source attribution.
2. **P0 MySQL access**: identify the real WordPress DB through Hostinger DB Manager, export schema/tables securely **outside public GitHub**; start with table inventory and counts.
3. **P0 flow matrix**: compare legacy mobile/desktop search, account, cart, checkout and member states against Next.js, rank gaps. Account/cart snapshots were previously incomplete in checkpoint 10.
4. **P1 backend work**: ship schema migrations and server APIs behind feature flags, test role isolation, stock changes and reliable transaction state before enabling checkout.
5. **P1 performance QA**: profile original high-res media optimization, LCP/CLS, Core Web Vitals, responsive overflow and scroll interactions.
6. **P2 release**: cut over only after user data handling, redirects, search, transactional reconciliation and rollback plan are validated.

## Access and verification boundaries

The Hostinger tab was inspected in Chat read mode and showed `public_html`, but its individual live subdirectories were not navigated. The ZIP is an older authorized snapshot; live-vs-backup drift is **not yet verified**. No live MySQL DB export, schema mutation, file deletion, data migration, production cutover or new checkout deployment occurred during this checkpoint.
