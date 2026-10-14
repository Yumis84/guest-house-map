# Booking architecture draft (not deployed)

Status: design-only. This branch does not enable live bookings.

## Canonical entities
- properties: id, name, owner_user_id
- room_types: id, property_id, name, capacity
- physical_units: id, property_id, room_type_id, label, active
- reservations: id, unit_id, checkin (date), checkout (date), status, source, external_ref, idempotency_key, created_at
- calendar_connections: id, property_id, provider, external_calendar_id, direction, sync_cursor
- calendar_events: reservation_id, connection_id, external_event_id, sync_status

A-frame №1, №2, №3 are distinct physical units; do not assume physical unit counts for «Комфорт» and «Для двоих» until owner verification. Use stable opaque IDs, never display labels as primary keys.

## Invariants
1. Checkin < checkout. Dates represent nights in the half-open interval [checkin, checkout). Checkout on another guest's checkin day is allowed.
2. Only active holds and confirmed reservations block occupancy. Cancelled/rejected/expired holds do not.
3. Exclusion constraint on (unit_id, daterange(checkin, checkout, '[)')) for blocking statuses. PostgreSQL btree_gist is required; implement as a tested migration after inspecting the existing Supabase schema.
4. One idempotency key per external write source; retries must return the same reservation, not create duplicates.
5. Availability lookup is advisory; atomic insert/update is authoritative. Concurrent writes must have exactly one winner.
6. Owner sees and edits only their own properties. Coordination role may see cross-property occupancy; guest PII is not exposed to public frontend or calendar feeds.
7. Google Calendar / ICS is a synchronized projection, not the concurrency lock. Import existing reservations and reconcile before turning on writes.
8. If database availability validation or authenticated backend is down, do not confirm a reservation (fail closed).
9. Frontend must not contain service-role keys, API secrets or unrestricted webhook endpoints.

## Proposed flow
Guest site / assistant -> authenticated booking API -> validate unit/date -> atomic database transaction -> outbox event -> n8n calendar adapter -> per-owner calendars and coordinator calendar. Incoming calendar edits are quarantined/reconciled until bidirectional semantics are approved.

## Acceptance tests before deployment
- Same unit, overlapping dates: exactly one concurrent confirmed write succeeds.
- Same unit, adjacent stays: both succeed.
- Different units, overlapping dates: both succeed.
- Repeated request with same idempotency key: no duplicate.
- Cancellation releases dates; expired holds do not block.
- Unauthorized owner cannot read/change other owners' reservations.
- Calendar adapter failure does not erase or double-book canonical reservations.
- Historical reservations reconciled, including timezone and all-day event boundaries.

## Verified from repository (2026-10-14)
- Current index.html stores prototype requests in browser localStorage under rominta_bookings.
- No physical unit_id in current index.html.
- Current assistant panel says n8n webhook is not connected.
- README.md contains older claims about n8n that need re-verification.

## Pending decisions
- Confirm exact inventory and labels for «Комфорт» / «Для двоих».
- Confirm real source of bookings for «У Степана» and owner authorization.
- Confirm how holds expire, cancellation rules and calendars' import direction.
- Inspect Supabase production schema in read-only mode before drafting executable SQL.

Do not merge or deploy this draft without separate approval.
