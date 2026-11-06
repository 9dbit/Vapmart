BEGIN;
CREATE TABLE product.store_profile (
 id boolean PRIMARY KEY DEFAULT true CHECK(id), profile jsonb NOT NULL DEFAULT '{}'::jsonb,
 version integer NOT NULL DEFAULT 1 CHECK(version>0), updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO product.store_profile(id) VALUES(true);
CREATE TABLE product.store_profile_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL,
 before_data jsonb NOT NULL,after_data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE product.manual_payment_confirmations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),order_id uuid NOT NULL UNIQUE REFERENCES product.orders(id),
 idempotency_key uuid NOT NULL UNIQUE,request_hash text NOT NULL,
 amount_idr bigint NOT NULL CHECK(amount_idr>0),paid_at timestamptz NOT NULL,
 bank_name text NOT NULL,account_number text NOT NULL,account_name text NOT NULL,
 reference text NOT NULL,reference_key text NOT NULL UNIQUE,notes text NOT NULL,
 actor_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON product.store_profile,product.store_profile_events,product.manual_payment_confirmations FROM PUBLIC;
ALTER TABLE product.store_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE product.store_profile_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE product.manual_payment_confirmations ENABLE ROW LEVEL SECURITY;
COMMIT;
