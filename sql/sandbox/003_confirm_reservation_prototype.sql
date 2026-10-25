-- Experimental trusted-writer prototype for Issue #11, Draft PR #12.
-- Execute AFTER 001_resource_allocation_prototype.sql in disposable PostgreSQL.
-- No auth mapping / tenant policies: NEVER deploy to a live Supabase database.
-- Run only as the isolated schema owner. All writes happen in one transaction.
BEGIN;
CREATE OR REPLACE FUNCTION pms_sandbox.confirm_reservation(
  p_unit_id uuid, p_checkin date, p_checkout date
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, pms_sandbox
AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_stay daterange;
  v_property uuid;
  v_resources int := 0;
  v_resource record;
BEGIN
  IF p_unit_id IS NULL OR p_checkin IS NULL OR p_checkout IS NULL
     OR p_checkin >= p_checkout THEN
    RAISE EXCEPTION 'Invalid stay' USING ERRCODE = '22023';
  END IF;
  v_stay := daterange(p_checkin, p_checkout, '[)');
  SELECT property_id INTO v_property
    FROM pms_sandbox.units WHERE unit_id = p_unit_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown unit' USING ERRCODE = '22023';
  END IF;
  -- Lock in stable order to reduce deadlocks for whole-apartment vs room.
  FOR v_resource IN
    SELECT r.resource_id
    FROM pms_sandbox.unit_resources ur
    JOIN pms_sandbox.physical_resources r ON r.resource_id = ur.resource_id
    WHERE ur.unit_id = p_unit_id AND r.property_id = v_property
    ORDER BY r.resource_id
    FOR UPDATE OF r
  LOOP
    v_resources := v_resources + 1;
  END LOOP;
  IF v_resources = 0 OR v_resources <> (
    SELECT count(*) FROM pms_sandbox.unit_resources WHERE unit_id = p_unit_id
  ) THEN
    RAISE EXCEPTION 'Missing or cross-property resource mapping'
      USING ERRCODE = '23514';
  END IF;
  INSERT INTO pms_sandbox.reservations(reservation_id,unit_id,stay,status)
    VALUES(v_id,p_unit_id,v_stay,'confirmed');
  INSERT INTO pms_sandbox.resource_allocations(reservation_id,resource_id,stay)
    SELECT v_id, resource_id, v_stay
    FROM pms_sandbox.unit_resources WHERE unit_id = p_unit_id;
  -- GiST exclusion constraint protects even against concurrent writers
  -- that do not honor the explicit row-lock protocol.
  RETURN v_id;
END;
$$;
-- Deliberately no grants to anon/authenticated/public.
REVOKE ALL ON FUNCTION pms_sandbox.confirm_reservation(uuid,date,date) FROM PUBLIC;
COMMIT;
