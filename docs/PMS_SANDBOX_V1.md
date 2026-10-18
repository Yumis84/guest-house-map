# Minimal PMS sandbox, Issue #11 / Draft PR #12

**Status: experimental, not deployable.** No production Supabase migrations, grants, owner-auth mapping, public calendar or iCal adapter. The repository's `main` and published GitHub Pages are unaffected.

## What is actually implemented
- `001`: a standalone PostgreSQL resource model; room and whole-apartment units may share underlying physical resources. A partial GiST exclusion constraint rejects overlapping **active** allocations.
- `003`: sandbox-owner-only atomic confirmation, using ordered resource row locks and one transaction. Not an exposed RPC.
- `005`: sandbox-owner-only idempotent cancellation and release of allocations.
- `002/004/006`: rollback-only smoke checks.
- `scripts/test_pms_sandbox.py`: launches two real `psql` processes against the same resource; requires exactly one confirmation and one exclusion failure. **Harness authored, not executed in this change.**

## Running locally
Use a **disposable PostgreSQL database** with a name beginning `pms_test` on localhost. Install `psql` and `btree_gist` extension support. Use a dedicated database role that owns this disposable schema.

```bash
PMS_SANDBOX_DSN='postgresql://localhost:5432/pms_test' python3 scripts/test_pms_sandbox.py
```

The harness refuses non-local hosts and other database names. Do not forward a production server to localhost and bypass this safeguard. After tests, manually drop the entire disposable database. `001` is **not rerunnable** on the same database.

## Known blockers before staging
1. **Data consistency**: reservations and resource allocations currently have no enforced equality of stay, no proof all mapped resources are allocated, and no database-enforced relationship between allocation.active and reservation.status. Prototype functions cooperate but direct owner writes can violate invariants. Add constraints/triggers and revoke direct writes.
2. **Ownership and security**: schema has no tenant memberships, no RLS policies and no verified Supabase JWT integration. FORCE RLS is enabled and no grants are provided, so only privileged schema owners can run this proof. Need dedicated least-privilege roles and real Auth/PostgREST acceptance.
3. **Idempotency**: cancellation is idempotent, but reservation creation has no client request key. Add tenant-scoped request id and deduplication before connecting n8n.
4. **External iCal**: asynchronous synchronization does not prevent external double bookings. Need event IDs, conflict queue, update/cancel semantics, timezones, loop prevention and official verification of Russian OTA features.
5. **Review**: align unit model with PR #4/#6 and owner cabinet PR #7, run PostgreSQL harness and independent SQL/security audit. Rollback plan and migration order are not yet ready.

No merge or production deployment until these blockers are resolved and the owner separately approves.
