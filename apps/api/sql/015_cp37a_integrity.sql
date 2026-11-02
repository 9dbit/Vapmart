-- CP37-A additive metadata only. No historical, inventory or payment mutation.
BEGIN;
ALTER TABLE product.products ADD COLUMN IF NOT EXISTS edit_version integer NOT NULL DEFAULT 1 CHECK(edit_version>0);
ALTER TABLE product.brands ADD COLUMN IF NOT EXISTS edit_version integer NOT NULL DEFAULT 1 CHECK(edit_version>0);
CREATE TABLE IF NOT EXISTS product.master_data_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 entity_type text NOT NULL CHECK(entity_type IN ('product','brand')),
 entity_id uuid NOT NULL,actor_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('create','update','publish','unpublish')),
 before_data jsonb,after_data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS master_data_audit_entity ON product.master_data_audit(entity_type,entity_id,id DESC);
REVOKE ALL ON product.master_data_audit FROM PUBLIC;
COMMIT;
