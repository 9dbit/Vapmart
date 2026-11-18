BEGIN;
ALTER TABLE product.orders ADD COLUMN payment_environment text CHECK(payment_environment IN ('test','live'));
UPDATE product.orders SET payment_environment='test' WHERE payment_method IN ('qris','virtual_account','ewallet');
ALTER TABLE product.xendit_payment_sessions DROP CONSTRAINT xendit_payment_sessions_environment_check;
ALTER TABLE product.xendit_payment_sessions ADD CONSTRAINT xendit_payment_sessions_environment_check CHECK(environment IN ('test','live'));
CREATE TABLE product.xendit_live_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES product.orders(id),
 session_record_id uuid NOT NULL UNIQUE REFERENCES product.xendit_payment_sessions(id),
 payment_id text NOT NULL UNIQUE,
 payment_request_id text NOT NULL UNIQUE,
 business_id text NOT NULL,
 amount_idr bigint NOT NULL CHECK(amount_idr>0),
 currency char(3) NOT NULL CHECK(currency='IDR'),
 disposition text NOT NULL CHECK(disposition IN ('applied','review')),
 verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX xendit_live_payments_order ON product.xendit_live_payments(order_id);
REVOKE ALL ON product.xendit_live_payments FROM PUBLIC;
ALTER TABLE product.xendit_live_payments ENABLE ROW LEVEL SECURITY;
COMMIT;
