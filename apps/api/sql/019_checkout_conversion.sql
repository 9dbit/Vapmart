-- CP41: voucher-ready checkout and manual bank-transfer test flow.
-- Additive only: no vouchers are seeded, no payment is captured, and no courier booking is enabled.
BEGIN;

CREATE TABLE IF NOT EXISTS product.vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
  discount_type text NOT NULL CHECK (discount_type IN ('fixed','percent')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  max_discount_idr bigint CHECK (max_discount_idr IS NULL OR max_discount_idr > 0),
  min_subtotal_idr bigint NOT NULL DEFAULT 0 CHECK (min_subtotal_idr >= 0),
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (discount_type <> 'percent' OR discount_value <= 100),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
);

ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS voucher_id uuid REFERENCES product.vouchers(id);
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS voucher_code text;
ALTER TABLE product.orders ADD COLUMN IF NOT EXISTS discount_idr bigint NOT NULL DEFAULT 0 CHECK (discount_idr >= 0);

ALTER TABLE product.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE product.orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK(payment_method IS NULL OR payment_method IN ('qris','virtual_account','ewallet','bank_transfer'));

CREATE INDEX IF NOT EXISTS idx_vouchers_active_code ON product.vouchers(code) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_orders_voucher_paid ON product.orders(voucher_id,payment_status) WHERE voucher_id IS NOT NULL;

REVOKE ALL ON product.vouchers FROM PUBLIC;
ALTER TABLE product.vouchers ENABLE ROW LEVEL SECURITY;

COMMIT;
