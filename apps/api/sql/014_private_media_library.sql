-- Private preservation only. No catalog publication, sales or storefront mutation.
BEGIN;
CREATE SCHEMA IF NOT EXISTS content;
CREATE TABLE IF NOT EXISTS content.media_library_assets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 original_path text NOT NULL UNIQUE,
 source_path text,
 filename text NOT NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 kind text NOT NULL CHECK(kind IN ('banner','category_icon','brand_logo','product_image','article_image','site_logo')),
 mime_type text NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','image/webp')),
 size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 16 AND 5242880),
 sha256 char(64) NOT NULL CHECK(sha256 ~ '^[0-9a-f]{64}$'),
 content bytea NOT NULL,
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=1000),
 visibility text NOT NULL DEFAULT 'internal' CHECK(visibility='internal'),
 imported_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(octet_length(content)=size_bytes)
);
CREATE TABLE IF NOT EXISTS content.media_library_audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 asset_id uuid NOT NULL REFERENCES content.media_library_assets(id),
 actor_id uuid NOT NULL,
 before_metadata jsonb NOT NULL,
 after_metadata jsonb NOT NULL,
 changed_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON SCHEMA content FROM PUBLIC;
REVOKE ALL ON content.media_library_assets,content.media_library_audit FROM PUBLIC;
COMMIT;
