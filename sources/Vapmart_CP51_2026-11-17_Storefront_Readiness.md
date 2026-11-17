# Vapmart CP51 | Storefront Catalog Scale and Checkout Readiness
Date: 2026-11-17
Parent request: "Mulai kembangkan storefront" in Google Doc "doc airwaybill"
https://docs.google.com/document/d/1YeXzHILqtBlUqS9kW5bj7KNQTmtLvvU_als98SOa94A/edit

## Implementation
- Product grid initially renders up to 24 active products, with a "Lihat 24 produk berikutnya" button. This prevents rendering thousands of cards at once after CSV imports. Category/search/sort/favorite/ready-only filter resets pagination.
- New "Siap dibeli" filter selects only products with positive price, available physical stock and availability flag.
- Product cards show "Harga belum tersedia" when the admin left Rp0 as a placeholder, and disable add-to-cart on such products.
- Cart add/refresh rejects or marks unavailable items with unpriced or sold-out flags, preventing stale localStorage from enabling purchase.
- The authoritative API quote refuses a physical product with an effective unit price of Rp0. No forced price adjustments and no database changes.
- Product detail price and text now correctly explain manual bank transfer versus unavailable gateway payment methods.
- Solid purple, rounded load-more control keeps the existing Vapmart design DNA.

## Guardrails
- Admin UI remains untouched.
- No gateway payment activation or direct checkout debit.
- Existing manual transfer remains subject to admin confirmation and does not auto-mark paid.
- Unit regression covers zero price quote rejection.
- CI must pass API build/tests and Next.js build; no live order created in CI.
