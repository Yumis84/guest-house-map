-- Sandbox-only cancellation writer. Execute after 001 and 003.
-- NOT an application migration; caller is trusted isolated schema owner.
BEGIN;
CREATE OR REPLACE FUNCTION pms_sandbox.cancel_reservation(p_reservation_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, pms_sandbox
AS $$
DECLARE
  v_status text;
BEGIN
  IF p_reservation_id IS NULL THEN
    RAISE EXCEPTION 'Reservation ID required' USING ERRCODE = '22023';
  END IF;
  SELECT status INTO v_status
    FROM pms_sandbox.reservations
    WHERE reservation_id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_status = 'cancelled' THEN
    RETURN true;
  END IF;
  -- The parent row lock serializes cancellation with other cooperating writers.
  UPDATE pms_sandbox.resource_allocations
     SET active = false
   WHERE reservation_id = p_reservation_id AND active;
  UPDATE pms_sandbox.reservations
     SET status = 'cancelled'
   WHERE reservation_id = p_reservation_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION pms_sandbox.cancel_reservation(uuid) FROM PUBLIC;
COMMIT;
