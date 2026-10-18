-- Standalone executable PostgreSQL smoke checks for 001_resource_allocation_prototype.sql.
-- Run in disposable PostgreSQL only:
-- psql -v ON_ERROR_STOP=1 -f sql/sandbox/001_resource_allocation_prototype.sql
-- psql -v ON_ERROR_STOP=1 -f sql/sandbox/002_resource_allocation_smoke.sql
-- NOT production, NOT a migration. Concurrency requires separate two-session test.
BEGIN;
DO $$
DECLARE
  p uuid := gen_random_uuid();
  room_a uuid := gen_random_uuid();
  room_b uuid := gen_random_uuid();
  apartment uuid := gen_random_uuid();
  resource_a uuid := gen_random_uuid();
  resource_b uuid := gen_random_uuid();
  booking_a uuid := gen_random_uuid();
  booking_b uuid := gen_random_uuid();
  booking_whole uuid := gen_random_uuid();
  booking_next uuid := gen_random_uuid();
  conflict_detected boolean := false;
BEGIN
  INSERT INTO pms_sandbox.physical_resources(resource_id,property_id,label)
    VALUES(resource_a,p,'Room A'),(resource_b,p,'Room B');
  INSERT INTO pms_sandbox.units(unit_id,property_id,label)
    VALUES(room_a,p,'Room A'),(room_b,p,'Room B'),(apartment,p,'Whole apartment');
  INSERT INTO pms_sandbox.unit_resources(unit_id,resource_id)
    VALUES(room_a,resource_a),(room_b,resource_b),
          (apartment,resource_a),(apartment,resource_b);
  INSERT INTO pms_sandbox.reservations(reservation_id,unit_id,stay,status)
    VALUES(booking_a,room_a,daterange('2026-11-01','2026-11-04','[)'),'confirmed'),
          (booking_b,room_b,daterange('2026-11-01','2026-11-04','[)'),'confirmed'),
          (booking_whole,apartment,daterange('2026-11-02','2026-11-03','[)'),'requested');
  INSERT INTO pms_sandbox.resource_allocations(reservation_id,resource_id,stay)
    VALUES(booking_a,resource_a,daterange('2026-11-01','2026-11-04','[)')),
          (booking_b,resource_b,daterange('2026-11-01','2026-11-04','[)'));
  BEGIN
    INSERT INTO pms_sandbox.resource_allocations(reservation_id,resource_id,stay)
      VALUES(booking_whole,resource_a,daterange('2026-11-02','2026-11-03','[)'));
  EXCEPTION WHEN exclusion_violation THEN
    conflict_detected := true;
  END;
  IF NOT conflict_detected THEN
    RAISE EXCEPTION 'FAIL: whole apartment double booked occupied room';
  END IF;
  -- Checkout is exclusive, so next guest may check in the same day.
  INSERT INTO pms_sandbox.reservations(reservation_id,unit_id,stay,status)
    VALUES(booking_next,apartment,daterange('2026-11-04','2026-11-05','[)'),'confirmed');
  INSERT INTO pms_sandbox.resource_allocations(reservation_id,resource_id,stay)
    VALUES(booking_next,resource_a,daterange('2026-11-04','2026-11-05','[)')),
          (booking_next,resource_b,daterange('2026-11-04','2026-11-05','[)'));
  RAISE NOTICE 'PASS: independent rooms, overlap exclusion, adjacent dates';
END $$;
ROLLBACK;
