BEGIN;
-- Add a service-level whitelist while preserving the existing provider-level
-- carrier selection for backwards-compatible in-flight web deployments.
ALTER TABLE product.shipping_courier_visibility
 ADD COLUMN IF NOT EXISTS service_keys text[] DEFAULT NULL;
ALTER TABLE product.shipping_courier_visibility
 ADD CONSTRAINT courier_service_visibility_nonempty
 CHECK (service_keys IS NULL OR cardinality(service_keys) BETWEEN 1 AND 160);
COMMIT;
