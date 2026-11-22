-- CP66: account-scoped product and brand favorites.
-- Never persist products/brands that are not active in the customer API.
CREATE TABLE public.customer_favorites (
 user_id uuid NOT NULL,
 entity_type text NOT NULL CHECK(entity_type IN('product','brand')),
 entity_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,entity_type,entity_id)
);
CREATE INDEX customer_favorites_recent_idx ON public.customer_favorites(user_id,created_at DESC);
REVOKE ALL ON public.customer_favorites FROM PUBLIC;
ALTER TABLE public.customer_favorites ENABLE ROW LEVEL SECURITY;
