-- CP26: additive catalog brands, restricted product media and payment-ready draft orders.
-- No payment can be captured by this schema. Product and order schemas remain private.
BEGIN;
CREATE TABLE IF NOT EXISTS product.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(name) BETWEEN 2 AND 100),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 1200),
  logo_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_restricted_brand_terms CHECK ((name || ' ' || slug || ' ' || description) !~* '(nicotine|nikotin|vape|vaping|rokok|tobacco|e-cig|e-liquid)')
);
ALTER TABLE product.products ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES product.brands(id) ON DELETE SET NULL;
ALTER TABLE product.products ADD COLUMN IF NOT EXISTS gallery_urls text[] NOT NULL DEFAULT ARRAY[]::text[];
CREATE INDEX IF NOT EXISTS idx_products_brand ON product.products(brand_id);
CREATE TABLE IF NOT EXISTS product.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid NOT NULL,
  filename text NOT NULL CHECK(length(filename) BETWEEN 1 AND 160),
  mime_type text NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp')),
  size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 1 AND 1572864),
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT media_size_valid CHECK(octet_length(content) = size_bytes)
);
CREATE INDEX IF NOT EXISTS idx_media_uploaded_by ON product.media_assets(uploaded_by,created_at DESC);
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS idempotency_key uuid;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS request_hash text;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS address_line text;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS shipping_method text DEFAULT 'standard';
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS subtotal_idr bigint NOT NULL DEFAULT 0;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS shipping_fee_idr bigint NOT NULL DEFAULT 0;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS payment_method text CHECK(payment_method IS NULL OR payment_method IN ('qris','virtual_account','ewallet'));
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_initiated' CHECK(payment_status IN ('not_initiated','pending','paid','failed','refunded'));
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS payment_provider text;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE product.order_items ADD COLUMN IF NOT EXISTS product_name text NOT NULL DEFAULT '';
ALTER TABLE product.order_items ADD COLUMN IF NOT EXISTS sku text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_idempotency ON product.orders(customer_user_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_customer_created ON product.orders(customer_user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_status_created ON product.orders(status,created_at DESC);
REVOKE ALL ON product.brands, product.media_assets FROM PUBLIC;
COMMIT;
