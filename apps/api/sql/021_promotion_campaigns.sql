-- CP43: operational promotion campaigns and checkout attribution.
-- Additive only. No campaign is seeded or published by this migration.
BEGIN;

ALTER TABLE promotion.events
  ADD COLUMN IF NOT EXISTS auto_apply boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stacking_rule text NOT NULL DEFAULT 'exclusive'
    CHECK(stacking_rule IN ('exclusive','with_voucher')),
  ADD COLUMN IF NOT EXISTS scope_mode text NOT NULL DEFAULT 'all'
    CHECK(scope_mode IN ('all','products','categories')),
  ADD COLUMN IF NOT EXISTS max_discount_idr bigint
    CHECK(max_discount_idr IS NULL OR max_discount_idr > 0),
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 100
    CHECK(priority BETWEEN 0 AND 10000),
  ADD COLUMN IF NOT EXISTS edit_version integer NOT NULL DEFAULT 1
    CHECK(edit_version > 0),
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS promotion.event_products(
  event_id uuid NOT NULL REFERENCES promotion.events(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES product.products(id) ON DELETE RESTRICT,
  PRIMARY KEY(event_id,product_id)
);

CREATE TABLE IF NOT EXISTS promotion.event_categories(
  event_id uuid NOT NULL REFERENCES promotion.events(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES product.categories(id) ON DELETE RESTRICT,
  PRIMARY KEY(event_id,category_id)
);

ALTER TABLE product.orders
  ADD COLUMN IF NOT EXISTS voucher_discount_idr bigint NOT NULL DEFAULT 0
    CHECK(voucher_discount_idr >= 0),
  ADD COLUMN IF NOT EXISTS promotion_event_id uuid REFERENCES promotion.events(id),
  ADD COLUMN IF NOT EXISTS promotion_title text,
  ADD COLUMN IF NOT EXISTS promotion_discount_idr bigint NOT NULL DEFAULT 0
    CHECK(promotion_discount_idr >= 0);

UPDATE product.orders
SET voucher_discount_idr=discount_idr
WHERE voucher_id IS NOT NULL
  AND voucher_discount_idr=0
  AND discount_idr>0;

CREATE INDEX IF NOT EXISTS idx_promotion_runtime
  ON promotion.events(status,auto_apply,starts_at,ends_at,priority,id);
CREATE INDEX IF NOT EXISTS idx_promotion_event_products_product
  ON promotion.event_products(product_id,event_id);
CREATE INDEX IF NOT EXISTS idx_promotion_event_categories_category
  ON promotion.event_categories(category_id,event_id);
CREATE INDEX IF NOT EXISTS idx_orders_promotion_paid
  ON product.orders(promotion_event_id,customer_user_id,payment_status)
  WHERE promotion_event_id IS NOT NULL;

REVOKE ALL ON promotion.event_products,promotion.event_categories FROM PUBLIC;
ALTER TABLE promotion.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion.redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion.event_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion.event_categories ENABLE ROW LEVEL SECURITY;

COMMIT;
