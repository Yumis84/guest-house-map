# M3 / Stepana pilot acceptance · 2026-10-25

Supabase project `ojifyifewlwzkysgxogo` remains the only intended booking authority. Google Sheets is excluded. n8n may notify/automate after commit, never independently establish availability. No working database, auth, workflow, endpoint, main or production migration changed.

## Delivered

- Public month grid and bounded availability via reviewed server endpoint `/availability`; removed the obsolete direct `widget_v2_availability` year-long call, which M1 revokes. The server rechecks the selected stay on submission.
- Existing owner design retained. Separate requests and calendar/period-management views. Per-unit calendar, Russian event labels, links to permitted request details, manual block creation and soft removal. Manual create uses stable retry keys, rights checks, resource locks, server availability check and history.
- Calendar deduplicates logical occupancy across multiple allocation resources and fallback rows. Missing-allocation drift still shows reserved/blocked dates. Exact source data remains incomplete until all Stepana writers are reviewed; `complete=false` is intentional.
- Stand runs real native PostgreSQL17.11, PostgREST16.5, actual browser UI and vendor Supabase JS client. Service JWT never reaches the browser. It binds only to loopback, has synthetic contacts, an ephemeral TLS certificate and a static-file allowlist. Test-only Auth getUser/JWT issuer and CAPTCHA substitute exist exclusively under tests/booking/stand; they are NOT production authorization code.

## Existing work reused

Read Yumis-pc branch `codex/m3-review-work`, verified checkpoints58f10a8/f5c558e/8324e51 and latest HANDOFF03b2bc67. Reused its Edge syntax correction, safe database guards and HTTP-handler→SQL→owner confirmation test. Original branch/untracked Qwen files preserved. Unrelated Qwen and obsolete Sheets adapters are excluded from this PR.

Independent Claude HANDOFF83f15f0b reran19 ledger groups +12 adversarial groups. Its P1 fingerprint/authorization-order findings are addressed in preceding Draft PR31, with bounded locks. This M3 PR depends on that PR.

## Executed

| Check | Result |
|---|---|
| Native PG17.11 multi-session lifecycle + new audit regressions | PASS21 groups; eight concurrent connections, expiry/late confirm/idempotency/10k paging |
| Real browser + real PostgREST + PG17.11 | PASS8 groups: guest submit/retry, owner masked list/detail/contact reveal, confirm, cancel, calendar, block/remove, expired hold/late confirm, gateway disable |
| JWT verification through actual PostgREST | PASS signature tamper, expiry, foreign-owner denial and anon contact denial |
| Owner/public responsive UI | PASS320/390/768/1440, no horizontal overflow or JS errors; keyboard calendar arrows; screenshots390/1440 inspected |
| M3 manual-block/calendar SQL | PASS5 groups: stable replay/mismatch, dedup, missing-allocation fallback, soft removal once, foreign-owner denial |
| CAPTCHA binding contract | PASS6 mocked tests; hostname/action/widget/duplicate and network/HTTP/JSON failure |
| Offline calendar/owner/DB guards/inventory checks | PASS34 tests before CAPTCHA addition; CAPTCHA6 separately |
| Existing Edge/Core/SQL regressions | PASS |
| Actual hosted GoTrue / Edge runtime / trusted gateway / real Turnstile | NOT RUN |
| Production migrations or real guest submissions | NOT RUN (forbidden) |

Expiration tests move synthetic timestamps across the900-second boundary; they do not wait15 wall-clock minutes. The baseline uses metadata-derived real inventory trigger bodies but is not a full live Supabase schema clone. Auth issuer/getUser and CAPTCHA are synthetic contracts; real PostgREST JWT role switching/RLS/RPC is exercised. Do not describe this as a hosted Supabase acceptance.

## Pilot inventory verified read-only

`house_001 / STEPAN-HOUSE`: active, exactly1 required resource;3 manual blocks,3 matching block allocations, matching date boundaries. No guest contacts/booking payloads read. Existing live `submit_stepan_booking` is request-only; new M1/M2 RPCs are not deployed. Other houses remain outside pilot. See M3_STEPAN_WRITERS_READONLY_2026-10-25.md: legacy owner UI still directly INSERTs/DELETEs unit_blocks and reads the old booking_requests store. Candidate does not migrate or hide those rows; coexistence/unified visibility and the soft-delete transition remain cutover gates.

## Reproduce (empty loopback database only)

```sh
npm ci --ignore-scripts
npm install --no-save --package-lock=false playwright@1.56.1
npx playwright install chromium
# Provide an installed PostgREST16.5 executable and ephemeral localhost TLS files:
export BOOKING_TEST_DATABASE_URL=postgresql://TEST_ROLE@127.0.0.1:PORT/synthetic_booking_m3_empty
export POSTGREST_BIN=/path/to/postgrest
export M3_TLS_KEY=/tmp/m3-local.key M3_TLS_CERT=/tmp/m3-local.crt
node tests/booking/stand/server.mjs
# In another terminal with the same test DB URL:
node tests/booking/stand/browser.mjs
```

The stand seeds an EMPTY synthetic database once and creates the local test authenticator role; never point it at Supabase. Windows PostgREST needs PostgreSQL/bin on its process PATH. Default TLS UI: https://127.0.0.1:55440/synthetic-owner. Current Yumis-pc review instance uses55444; browser certificate is self-signed. CI creates and removes its own isolated service.

## GO / NO-GO

GO for isolated synthetic review. **NO-GO for the production pilot.** Remaining gates:

1. Independent exact-head review of PR31 and this M3 candidate.
2. Real hosted GoTrue/Edge/Turnstile/trusted-IP tests and exact-schema transition/rollback rehearsal in an approved isolated environment; no new working Supabase project.
3. Complete inventory of every live Stepana writer/caller, including legacy request form, owner block/reservation writes and any active automation. Preserve active workflows until their purpose and routing are verified. No Sheets dependency.
4. Review/deploy an expiry+limit-cleanup scheduler and idempotent post-commit notifications; scripts/booking-maintenance.mjs exists but is not installed on production.
5. Owner separately approves personal-data retention/deletion proposal, final cutover window and pilot activation. Hold-less pending-request quotas remain a separate operational policy proposal; existing gateway/IP/phone/widget limits and active-hold quota are enforced.

See updated BOOKING_CUTOVER_PLAN.md for ordered stop/SQL/gateway/UI/verify/disable steps. No production action is authorized by this report.
