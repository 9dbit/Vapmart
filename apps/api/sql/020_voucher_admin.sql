-- CP42: voucher administration metadata and concurrency controls.
-- Additive only; no voucher rows are created or activated by this migration.
BEGIN;

ALTER TABLE product.vouchers
  ADD COLUMN IF NOT EXISTS edit_version integer NOT NULL DEFAULT 1 CHECK(edit_version > 0),
  ADD COLUMN IF NOT EXISTS updated_by uuid;

CREATE INDEX IF NOT EXISTS idx_vouchers_updated_at ON product.vouchers(updated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_vouchers_schedule ON product.vouchers(is_active, starts_at, ends_at);

COMMIT;
