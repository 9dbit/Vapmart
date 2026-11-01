-- CP34: email-bound, short-lived one-time invitations for assigned brand access.
-- Secret tokens are stored only as SHA-256 digests; no password or invite token is persisted.
BEGIN;
CREATE TABLE IF NOT EXISTS product.brand_invitations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 brand_id uuid NOT NULL REFERENCES product.brands(id) ON DELETE CASCADE,
 email text NOT NULL CHECK(length(email) BETWEEN 5 AND 254),
 role text NOT NULL CHECK(role IN('owner','manager','viewer')),
 token_hash char(64) NOT NULL UNIQUE,
 created_by uuid NOT NULL,
 accepted_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 accepted_at timestamptz,
 revoked_at timestamptz,
 CONSTRAINT valid_invite_lifetime CHECK(expires_at>created_at),
 CONSTRAINT valid_invite_state CHECK(NOT(accepted_at IS NOT NULL AND revoked_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_brand_invites_active ON product.brand_invitations(brand_id,created_at DESC);
REVOKE ALL ON product.brand_invitations FROM PUBLIC;
COMMIT;
