-- Vapmart CP17: REVIEW-ONLY PostgreSQL contract for WordPress merchandising sources.
-- DO NOT execute as part of current deploy. Not included in apps/api/src/migrate.ts.
-- Source: docs/legacy-source-capture-cp17.json; no customer/order/payment import.
-- Existing product.products.category remains untouched until explicit cutover.
BEGIN;

CREATE SCHEMA IF NOT EXISTS storefront;

CREATE TABLE IF NOT EXISTS product.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  parent_id uuid REFERENCES product.categories(id) ON DELETE SET NULL,
  image_url text,
  description text NOT NULL DEFAULT '',
  source_system text NOT NULL DEFAULT 'wordpress-archive',
  source_key text,
  source_wp_id bigint,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_reference_only boolean NOT NULL DEFAULT true,
  is_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_source_key
  ON product.categories (source_system, source_key) WHERE source_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_wp_id
  ON product.categories (source_wp_id) WHERE source_wp_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS product.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  logo_url text,
  description text NOT NULL DEFAULT '',
  source_system text NOT NULL DEFAULT 'wordpress-archive',
  source_wp_id bigint,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  is_reference_only boolean NOT NULL DEFAULT true,
  is_visible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_wp_id
  ON product.brands (source_wp_id) WHERE source_wp_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS product.product_category_links (
  product_id uuid NOT NULL REFERENCES product.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES product.categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);

CREATE TABLE IF NOT EXISTS product.product_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  alt_text text NOT NULL DEFAULT '',
  source_system text NOT NULL DEFAULT 'internal',
  source_media_id text,
  source_sha256 char(64),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (source_sha256 IS NULL OR source_sha256 ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS idx_media_product_order
  ON product.product_media (product_id, sort_order, id);

CREATE TABLE IF NOT EXISTS product.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES product.products(id) ON DELETE CASCADE,
  sku text UNIQUE NOT NULL CHECK (sku ~ '^[A-Z0-9][A-Z0-9._-]{2,63}$'),
  label text NOT NULL DEFAULT '',
  options jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(options)='object'),
  price_idr bigint CHECK (price_idr IS NULL OR price_idr BETWEEN 0 AND 2000000000),
  stock_qty integer NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  is_active boolean NOT NULL DEFAULT false,
  source_wp_variation_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_variants_product
  ON product.product_variants (product_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_variants_wp_id
  ON product.product_variants (source_wp_variation_id)
  WHERE source_wp_variation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS storefront.hero_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  desktop_image_url text NOT NULL,
  mobile_image_url text NOT NULL,
  button_label text,
  button_href text,
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  source_system text NOT NULL DEFAULT 'wordpress-archive',
  is_reference_only boolean NOT NULL DEFAULT true,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storefront.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  cover_image_url text,
  source_system text NOT NULL DEFAULT 'wordpress-archive',
  source_wp_id bigint,
  is_reference_only boolean NOT NULL DEFAULT true,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_wp_id
  ON storefront.posts (source_wp_id) WHERE source_wp_id IS NOT NULL;

-- Curated UI references only; no product rows, active offers, accounts or orders.
INSERT INTO product.categories (slug,name,image_url,source_key,sort_order)
VALUES ('brand','Brand','/legacy/categories/brand.png','brand',1),
       ('pod','Pod','/legacy/categories/pod.png','pod',2),
       ('mod','Mod','/legacy/categories/mod.png','mod',3),
       ('cartridge','Cartridge','/legacy/categories/cartridge.png','cartridge',4),
       ('e-juice','Liquid','/legacy/categories/liquid.png','e-juice',5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO storefront.hero_slides (source_key,title,desktop_image_url,mobile_image_url,sort_order)
VALUES ('legacy-hero-01','Vapmart legacy banner 1','/legacy/banners/desktop-01.png','/legacy/banners/mobile-01.png',1),
       ('legacy-hero-02','Vapmart legacy banner 2','/legacy/banners/desktop-02.png','/legacy/banners/mobile-02.png',2),
       ('legacy-hero-03','Vapmart legacy banner 3','/legacy/banners/desktop-03.png','/legacy/banners/mobile-03.png',3)
ON CONFLICT (source_key) DO NOTHING;

-- Existing homepage brand/logo references only; disabled for live merchandising until verified.
INSERT INTO product.brands (slug,name,logo_url,sort_order)
VALUES ('oxva','OXVA','/legacy/brands/brand-01.png',1),
       ('foom','FOOM','/legacy/brands/brand-02.png',2),
       ('iqos','IQOS','/legacy/brands/brand-03.png',3),
       ('into','INTO','/legacy/brands/brand-04.png',4),
       ('joiway','JOIWAY','/legacy/brands/brand-05.png',5),
       ('sp2s','SP2S','/legacy/brands/brand-06.png',6),
       ('lanavape','LANAVAPE','/legacy/brands/brand-07.png',7),
       ('e-super','E-SUPER','/legacy/brands/brand-08.png',8),
       ('rolv','ROLV','/legacy/brands/brand-09.png',9),
       ('liquid-cult','LIQUID CULT','/legacy/brands/brand-10.png',10),
       ('taze','TAZE','/legacy/brands/brand-11.png',11),
       ('seven-liquid','SEVEN LIQUID','/legacy/brands/brand-12.png',12)
ON CONFLICT (slug) DO NOTHING;

-- No public table grants are created. Existing application role policy must be reviewed first.
REVOKE ALL ON SCHEMA storefront FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA storefront FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA product FROM PUBLIC;
COMMIT;
