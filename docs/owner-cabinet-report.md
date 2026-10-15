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
| Full JWT/Auth/Storage acceptance | FAIL / BLOCKED | No isolated local stack; required OWNER_TEST_* settings absent; runner refused to start |
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
