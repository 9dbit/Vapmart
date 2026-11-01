# VAPMART / OFFICIAL BUILD CHECKPOINT CP36-R1

**Release ID:** VAPMART-CP36-R1-STOREFRONT-RESTORED-20261102  
**Created:** 2026-11-02 (Asia/Jakarta)  
**Repository:** [9dbit/Vapmart](https://github.com/9dbit/Vapmart)  
**Build snapshot branch:** `checkpoint/vapmart-cp36-r1-20261102`  
**Verified application code commit:** `6efb91c6332b5713309ef544aa865d5dc19fd4c5`  
**Feature branch at checkpoint time:** `feat/ecommerce-foundation-20261029`  
**Original pre-CP33 layout reference:** `f0e80331003b`  
**Release classification:** Stable UI recovery + guarded backend foundation, **not** live commerce launch.

## PURPOSE

This checkpoint freezes the tested Vapmart rebuild state after correcting the CP33 storefront regression. The WordPress-to-Next.js rebuild must retain Vapmart's existing brand identity and familiar page hierarchy. The same branch snapshot also preserves all existing backend CP35/CP36 modules without resetting database state.

**Snapshot principle:** The release branch was forked from the exact passing code commit above. Its only additional change is this Markdown manifest, so application binaries and source content are unchanged.

## RESTORED HOMEPAGE STRUCTURE

1. Responsive original Vapmart hero carousel: three desktop + three mobile image sources, swipe, dots, pause and keyboard controls.
2. Five original category-image thumbnails with working non-transactional reference navigation.
3. Featured products area sourcing **published, verified SKUs only** from PostgreSQL.
4. Historical product image/reference gallery, showing **19 unique references** with no active SKU, stock, price, cart or checkout action.
5. Membership promotion panel, retained member account views and original header/footer brand treatment.
6. Brand partner rail: approved active brands from database; legacy logo images used as *reference only* when no verified brands exist.
7. Editorial news image grid with ten historic image references. Historical promotional copy is not reissued as new editorial content.
8. Desktop + mobile layouts, theme modes and source PNG/JPEG/WebP responsive behavior.

## MEDIA / CONTENT SAFETY

- 59 original images retained in protected Control Panel Media Library, plus their original public asset paths where previously present.
- Historic product, category and banner imagery remains **visual documentation only**, not a new product offer or sales promotion. Publication of any restricted products/promotional content requires separate review.
- No data is fabricated: the authenticated PostgreSQL-backed active products endpoint was returning **0 active products and 0 active brands** when the release smoke tests ran. These counts are a snapshot of test time, not a guarantee of future counts.
- Existing product pictures are not promoted into active SKUs or associated with invented price, quantity, tax, origin, dimensions or brand rights.

## VERIFIED CI / RELEASE TESTS

All nine workflow runs on the verified application commit **PASS**:

| Workflow | Run ID | Result |
|---|---:|---|
| Foundation checks (1) | 41348957019 | PASS |
| Browser UI smoke | 41348953147 | PASS |
| Coin wallet ledger integration | 41348953061 | PASS |
| Staging smoke | 41348953048 | PASS |
| Warehouse & Fulfillment PostgreSQL Integration | 41348953032 | PASS |
| Private Media Library Integration | 41348953031 | PASS |
| Dependency security audit | 41348953022 | PASS |
| Theme mode browser QA | 41348953010 | PASS |
| Foundation checks (2) | 41348952990 | PASS |

Production-domain smoke included `https://vapmart.id` and `/catalog`, verified original responsive banners and archive-gallery markup, and confirmed payment/booking feature gates remain disabled. Browser QA verified all 5 category pictures and the mobile-specific hero asset load successfully. The historical grid contains 19 distinct original product-image references, not 38 duplicated products.

## DEPLOYMENT SNAPSHOT (RAILWAY)

Project: Vapmart (`7c01e4d8-6152-4f04-9750-6e7031aa0830`)  
Environment: staging (`04586a07-99b0-4cfd-95fa-bb6d8f1719e3`)

| Service | Deployment ID | Last observed terminal status |
|---|---|---|
| vapmart-web | `a8579edd-0dc9-4541-be50-354c12f399a9` | SUCCESS |
| vapmart-api | `e3a39da8-02d4-4d7f-81d2-868ed2b1ca1b` | SUCCESS |
| PostgreSQL | `19ee1b92-92d7-42c9-a7fc-6cb676bcfa21` | SUCCESS |

Domains: `vapmart.id`, `www.vapmart.id` remain attached to the same `vapmart-web` service. **This checkpoint is a Git source snapshot, not a new Railway deployment or database backup.** One older Railway environment patch was staged but not applied when inspected; this checkpoint did not accept, alter or discard that patch.

## KNOWN GUARDS AND EXISTING FUNCTIONALITY

- Supabase Auth / admin and brand login policies: unchanged.
- Control Panel Media Library, brands and SKU management: unchanged.
- CP35 warehouse, stock, reservations and CP36 courier/return code: unchanged.
- Membership/coin ledger, order draft handling and storefront product API: unchanged.
- Payments, gateway charging, real courier booking, automatic label creation and refunds: **OFF**.
- No migrations, stock mutation, DNS edits, mailbox edits, provider credential changes or modifications to other projects.

## SCOPE OF SOURCE CHANGES SINCE CP33

- `apps/web/src/app/page.tsx`: original homepage structure restored.
- `apps/web/src/app/catalog/page.tsx`: read-only visual gallery remains accessible when public catalog is empty.
- `apps/web/src/app/brand-partner/page.tsx`: historic partner logos visually separated from active partners.
- `apps/web/src/components/reference-visual-grid.tsx`: non-transactional photo cards.
- `apps/web/src/app/restored-home.css`: responsive visual repairs scoped to restored surfaces.
- `scripts/ui-smoke.mjs` and `scripts/smoke-staging.mjs`: permanent UI and custom-domain regression guards.

Detailed implementation record: `sources/Vapmart_CP36_R1_2026-11-02_Storefront_Recovery.md`.

## RECOVERY / ROLLBACK PROCEDURE

1. Do **not** blindly revert the entire repository to CP32: it would also regress newer authentication, warehouse and fulfillment code.
2. For an exact Git snapshot, check out `checkpoint/vapmart-cp36-r1-20261102` or the verified application source SHA `6efb91c6332b5713309ef544aa865d5dc19fd4c5`.
3. For a surgical storefront recovery, restore only the five listed frontend files and run the two smoke scripts plus the full build pipeline.
4. Keep database untouched; never overwrite PostgreSQL from the source snapshot. Arrange a separate Railway/PostgreSQL backup before destructive operations.
5. If deploying from this snapshot, require SUCCESS on `vapmart-web` and `vapmart-api`, then verify HTTPS, the custom domain, the member/admin/brand auth gates, and payment OFF.

## NEXT CHECKPOINT

CP37 should reconcile approved, non-restricted products and brands into the unified catalog via Control Panel, map verified SKU-to-media references, and implement gateway integration **behind explicit testing and authorization gates**. Do not turn historical archive records into purchasable products by inference.

**Checkpoint completion criteria:** Git snapshot branch exists; MD manifest committed to `sources/`; verified build commit preserved; no new production change caused by creating the checkpoint.
