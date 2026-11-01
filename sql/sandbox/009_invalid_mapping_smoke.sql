-- Disposable PostgreSQL only; requires 001, 003.
-- Negative authorization-independent resource mapping checks.
BEGIN;
DO $$
DECLARE
 p1 uuid := gen_random_uuid();
 p2 uuid := gen_random_uuid();
 u uuid := gen_random_uuid();
 r uuid := gen_random_uuid();
 rejected boolean := false;
BEGIN
 INSERT INTO pms_sandbox.units(unit_id,property_id,label) VALUES(u,p1,'Unmapped unit');
 BEGIN
   PERFORM pms_sandbox.confirm_reservation(u,'2027-02-01','2027-02-03');
 EXCEPTION WHEN check_violation THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL: zero-resource unit accepted'; END IF;
 INSERT INTO pms_sandbox.physical_resources(resource_id,property_id,label)
 VALUES(r,p2,'Other property resource');
 INSERT INTO pms_sandbox.unit_resources(unit_id,resource_id) VALUES(u,r);
 rejected := false;
 BEGIN
   PERFORM pms_sandbox.confirm_reservation(u,'2027-02-01','2027-02-03');
 EXCEPTION WHEN check_violation THEN rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'FAIL: cross-property resource accepted'; END IF;
 IF EXISTS(SELECT 1 FROM pms_sandbox.reservations WHERE unit_id=u)
 THEN RAISE EXCEPTION 'FAIL: rejected requests left a reservation'; END IF;
 RAISE NOTICE 'PASS: missing resources and cross-property mappings rejected';
END $$;
ROLLBACK;
