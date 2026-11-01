-- CP34: immutable inventory movements, serialized stock adjustments and an opening baseline.
-- This is additive. Existing inventory is not deleted or reclassified as new receipts.
BEGIN;
ALTER TABLE product.inventory_events DROP CONSTRAINT IF EXISTS inventory_events_reason_check;
ALTER TABLE product.inventory_events ADD CONSTRAINT inventory_events_reason_check
 CHECK(reason IN('opening_balance','stock_receipt','adjustment','return','reserve','release','fulfilment'));
ALTER TABLE product.inventory_events ADD COLUMN IF NOT EXISTS movement_key uuid;
ALTER TABLE product.inventory_events ADD COLUMN IF NOT EXISTS stock_before integer CHECK(stock_before >= 0);
ALTER TABLE product.inventory_events ADD COLUMN IF NOT EXISTS stock_after integer CHECK(stock_after >= 0);
ALTER TABLE product.inventory_events ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '' CHECK(length(notes)<=300);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_event_key
 ON product.inventory_events(product_id,movement_key) WHERE movement_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_actor ON product.inventory_events(actor_id,created_at DESC);
INSERT INTO product.inventory_events(product_id,delta_qty,reason,stock_before,stock_after,notes)
SELECT p.id,p.stock_qty,'opening_balance',0,p.stock_qty,'CP34 opening balance: pre-existing stock; source not yet independently verified'
FROM product.products p
WHERE p.stock_qty>0 AND p.slug NOT LIKE 'demo-%'
  AND NOT EXISTS(SELECT 1 FROM product.inventory_events ev WHERE ev.product_id=p.id);
COMMIT;
