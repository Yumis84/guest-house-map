# Owner Cabinet V1 — security acceptance

Status: candidate implemented in Draft PR #7; **NOT applied to hosted Supabase**.
Issue: https://github.com/Yumis84/guest-house-map/issues/8

## Read-only audit, 2026-10-15

Target: guest-house-booking, project `ojifyifewlwzkysgxogo`. Only schema/grant/policy/constraint/bucket/count queries and security advisors were used. No hosted Auth users, memberships, objects, settings or migration history were changed.

- 7 properties, 0 company memberships, 0 media_assets, no Storage buckets.
- RLS enabled on properties, company_members and storage.objects.
- properties has UUID id/company_id, name, description, locality, address, coordinates, published, source_key, property_kind, owner_display_name and created_at.
- company_members uses **member_role**, with owner/admin/manager/viewer roles. Its SELECT policy is user-scoped, but authenticated had **no SELECT grant**, so the old dashboard could not query it.
- properties only had published SELECT; no authenticated draft SELECT or UPDATE policy.
- properties had broad legacy grants to anon/authenticated, including INSERT/UPDATE/DELETE/TRUNCATE. RLS blocked row mutations, but grants should still be narrowed (TRUNCATE is not row-filtered).
- No custom triggers on properties/company_members; no SECURITY DEFINER functions in public.
- Contacts do not exist in properties. media_assets exists, but has no client grants/policies; V1 does not open it or its verification flag.
- storage.objects has standard SELECT/INSERT/UPDATE/DELETE grants to anon/authenticated, RLS, no policies.
- Security advisor: 15 INFO tables with RLS and no policies (closed by default); one existing WARN for btree_gist in public. This inventory-related extension was not moved. [Advisor remediation](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).
- Auth provider, SMTP and redirect allowlist were not changed or independently verified.

## Candidate migration

`supabase/migrations/20261015110028_owner_cabinet_v1.sql` was created using the pinned Supabase CLI's `migration new` command. Apply only to an isolated staging clone first; this task does not authorize applying it to the hosted working database.

It adds contact_phone/contact_email/website_url and owner_revision; grants only editable columns; permits company members to read drafts, and owner/admin/manager to update their own company's records. Viewer is read-only. No client can change company_id, identity, source mapping, revision, or memberships, or insert/delete properties. No inventory/booking grants are added. Update policies have both USING and WITH CHECK; authorization reads current membership, never editable user_metadata.

Existing named baseline SELECT policies are recreated with exact predicates. Unexpected policy names stop the migration instead of silently combining permissions. No SECURITY DEFINER function is introduced. Column length and URL checks protect new/edited data; legacy name/description constraints are NOT VALID pending staging data review.

## Photo model

V1 uses the new **private** `owner-property-photos` bucket directly; existing media_assets and public static galleries are untouched.
Path: `<company_uuid>/<property_uuid>/<random_uuid>.webp`.

- SELECT/signing: any current member of the exact company/property.
- INSERT/DELETE: owner/admin/manager of that company/property.
- UPDATE, overwrite and move: denied; upload always uses a new random path.
- Restrictive guard policies prevent unrelated broad Storage policies from opening this bucket.
- Anonymous access is denied even for a published property.
- 5 MiB bucket limit; WebP MIME only. Browser accepts JPEG/PNG/WebP, decodes and re-encodes to WebP, strips source metadata and bounds output dimensions.
- MIME declarations alone are not content scanning. The bucket stays private; a separate verified publication pipeline is required before using these uploads on the public website.
- Signed viewing URLs expire in 60 seconds. Previously issued URLs can remain usable until expiry after membership revocation. Images already downloaded cannot be recalled.

## Verification layers

1. `npm test`: real PostgreSQL execution in PGlite, with a minimal audited schema fixture and transaction-scoped anon/authenticated roles. Covers A/B visibility, no-membership, viewer, owner/admin/manager, direct forged company update, protected columns, membership self-grant, DELETE/INSERT/TRUNCATE denial, stale revisions, Storage path/role isolation, revocation and rollback.
2. `npm run test:browser`: real browser and pinned real Supabase SDK, **mock Auth/REST/Storage HTTP responses**. All external network (including n8n) is blocked. Covers sign-in/up/out, recovery request and PKCE exchange, expired/invalid sessions, cross-tab logout, no membership/missing migration/grants, editing and conflicts, XSS text, photo upload/delete and real catalog address/marker synchronization at 320/390/1440 px.
3. `npm run test:jwt`: opt-in full local Supabase Auth + PostgREST + Storage test. Requires an isolated local stack and local keys. Refuses hosted URLs and does not apply migrations. It creates only synthetic local users/companies/properties and cleans them up.

**Layer 1 is not JWT acceptance; layer 2 mocks server behavior.** Layer 3 has not passed: no local Supabase stack/Docker CLI was available on Yumis-pc, and required local settings are absent. The runner correctly stopped before network or data mutation. Production readiness remains FAIL/BLOCKED.

## Full-stack local acceptance procedure

On a disposable local Supabase stack (never the working project):
1. Initialize/start a separate local Supabase workspace with Docker, following `npx supabase --help`.
2. Load `tests/fixtures/local-supabase-baseline.sql` into its empty public schema, then load the candidate migration. This fixture is intentionally minimal; also test a sanitized full-schema staging clone before rollout.
3. Set process-only `OWNER_TEST_SUPABASE_URL` (http://127.0.0.1:54321), `OWNER_TEST_DATABASE_URL` (loopback Postgres), `OWNER_TEST_ANON_KEY`, `OWNER_TEST_SERVICE_ROLE_KEY` using **local** stack values. Also set `OWNER_TEST_CONFIRM_ISOLATED=disposable-local-owner-cabinet` only after confirming the stack is disposable. The runner rejects non-loopback URLs and equal anon/service keys. Never paste credentials into source or reports. A loopback proxy/tunnel is not proof of isolation: do not point these variables at one.
4. Run `npm run test:jwt`. It never applies schema changes. It checks actual password sign-in and JWT reads/writes, foreign-company/viewer denial, metadata escalation denial, private Storage read/upload/overwrite/delete and membership revocation, then best-effort removes synthetic fixtures.
5. Configure local email delivery and exact callback URLs; complete real confirmation and recovery email flows, including expired/used links and another browser. Browser mocks cannot prove delivery.
6. Re-audit grants, triggers, functions and policies on the staging clone; run security advisors. Verify no existing column-level grant widens protected columns and no privileged function supplies another write path.

## Rollback

Candidate: `supabase/rollback/owner_cabinet_v1.sql`. Not applied to hosted Supabase. Removes owner writes/draft access, version RPC and trigger, revokes membership SELECT, and locks the private bucket. Retains contact columns and files to avoid data loss; does not reinstate old broad grants. Disable frontend configuration/revert the frontend through normal review. Test rollback on a clone and back up data first.

## Release gates

- [x] Local implementation and SQL policy tests.
- [x] Browser acceptance at mobile and desktop widths.
- [ ] Full local/staging JWT/Auth/Storage acceptance and real email delivery.
- [ ] DBA review and separately authorized migration on the intended working database.
- [ ] Public URL/key configuration and exact Auth redirect allowlist; no service-role key in frontend.
- [ ] Privileged, verified membership bootstrap (no browser self-assignment).
- [ ] Approved integration of edited data/photos into the currently static public catalog.
- [ ] Separate deployment approval; keep PR draft until these gates pass.

No production migrations, membership assignment, deployment, merge, n8n changes or inventory/booking activation were performed.
