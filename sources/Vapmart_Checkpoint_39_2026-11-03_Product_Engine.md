# Vapmart CP39 Product Engine

Status: isolated candidate, not yet deployed. Scope approved: native product management, 1-3 variation attributes, promotional prices, warehouse stock within product forms, optional informational brand, categories, CSV preview/confirmed import, verified buyer reviews, storefront selection and draft-order operations.

Baseline live CP38: af47f967f5e32a8508ee274edc2de47237792bb6. Work branch: work/cp39-product-engine-20261103.

Products keep one authoritative inventory ledger. Variation SKUs are child product rows; the parent is never separately stocked or purchasable. Informational brand is separate from fulfillment owner. Existing explicit brand ownership is preserved; unknown historical order ownership is not guessed. New platform-managed order lines carry an explicit platform snapshot. Original auth and nicotine/tobacco restrictions remain. Payments, paid rate lookup and carrier booking remain OFF.

Migration 017 is additive except replacing the fixed category check with an actual category foreign key and permitting a null partner owner on platform fulfillment batches. Existing prices, quantities, publication flags and original media are not rewritten. The 19 historical source records are still read-only references.

All live application pins remain unchanged until exact tracked-source CI passes and both Railway deployments reach terminal SUCCESS. Tests run on named localhost PostgreSQL databases and synthetic identities only. No real user/password, verified payment, courier purchase or operator acceptance is claimed.

Application routes: /admin/products, /admin/products/new, /admin/products/categories, /admin/products/reviews, /admin/products/import, /admin/orders, /pesanan. Hero Banner remains /admin/banners.

CSV import accepts up to 2 MiB and 2,000 records, supports mappings and multi-warehouse columns, preserves parent/variation relations, treats blank stock as unchanged, creates drafts and never fetches arbitrary external image URLs from the server. Preview is required before one atomic confirmed apply. Original sample CSV is a reference and is not imported into live data.

Pending: exact-source integration and browser verification, controlled API then Web release, public read/denial smoke, operator guide and final evidence update. No deployment success is claimed here.
