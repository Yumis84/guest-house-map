# M4 safe pilot preparation — candidate only

Stack: PR32 a6d3c524677e7119a8c1a7c00eca60bc72cbcf09. No production SQL, merge, Auth/ACL changes or workflow execution. Existing Yumis-pc native PG17/PostgREST environment reused; synthetic test databases only.

## Compatibility

M4 adds revision/reservation reference columns to the existing legacy booking_requests, NOT a second copy of old requests or contacts. A private UNION feed returns legacy and V2 with one keyset cursor, stable IDs and a generation label. Preflight and insert guards reject cross-generation ID collisions. Legacy contact data remains in booking_guest_contacts. The new inbox reveals it through owner-checked, audited, rate-limited RPCs. Read-only live metadata also confirms an existing owner-scoped direct SELECT policy; that legacy permission is preserved, not silently revoked. The realistic test fixture verifies direct owner read and foreign-owner denial as well as the new RPC.

Legacy new/reviewing maps to pending; accepted maps to confirmed for display, retaining original source_status. Old accepted rows without an associated reservation are marked resolution_required; unsafe actions and pilot activation are blocked. M4 never invents a reservation or starts a retrospective hold. New owner decisions on legacy requests use the existing global/resource locking and exclusion domain, create confirmed reservations atomically and keep source rows/history on decline/cancel. Existing V2 implementations are retained privately behind the same public contracts.

## Pilot guard

Disabled by default, scoped to house_001 / STEPAN-HOUSE. prepared -> active -> paused. Activation checks verified inventory and unresolved historical accepted requests. Once active or paused, direct authenticated/service-role block/reservation/legacy/ledger mutation, including old-to-new unit/resource relocation is rejected by SECURITY INVOKER guards; SECURITY DEFINER reviewed RPCs can perform their checked writes. No blanket ACL change for unrelated properties. The old anonymous submit wrapper becomes fail closed while the pilot is active/paused; it is not silently upgraded into a CAPTCHA-bypassing V2 admission endpoint. The frontend and route switch must be coordinated after approval.

Pause disables admission and keeps guards and committed data. It cannot return to prepared and silently reopen an unsafe old route. This is an operational stop, not a destructive schema rollback.

## Background work

History events enqueue identifier-only notifications in the same transaction. Rollback produces no event. Service-only claim/ACK APIs implement SKIP LOCKED, expiring leases, retry delay, stale-ACK rejection and eight-attempt failure state. Delivery is at-least-once: consumer must deduplicate booking-event:<history id>. No contacts/tokens in event bodies.

Local maintenance now reconnects/retries with bounded backoff, server timeouts, sanitized JSON diagnostics and graceful stop. Notification runner is deliberately limited to a loopback synthetic sink. No real messages sent; no production scheduler installed.

## API boundary

Candidate Edge requires a timestamped HMAC from a reviewed server-side ingress, binding method/path/origin/client IP/body hash. Plain X-Forwarded-For or X-Real-IP is insufficient. Body reads are bounded, signature checks use WebCrypto verification, stale signatures fail closed. Gateway secret never belongs in browser config. Existing runtime/provider tests do not validate a production ingress installation.

## Evidence and limits

Local native PG17: initial12 M4 groups PASS, including161 mixed-generation rows, rights/contact checks, blocked direct deletion, legacy confirmation/cancel, legacy-vs-V2 collision, unresolved accepted gate, transactional outbox, lease recovery and real worker-to-loopback delivery. The expanded suite has14 groups, including eight-session legacy confirmation, disjoint worker claims and exhausted retries. Subsequent hardening is always checked at the exact CI HEAD. M3 evidence remains historical unless regression CI reruns it.

Actual component execution is now verified in ephemeral CI run40265439535: GoTrue v2.197.0 + PostgREST16.5 (5 groups), Edge Runtime v1.77.4 with shared production handler/gateway modules (4 groups), and Cloudflare Siteverify public test keys (3 cases). Browser stand checks3 legacy groups plus8 V2 regression groups; synthetic pg_dump/pg_restore verifies data, ACL and paused state. Final-head status/artifacts are published in Hub; prior results do not replace testing a changed candidate. GoTrue tests are password/local sessions, not hosted production OAuth. Provider test keys do not prove production hostname/action/cdata binding. Exact working Supabase schema rehearsal and real proxy/Edge deployment remain release gates.

Read-only workflow graphs remain active at wrapper43e93575 and subworkflow7752e369, unchanged since August/July. The subworkflow still has a Sheets-only booking path and no Supabase node; its actual routing/retention must be resolved before any approved switch, without building a new Sheets integration. No workflow was changed or executed.

Read-only 2026-10-26: live house_001 has3 new requests from stepan-unified-widget, newest2026-10-24T00:47:28Z. n8n metadata search for wrapper bB628xgqVhO9mz6F and subworkflow xnQAB56WS1MQ2iXo returned0 retained executions since2026-10-19; retention/alternate routes mean this does NOT prove zero traffic. No execution payloads/contacts read. Google Sheets stays out of architecture.

GO for isolated rehearsal only. Production NO-GO pending exact-head independent audit, all privileged-writer inventory, actual deployment/ingress/provider acceptance, scheduler/notification destination and privacy/cutover approval.
