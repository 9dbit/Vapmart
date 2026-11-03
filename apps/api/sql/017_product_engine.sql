-- CP39: additive catalog/variant metadata. No existing stock or prices are rewritten.
BEGIN;
CREATE TABLE product.categories (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
 slug text UNIQUE NOT NULL CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug)<=120),
 parent_id uuid REFERENCES product.categories(id),
 image_url text,
 description text NOT NULL DEFAULT '' CHECK(length(description)<=1500),
 is_active boolean NOT NULL DEFAULT true,
 edit_version integer NOT NULL DEFAULT 1 CHECK(edit_version>0),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(parent_id IS DISTINCT FROM id)
);
INSERT INTO product.categories(name,slug) VALUES
 ('Home','home'),('Lifestyle','lifestyle'),('Decor','decor'),('Accessories','accessories'),('Electronics','electronics'),('Lainnya','other');
ALTER TABLE product.products DROP CONSTRAINT IF EXISTS products_category_check;
ALTER TABLE product.products ADD CONSTRAINT products_category_reference FOREIGN KEY(category) REFERENCES product.categories(slug) ON UPDATE CASCADE;
ALTER TABLE product.products ADD COLUMN fulfillment_owner_brand_id uuid REFERENCES product.brands(id);
UPDATE product.products SET fulfillment_owner_brand_id=brand_id WHERE brand_id IS NOT NULL;
ALTER TABLE product.order_items ADD COLUMN ownership_scope text NOT NULL DEFAULT 'unknown' CHECK(ownership_scope IN('unknown','platform','brand'));
UPDATE product.order_items SET ownership_scope='brand' WHERE brand_id IS NOT NULL;
ALTER TABLE product.products ADD COLUMN product_type text NOT NULL DEFAULT 'simple' CHECK(product_type IN('simple','variable','variation'));
ALTER TABLE product.products ADD COLUMN parent_product_id uuid REFERENCES product.products(id);
ALTER TABLE product.products ADD COLUMN attributes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(attributes)='array' AND jsonb_array_length(attributes)<=3);
ALTER TABLE product.products ADD COLUMN option_values jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(option_values)='object');
ALTER TABLE product.products ADD COLUMN sale_price_idr bigint CHECK(sale_price_idr>=0);
ALTER TABLE product.products ADD COLUMN sale_starts_at timestamptz;
ALTER TABLE product.products ADD COLUMN sale_ends_at timestamptz;
ALTER TABLE product.products ADD COLUMN archived_at timestamptz;
ALTER TABLE product.products ADD CONSTRAINT valid_variant_parent CHECK((product_type='variation')=(parent_product_id IS NOT NULL));
ALTER TABLE product.products ADD CONSTRAINT valid_sale_price CHECK(sale_price_idr IS NULL OR sale_price_idr<price_idr);
ALTER TABLE product.products ADD CONSTRAINT valid_sale_schedule CHECK(sale_starts_at IS NULL OR sale_ends_at IS NULL OR sale_starts_at<sale_ends_at);
CREATE UNIQUE INDEX product_variant_combination ON product.products(parent_product_id,option_values) WHERE parent_product_id IS NOT NULL AND archived_at IS NULL;
CREATE INDEX product_parent_idx ON product.products(parent_product_id);
CREATE TABLE product.product_categories (
 product_id uuid NOT NULL REFERENCES product.products(id),category_id uuid NOT NULL REFERENCES product.categories(id),
 PRIMARY KEY(product_id,category_id)
);
INSERT INTO product.product_categories(product_id,category_id) SELECT p.id,c.id FROM product.products p JOIN product.categories c ON c.slug=p.category;
CREATE TABLE product.catalog_requests (
 actor_id uuid NOT NULL,request_key uuid NOT NULL,request_hash text NOT NULL,
 response jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,request_key)
);
CREATE TABLE product.catalog_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,actor_id uuid NOT NULL,
 entity_type text NOT NULL,entity_id uuid NOT NULL,action text NOT NULL,
 before_data jsonb,after_data jsonb,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX catalog_audit_entity ON product.catalog_audit(entity_type,entity_id,id DESC);
CREATE TABLE product.catalog_imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL,fingerprint text NOT NULL,
 source_key text NOT NULL,mode text NOT NULL CHECK(mode IN('create','upsert')),
 state text NOT NULL DEFAULT 'preview' CHECK(state IN('preview','applied')),
 plan jsonb NOT NULL,report jsonb,expires_at timestamptz NOT NULL DEFAULT now()+interval '30 minutes',
 created_at timestamptz NOT NULL DEFAULT now(),applied_at timestamptz,
 UNIQUE(actor_id,fingerprint)
);
CREATE TABLE product.catalog_source_rows (
 source_key text NOT NULL,source_id text NOT NULL,product_id uuid NOT NULL REFERENCES product.products(id),
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(source_key,source_id)
);
CREATE TABLE product.product_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),product_id uuid NOT NULL REFERENCES product.products(id),
 purchased_product_id uuid NOT NULL REFERENCES product.products(id),order_item_id uuid UNIQUE NOT NULL REFERENCES product.order_items(id),
 customer_user_id uuid NOT NULL,display_name text NOT NULL CHECK(length(display_name) BETWEEN 2 AND 60),
 rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),body text NOT NULL CHECK(length(body) BETWEEN 10 AND 2000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected','spam','trash')),
 reply text NOT NULL DEFAULT '' CHECK(length(reply)<=2000),reply_by uuid,reply_at timestamptz,
 edit_version integer NOT NULL DEFAULT 1 CHECK(edit_version>0),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_reviews_public ON product.product_reviews(product_id,created_at DESC) WHERE status='approved';
-- A null brand is a platform-managed shipment, not an invented brand or partner membership.
ALTER TABLE product.fulfillment_batches ALTER COLUMN brand_id DROP NOT NULL;
CREATE UNIQUE INDEX fulfillment_platform_batch ON product.fulfillment_batches(order_id,warehouse_id) WHERE brand_id IS NULL;
-- Keep original upload bytes privately when new uploads are normalized for display.
ALTER TABLE product.media_assets ADD COLUMN original_content bytea;
ALTER TABLE product.media_assets ADD COLUMN original_mime_type text;
REVOKE ALL ON product.categories,product.product_categories,product.catalog_requests,product.catalog_audit,
 product.catalog_imports,product.catalog_source_rows,product.product_reviews FROM PUBLIC;
ALTER TABLE product.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product.catalog_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE product.catalog_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE product.catalog_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE product.catalog_source_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE product.product_reviews ENABLE ROW LEVEL SECURITY;
COMMIT;
