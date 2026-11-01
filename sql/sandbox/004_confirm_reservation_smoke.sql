-- Run only on disposable PostgreSQL after 001 and 003.
-- psql -v ON_ERROR_STOP=1 -f sql/sandbox/004_confirm_reservation_smoke.sql
-- No production use. Does not test two concurrent database sessions.
BEGIN;
DO $$
DECLARE
  p uuid := gen_random_uuid();
  ra uuid := gen_random_uuid();
  rb uuid := gen_random_uuid();
  ua uuid := gen_random_uuid();
  ub uuid := gen_random_uuid();
  uw uuid := gen_random_uuid();
  b uuid;
  rejected boolean;
BEGIN
  INSERT INTO pms_sandbox.physical_resources(resource_id,property_id,label)
    VALUES(ra,p,'Room A'),(rb,p,'Room B');
  INSERT INTO pms_sandbox.units(unit_id,property_id,label)
    VALUES(ua,p,'Room A'),(ub,p,'Room B'),(uw,p,'Whole apartment');
  INSERT INTO pms_sandbox.unit_resources(unit_id,resource_id)
    VALUES(ua,ra),(ub,rb),(uw,ra),(uw,rb);
  b := pms_sandbox.confirm_reservation(ua,'2026-11-01','2026-11-04');
  IF (SELECT count(*) FROM pms_sandbox.resource_allocations WHERE reservation_id=b) <> 1 THEN
    RAISE EXCEPTION 'FAIL: room reservation allocation missing';
  END IF;
  PERFORM pms_sandbox.confirm_reservation(ub,'2026-11-01','2026-11-04');
  rejected := false;
  BEGIN
    PERFORM pms_sandbox.confirm_reservation(uw,'2026-11-02','2026-11-03');
  EXCEPTION WHEN exclusion_violation THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'FAIL: overlapping apartment booking accepted'; END IF;
  b := pms_sandbox.confirm_reservation(uw,'2026-11-04','2026-11-05');
  IF (SELECT count(*) FROM pms_sandbox.resource_allocations WHERE reservation_id=b) <> 2 THEN
    RAISE EXCEPTION 'FAIL: whole apartment must allocate both rooms';
  END IF;
  rejected := false;
  BEGIN
    PERFORM pms_sandbox.confirm_reservation(ua,'2026-11-03','2026-11-03');
  EXCEPTION WHEN invalid_parameter_value THEN rejected := true;
  END;
  IF NOT rejected THEN RAISE EXCEPTION 'FAIL: empty stay accepted'; END IF;
  RAISE NOTICE 'PASS: separate rooms, whole-apartment conflict, checkout boundary, invalid stay';
END $$;
ROLLBACK;
