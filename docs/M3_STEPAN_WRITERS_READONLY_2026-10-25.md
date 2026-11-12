# Stepana writer inventory: read-only snapshot

Existing Supabase ojifyifewlwzkysgxogo, 2026-10-25. SELECT-only catalog/aggregate queries; no guest PII, workflow executions or writes.

| Path | Observed state | Pilot consequence |
|---|---|---|
| `widget/booking.html` → `submit_stepan_booking` | Live RPC is anon/authenticated callable; request-only (no hold). UI correctly says dates are not yet booked. | Route must be deliberately switched to the atomic candidate before claiming15-minute protection. Existing requests must remain accessible; no automatic conversion/import in these PRs. |
| `owner-gate.js` → `booking_requests` | Existing owner summary reads up to40 legacy rows. | New widget_private request store is a separate candidate generation, while old requests are retained in their original table. Unified old/new inbox or explicit legacy read-only section must be reviewed at cutover; do not silently hide existing requests. |
| `owner-calendar.js` → direct `unit_blocks` INSERT/DELETE | Current owner RLS permits SELECT/INSERT/DELETE for company members; trigger `sync_unit_block_inventory` syncs allocations. | Atomic exclusion participates in protection, but legacy DELETE physically removes a block and bypasses M3 soft-release history. Keep current ACL/auth unchanged; coordinated UI/permission migration is a separate approved step. |
| `reservations` and `inventory_allocations` | No authenticated write policy in current catalog snapshot. Inventory trigger writers exist. | Service/admin/integration callers still require a complete route/credential-purpose inventory; absence of RLS policy is not proof of no privileged writer. |
| `stepan_widget_blocks` / `public_calendar_blocks` | Public read RPCs exist. | Legacy sources are not the combined request/hold/reservation calendar; preserve until approved route switch. |
| Candidate M1/M2 owner/submit APIs | Not present on the working project. | No production activation or migration occurred. |

Physical inventory aggregate: `house_001 / STEPAN-HOUSE` active;1 required resource;3 existing manual blocks;3 matching allocation rows; all range boundaries match. No dates, reasons or contact fields copied into this report.

Google Sheets is excluded from the target architecture by owner decision49017584. Any active n8n workflow must be assessed for its present purpose/traffic before modification; new automation may only notify after the Supabase commit.

This is a verified partial writer inventory, not an exhaustive account of privileged integrations or actual traffic. Production remains NO-GO pending exact-schema upgrade/rollback rehearsal, legacy-request visibility, review of privileged callers and separate authorization. No existing ACL or working auth was changed.
