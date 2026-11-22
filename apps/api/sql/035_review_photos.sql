-- Product detail V2: purchaser-submitted review photos.
-- One review per fulfilled order item, 3 photos maximum (enforced transactionally).
-- Private binary payloads are never served until the parent review is approved.
CREATE TABLE product.review_photos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 order_item_id uuid NOT NULL REFERENCES product.order_items(id) ON DELETE CASCADE,
 uploaded_by uuid NOT NULL,
 review_id uuid REFERENCES product.product_reviews(id) ON DELETE CASCADE,
 position smallint CHECK(position IS NULL OR position BETWEEN 1 AND 3),
 mime_type text NOT NULL DEFAULT 'image/webp' CHECK(mime_type='image/webp'),
 content bytea NOT NULL,
 size_bytes integer NOT NULL CHECK(size_bytes BETWEEN 16 AND 1572864),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(size_bytes=octet_length(content))
);
CREATE INDEX review_photos_order_item_idx ON product.review_photos(order_item_id,created_at);
CREATE INDEX review_photos_user_recent_idx ON product.review_photos(uploaded_by,created_at DESC);
CREATE UNIQUE INDEX review_photos_review_position ON product.review_photos(review_id,position)
 WHERE review_id IS NOT NULL;
REVOKE ALL ON product.review_photos FROM PUBLIC;
ALTER TABLE product.review_photos ENABLE ROW LEVEL SECURITY;
