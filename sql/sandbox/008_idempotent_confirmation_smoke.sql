-- Disposable DB only; run after 001, 003, 005, 007.
BEGIN;
DO $$
DECLARE
 p uuid := gen_random_uuid();
 u uuid := gen_random_uuid();
 r uuid := gen_random_uuid();
 k uuid := gen_random_uuid();
 a uuid;
 b uuid;
 rejected boolean := false;
BEGIN
 INSERT INTO pms_sandbox.physical_resources(resource_id,property_id,label) VALUES(r,p,'Room');
 INSERT INTO pms_sandbox.units(unit_id,property_id,label) VALUES(u,p,'Unit');
 INSERT INTO pms_sandbox.unit_resources(unit_id,resource_id) VALUES(u,r);
 a := pms_sandbox.confirm_reservation_idempotent(u,'2026-12-15','2026-12-18',k);
 b := pms_sandbox.confirm_reservation_idempotent(u,'2026-12-15','2026-12-18',k);
 IF a <> b THEN RAISE EXCEPTION 'FAIL: retry created another booking'; END IF;
 IF (SELECT count(*) FROM pms_sandbox.reservations WHERE request_key=k) <> 1
 THEN RAISE EXCEPTION 'FAIL: duplicate request key'; END IF;
 BEGIN
   PERFORM pms_sandbox.confirm_reservation_idempotent(u,'2026-12-16','2026-12-18',k);
 EXCEPTION WHEN unique_violation THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL: reused key accepted changed dates'; END IF;
 PERFORM pms_sandbox.cancel_reservation(a);
 b := pms_sandbox.confirm_reservation_idempotent(u,'2026-12-15','2026-12-18',k);
 IF a <> b THEN RAISE EXCEPTION 'FAIL: cancelled request resurrected'; END IF;
 RAISE NOTICE 'PASS: idempotent create, changed-payload rejection, cancelled retry';
END $$;
ROLLBACK;
