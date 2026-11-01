-- Disposable DB only. Requires 001, 003, 005. Rollback-only smoke.
BEGIN;
DO $$
DECLARE
  p uuid := gen_random_uuid();
  r uuid := gen_random_uuid();
  u uuid := gen_random_uuid();
  b uuid;
  b2 uuid;
BEGIN
  INSERT INTO pms_sandbox.physical_resources(resource_id,property_id,label)
    VALUES(r,p,'Test resource');
  INSERT INTO pms_sandbox.units(unit_id,property_id,label)
    VALUES(u,p,'Test unit');
  INSERT INTO pms_sandbox.unit_resources(unit_id,resource_id)
    VALUES(u,r);
  b := pms_sandbox.confirm_reservation(u,'2026-12-01','2026-12-04');
  IF NOT pms_sandbox.cancel_reservation(b) THEN
    RAISE EXCEPTION 'FAIL: cancellation returned false';
  END IF;
  IF NOT pms_sandbox.cancel_reservation(b) THEN
    RAISE EXCEPTION 'FAIL: repeat cancellation must be idempotent';
  END IF;
  IF (SELECT status FROM pms_sandbox.reservations WHERE reservation_id=b) <> 'cancelled'
    OR EXISTS (SELECT 1 FROM pms_sandbox.resource_allocations
               WHERE reservation_id=b AND active) THEN
    RAISE EXCEPTION 'FAIL: cancellation left an active allocation';
  END IF;
  b2 := pms_sandbox.confirm_reservation(u,'2026-12-01','2026-12-04');
  IF b2 = b THEN RAISE EXCEPTION 'FAIL: replacement reservation ID reused'; END IF;
  IF pms_sandbox.cancel_reservation(gen_random_uuid()) THEN
    RAISE EXCEPTION 'FAIL: unknown cancellation should return false';
  END IF;
  RAISE NOTICE 'PASS: cancellation, repeat cancellation, released dates';
END $$;
ROLLBACK;
