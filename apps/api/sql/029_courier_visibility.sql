BEGIN;
-- Storefront carrier visibility is an explicit admin-managed whitelist.
-- A missing row retains the pre-upgrade behavior until the admin saves a selection.
CREATE TABLE IF NOT EXISTS product.shipping_courier_visibility (
 provider text PRIMARY KEY CHECK (provider IN ('jubelio','biteship')),
 courier_codes text[] NOT NULL,
 updated_by uuid,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT visibility_nonempty CHECK (cardinality(courier_codes) BETWEEN 1 AND 80)
);
COMMIT;
