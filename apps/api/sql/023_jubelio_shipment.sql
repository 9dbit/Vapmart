-- Jubelio rates remain quotes: no carrier booking or payment is created.
BEGIN;
ALTER TABLE product.shipping_rate_quotes DROP CONSTRAINT IF EXISTS shipping_rate_quotes_provider_check;
ALTER TABLE product.shipping_rate_quotes ADD CONSTRAINT shipping_rate_quotes_provider_check CHECK(provider IN('biteship_test','jubelio'));
ALTER TABLE product.shipping_rate_quotes ADD COLUMN origin_area_id char(10);
ALTER TABLE product.shipping_rate_quotes ADD COLUMN destination_area_id char(10);
ALTER TABLE product.shipping_rate_quotes ADD COLUMN destination_region jsonb;
ALTER TABLE product.shipping_rate_quotes ADD COLUMN provider_service_id integer CHECK(provider_service_id>0);
ALTER TABLE product.shipping_rate_quotes ADD COLUMN base_amount_idr bigint CHECK(base_amount_idr BETWEEN 0 AND 10000000);
ALTER TABLE product.shipping_rate_quotes ADD COLUMN insurance_amount_idr bigint CHECK(insurance_amount_idr BETWEEN 0 AND 10000000);
ALTER TABLE product.shipping_rate_quotes ADD CONSTRAINT jubelio_quote_context CHECK(provider<>'jubelio' OR (
 origin_area_id IS NOT NULL AND origin_area_id ~ '^[0-9]{10}$' AND
 destination_area_id IS NOT NULL AND destination_area_id ~ '^[0-9]{10}$' AND
 destination_region IS NOT NULL AND jsonb_typeof(destination_region)='object' AND
 provider_service_id IS NOT NULL AND base_amount_idr IS NOT NULL AND insurance_amount_idr IS NOT NULL AND
 amount_idr=base_amount_idr+insurance_amount_idr));
COMMIT;
