-- CP40: private wording can be retained without making a draft purchasable.
-- Replace unconditional content checks with published-row and family checks.
-- No prices, quantities, publication flags or existing content are rewritten.
BEGIN;
DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM product.products p
  LEFT JOIN product.products parent ON parent.id=p.parent_product_id
  WHERE p.is_active AND (p.parent_product_id IS NULL OR parent.is_active)
   AND concat_ws(' ',p.name,p.description,p.slug,p.sku,p.attributes::text,p.option_values::text)
       ~* '(nicotine|nikotin|vape|vaping|rokok|tobacco|e-cig|e-liquid|e-juice|saltnic|iqos)'
 ) THEN
  RAISE EXCEPTION 'Existing published content requires review before CP40 migration' USING ERRCODE='23514';
 END IF;
END $$;

ALTER TABLE product.products DROP CONSTRAINT no_restricted_product_terms;
ALTER TABLE product.products DROP CONSTRAINT product_no_restricted_identifiers;
ALTER TABLE product.products ADD CONSTRAINT no_restricted_product_terms CHECK (
 NOT is_active OR parent_product_id IS NOT NULL OR
 concat_ws(' ',name,description,attributes::text,option_values::text)
 !~* '(nicotine|nikotin|vape|vaping|rokok|tobacco|e-cig|e-liquid|e-juice|saltnic|iqos)'
);
ALTER TABLE product.products ADD CONSTRAINT product_no_restricted_identifiers CHECK (
 NOT is_active OR parent_product_id IS NOT NULL OR
 concat_ws(' ',slug,sku) !~* '(nicotine|nikotin|vape|vaping|rokok|tobacco|e-cig|e-liquid|e-juice|saltnic|iqos)'
);

CREATE FUNCTION product.enforce_published_catalog_content() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,product AS $$
DECLARE
 effective_active boolean := false;
 pattern constant text := '(nicotine|nikotin|vape|vaping|rokok|tobacco|e-cig|e-liquid|e-juice|saltnic|iqos)';
BEGIN
 IF NOT NEW.is_active THEN RETURN NEW; END IF;
 IF NEW.parent_product_id IS NULL THEN
  effective_active := true;
 ELSE
  -- Lock the parent so child edits and parent activation cannot race at READ COMMITTED.
  SELECT p.is_active INTO effective_active FROM product.products p
   WHERE p.id=NEW.parent_product_id FOR SHARE;
 END IF;
 IF coalesce(effective_active,false) AND
    concat_ws(' ',NEW.name,NEW.description,NEW.slug,NEW.sku,NEW.attributes::text,NEW.option_values::text) ~* pattern THEN
  RAISE EXCEPTION 'Published catalog content requires review'
   USING ERRCODE='23514',CONSTRAINT='published_catalog_content';
 END IF;
 IF NEW.parent_product_id IS NULL THEN
  -- Activating or editing a parent validates every enabled child, including stored drafts.
  PERFORM p.id FROM product.products p
   WHERE p.parent_product_id=NEW.id AND p.is_active AND
    concat_ws(' ',p.name,p.description,p.slug,p.sku,p.attributes::text,p.option_values::text) ~* pattern
   FOR SHARE;
  IF FOUND THEN
   RAISE EXCEPTION 'Enabled variation content requires review before publication'
    USING ERRCODE='23514',CONSTRAINT='published_catalog_child_content';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION product.enforce_published_catalog_content() FROM PUBLIC;
CREATE TRIGGER published_catalog_content_guard
 BEFORE INSERT OR UPDATE OF name,description,slug,sku,attributes,option_values,is_active,parent_product_id
 ON product.products FOR EACH ROW EXECUTE FUNCTION product.enforce_published_catalog_content();
COMMIT;
