-- Sandbox-only idempotent confirmation. Run AFTER 001 and 003.
-- No client access, no Supabase JWT integration, not production-safe.
BEGIN;
ALTER TABLE pms_sandbox.reservations
  ADD COLUMN request_key uuid;
CREATE UNIQUE INDEX reservations_request_key_uniq
  ON pms_sandbox.reservations(request_key) WHERE request_key IS NOT NULL;

CREATE OR REPLACE FUNCTION pms_sandbox.confirm_reservation_idempotent(
  p_unit_id uuid, p_checkin date, p_checkout date, p_request_key uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, pms_sandbox
AS $$
DECLARE
  v_existing record;
  v_created uuid;
  v_stay daterange;
BEGIN
  IF p_request_key IS NULL OR p_unit_id IS NULL OR p_checkin IS NULL
     OR p_checkout IS NULL OR p_checkin >= p_checkout THEN
    RAISE EXCEPTION 'Invalid booking request' USING ERRCODE = '22023';
  END IF;
  v_stay := daterange(p_checkin,p_checkout,'[)');
  -- Serialize retries on the same request key, even across independent sessions.
  -- Hash collisions merely serialize unrelated keys; the exact UUID is checked below.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  SELECT reservation_id, unit_id, stay, status
    INTO v_existing
    FROM pms_sandbox.reservations
    WHERE request_key = p_request_key;
  IF FOUND THEN
    IF v_existing.unit_id <> p_unit_id OR v_existing.stay <> v_stay THEN
      RAISE EXCEPTION 'Request key reused with different booking parameters'
        USING ERRCODE = '23505';
    END IF;
    -- Returning a cancelled reservation is intentional: a retry must not
    -- silently recreate a cancelled booking.
    RETURN v_existing.reservation_id;
  END IF;
  v_created := pms_sandbox.confirm_reservation(p_unit_id,p_checkin,p_checkout);
  UPDATE pms_sandbox.reservations SET request_key = p_request_key
    WHERE reservation_id = v_created;
  RETURN v_created;
END;
$$;
REVOKE ALL ON FUNCTION pms_sandbox.confirm_reservation_idempotent(uuid,date,date,uuid) FROM PUBLIC;
COMMIT;
