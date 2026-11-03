-- Independent content manager. No changes to commerce, staff roles or private originals.
BEGIN;
CREATE TABLE content.hero_banner_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), revision integer NOT NULL DEFAULT 1 CHECK(revision>0)
);
INSERT INTO content.hero_banner_state(singleton) VALUES(true);
CREATE TABLE content.hero_banner_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), filename text NOT NULL,
 original_mime text NOT NULL CHECK(original_mime IN ('image/png','image/jpeg','image/webp')),
 original_bytes integer NOT NULL CHECK(original_bytes BETWEEN 16 AND 5242880),
 original_sha256 char(64) NOT NULL, original_content bytea NOT NULL,
 display_content bytea NOT NULL, display_bytes integer NOT NULL CHECK(display_bytes BETWEEN 16 AND 5242880),
 display_sha256 char(64) NOT NULL, width integer NOT NULL CHECK(width>0), height integer NOT NULL CHECK(height>0),
 uploaded_by uuid NOT NULL, UNIQUE(uploaded_by,original_sha256), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(octet_length(original_content)=original_bytes), CHECK(octet_length(display_content)=display_bytes)
);
CREATE TABLE content.hero_banners (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_key uuid UNIQUE, title text NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
 alt_text text NOT NULL CHECK(length(alt_text) BETWEEN 1 AND 240),
 desktop_asset_id uuid REFERENCES content.hero_banner_assets(id), mobile_asset_id uuid REFERENCES content.hero_banner_assets(id),
 desktop_path text CHECK(desktop_path ~ '^/legacy/banners/desktop-0[123][.]png$'),
 mobile_path text CHECK(mobile_path ~ '^/legacy/banners/mobile-0[123][.]png$'),
 position integer NOT NULL CHECK(position>=0), is_active boolean NOT NULL DEFAULT false,
 edit_version integer NOT NULL DEFAULT 1 CHECK(edit_version>0), deleted_at timestamptz,
 created_by uuid, updated_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((desktop_asset_id IS NOT NULL)::integer+(desktop_path IS NOT NULL)::integer=1),
 CHECK((mobile_asset_id IS NOT NULL)::integer+(mobile_path IS NOT NULL)::integer=1),
 CHECK(deleted_at IS NULL OR NOT is_active)
);
CREATE INDEX hero_banners_display_order ON content.hero_banners(position,id) WHERE deleted_at IS NULL AND is_active;
CREATE INDEX hero_assets_owner_time ON content.hero_banner_assets(uploaded_by,created_at);
CREATE TABLE content.hero_banner_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, banner_id uuid REFERENCES content.hero_banners(id),
 actor_id uuid NOT NULL, action text NOT NULL, before_data jsonb, after_data jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON content.hero_banner_state,content.hero_banner_assets,content.hero_banners,content.hero_banner_audit FROM PUBLIC;
-- Preserve exactly the existing three public reference slides once, never reseed after deletion.
INSERT INTO content.hero_banners(id,title,alt_text,desktop_path,mobile_path,position,is_active) VALUES
 ('38000000-0000-4000-8000-000000000001','Banner 1','Banner arsip Vapmart pertama','/legacy/banners/desktop-01.png','/legacy/banners/mobile-01.png',10,true),
 ('38000000-0000-4000-8000-000000000002','Banner 2','Banner arsip Vapmart kedua','/legacy/banners/desktop-02.png','/legacy/banners/mobile-02.png',20,true),
 ('38000000-0000-4000-8000-000000000003','Banner 3','Banner arsip Vapmart ketiga','/legacy/banners/desktop-03.png','/legacy/banners/mobile-03.png',30,true);
COMMIT;
