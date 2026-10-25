# V2 integration candidate · 25 October 2026

Status: **NOT READY FOR PRODUCTION**. No SQL applied, migrations run, production/auth changes or merge. Branch is stacked on #24 → #23 → #22; those PRs remain Draft. Standalone editor does not replace the existing cabinet. No live guest data was fetched; only schema, function definitions, grants, policies and aggregate counts.

## Evidence and scope

Read full Claude Vitalina HANDOFF db37d211-89ea-4160-9377-bf5a636835cb and both FYI f83a5989-aec6-42e7-8541-d537d8973723 / f0c55823-b79e-4c2b-930e-f65fe96c4817 through reply_to 9cf95e33-58fe-42de-bc92-1b45307fb441. These events are in the AI AGENT HUB space, while implementation state belongs in guest-house-map. Fresh project context returned no PROJECT_STATE, AGENTS.md or WORKSTREAM_SCOPE.md; no such files exist in this checkout. Owner instructions and existing audit are applied; missing documents are not invented.

Read-only live inspection: Supabase ref ojifyifewlwzkysgxogo, PostgreSQL 17.11, 25 October. Metadata snapshot: `evidence/widget-v2-live-metadata.json`. All 21 public tables have RLS enabled. Snapshot contains no guest records. Aggregates: reservations empty, booking_requests 3 new, inventory_allocations 3 block, calendar_connections empty. These counts do not prove the absence of external bookings.

## Inventory

| Tables | Role / safety relevance |
|---|---|
| companies, company_members, property_members | Ownership/membership. Existing client uses company_members; unchanged. V2 candidates restrict configuration writes to owner/admin. |
| properties, buildings, room_types, physical_units | Catalog / physical inventory / capacity. IDs must be mapped explicitly; never select the first unit for universal booking. |
| inventory_resources, unit_resource_requirements | Shared resource graph; whole house and individual rooms can share resources. Checking just unit_id is insufficient. |
| reservations | pending/confirmed/cancelled/expired; same-unit GiST exclusion for active statuses. No expiry timestamp in this live table. |
| unit_blocks | Manual closures; same-unit exclusion. Owner browser inserts/deletes directly; triggers participate in resource allocation. |
| inventory_allocations | Resource-level GiST exclusion, kinds reservation/block/hold. No expires_at; time passage alone cannot release holds here. |
| booking_requests, booking_guest_contacts | Legacy request queue (new/reviewing/accepted/declined/cancelled), private contacts separate. No hold TTL or FK to a reservation. |
| calendar_connections | Provider/unit mapping; empty now, not evidence Google Sheets is unused. |
| rate_plans, extra_services | Pricing and ancillary products; not public V2 pricing input yet. |
| amenities, property_amenities, unit_amenities, media_assets | Presentation data, not occupancy sources. |

Application SQL/PLpgSQL functions are fully recorded in the metadata snapshot (10); extension support functions excluded there. Booking-relevant RPCs/triggers:

| Mechanism | Observed behavior |
|---|---|
| stepan_widget_blocks() | Only unit_blocks for hardcoded Stepan property, all active units merged; no reservations or requests. |
| public_calendar_blocks(property) | Only manual blocks for published properties. Not a complete availability function. |
| submit_stepan_booking(...) | Public anon/authenticated execute; validates 1–8 guests, max 60 nights, contacts; phone advisory lock, 3 requests/24h/phone and 50/hour/property. Inserts request new + contacts. Does not insert a hold/reservation. No CAPTCHA in this function. |
| sync_reservation_inventory | pending/confirmed reservations allocate each required resource; cancellations/deletes remove allocations. |
| sync_unit_block_inventory | Closures allocate resources; deletion releases them. |
| ensure_unit_inventory_mapping | Rejects reservations without resource mappings. |
| guard_inventory_mapping_changes | Prevents mapping changes while allocations exist for that unit. |
| owner_property_revision / owner_photo_access / owner_cabinet_version | Existing cabinet support; unchanged. |
| widget_v2_* (#23) | Candidates only. Separate requests store, explicit activation gate, intentionally failing inventory adapter. Not present among live functions. |

### External writer discovered

Repository `guest-n8n-v1.js` POSTs to `/webhook/guest-house-booking`. Read-only n8n definitions confirm active WEB_BOOKING_GUEST_HOUSES (`bB628xgqVhO9mz6F`) invokes active `xnQAB56WS1MQ2iXo`. That workflow reads Google Sheets «Дома» and «Бронирования», checks overlap by house_id, appends status «Подтверждено», then branches to notifications and success. Active definition has no Supabase call or atomic shared lock. No workflow was executed or changed; notifications were not sent. Google Sheets rows themselves were not read.

A concurrent read/check/append race is possible from this control flow; it was not reproduced against production. Google Calendar/iCal synchronization is not established by these definitions. Other service-role clients/manual administrators cannot be exhaustively enumerated from pg_proc; they remain inventory sign-off scope.

## Compatibility verdict

The legacy HTML and RPCs stay byte-for-byte unchanged. V2 uses separate public IDs, pages, loader and RPC contracts. This preserves existing behavior but **does not establish simultaneous booking safety**. Legacy dates omit reservations. Legacy submit does not see V2 private holds. V2 unit row locking does not coordinate with resource exclusions or Sheets. Therefore do not replace the failing inventory adapter with a unit_blocks-only query and do not activate V2 for Stepan or any shared resource.

Recommended integration, pending owner approval: retain the existing resource ledger as authority; all writers reserve every required resource atomically in deterministic order, including parent/child conflicts. Avoid creating another inventory authority. A staged adapter must cover reservations, blocks, resource allocations, legacy requests according to policy, and reconciliation of Sheets. A read adapter alone is insufficient: holds must write into the same exclusion domain.

## Lifecycle and 15-minute target

Proposed rule for approval: a successful validated submit creates one request and a 15-minute hold in one transaction. Browser timeout/retry uses the same idempotency key and does not extend expiry. Expiry is checked by server clock; worker releases ledger allocations and marks expired. Confirmation locks the same resource set, rechecks availability, atomically converts hold to reservation, and links request→reservation. An expired request cannot be confirmed without a fresh atomic check. Decline/cancel release allocations once; duplicate transitions are idempotent. Owner notifications use an outbox after commit and must not confirm a reservation merely because email/Telegram succeeded.

Current #23 implements only isolated pending/confirmed/declined/cancelled rows; no owner transition RPC, expired status, ledger conversion, outbox or PII retention job. Existing reservation pending has no time-based expiry. These are explicit deployment blockers, not implemented lifecycle guarantees. Request creation time is the proposed hold start; browser date selection does not hold anything.

## New UI candidate

- `owner-widgets-v2.html`: authenticated standalone list/editor using existing getClient/loadAccessibleProperties, RPC save/publish/remove, duplicate, revision errors, unpublished code disabled. No localStorage persistence or fake live database.
- `widget/v2.html?id=<publicId>`: per-object public page with date inputs, occupancy overlap check, capacity, consent, Turnstile cData/action and Edge submission. Failure hides submission; empty/unready inventory never appears free. Dates are input fields, not a custom visual month grid.
- `widget/loader.js`: multiple independent iframe instances, checked source/origin/type/finite/range for resize, accessible native modal close, fallback public URL. Published template is fetched inside iframe, so code remains stable after settings publication.
- Draft changes remain private; public client reads only widget_v2_config's published projection. Live storage/publication cannot work until approved candidates are deployed to staging.
- `widget/v2-runtime.js` is intentionally empty public deployment configuration. Site key and HTTPS Edge URL must be set by deployment; secret stays server-side. Real Turnstile and Edge have not been deployed.
- ru only; prices/photos, QR generation, installation telemetry, full visual calendar, Tilda-specific instructions, undo/history UI and SaaS features remain future work. No fabricated installation status.

## Deployment gates and rollback

1. Owner approves resource-ledger integration and treatment of the Sheets writer; reconcile existing Sheets rows before enabling shared inventory.
2. Define and test ledger holds, expiry/cleanup, owner confirmation/cancellation and request→reservation mapping. Finalize 15-minute policy and whether expiry requires resubmission.
3. Review effective RLS/grants and role behavior (live manual blocks currently allow any company member, without role restriction). Existing ACL is not changed here.
4. Two-account staging acceptance; real two-connection races: same unit, different units sharing a resource, hold vs manual block, hold vs reservation, legacy vs V2, confirmation vs expiry. PGlite sequential tests do not satisfy this.
5. Approve policy URL and storage/deletion periods; implement actual deletion and limiter cleanup. Set verified Turnstile hostname/site key/secret, trusted gateway IP overwrite and rate budgets; test real replay/expiry/accessibility.
6. Deploy only after explicit permission. Turn off Edge enabled flag and per-unit activation first on rollback; preserve requests/contacts for reconciliation. Do not drop tables with live requests or restore insecure grants. Existing Stepan path is retained until a separately approved cutover.

## Owner decisions required

- Approve proposed common ledger integration and how to retire/bridge the active Google Sheets confirmation path. No workflow change is authorized by this document.
- Confirm 15 minutes from server acceptance; approve expiry behavior and owner's confirmation after expiry (fresh check required).
- Provide/approve policy URL, data operator and retention/deletion rules.
- Authorize isolated staging deployment and subsequent cutover separately. Turnstile and continued GitHub Pages are already selected; no need to choose them again.

Official Supabase changelog was read on 25 October, including the PostgreSQL 17.11 notice: https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes . Its btree_gist reindex warning is specifically for float/NaN keys; the recorded booking exclusions use UUID and ranges, so this notice alone does not establish that they need reindexing. RLS reference checked: https://supabase.com/docs/guides/database/postgres/row-level-security .
