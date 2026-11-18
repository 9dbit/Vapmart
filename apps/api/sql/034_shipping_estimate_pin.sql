BEGIN;
ALTER TABLE product.orders ADD COLUMN delivery_pin jsonb CHECK(delivery_pin IS NULL OR jsonb_typeof(delivery_pin)='object');
ALTER TABLE product.shipping_rate_quotes ADD COLUMN destination_pin jsonb;
ALTER TABLE product.shipping_rate_quotes ADD COLUMN origin_pin jsonb;
ALTER TABLE product.shipping_rate_quotes ADD COLUMN requires_pin boolean NOT NULL DEFAULT false;
CREATE TABLE product.shipping_origin_pins (
 provider text PRIMARY KEY CHECK(provider='jubelio'),area_id char(10) NOT NULL,postal_code char(5) NOT NULL,
 pin jsonb NOT NULL CHECK(jsonb_typeof(pin)='object'),updated_by uuid NOT NULL,updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON product.shipping_origin_pins FROM PUBLIC;
ALTER TABLE product.shipping_origin_pins ENABLE ROW LEVEL SECURITY;
COMMIT;
