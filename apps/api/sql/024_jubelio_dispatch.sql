BEGIN;
-- One durable external-create attempt per fulfillment batch. Ambiguous results
-- are recovered by exact provider reference, never by issuing another POST.
CREATE TABLE product.jubelio_bookings (
 batch_id uuid PRIMARY KEY REFERENCES product.fulfillment_batches(id),
 request_key uuid NOT NULL UNIQUE,
 reference text NOT NULL UNIQUE,
 state text NOT NULL CHECK(state IN('pending','uncertain','booked')),
 payload_hash char(64) NOT NULL,
 payload jsonb NOT NULL,
 accepted_fee_idr bigint NOT NULL CHECK(accepted_fee_idr BETWEEN 0 AND 10000000),
 provider_shipment_id text UNIQUE,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON product.jubelio_bookings FROM PUBLIC;
COMMIT;
