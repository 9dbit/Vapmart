BEGIN;
-- Preserve the pre-upgrade order snapshot without exporting customer data.
CREATE TABLE product.order_upgrade_baselines AS
 SELECT o.id AS order_id,to_jsonb(o) AS snapshot,
 (SELECT coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) FROM product.order_items i WHERE i.order_id=o.id) AS items,
 now() AS captured_at FROM product.orders o;
ALTER TABLE product.order_upgrade_baselines ADD PRIMARY KEY(order_id);
CREATE SEQUENCE product.invoice_numbers;
ALTER TABLE product.orders ADD COLUMN operational_status text;
ALTER TABLE product.orders ADD COLUMN operational_hold boolean NOT NULL DEFAULT false;
ALTER TABLE product.orders ADD COLUMN edit_version integer NOT NULL DEFAULT 1 CHECK(edit_version>0);
ALTER TABLE product.orders ADD COLUMN processing_started_at timestamptz;
ALTER TABLE product.orders ADD COLUMN additional_fees jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(additional_fees)='array');
ALTER TABLE product.orders ADD COLUMN additional_fee_idr bigint NOT NULL DEFAULT 0 CHECK(additional_fee_idr>=0);
ALTER TABLE product.orders ADD COLUMN invoice_number text NOT NULL DEFAULT ('VM-'||lpad(nextval('product.invoice_numbers')::text,10,'0'));
CREATE UNIQUE INDEX order_invoice_number_unique ON product.orders(invoice_number);
UPDATE product.orders SET operational_status=CASE
 WHEN payment_status='refunded' THEN 'refunded'
 WHEN status='cancelled' THEN 'cancelled'
 WHEN status='fulfilled' THEN 'completed'
 WHEN status='paid' AND payment_status='paid' AND payment_provider IS NOT NULL AND payment_reference IS NOT NULL THEN 'processing'
 WHEN status='paid' THEN 'on_hold'
 WHEN payment_status='failed' THEN 'failed'
 WHEN status='pending' OR payment_status='pending' THEN 'pending_payment' ELSE 'draft' END;
UPDATE product.orders SET processing_started_at=created_at
 WHERE operational_status IN('processing','completed') OR EXISTS(SELECT 1 FROM product.fulfillment_batches f WHERE f.order_id=product.orders.id);
ALTER TABLE product.orders ALTER COLUMN operational_status SET NOT NULL;
ALTER TABLE product.orders ADD CONSTRAINT orders_operational_status_check CHECK(operational_status IN('draft','pending_payment','processing','completed','on_hold','cancelled','refunded','failed','pre_order'));
CREATE INDEX order_operational_status_created ON product.orders(operational_status,created_at DESC);
CREATE FUNCTION product.order_revision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.payment_status='refunded' THEN NEW.status:='cancelled'; END IF;
 IF TG_OP='INSERT' OR (NEW.operational_status IS NOT DISTINCT FROM OLD.operational_status AND
   (NEW.status IS DISTINCT FROM OLD.status OR NEW.payment_status IS DISTINCT FROM OLD.payment_status)) THEN
   NEW.operational_status := CASE
    WHEN NEW.payment_status='refunded' THEN 'refunded' WHEN NEW.status='cancelled' THEN 'cancelled'
    WHEN NEW.status='fulfilled' THEN 'completed'
    WHEN NEW.status='paid' AND NEW.payment_status='paid' AND NEW.payment_provider IS NOT NULL AND NEW.payment_reference IS NOT NULL
      THEN CASE WHEN NEW.operational_hold THEN 'on_hold' ELSE 'processing' END
    WHEN NEW.status='paid' THEN 'on_hold' WHEN NEW.payment_status='failed' THEN 'failed'
    WHEN NEW.status='pending' OR NEW.payment_status='pending' THEN 'pending_payment' ELSE 'draft' END;
 END IF;
 IF TG_OP='UPDATE' THEN
   NEW.edit_version:=OLD.edit_version+1;
   NEW.processing_started_at:=coalesce(OLD.processing_started_at,NEW.processing_started_at);
 END IF;
 IF NEW.operational_status IN('processing','completed') THEN NEW.processing_started_at:=coalesce(NEW.processing_started_at,now()); END IF;
 NEW.updated_at:=now();
 RETURN NEW;
END $$;
CREATE TRIGGER order_revision_guard BEFORE INSERT OR UPDATE ON product.orders FOR EACH ROW EXECUTE FUNCTION product.order_revision_guard();
CREATE TABLE product.order_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES product.orders(id),
 actor_id uuid,action text NOT NULL,notes text NOT NULL,
 before_data jsonb,after_data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_date ON product.order_events(order_id,created_at,id);
CREATE TABLE product.order_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL REFERENCES product.orders(id),
 order_version integer NOT NULL,invoice_number text NOT NULL,snapshot jsonb NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(order_id,order_version)
);
ALTER TABLE product.shipping_rate_quotes ADD COLUMN admin_order_id uuid REFERENCES product.orders(id);
ALTER TABLE product.shipping_rate_quotes ADD COLUMN admin_edit_hash char(64);
REVOKE ALL ON product.order_upgrade_baselines,product.order_events,product.order_invoices FROM PUBLIC;
REVOKE ALL ON SEQUENCE product.invoice_numbers FROM PUBLIC;
ALTER TABLE product.order_upgrade_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE product.order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE product.order_invoices ENABLE ROW LEVEL SECURITY;
COMMIT;
