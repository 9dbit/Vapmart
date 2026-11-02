-- Additive SKU tracking for new non-nicotine replacement catalog.
-- Existing DEMO rows have sku=NULL; this file never publishes products.
ALTER TABLE product.products ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE product.products ADD CONSTRAINT product_sku_format
  CHECK (sku IS NULL OR sku ~ '^[A-Z0-9][A-Z0-9._-]{2,63}$');
ALTER TABLE product.products ADD CONSTRAINT product_no_restricted_identifiers
  CHECK ((slug || ' ' || coalesce(sku, '')) !~* '(nicotine|nikotin|vape|vaping|rokok|tobacco|e-cig|e-liquid|e-juice|saltnic|iqos)');
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_sku_unique ON product.products (sku) WHERE sku IS NOT NULL;
