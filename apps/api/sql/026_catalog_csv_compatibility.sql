BEGIN;
-- Preserve legacy identifiers and full product names; uniqueness remains enforced.
ALTER TABLE product.products DROP CONSTRAINT product_sku_format;
ALTER TABLE product.products ADD CONSTRAINT product_sku_format
 CHECK (sku IS NULL OR sku ~ '^[A-Z0-9][A-Z0-9._ /-]{2,63}$');
ALTER TABLE product.products DROP CONSTRAINT products_name_check;
ALTER TABLE product.products ADD CONSTRAINT products_name_check
 CHECK (char_length(name) BETWEEN 2 AND 255);
-- Measurements remain JSON numbers throughout catalog and courier snapshots.
-- Existing range constraints continue to reject nonfinite/out-of-range values.
ALTER TABLE product.products
 ALTER COLUMN length_cm TYPE double precision USING length_cm::double precision,
 ALTER COLUMN width_cm TYPE double precision USING width_cm::double precision,
 ALTER COLUMN height_cm TYPE double precision USING height_cm::double precision;
ALTER TABLE product.courier_manifest_items
 ALTER COLUMN length_cm TYPE double precision USING length_cm::double precision,
 ALTER COLUMN width_cm TYPE double precision USING width_cm::double precision,
 ALTER COLUMN height_cm TYPE double precision USING height_cm::double precision;
COMMIT;
