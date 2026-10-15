# Owner Cabinet V1 — implementation and remaining rollout

Implemented in `feature/owner-login-shell-v1`, Draft PR [#7](https://github.com/Yumis84/guest-house-map/pull/7), Issue [#8](https://github.com/Yumis84/guest-house-map/issues/8).

- Shared pinned, locally served Supabase SDK and public-only configuration validator.
- Password sign-in, registration with confirmation guidance, PKCE recovery, password change, local sign-out; invalid-session, cross-tab and back-cache handling.
- Company-scoped dashboard; no-membership, no-properties, denied-access and missing-migration states.
- Owner/admin/manager edit name, description, contacts and published status; viewer can inspect.
- Column allowlist, database RLS, optimistic revision check, safe text rendering and unsaved-change prompts.
- Private photo list, signed preview, validated/re-encoded upload and confirmed deletion.
- Exact locality parsing with options derived from the real catalog and synchronized map markers.
- Local PostgreSQL policy tests, browser fixtures, optional loopback-only real JWT runner and GitHub Actions CI.

The shared config intentionally remains empty. This prevents accidental connection of an unfinished deployment to the working database. No hosted Auth configuration, memberships or migrations were changed.

See [security acceptance and rollout gates](owner-cabinet-rls-acceptance.md) and [execution report](owner-cabinet-report.md). Full-stack acceptance and deployment remain blocked; this is not a production-ready sign-off.
