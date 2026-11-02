-- CP33: scoped brand identities, item shipping metadata, and auditable operations.
-- Brand users never get direct database privileges; scope enforced by NestJS APIs.
BEGIN;
CREATE TABLE IF NOT EXISTS product.brand_memberships(
 brand_id uuid NOT NULL REFERENCES product.brands(id) ON DELETE CASCADE,
 user_id uuid NOT NULL,
 role text NOT NULL CHECK(role IN ('owner','manager','viewer')),
 is_active boolean NOT NULL DEFAULT true,
 added_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(brand_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_brand_memberships_user ON product.brand_memberships(user_id) WHERE is_active=true;
CREATE TABLE IF NOT EXISTS product.brand_access_audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 brand_id uuid NOT NULL,
 user_id uuid NOT NULL,
 actor_id uuid NOT NULL,
 role text NOT NULL,
 is_active boolean NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE product.products ADD COLUMN IF NOT EXISTS weight_grams integer CHECK(weight_grams BETWEEN 1 AND 1000000);
ALTER TABLE product.products ADD COLUMN IF NOT EXISTS length_cm integer CHECK(length_cm BETWEEN 1 AND 1000);
ALTER TABLE product.products ADD COLUMN IF NOT EXISTS width_cm integer CHECK(width_cm BETWEEN 1 AND 1000);
ALTER TABLE product.products ADD COLUMN IF NOT EXISTS height_cm integer CHECK(height_cm BETWEEN 1 AND 1000);
CREATE TABLE IF NOT EXISTS product.inventory_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id uuid NOT NULL REFERENCES product.products(id),
 delta_qty integer NOT NULL CHECK(delta_qty <> 0),
 reason text NOT NULL CHECK(reason IN ('stock_receipt','adjustment','return','reserve','release','fulfilment')),
 actor_id uuid,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_events_product_time ON product.inventory_events(product_id,created_at DESC);
CREATE TABLE IF NOT EXISTS product.shipments(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES product.orders(id),
 brand_id uuid REFERENCES product.brands(id),
 provider text NOT NULL,
 courier_code text,
 service_code text,
 tracking_number text,
 state text NOT NULL DEFAULT 'not_booked' CHECK(state IN ('not_booked','booked','picked_up','in_transit','delivered','failed','cancelled')),
 provider_shipment_id text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shipments_order ON product.shipments(order_id);
REVOKE ALL ON product.brand_memberships,product.brand_access_audit,product.inventory_events,product.shipments FROM PUBLIC;
COMMIT;
