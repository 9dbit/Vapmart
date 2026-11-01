-- CP36: forward-only courier manifest, verified provider-event ledger and guarded customer returns.
-- DOES NOT enable payment, courier booking or automatic refunds.
BEGIN;
ALTER TABLE product.warehouses ADD COLUMN IF NOT EXISTS contact_name text;
ALTER TABLE product.warehouses ADD COLUMN IF NOT EXISTS contact_phone text;
ALTER TABLE product.fulfillment_batches ADD COLUMN IF NOT EXISTS carrier_handover_at timestamptz;
ALTER TABLE product.shipments ADD COLUMN IF NOT EXISTS courier_tracking_id text;
ALTER TABLE product.shipments ADD COLUMN IF NOT EXISTS tracking_url text;
ALTER TABLE product.shipments ADD COLUMN IF NOT EXISTS provider_status text;
ALTER TABLE product.shipments ADD COLUMN IF NOT EXISTS status_rank integer NOT NULL DEFAULT 0;
ALTER TABLE product.shipments ADD COLUMN IF NOT EXISTS actual_shipping_fee_idr bigint CHECK(actual_shipping_fee_idr IS NULL OR actual_shipping_fee_idr>=0);
CREATE TABLE IF NOT EXISTS product.courier_manifests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 batch_id uuid NOT NULL UNIQUE REFERENCES product.fulfillment_batches(id),
 request_key uuid NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'prepared' CHECK(state IN('prepared','void')),
 pickup_method text NOT NULL DEFAULT 'pickup' CHECK(pickup_method IN('pickup','drop_off')),
 pickup_date date,
 pickup_time text CHECK(pickup_time IS NULL OR pickup_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
 total_weight_grams integer NOT NULL CHECK(total_weight_grams BETWEEN 1 AND 100000000),
 created_by uuid NOT NULL,
 notes text NOT NULL CHECK(length(notes) BETWEEN 6 AND 300),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT courier_manifest_pickup_window CHECK ((pickup_date IS NULL AND pickup_time IS NULL) OR (pickup_date IS NOT NULL AND pickup_time IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS product.courier_manifest_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 manifest_id uuid NOT NULL REFERENCES product.courier_manifests(id),
 order_item_id uuid NOT NULL REFERENCES product.order_items(id),
 product_id uuid NOT NULL REFERENCES product.products(id),
 quantity integer NOT NULL CHECK(quantity>0),
 weight_grams integer NOT NULL CHECK(weight_grams BETWEEN 1 AND 100000000),
 unit_value_idr bigint NOT NULL CHECK(unit_value_idr BETWEEN 0 AND 2000000000),
 length_cm integer,
 width_cm integer,
 height_cm integer,
 UNIQUE(manifest_id,order_item_id)
);
CREATE TABLE IF NOT EXISTS product.courier_tracking_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 shipment_id uuid NOT NULL REFERENCES product.shipments(id),
 event_hash char(64) NOT NULL,
 event_type text NOT NULL CHECK(event_type IN('order.status','order.waybill_id','order.price')),
 provider_status text,
 waybill_id text,
 observed_fee_idr bigint,
 is_applied boolean NOT NULL DEFAULT false,
 received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(shipment_id,event_hash)
);
CREATE INDEX IF NOT EXISTS courier_tracking_events_shipment_idx ON product.courier_tracking_events(shipment_id,received_at,id);
CREATE TABLE IF NOT EXISTS product.courier_returns(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 batch_id uuid NOT NULL REFERENCES product.fulfillment_batches(id),
 order_id uuid NOT NULL REFERENCES product.orders(id),
 customer_user_id uuid NOT NULL,
 request_key uuid NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'requested' CHECK(status IN('requested','approved','rejected','received','restocked')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 500),
 review_note text,
 review_actor uuid,
 received_note text,
 received_warehouse_id uuid REFERENCES product.warehouses(id),
 restock_key uuid UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(batch_id,customer_user_id)
);
CREATE INDEX IF NOT EXISTS courier_returns_status_created_idx ON product.courier_returns(status,created_at DESC);
CREATE TABLE IF NOT EXISTS product.courier_return_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 return_id uuid NOT NULL REFERENCES product.courier_returns(id),
 status text NOT NULL CHECK(status IN('requested','approved','rejected','received','restocked')),
 actor_id uuid,
 note text NOT NULL CHECK(length(note) BETWEEN 6 AND 500),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS courier_return_events_return_idx ON product.courier_return_events(return_id,created_at,id);
REVOKE ALL ON product.courier_manifests,product.courier_manifest_items,
 product.courier_tracking_events,product.courier_returns,product.courier_return_events FROM PUBLIC;
COMMIT;
