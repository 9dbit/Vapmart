-- CP33: no seeded DEMO product is publicly sellable in Vapmart.
-- Historical archive table remains an offline reversible backup, not an operational catalog.
BEGIN;
UPDATE product.products SET is_active=false,updated_at=now() WHERE slug LIKE 'demo-%' AND name LIKE 'DEMO%';
COMMIT;
