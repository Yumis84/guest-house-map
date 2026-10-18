# Owner Cabinet V1 — execution report (2026-10-15)

Work performed on **Yumis-pc / Windows 11**.
Checkout: `C:\Users\Yumis\Documents\Codex\guest-house-map-owner-v1`.
Branch: `feature/owner-login-shell-v1`.
Starting commit: `ffb4f034423e9efe9d8014e0b2a06a548b964ab5`.
A separate clean clone was created after searching normal development folders; no existing working tree was overwritten.

## PASS / FAIL

| Check | Result | Evidence / limit |
|---|---|---|
| Hosted Supabase audit | PASS | Read-only schema, RLS, grant, trigger, bucket and advisor inspection |
| Auth/dashboard implementation | PASS (local) | Real SDK with isolated browser HTTP fixtures |
| RLS + validation + locality tests | PASS | `npm test`; PostgreSQL/PGlite, synthetic fixture only |
| Mobile/desktop browser acceptance | PASS | 66 tests, Chrome on Windows; 320, 390, 1440 px |
| Photo isolation and permissions | PASS (local) | SQL policy tests + browser upload/delete; real Storage service still unverified |
| Dependency audit | PASS | npm audit: 0 vulnerabilities at installation |
| Full JWT/Auth/Storage acceptance | FAIL / BLOCKED | No isolated local stack; required OWNER_TEST_* settings and explicit disposable-stack confirmation absent; runner refused before network access |
| Hosted email confirmation/recovery | FAIL / NOT RUN | SMTP, redirect allowlist and real email delivery not verified |
| Production readiness | FAIL / BLOCKED | Migration/configuration/membership rollout and real acceptance remain outstanding |
| Production / main / n8n untouched | PASS | No migration application, membership assignment, merge, deployment or n8n call |

## Changes

Auth and protected dashboard, editable property fields with conflict protection, private photo gallery, least-privilege SQL candidate and non-destructive rollback, exact locality filter and late-marker synchronization, pinned dependencies, CI and repeatable acceptance procedures.

Browser failures found during implementation were resolved: multipart upload fixture parsing, expired-session redirect loop, and logout behavior when server revocation fails. With the pinned SDK a failed server logout clears local session data; the login page now explains that server revocation was not confirmed.

## Preview / screenshots

No public preview deployment was created. Start the local preview on Yumis-pc:

```powershell
Set-Location 'C:\Users\Yumis\Documents\Codex\guest-house-map-owner-v1'
npm.cmd ci --ignore-scripts
npm.cmd run build
npm.cmd run serve
```

Open http://127.0.0.1:4173/login.html . With empty config, the app correctly fails closed.
Screenshots use synthetic test data, not real owner accounts:
[Mobile cabinet](screenshots/owner-mobile.png), [Desktop cabinet](screenshots/owner-desktop.png), [Mobile password form](screenshots/auth-mobile.png).
CI also preserves browser evidence as a short-lived artifact.

## Remaining blockers

1. Provide an isolated local/staging Supabase stack and pass real JWT, Storage and email acceptance. Docker/psql were not available on PATH on Yumis-pc.
2. Review and separately authorize migration deployment to the working database; no such deployment was performed.
3. Configure only a public key/project URL, Auth email settings and exact callback URLs, then provision verified membership through a privileged admin workflow.
4. Public website data still comes from static guest-houses.js and image assets. Connecting owner edits/photos to the public catalog requires a separate reviewed publication step; booking/inventory remains outside V1.

See [RLS acceptance](owner-cabinet-rls-acceptance.md).
PR: https://github.com/Yumis84/guest-house-map/pull/7 (keep Draft).

## Continuation audit, 2026-10-15

- PASS: migration and non-destructive rollback reviewed; PGlite executed the candidate policies and rollback, including a second rollback run, without losing retained private objects.
- PASS: isolated acceptance preflight now requires an explicit disposable-stack confirmation, rejects non-loopback endpoints and equal anon/service keys, and has local unit coverage. Cleanup remains best-effort and the runner still never applies migrations.
- PASS: `npm test` — 50/50 tests. Node test process isolation is disabled because this managed Windows environment blocks child-process spawning; test semantics are unchanged.
- PASS: `npm run build`.
- BLOCKED: `npm run test:browser` could not start a Playwright worker (`spawn EPERM`) in the managed environment. No browser assertion ran; the earlier 66-test PASS remains historical evidence, not a new result.
- EXPECTED FAIL / BLOCKED: `npm run test:jwt` refused before network access because no disposable local stack or required settings were supplied.
- NOT COMMITTED: the requested all-tests-pass condition was not met in this continuation run.

## Owner demo continuation, 2026-10-18

This continuation is demo-only. It does not apply SQL, contact a hosted database, deploy production, or change the real owner dashboard. Existing uncommitted work was preserved, and `vendor/` was excluded from the implementation scope.

Current local test evidence must not be reported as an all-tests PASS:

- **FAIL:** `npm.cmd test` completed with 53/58 passing and five failing SQL tests in `tests/rls.test.mjs`:
  1. `anonymous cannot read base properties; private photos denied` — transaction aborted (`25P02`) before the storage assertion.
  2. `revocation takes effect without JWT refresh` — `permission denied for table properties` (`42501`).
  3. `publication RPC enforces ownership and anonymous denial` — expected rejection did not match because the transaction was already aborted.
  4. `public catalog hides contacts until owner confirmation` — confirmed phone was `null`, not the expected value.
  5. `candidate rollback disables owner writes and locks private photos without deleting data` — rollback SQL syntax error near `$` (`42601`).
- **BLOCKED:** `npm.cmd run test:browser` stopped at `Error: spawn EPERM`. No Playwright test or browser assertion ran in this continuation, including the focused owner-demo specifications.

Passing focused Node/static owner-demo checks may be reported separately, but they do not override the five SQL failures or the Playwright blocker above.

## Owner demo and property-category release review, 2026-10-18

Release status: **BLOCKED; no release commit created.** Vendor changes were not reviewed as application changes and must remain excluded from any future app/docs/tests commit.

Verified in this review:

- `node --test --test-isolation=none tests/owner-demo.test.mjs tests/property-category.test.mjs`: 4/4 passing.
- `npm.cmd run build`: passing. The build copies the pinned Supabase browser bundle, so the already-dirty `vendor/` files remain intentionally unstaged.
- `git diff --check -- . ':(exclude)vendor/**'`: passing.
- Live local catalog review: all seven existing top-level listings render as guest houses; `До 7000 ₽` leaves one listing and one visible marker; switching to apartments removes all markers; the catalog title, count `0`, and apartment empty state update correctly.
- Live local owner-demo review: an existing v2 browser draft was restored through the v3 fallback, including its current object and wizard step.
- Static responsive review: `owner-demo.html` retains the one-column layout below 720 px and shared controls use bounded widths/min-width rules.

Unresolved release blockers:

- **FAIL:** `npm.cmd test` completed with 56/61 passing and the same five failures in `tests/rls.test.mjs`: anonymous/private-storage transaction abort, revocation permission error, publication RPC assertion after transaction abort, confirmed public contact remaining `null`, and rollback SQL syntax near `$`.
- **BLOCKED:** `npm.cmd run test:browser -- tests/browser/owner-demo.spec.js` cannot start a worker (`spawn EPERM`), so the new autosave, validation, pricing/availability, photo persistence, and mobile browser assertions did not execute.
- **BLOCKED:** an attempted local 390 px DevTools viewport review was not authorized by the browser control gate. No viewport override was applied. Mobile layout therefore has static-review evidence only, not a fresh rendered-browser pass.
- The apartment path currently has no published fixture; only its zero-result state is exercised. Category-colored apartment markers cannot receive live UI coverage until an apartment fixture exists.

Because required checks did not all pass, staging and commit creation were deliberately skipped.
