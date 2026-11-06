BEGIN;
-- An admin approval records an attestation, not fabricated bank transaction details.
ALTER TABLE product.manual_payment_confirmations
 ALTER COLUMN paid_at DROP NOT NULL,
 ALTER COLUMN bank_name DROP NOT NULL,
 ALTER COLUMN account_number DROP NOT NULL,
 ALTER COLUMN account_name DROP NOT NULL,
 ADD COLUMN verification_method text NOT NULL DEFAULT 'bank_details'
 CHECK(verification_method IN ('bank_details','admin_approval'));
COMMIT;
