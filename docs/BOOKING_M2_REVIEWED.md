# M2 candidate · Claude edba6367

Dependencies: PR28 M0b, then M1. No production migrations or writer cutover. `booking-m2-ledger.CANDIDATE.sql` activates the previously closed lifecycle seam only inside the candidate database.

Mapping: existing `widget_private.requests` remains the request; new `widget_private.holds` is independent (active/expired/released/converted); `history` and `operations` implement events and idempotency. Requests remain pending after expiry. `inventory_allocations.widget_hold_id` identifies hold allocations for each existing required resource. Existing reservations/blocks trigger bodies are reused. New adapter reads allocations with fallback through reservations/blocks mapped over all shared resources. Missing allocation drift cannot silently appear free.

`lock_unit_resources` acquires sorted resource advisory locks; a conservative global booking gate is retained around writers/expiry/allocation guard as an additional compatibility/deadlock barrier for existing triggers. This is a deliberate throughput tradeoff, not a production load claim. Confirmation takes resource locks before request row lock, removes only its own hold, repeats availability, and atomically creates reservation. Cancellation keeps reservation row. Private fields remain unavailable to anon and other owners.

Expiry is logical at server expires_at and materialized by the idempotent maintenance worker or a following ledger writer. No public RPC reactivates an expired hold. Worker tested as a real child process. Scheduler deployment is not installed on live Supabase. Tests shift synthetic timestamps across the15-minute boundary rather than waiting15 wall-clock minutes; exact900-second invariant checked.

Native PostgreSQL18.4/btree_gist:19 test groups PASS (evidence/booking-m2-postgres.json), including8 parallel submissions (8 pending requests retained, exactly1 hold), competing confirms, confirm/expiry, late confirm free/blocked,5 same-key confirms→1reservation, direct synthetic external ledger write, shared whole/room resource, reversed resource lock order, idempotency/revision mismatch,155 requests, contacts/ACL, soft archive/release, rate cleanup, fail-closed disable. This follows owner instruction to retain requests even when no hold can be acquired; the audit's shorthand “exactly1 accepted request” is interpreted as exactly1 hold.

10k-request keyset test uses an Index Scan on booking_requests_all_page. Local page time about20ms; no hosted latency claim. CI uses native PostgreSQL17 service. Browser lifecycle regression remains UI-only in PR28; real hosted PostgREST/Auth/Turnstile/proxy, working n8n, and external reconciliation NOT RUN. Production NO-GO until independent audit and separately approved cutover. Policy/retention draft unapproved.

Replay on a fresh loopback PostgreSQL17/18 with btree_gist and an EMPTY synthetic_booking_* database:

```sh
npm ci --ignore-scripts
BOOKING_TEST_DATABASE_URL=postgresql://TEST_ROLE@127.0.0.1:PORT/synthetic_booking_review node tests/booking/postgres.test.mjs
# M1-only schema/privacy/closed-capability checks:
BOOKING_M1_ONLY=true BOOKING_TEST_DATABASE_URL=postgresql://TEST_ROLE@127.0.0.1:PORT/synthetic_booking_other node tests/booking/postgres.test.mjs
```

The local server was native @embedded-postgres/linux-x64 18.4.0-beta.17 in an isolated command network namespace. Because the execution environment maps only root and cannot switch uid, a temporary process-local identity/stat shim was used for initdb/postgres startup; ordinary non-root PostgreSQL needs no shim. No host accounts or production binaries changed. Server stopped after each run. CI runs standard PostgreSQL17 without that shim.

Fail-closed rollback: `booking-disable.CANDIDATE.sql` disables activation/submit/capability and preserves all data and exclusion protection. It is NOT an automatic migration, data-erasing uninstall or permission to use production.
