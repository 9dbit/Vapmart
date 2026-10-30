-- Checkpoint 21: additive commerce/member/coin ledger schema. Staging only.
-- Supabase Auth is a SEPARATE identity provider; auth user IDs are foreign UUID references, not database FKs.
-- Checkout is feature-gated in NestJS until a verified licensed payment integration exists.
BEGIN;
CREATE SCHEMA IF NOT EXISTS membership;
CREATE SCHEMA IF NOT EXISTS commerce;
CREATE SCHEMA IF NOT EXISTS wallet;

CREATE TABLE IF NOT EXISTS public.customer_profiles (
 user_id uuid PRIMARY KEY,
 email text NOT NULL CHECK(length(email) BETWEEN 3 AND 255),
 display_name text CHECK(display_name IS NULL OR length(display_name)<=90),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS membership.accounts (
 user_id uuid PRIMARY KEY REFERENCES public.customer_profiles(user_id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'REGISTERED' CHECK(status IN ('REGISTERED','ACTIVE','SUSPENDED')),
 activated_at timestamptz,
 activation_order_id uuid UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS membership.cards (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL UNIQUE REFERENCES public.customer_profiles(user_id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS commerce.digital_catalog (
 sku text PRIMARY KEY CHECK(sku ~ '^[A-Z0-9][A-Z0-9-]{2,31}$'),
 title text NOT NULL,
 item_type text NOT NULL CHECK(item_type IN ('membership_activation','coin_pack')),
 price_idr bigint NOT NULL CHECK(price_idr BETWEEN 1 AND 2000000),
 credit_coins bigint NOT NULL CHECK(credit_coins=price_idr),
 is_active boolean NOT NULL DEFAULT false,
 sort_order smallint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS commerce.digital_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.customer_profiles(user_id) ON DELETE RESTRICT,
 sku text NOT NULL REFERENCES commerce.digital_catalog(sku),
 quantity smallint NOT NULL DEFAULT 1 CHECK(quantity=1),
 amount_idr bigint NOT NULL CHECK(amount_idr BETWEEN 1 AND 2000000),
 credit_coins bigint NOT NULL CHECK(credit_coins BETWEEN 1 AND 2000000),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','failed','expired','refunded')),
 idempotency_key uuid NOT NULL,
 paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_digital_orders_customer_time ON commerce.digital_orders(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_digital_orders_pending ON commerce.digital_orders(created_at DESC) WHERE status='pending';

CREATE TABLE IF NOT EXISTS commerce.payment_events (
 event_id text PRIMARY KEY CHECK(length(event_id) BETWEEN 8 AND 120),
 order_id uuid NOT NULL REFERENCES commerce.digital_orders(id) ON DELETE RESTRICT,
 provider text NOT NULL,
 outcome text NOT NULL CHECK(outcome IN ('paid','failed','expired')),
 amount_idr bigint NOT NULL CHECK(amount_idr >=0),
 verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payment_events_order ON commerce.payment_events(order_id,verified_at DESC);
CREATE TABLE IF NOT EXISTS wallet.accounts (
 user_id uuid PRIMARY KEY REFERENCES public.customer_profiles(user_id) ON DELETE RESTRICT,
 available_coins bigint NOT NULL DEFAULT 0 CHECK(available_coins >= 0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS wallet.ledger_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES wallet.accounts(user_id) ON DELETE RESTRICT,
 order_id uuid NOT NULL REFERENCES commerce.digital_orders(id) ON DELETE RESTRICT,
 delta_coins bigint NOT NULL CHECK(delta_coins <> 0),
 entry_type text NOT NULL CHECK(entry_type IN ('credit','reversal')),
 memo text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_id,entry_type)
);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user ON wallet.ledger_entries(user_id,created_at DESC);

-- Digital products are distinct from the archived physical products and cannot modify the old product.orders API.
INSERT INTO commerce.digital_catalog(sku,title,item_type,price_idr,credit_coins,is_active,sort_order)
VALUES
 ('MEMBER-ACTIVATION','Vapmart Membership Activation','membership_activation',100000,100000,true,0),
 ('COIN-050','50.000 Vapmart Coin','coin_pack',50000,50000,true,1),
 ('COIN-100','100.000 Vapmart Coin','coin_pack',100000,100000,true,2),
 ('COIN-300','300.000 Vapmart Coin','coin_pack',300000,300000,true,3),
 ('COIN-500','500.000 Vapmart Coin','coin_pack',500000,500000,true,4),
 ('COIN-1000','1.000.000 Vapmart Coin','coin_pack',1000000,1000000,true,5),
 ('COIN-2000','2.000.000 Vapmart Coin','coin_pack',2000000,2000000,true,6)
ON CONFLICT(sku) DO NOTHING;

REVOKE ALL ON SCHEMA membership,commerce,wallet FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA membership,commerce,wallet FROM PUBLIC;
REVOKE ALL ON TABLE public.customer_profiles FROM PUBLIC;
COMMIT;
