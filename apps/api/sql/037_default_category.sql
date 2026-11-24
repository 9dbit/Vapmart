-- Keep a permanent fallback when an operator deletes a product category.
-- Existing products and their category memberships are not moved by this migration.
BEGIN;
SELECT pg_advisory_xact_lock(2026110202);

INSERT INTO product.categories(name,slug,is_active,parent_id)
VALUES('Accessories','accessories',true,NULL)
ON CONFLICT(slug) DO UPDATE
SET name='Accessories',is_active=true,parent_id=NULL,
    edit_version=product.categories.edit_version+1,updated_at=now()
WHERE product.categories.name<>'Accessories'
   OR NOT product.categories.is_active
   OR product.categories.parent_id IS NOT NULL;

CREATE FUNCTION product.protect_default_category() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.slug='accessories' THEN
    IF TG_OP='DELETE' THEN
      RAISE EXCEPTION 'Accessories is the protected default category'
        USING ERRCODE='23514';
    END IF;
    IF NEW.slug<>'accessories' OR NEW.name<>'Accessories'
       OR NOT NEW.is_active OR NEW.parent_id IS NOT NULL THEN
      RAISE EXCEPTION 'The default category identity and active root status must be preserved'
        USING ERRCODE='23514';
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_default_category
BEFORE UPDATE OR DELETE ON product.categories
FOR EACH ROW EXECUTE FUNCTION product.protect_default_category();

COMMIT;
