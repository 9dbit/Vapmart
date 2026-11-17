BEGIN;
-- CP53: Xendit test-mode integration ledger only. No settlement or live money transfer.
CREATE TABLE IF NOT EXISTS product.xendit_payment_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id uuid NOT NULL REFERENCES product.orders(id),
 environment text NOT NULL DEFAULT 'test' CHECK(environment='test'),
 attempt integer NOT NULL CHECK(attempt BETWEEN 1 AND 99),
 reference_id varchar(64) NOT NULL UNIQUE,
 amount_idr bigint NOT NULL CHECK(amount_idr>0),
 currency char(3) NOT NULL DEFAULT 'IDR' CHECK(currency='IDR'),
 request_hash char(64) NOT NULL,
 request_idempotency_key uuid NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'prepared' CHECK(state IN
  ('prepared','creating','active','unknown','failed','awaiting_reconciliation','completed','expired','canceled','review')),
 payment_session_id varchar(64) UNIQUE,
 payment_request_id text,
 payment_id text,
 payment_link_url text,
 provider_business_id text,
 provider_status text,
 expires_at timestamptz,
 last_error_code text,
 last_checked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,attempt)
);
CREATE UNIQUE INDEX IF NOT EXISTS xendit_one_open_session_per_order
 ON product.xendit_payment_sessions(order_id)
 WHERE state IN ('prepared','creating','active','unknown','awaiting_reconciliation','review','completed');
CREATE INDEX IF NOT EXISTS xendit_session_order_recent
 ON product.xendit_payment_sessions(order_id,created_at DESC);
CREATE TABLE IF NOT EXISTS product.xendit_webhook_inbox (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_hash char(64) NOT NULL UNIQUE,
 event_type text NOT NULL CHECK(event_type IN ('payment_session.completed','payment_session.expired')),
 payment_session_id varchar(64) NOT NULL,
 reference_id varchar(64) NOT NULL,
 provider_business_id text NOT NULL,
 amount_idr bigint NOT NULL CHECK(amount_idr>0),
 currency char(3) NOT NULL DEFAULT 'IDR',
 provider_status text NOT NULL CHECK(provider_status IN ('COMPLETED','EXPIRED')),
 payment_id text,
 payment_request_id text,
 provider_created_at timestamptz NOT NULL,
 disposition text NOT NULL DEFAULT 'pending_reconciliation'
  CHECK(disposition IN ('pending_reconciliation','duplicate','quarantined','reconciled')),
 disposition_reason text,
 received_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(payment_session_id,event_type)
);
CREATE INDEX IF NOT EXISTS xendit_inbox_received ON product.xendit_webhook_inbox(received_at DESC);
REVOKE ALL ON product.xendit_payment_sessions,product.xendit_webhook_inbox FROM PUBLIC;
ALTER TABLE product.xendit_payment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product.xendit_webhook_inbox ENABLE ROW LEVEL SECURITY;
COMMIT;
