# M2: shared occupancy and n8n / Sheets cutover — NOT EXECUTED

Supabase is approved as authority. The candidate extends existing resource allocations and reuses actual inventory trigger function bodies captured read-only, not a second ledger. Private holds are separate because request lifetime differs from hold lifetime. Existing request/contact store is extended, not duplicated. Expiry changes holds only; reservations are retained on cancellation.

## Before any cutover

1. Read-only export of Sheets bookings and any Google Calendar feeds must be separately scoped with owner permission for real data. No actual rows used in this implementation.
2. Map house_id → property → physical unit → resource set; ambiguities and duplicate source IDs are blocking. Each external booking needs stable (channel, external_id), revision and idempotency key. Time intervals use checkout-exclusive dates; baseline resource allocation dates are normalized at UTC midnight to match existing trigger bodies.
3. Reconcile confirmed bookings and manual blocks into a proposed import manifest. Detect overlaps, conflicting revisions, missing units; owner resolves each. Test manifest uses synthetic data only.
4. Prepare a new disabled n8n candidate: submit/confirm through shared server transaction FIRST; only after commit mirror row to Sheets and enqueue notification. Sheets becomes projection; Sheets append or notification success must never create a confirmed reservation by itself. Retry uses same source id; do not blindly retry with new booking id.
5. Separate approval of a maintenance window and switching all writers is mandatory. A dual active writable Sheets/Supabase window is not safe. Shadow read/compare is permissible only as separately approved real-data work. Existing n8n workflow remains byte-for-byte unchanged until approval.
6. Enable V2 only after all writers pass shared-resource races and reconciliation. Until then public runtime/activation stay off and calendars say sources incomplete.

## Transaction protocol

Conservative global booking advisory transaction lock serializes ledger mutations; exclusion constraints are the independent final barrier, including whole-house vs room allocations. Guard trigger on ledger inserts/updates expires old holds before a new reservation/block allocation. Request confirmation removes only its own hold, rechecks all relevant resources, creates reservation (existing inventory trigger allocates it), changes request and appends history atomically. On conflict the transaction rolls back; pending request survives. A confirmed reservation is soft-cancelled; manual block is soft-released and audited.

A maintenance runner (`scripts/booking-maintenance.mjs --watch`) expires holds and deletes expired limiter buckets periodically in the isolated environment. At/after expires_at availability excludes hold even before the worker tick. New writers lazily clean expired allocations under the same transaction lock. Expired holds cannot be revived via public RPC. Production requires a separately reviewed scheduler/service-role deployment; none is installed here.

## Rollback

Disable V2 submissions/activation first. Keep request, hold, reservation and history rows. Do not drop tables, release confirmed reservations or restore unauthenticated write grants. Reconcile committed Supabase reservations before any separately approved return to the old writer. A failure after DB commit must be retried idempotently or recovered from outbox, not compensated by deleting a reservation.

## Open blockers

Real external writer not integrated; real reconciliation not performed. No production scheduler, Turnstile/gateway deployment or notifications/outbox delivery. Local PostgreSQL is 18.4; actual Supabase baseline is 17.11, so a PG17/Supabase staging acceptance remains required. Global locking is deliberate for initial correctness and requires load review before scaling.
