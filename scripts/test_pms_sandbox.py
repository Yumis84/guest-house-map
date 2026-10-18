#!/usr/bin/env python3
"""Disposable PostgreSQL smoke + two-session collision test. Standard library only.

Requires local psql and a dedicated empty DB named pms_test*.
PMS_SANDBOX_DSN must point to localhost (not production).
Usage: PMS_SANDBOX_DSN='postgresql://.../pms_test' python3 scripts/test_pms_sandbox.py
"""
import os
import pathlib
import subprocess
import sys
import threading
import urllib.parse
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
DSN = os.environ.get("PMS_SANDBOX_DSN", "")
parsed = urllib.parse.urlparse(DSN)
if parsed.scheme not in ("postgres", "postgresql") or parsed.hostname not in ("localhost", "127.0.0.1", "::1") or not parsed.path.lstrip("/").startswith("pms_test"):
    sys.exit("REFUSED: PMS_SANDBOX_DSN must be a local dedicated pms_test* database")
if not DSN:
    sys.exit("REFUSED: PMS_SANDBOX_DSN missing")


def psql(sql=None, file=None):
    cmd = ["psql", DSN, "-X", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-qAt"]
    if file is not None:
        cmd += ["-f", str(ROOT / file)]
    else:
        cmd += ["-c", sql]
    return subprocess.run(cmd, capture_output=True, text=True)


for name in (
    "001_resource_allocation_prototype.sql",
    "003_confirm_reservation_prototype.sql",
    "005_cancel_reservation_prototype.sql",
    "007_idempotent_confirmation_prototype.sql",
    "002_resource_allocation_smoke.sql",
    "004_confirm_reservation_smoke.sql",
    "006_cancel_reservation_smoke.sql",
    "008_idempotent_confirmation_smoke.sql",
):
    result = psql(file="sql/sandbox/" + name)
    if result.returncode:
        sys.exit(f"FAIL {name}: {result.stderr}")
    print("PASS", name)

prop, unit, resource = (str(uuid.uuid4()) for _ in range(3))
setup = f"""
INSERT INTO pms_sandbox.physical_resources(resource_id,property_id,label) VALUES ('{resource}','{prop}','Race resource');
INSERT INTO pms_sandbox.units(unit_id,property_id,label) VALUES ('{unit}','{prop}','Race unit');
INSERT INTO pms_sandbox.unit_resources(unit_id,resource_id) VALUES ('{unit}','{resource}');
"""
result = psql(sql=setup)
if result.returncode:
    sys.exit("FAIL setup: " + result.stderr)

barrier = threading.Barrier(3)
results = []


def worker():
    barrier.wait()
    results.append(psql(sql=f"SELECT pms_sandbox.confirm_reservation('{unit}','2026-12-10','2026-12-12');"))


threads = [threading.Thread(target=worker) for _ in range(2)]
for t in threads:
    t.start()
barrier.wait()
for t in threads:
    t.join(timeout=20)
if any(t.is_alive() for t in threads):
    sys.exit("FAIL: concurrent calls timed out")
success = sum(r.returncode == 0 for r in results)
excluded = sum("23P01" in r.stderr for r in results)
if success != 1 or excluded != 1:
    sys.exit(f"FAIL: expected one confirmed and one exclusion failure; successes={success}, excluded={excluded}; stderr={[r.stderr for r in results]}")
check = psql(sql=f"""SELECT count(*) FROM pms_sandbox.reservations
WHERE unit_id='{unit}' AND status='confirmed';""")
if check.returncode or check.stdout.strip() != "1":
    sys.exit("FAIL: expected exactly one committed confirmed reservation")
print("PASS two-session collision: exactly one confirmed, one rejected")
# No automatic teardown: disposable database must be dropped by operator.

# A separate race uses the same request key and must return the same UUID.
request_key = str(uuid.uuid4())
barrier2 = threading.Barrier(3)
retries = []


def retry_worker():
    barrier2.wait()
    retries.append(psql(sql=f"SELECT pms_sandbox.confirm_reservation_idempotent('{unit}','2027-01-10','2027-01-12','{request_key}');"))


threads2 = [threading.Thread(target=retry_worker) for _ in range(2)]
for t in threads2:
    t.start()
barrier2.wait()
for t in threads2:
    t.join(timeout=20)
if any(t.is_alive() for t in threads2):
    sys.exit("FAIL: idempotency race timed out")
if len(retries) != 2 or any(r.returncode for r in retries) or retries[0].stdout.strip() != retries[1].stdout.strip():
    sys.exit(f"FAIL: idempotency race produced different results: {[(r.returncode, r.stdout, r.stderr) for r in retries]}")
print("PASS two-session retry: one reservation ID returned twice")
