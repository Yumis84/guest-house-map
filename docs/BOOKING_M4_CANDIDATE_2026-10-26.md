# M4 safe pilot preparation — candidate only

Stack: PR32 a6d3c524677e7119a8c1a7c00eca60bc72cbcf09. No production SQL, merge, Auth/ACL changes or workflow execution. Existing Yumis-pc native PG17/PostgREST environment reused; synthetic test databases only.

## Compatibility

M4 adds revision/reservation reference columns to the existing legacy booking_requests, NOT a second copy of old requests or contacts. A private UNION feed returns legacy and V2 with one keyset cursor, stable IDs and a generation label. Preflight and insert guards reject cross-generation ID collisions. Legacy contact data remains in booking_guest_contacts and is revealed only through owner-checked, audited, rate-limited RPCs.

Legacy new/reviewing maps to pending; accepted maps to confirmed for display, retaining original source_status. Old accepted rows without an associated reservation are marked resolution_required; unsafe actions and pilot activation are blocked. M4 never invents a reservation or starts a retrospective hold. New owner decisions on legacy requests use the existing global/resource locking and exclusion domain, create confirmed reservations atomically and keep source rows/history on decline/cancel. Existing V2 implementations are retained privately behind the same public contracts.

## Pilot guard

Disabled by default, scoped to house_001 / STEPAN-HOUSE. prepared -> active -> paused. Activation checks verified inventory and unresolved historical accepted requests. Once active or paused, direct authenticated block/reservation/legacy status deletion or mutation is rejected by SECURITY INVOKER guards; SECURITY DEFINER reviewed RPCs can perform their checked writes. No blanket ACL change for unrelated properties. The old anonymous submit wrapper becomes fail closed while the pilot is active/paused; it is not silently upgraded into a CAPTCHA-bypassing V2 admission endpoint. The frontend and route switch must be coordinated after approval.

Pause disables admission and keeps guards and committed data. It cannot return to prepared and silently reopen an unsafe old route. This is an operational stop, not a destructive schema rollback.

## Background work

History events enqueue identifier-only notifications in the same transaction. Rollback produces no event. Service-only claim/ACK APIs implement SKIP LOCKED, expiring leases, retry delay, stale-ACK rejection and eight-attempt failure state. Delivery is at-least-once: consumer must deduplicate booking-event:<history id>. No contacts/tokens in event bodies.

Local maintenance now reconnects/retries with bounded backoff, server timeouts, sanitized JSON diagnostics and graceful stop. Notification runner is deliberately limited to a loopback synthetic sink. No real messages sent; no production scheduler installed.

## API boundary

Candidate Edge requires a timestamped HMAC from a reviewed server-side ingress, binding method/path/origin/client IP/body hash. Plain X-Forwarded-For or X-Real-IP is insufficient. Body reads are bounded, signature checks use WebCrypto verification, stale signatures fail closed. Gateway secret never belongs in browser config. Existing runtime/provider tests do not validate a production ingress installation.

## Evidence and limits

Local native PG17: initial12 M4 groups PASS, including161 mixed-generation rows, rights/contact checks, blocked direct deletion, legacy confirmation/cancel, legacy-vs-V2 collision, unresolved accepted gate, transactional outbox, lease recovery and real worker-to-loopback delivery. Added eight-session legacy-confirm regression for CI. M3 evidence remains historical unless regression CI reruns it.

Real GoTrue v2.197.0 + PostgREST16.5 and actual Cloudflare Siteverify public test keys are configured in an ephemeral CI job. Until successful execution these are NOT RUN. GoTrue tests are password/local sessions, not hosted production OAuth. Provider test keys do not prove production hostname/action/cdata binding. Exact working Supabase schema rehearsal and real proxy/Edge deployment remain release gates.

Read-only 2026-10-26: live house_001 has3 new requests from stepan-unified-widget, newest2026-10-24T00:47:28Z. n8n metadata search for wrapper bB628xgqVhO9mz6F and subworkflow xnQAB56WS1MQ2iXo returned0 retained executions since2026-10-19; retention/alternate routes mean this does NOT prove zero traffic. No execution payloads/contacts read. Google Sheets stays out of architecture.

GO for isolated rehearsal only. Production NO-GO pending exact-head independent audit, all privileged-writer inventory, actual deployment/ingress/provider acceptance, scheduler/notification destination and privacy/cutover approval.
