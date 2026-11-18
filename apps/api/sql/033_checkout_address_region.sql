BEGIN;
ALTER TABLE product.orders ADD COLUMN address_region jsonb;
ALTER TABLE product.orders ADD CONSTRAINT orders_address_region_object CHECK(address_region IS NULL OR jsonb_typeof(address_region)='object');
UPDATE product.orders o SET address_region=q.destination_region FROM product.shipping_rate_quotes q WHERE o.shipping_quote_id=q.id AND q.destination_region IS NOT NULL;
COMMIT;
