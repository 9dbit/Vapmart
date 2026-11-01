-- CP35: Multi-warehouse ledger, verified paid order reservations, per-brand fulfillment and internal tracking.
-- All legacy stock is preserved in a non-dispatchable hold location. Payments and courier booking remain OFF.
BEGIN;
CREATE TABLE IF NOT EXISTS product.warehouses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE CHECK(code ~ '^[A-Z0-9][A-Z0-9-]{1,23}$'),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 100),
 address_line text NOT NULL DEFAULT '',
 city text NOT NULL DEFAULT '',
 province text NOT NULL DEFAULT '',
 postal_code char(5),
 is_active boolean NOT NULL DEFAULT true,
 is_dispatch_enabled boolean NOT NULL DEFAULT false,
 is_system_hold boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT warehouse_dispatch_valid CHECK(
   NOT is_dispatch_enabled OR
   (is_active AND NOT is_system_hold AND postal_code ~ '^[0-9]{5}$'
    AND length(trim(city))>=2 AND length(trim(province))>=2
    AND length(trim(address_line))>=8)
 ),
 CONSTRAINT hold_never_dispatch CHECK(NOT is_system_hold OR NOT is_dispatch_enabled)
);
CREATE TABLE IF NOT EXISTS product.warehouse_stock (
 warehouse_id uuid NOT NULL REFERENCES product.warehouses(id),
 product_id uuid NOT NULL REFERENCES product.products(id),
 on_hand integer NOT NULL DEFAULT 0 CHECK(on_hand>=0),
 reserved integer NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=on_hand),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(warehouse_id,product_id)
);
CREATE INDEX IF NOT EXISTS warehouse_stock_product_idx ON product.warehouse_stock(product_id);
CREATE TABLE IF NOT EXISTS product.warehouse_stock_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 warehouse_id uuid NOT NULL REFERENCES product.warehouses(id),
 product_id uuid NOT NULL REFERENCES product.products(id),
 delta_on_hand integer NOT NULL DEFAULT 0,
 delta_reserved integer NOT NULL DEFAULT 0,
 on_hand_before integer NOT NULL CHECK(on_hand_before>=0),
 on_hand_after integer NOT NULL CHECK(on_hand_after>=0),
 reserved_before integer NOT NULL CHECK(reserved_before>=0),
 reserved_after integer NOT NULL CHECK(reserved_after>=0 AND reserved_after<=on_hand_after),
 reason text NOT NULL CHECK(reason IN ('legacy_import','receipt','adjustment','return','transfer_in','transfer_out','reserve','release','fulfilled')),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=300),
 actor_id uuid,
 movement_key uuid,
 batch_id uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT stock_event_has_effect CHECK(delta_on_hand<>0 OR delta_reserved<>0),
 CONSTRAINT stock_event_matches_hand CHECK(on_hand_after=on_hand_before+delta_on_hand),
 CONSTRAINT stock_event_matches_reserved CHECK(reserved_after=reserved_before+delta_reserved)
);
CREATE INDEX IF NOT EXISTS warehouse_stock_events_lookup ON product.warehouse_stock_events(product_id,warehouse_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_stock_events_key
 ON product.warehouse_stock_events(warehouse_id,product_id,movement_key) WHERE movement_key IS NOT NULL;
CREATE TABLE IF NOT EXISTS product.warehouse_transfers(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 movement_key uuid NOT NULL UNIQUE,
 product_id uuid NOT NULL REFERENCES product.products(id),
 from_warehouse_id uuid NOT NULL REFERENCES product.warehouses(id),
 to_warehouse_id uuid NOT NULL REFERENCES product.warehouses(id),
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100000),
 notes text NOT NULL CHECK(length(notes) BETWEEN 6 AND 300),
 actor_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(from_warehouse_id<>to_warehouse_id)
);
ALTER TABLE product.order_items ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES product.brands(id);
UPDATE product.order_items oi SET brand_id=p.brand_id FROM product.products p
 WHERE oi.product_id=p.id AND oi.brand_id IS NULL;
CREATE TABLE IF NOT EXISTS product.fulfillment_preparations(
 order_id uuid PRIMARY KEY REFERENCES product.orders(id),
 request_key uuid NOT NULL UNIQUE,
 actor_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS product.fulfillment_batches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES product.orders(id),
 brand_id uuid NOT NULL REFERENCES product.brands(id),
 warehouse_id uuid NOT NULL REFERENCES product.warehouses(id),
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN('reserved','picking','packed','ready_for_carrier','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,brand_id,warehouse_id)
);
CREATE INDEX IF NOT EXISTS fulfillment_batches_brand_created ON product.fulfillment_batches(brand_id,created_at DESC);
CREATE TABLE IF NOT EXISTS product.fulfillment_lines(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 batch_id uuid NOT NULL REFERENCES product.fulfillment_batches(id),
 order_item_id uuid NOT NULL REFERENCES product.order_items(id),
 product_id uuid NOT NULL REFERENCES product.products(id),
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100000),
 UNIQUE(batch_id,order_item_id)
);
CREATE TABLE IF NOT EXISTS product.fulfillment_tracking_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 batch_id uuid NOT NULL REFERENCES product.fulfillment_batches(id),
 state text NOT NULL CHECK(state IN('reserved','picking','packed','ready_for_carrier','cancelled')),
 source text NOT NULL DEFAULT 'internal' CHECK(source='internal'),
 actor_id uuid,
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=300),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fulfillment_tracking_batch_time ON product.fulfillment_tracking_events(batch_id,created_at,id);
ALTER TABLE product.shipments ADD COLUMN IF NOT EXISTS fulfillment_batch_id uuid UNIQUE REFERENCES product.fulfillment_batches(id);
-- Preserve any previous inventory under an explicitly unverified, non-dispatchable hold.
INSERT INTO product.warehouses(code,name,address_line,city,province,postal_code,is_active,is_dispatch_enabled,is_system_hold)
 VALUES('LEGACY-HOLD','Unverified opening stock','','','',NULL,true,false,true)
 ON CONFLICT(code) DO NOTHING;
INSERT INTO product.warehouse_stock(warehouse_id,product_id,on_hand,reserved)
 SELECT w.id,p.id,p.stock_qty,0 FROM product.warehouses w CROSS JOIN product.products p
 WHERE w.code='LEGACY-HOLD' AND p.stock_qty>0 AND p.slug NOT LIKE 'demo-%'
 ON CONFLICT(warehouse_id,product_id) DO NOTHING;
INSERT INTO product.warehouse_stock_events(warehouse_id,product_id,delta_on_hand,delta_reserved,
  on_hand_before,on_hand_after,reserved_before,reserved_after,reason,notes)
 SELECT s.warehouse_id,s.product_id,s.on_hand,0,0,s.on_hand,0,0,'legacy_import',
 'CP35: unverified opening stock quarantined, not dispatchable'
 FROM product.warehouse_stock s JOIN product.warehouses w ON w.id=s.warehouse_id
 WHERE w.code='LEGACY-HOLD' AND s.on_hand>0
 AND NOT EXISTS(SELECT 1 FROM product.warehouse_stock_events e
  WHERE e.warehouse_id=s.warehouse_id AND e.product_id=s.product_id);
-- Public saleable quantity is only verified dispatch-enabled available stock.
UPDATE product.products p SET stock_qty=COALESCE((
 SELECT sum(s.on_hand-s.reserved)::integer
 FROM product.warehouse_stock s JOIN product.warehouses w ON w.id=s.warehouse_id
 WHERE s.product_id=p.id AND w.is_active=true AND w.is_dispatch_enabled=true),0)
 WHERE p.slug NOT LIKE 'demo-%';
REVOKE ALL ON product.warehouses,product.warehouse_stock,product.warehouse_stock_events,
 product.warehouse_transfers,product.fulfillment_preparations,product.fulfillment_batches,
 product.fulfillment_lines,product.fulfillment_tracking_events FROM PUBLIC;
COMMIT;
