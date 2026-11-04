-- CP44: indexes for read-only promotion analytics and audit exports.
-- No data changes and no changes to payment or courier handling.
BEGIN;
CREATE INDEX IF NOT EXISTS idx_cp44_orders_attribution_window
 ON product.orders(created_at DESC,id DESC)
 WHERE idempotency_key IS NOT NULL
   AND (promotion_event_id IS NOT NULL OR voucher_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_cp44_orders_campaign_window
 ON product.orders(promotion_event_id,created_at DESC,id DESC)
 WHERE idempotency_key IS NOT NULL AND promotion_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cp44_order_items_order
 ON product.order_items(order_id,id);
COMMIT;
