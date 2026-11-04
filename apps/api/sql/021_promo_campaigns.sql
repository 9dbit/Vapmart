-- CP43 promotion campaigns: independent from voucher codes, safe by default.
BEGIN;
CREATE TABLE IF NOT EXISTS product.promo_campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 3 AND 120),
 campaign_code text NOT NULL UNIQUE CHECK (campaign_code ~ '^[A-Z0-9][A-Z0-9_-]{2,39}$'),
 discount_type text NOT NULL CHECK (discount_type IN ('fixed','percent')),
 discount_value integer NOT NULL CHECK (discount_value > 0 AND (discount_type <> 'percent' OR discount_value <= 100)),
 max_discount_idr bigint CHECK (max_discount_idr IS NULL OR max_discount_idr > 0),
 min_subtotal_idr bigint NOT NULL DEFAULT 0 CHECK (min_subtotal_idr >= 0),
 usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
 scope_type text NOT NULL DEFAULT 'all' CHECK (scope_type IN ('all','products','categories')),
 stacking_policy text NOT NULL DEFAULT 'exclusive' CHECK (stacking_policy IN ('exclusive','allow_voucher')),
 priority integer NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 10000),
 starts_at timestamptz,
 ends_at timestamptz,
 is_active boolean NOT NULL DEFAULT false,
 edit_version integer NOT NULL DEFAULT 1 CHECK (edit_version > 0),
 created_by uuid,
 updated_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
);
CREATE TABLE IF NOT EXISTS product.promo_campaign_targets (
 campaign_id uuid NOT NULL REFERENCES product.promo_campaigns(id) ON DELETE CASCADE,
 target_type text NOT NULL CHECK (target_type IN ('product','category')),
 target_id uuid NOT NULL,
 PRIMARY KEY(campaign_id,target_type,target_id)
);
CREATE INDEX IF NOT EXISTS idx_promo_campaigns_active_schedule ON product.promo_campaigns(is_active,starts_at,ends_at,priority);
CREATE INDEX IF NOT EXISTS idx_promo_campaign_targets_lookup ON product.promo_campaign_targets(target_type,target_id);
REVOKE ALL ON product.promo_campaigns,product.promo_campaign_targets FROM PUBLIC;
ALTER TABLE product.promo_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE product.promo_campaign_targets ENABLE ROW LEVEL SECURITY;
COMMIT;
