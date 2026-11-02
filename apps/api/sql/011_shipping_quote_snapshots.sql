-- CP34: authenticated, expiring sandbox courier quote snapshots.
-- These records ONLY support draft order reviews; no courier booking or payment is enabled.
BEGIN;
CREATE TABLE IF NOT EXISTS product.shipping_rate_quotes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_user_id uuid NOT NULL,
 cart_fingerprint char(64) NOT NULL,
 origin_postal_code char(5) NOT NULL,
 destination_postal_code char(5) NOT NULL,
 provider text NOT NULL CHECK(provider='biteship_test'),
 courier_code text NOT NULL,
 service_code text NOT NULL,
 courier_name text NOT NULL,
 service_name text NOT NULL,
 amount_idr bigint NOT NULL CHECK(amount_idr BETWEEN 0 AND 10000000),
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL CHECK(expires_at>created_at),
 applied_order_id uuid UNIQUE REFERENCES product.orders(id)
);
CREATE INDEX IF NOT EXISTS idx_shipping_quote_user_expiry ON product.shipping_rate_quotes(customer_user_id,expires_at DESC);
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS shipping_quote_id uuid REFERENCES product.shipping_rate_quotes(id);
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS shipping_provider text;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS shipping_courier_code text;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS shipping_service_code text;
REVOKE ALL ON product.shipping_rate_quotes FROM PUBLIC;
COMMIT;
