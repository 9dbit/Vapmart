-- Vapmart staging foundation. Run once via trusted migration operator.
BEGIN;
CREATE SCHEMA IF NOT EXISTS product;
CREATE TABLE IF NOT EXISTS public.staff_roles (
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','customer')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,role)
);
CREATE TABLE IF NOT EXISTS product.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 140),
  description text NOT NULL DEFAULT '',
  category text NOT NULL CHECK (category IN ('home','lifestyle','decor','accessories','electronics','other')),
  price_idr bigint NOT NULL CHECK (price_idr BETWEEN 0 AND 2000000000),
  stock_qty integer NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  image_url text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_restricted_product_terms CHECK ((name || ' ' || description) !~* '(nicotine|nikotin|vape|vaping|rokok|tobacco|e-cig|e-liquid)')
);
CREATE INDEX IF NOT EXISTS idx_product_active_created ON product.products (created_at DESC) WHERE is_active = true;
CREATE TABLE IF NOT EXISTS product.orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 customer_user_id uuid NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','paid','cancelled','fulfilled')),
 currency text NOT NULL DEFAULT 'IDR' CHECK(currency = 'IDR'),
 total_idr bigint NOT NULL DEFAULT 0 CHECK(total_idr >= 0),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product.order_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES product.orders(id) ON DELETE CASCADE,
 product_id uuid NOT NULL REFERENCES product.products(id),
 quantity integer NOT NULL CHECK(quantity > 0),
 unit_price_idr bigint NOT NULL CHECK(unit_price_idr >= 0)
);
-- Roles deliberately NOT provisioned with shared superuser credentials here.
-- Supabase Auth remains an external identity provider, not a copied auth schema.
-- No anon or authenticated SQL grants on these tables.
REVOKE ALL ON SCHEMA product FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA product FROM PUBLIC;
REVOKE ALL ON public.staff_roles FROM PUBLIC;
COMMIT;
