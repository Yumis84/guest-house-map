# Guest House Platform: Domain Architecture v1 (review required)

Status: design proposal. No production integration or schema extension applied by this document.
Database: Supabase project `guest-house-booking`, ref `ojifyifewlwzkysgxogo`, region eu-west-2.

## Domain boundaries

- **property**: listing/site, with locality, location, timezone, publishing state and legal operator. Kinds include guest house, apartment, cottage, hotel, hostel and other.
- **building**: physical structure inside a property. One property can have a main house, annexes, standalone cottages and a separate sauna building.
- **room_type**: marketing/product category, such as Comfort, A-frame, entire apartment or whole cottage. It is NOT a physical inventory item.
- **physical_unit**: unique reservable inventory item (room 101, A-frame 1, apartment 2). Has a stable unit ID, room type, optional building, capacity, occupancy and lifecycle status.
- **extra_service**: add-on such as sauna, breakfast, transfer or equipment rental. A service is not a lodging unit by default; a sauna building can also have its own reservable timeslots.
- **rate_plan**: currency, nightly price, minimum stay, cancellation rules, seasonal overrides; never store a single price as sole source of truth.
- **reservation**: binds to one or more exact physical units, never just a room type. Booking workflow owns guest details separately.
- **availability_block**: maintenance, owner use, external confirmed booking; must participate in the same availability decision as reservations.
- **calendar_connection**: owner-controlled provider and mapping to units; external calendars are projections/integrations, not source of truth.
- **property_members**: owner/manager/viewer per property; tenant isolation must be enforced in database.
- **media_assets** and **amenities**: normalized catalog assets, scoped to property/building/unit as applicable.
- **booking_request**: inquiry without an assigned physical unit is not a confirmed reservation.

## Modeling scenarios

1. One guest house, several rooms: one property, main building, several physical units.
2. Three A-frames: one property, three buildings (if separate), three distinct units, optionally shared room type.
3. Apartment rented entirely: one property, one unit of type entire apartment.
4. Apartment rooms rented individually: one apartment property, several room units. Never simultaneously sell the entire apartment and constituent rooms without an inventory-allocation lock/conflict model.
5. Sauna: standalone building plus extra_service with capacity/time slots; overnight sauna accommodation only when explicitly configured as lodging inventory.
6. Different owners: property-scoped memberships; no cross-owner data visibility.

## Non-negotiable correctness

- Central Postgres is source of truth; GitHub JS becomes a build/cache/read projection, not canonical editing store.
- One stable UUID for each physical unit, explicit locality, timezone Europe/Kaliningrad by default, RUB by default.
- Atomic allocation in database transaction; exclude overlapping half-open [checkin, checkout) date ranges per unit; blocks must be checked in the same transaction.
- Booking requests, temporary holds, confirmed reservations, cancellations, refunds, external calendars and idempotency have separate state transitions.
- Do not grant browser roles direct write to bookings or inventory. Use authenticated backend/Edge Function/RPC with role checks, throttling and audit.
- RLS + grants tested with anon, authenticated, owner, manager, outsider; deny by default; keep personal data out of public catalog.
- Never publish service role credentials, calendar tokens or guest personal information to frontend or repository.
- Avoid automatic migration of guessed addresses, prices, room counts and coordinates. Import as drafts; owner verifies before publication.
- Keep migration SQL versioned in GitHub; run tests and backup before any production switch.

## Existing state and next steps

The newly created Supabase database currently has: properties, room_types, physical_units, reservations (empty, RLS enabled). The initial reservations table already excludes overlapping pending/confirmed date ranges for the same unit.
Next: additive migrations for buildings, membership, services, amenities, media, rate plans, blocks, calendar integrations and inquiry workflow. Review booking/blocks race handling, unit-building-property consistency, entire-apartment vs room inventory conflicts and guest privacy BEFORE allowing live bookings.
Then: import nine verified source entries as unpublished drafts, review, implement read-only catalog API, and only then switch frontend to Supabase. Do not merge site PRs prematurely.

References: Supabase Database, RLS and Production Checklist official documentation.
