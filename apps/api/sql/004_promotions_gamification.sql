-- Checkpoint 21: event-driven membership benefits, no invented active campaigns.
BEGIN;
CREATE SCHEMA IF NOT EXISTS promotion;
CREATE SCHEMA IF NOT EXISTS gamification;
CREATE TABLE IF NOT EXISTS promotion.events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 title text NOT NULL,
 description text NOT NULL DEFAULT '',
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 member_only boolean NOT NULL DEFAULT true,
 discount_type text CHECK(discount_type IS NULL OR discount_type IN ('percentage','fixed','early_access')),
 discount_value integer NOT NULL DEFAULT 0 CHECK(discount_value BETWEEN 0 AND 100000000),
 minimum_spend_idr bigint NOT NULL DEFAULT 0,
 max_uses_per_user integer NOT NULL DEFAULT 1 CHECK(max_uses_per_user>=0),
 CHECK(ends_at>starts_at)
);
CREATE INDEX IF NOT EXISTS idx_promotion_active_dates ON promotion.events(starts_at,ends_at) WHERE status='published';
CREATE TABLE IF NOT EXISTS promotion.redemptions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 event_id uuid NOT NULL REFERENCES promotion.events(id) ON DELETE RESTRICT,
 user_id uuid NOT NULL,
 order_id uuid NOT NULL,
 redeemed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_id,user_id,order_id)
);
CREATE TABLE IF NOT EXISTS gamification.xp_ledger(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 source_key text NOT NULL UNIQUE,
 xp integer NOT NULL CHECK(xp BETWEEN 1 AND 1000000),
 description text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gamification_xp_user ON gamification.xp_ledger(user_id,created_at DESC);
-- No campaign is seeded or automatically activated: eligibility must be approved and configured by admin.
REVOKE ALL ON SCHEMA promotion,gamification FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA promotion,gamification FROM PUBLIC;
COMMIT;
