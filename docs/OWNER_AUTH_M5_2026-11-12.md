# M5: existing Auth and owner cabinet

## Diagnosis

On 2026-11-12 the deployed `https://hostframe.ru/login.html`, `owner-auth.js`, `owner-common.js`, `owner-gate.js` and CNAME were fetched and compared byte-for-byte against origin/main (6a53d31). They match. Response headers identify GitHub Pages. This establishes the source of these deployed assets, not all server-side configuration.

Supabase Management API get_project confirms `ojifyifewlwzkysgxogo` status `INACTIVE`. Desktop Commander on Yumis-pc reports DNS resolution failure for that project's Auth host. A cloud health request returned upstream503. The inactive project is a live Auth blocker; the project was NOT resumed or modified.

Fresh browser session: submit becomes enabled, pointer-events auto, hit-test resolves to submit; no page Auth script exception observed. Thus the button is not universally covered or disabled by CSS. Reproduced with production source and a stored expired synthetic session: pending refresh keeps `getSession()` pending, markup submit remains disabled. No overlay. The prior PR35 candidate enabled the form but only attached submit after its await, leaving an event-handler gap and relying on Promise.race without canceling Auth.

## Changes

Continue existing PR35; integrate existing M4 branch as dependency. No new Auth implementation or parallel cabinet.

- Attach submit before any asynchronous initialization. Enable only after validated public client creation.
- Bound real fetch AND body read using AbortController (12s); preserve error status and headers. No UI-only sign-in race leaving a late session commit.
- Ignore stale initial-session results after user actions. Synchronous onAuthStateChange callback, no nested Auth request.
- Neutral signup/recovery messages; no instruction to disable email confirmation. Do not reset any real password.
- Existing owner shell shows server-authorized objects, profile email and assigned role labels. No automatic property or membership creation.
- Calendar and requests link to the existing M4 RPC UI with validated property selection. Remove legacy direct unit_blocks DML from that owner path; preserve separate requests/calendar views. Saved widget management remains linked.
- Network errors do not silently become an authentication redirect. Logout avoids duplicate navigations. Empty access has an explicit state.
- Candidate-only M4 audit hardening: guard legacy INSERT by property/unit, protect TRUNCATE, revoke API EXECUTE on renamed private originals, DDL2s lock timeout, avoid unchecked UUID cast in calendar join, literal prefix search.
- Pin browser CI OS to Ubuntu24.04: ubuntu-latest moved to26.04, unsupported by pinned Playwright1.56.1.

## Verification contracts

`tests/booking/stand/m5-browser.mjs`: actual vendored SDK, mock Auth/REST transport; 320/390/768/1440, keyboard/touch, old-source failure, stall abort/retry, wrong password, owner/profile/calendar, logout/relogin, invalid recovery URL. This is NOT real Auth/RLS acceptance.

`tests/booking/stand/m5-real-auth.mjs`: real ephemeral GoTrue2.197.0 + PG17 + PostgREST16.5 + same login/owner/calendar UI. Password sign-in, invalid credentials, role/member scoped objects, manual block/release through UI and ledger assertions, logout/relogin, expired stored session -> real refresh grant, second-user RLS denial. Browser390/1440. No production user or secret.

`tests/auth-transport.test.mjs`: actual cancellation, stalled body, response preservation/caller cancellation. Existing M1–M4 concurrency and browser suites run as regressions because shared client/SQL changed.

## Remaining gates

- Explicit owner authorization to resume the existing INACTIVE working Supabase project; then read-only review of actual memberships/Auth redirects/CORS/RLS, with no auto grants or password resets.
- A designated isolated HTTPS host and synthetic GoTrue/PostgREST deployment are needed for owner phone acceptance. Loopback and CI artifacts are not a remotely usable HTTPS link. Do not substitute a fake Auth UI or attach the preview to real booking data.
- Real recovery email delivery / PKCE callback and hosted redirect allowlist remain unverified. Browser mock recovery is limited to request/error flow.
- Exact-HEAD independent Claude audit required; production remains NO-GO.
- M4 operational gates, retention/deletion approval and full writer inventory remain. Literal prefix query is correct; large-scale pagination pushdown tuning remains a P2 follow-up.

## Rollout

No production/main/live Auth/n8n/real booking changes. SQL is CANDIDATE only. PR35 depends on the unmerged M4 chain; it cannot be deployed alone as a whole-cabinet release. A separately approved login-only patch can be extracted after review; backend resumption is still needed. Pausing the new booking mechanism retains guards/data and never silently restores unguarded legacy writes.
