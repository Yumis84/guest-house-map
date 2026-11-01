# Disposable Supabase acceptance runbook: Publication Pipeline V1

Status: execution plan only; not run. Use a newly created local/disposable Supabase stack containing no real users, customer data, credentials, or production project references. Never point commands at hosted, staging, or production Supabase. Record tool and PostgreSQL versions in the evidence bundle.

## Hard stop conditions

Do not begin if the target is not demonstrably disposable, a project ref or URL belongs to a real environment, seed data contains real identifiers, or credentials would be committed/logged. Stop and destroy the stack if migration preflight differs from the reviewed baseline. Do not weaken a check to make a test pass.

The SQL files are design candidates. Passing static Node tests does not mean they parse or execute in PostgreSQL.

## Disposable identities and JWT matrix

Create synthetic UUIDs and locally issued test JWTs only. Keep tokens outside the repository and redact them from logs.

| Actor | JWT role | DB membership/role | Expected submit | review | publish/rollback | direct table write |
| --- | --- | --- | --- | --- | --- | --- |
| anonymous | `anon` | none | blocked | blocked | blocked | blocked |
| unrelated user | `authenticated` | other company | blocked | blocked | blocked | blocked |
| owner | `authenticated` | company owner | allowed own current revision | blocked | blocked | blocked |
| manager | `authenticated` | company manager | allowed own current revision | blocked | blocked | blocked |
| viewer | `authenticated` | company viewer | blocked | blocked | blocked | blocked |
| reviewer | `authenticated` | reviewer row | blocked unless separately owner | allowed except self-review | blocked | blocked |
| publisher user | `authenticated` | publisher row | review allowed | allowed except self-review | **blocked from browser/user JWT** | blocked |
| revoked reviewer/publisher | `authenticated` | role row removed before call | blocked by current lookup | blocked | blocked | blocked |
| publication worker | service identity, worker audience | active publisher/admin | not a browser RPC actor | not a browser RPC actor | allowed through worker boundary only | no general table write |

## Migration preflight

1. Create the disposable stack and capture `supabase --version`, `postgres version()`, enabled extensions, and migration checksums. Do not install tooling as part of this repository task.
2. Apply the exact Owner Cabinet baseline candidate expected by the integration preflight, using synthetic seed data only.
3. Before applying publication candidates, query `information_schema.columns`, `information_schema.column_privileges`, `pg_policies`, `pg_proc`, `pg_roles`, and extension schemas. Confirm the reviewed `properties`, `company_members`, `auth.uid()`, `auth.role()`, `extensions.digest(bytea,text)`, unsafe `owner_update_properties`, and exact authenticated column grant are present. Save results.
4. In one maintenance window with no application traffic, apply in order:
   1. `20261016_publication_pipeline_v1.candidate.sql`
   2. `20261016_owner_publication_integration_v1.candidate.sql`
5. Require zero errors and a committed transaction. Re-query grants/policies/functions/triggers. Confirm no `PUBLIC`, `anon`, or `authenticated` UPDATE/INSERT/DELETE path exists for publication tables, pointer, snapshots, audit, or `properties`; only the intended RPC EXECUTE grants exist.
6. Verify function owners are a dedicated non-login migration/owner role, every definer function has fixed empty `search_path`, and client roles cannot alter functions, tables, triggers, role rows, or audit events.

If step 3 does not match exactly, the expected result is a preflight exception and transaction rollback. That is a pass for drift detection, not permission to edit the migration in place.

## Exact functional and negative matrix

Run every case in its own transaction where practical, assert SQLSTATE/message plus final rows, and reset only synthetic fixtures.

| ID | Operation | Variant | Expected |
| --- | --- | --- | --- |
| S1 | submit | owner, own company, current revision, allowed non-empty patch | one pending immutable submission and one chained audit event |
| S2 | submit | anon, viewer, foreign company, missing user, stale revision | blocked; no submission/audit |
| S3 | submit | `published`, name, ID/company/source key, unknown key, array/scalar/empty patch | blocked; no mutation |
| S4 | direct DML | client INSERT/UPDATE/DELETE on `properties` and all publication tables | privilege/RLS denial |
| R1 | review | independent current reviewer, approval/rejection with nonblank reason | one terminal decision and audit event |
| R2 | review | submitter self-review, owner, revoked reviewer, missing/blank reason, invalid decision | blocked; pending unchanged |
| R3 | review | second decision, stale property revision, missing submission | blocked; no extra audit |
| I1 | immutability | privileged attempt to alter submitted identity/property/company/source/revision/patch/hash/author/time | trigger blocks |
| A1 | audit | concurrent successful transitions | unique monotonic sequence; each previous hash links to predecessor; recomputation matches |
| A2 | audit | client insert/update/delete or direct helper EXECUTE | blocked |
| P1 | publication | active worker, approved current candidate, valid snapshot/manifest hashes, current CAS | immutable artifact and pointer advance once |
| P2 | publication | browser/user JWT including publisher user | blocked before artifact/pointer access |
| P3 | publication | revoked/inactive worker or role removed immediately before command | blocked by current authoritative lookup |
| P4 | publication | rejected/revoked/pending/stale/self-approved submission | blocked |
| P5 | publication | tampered bytes, manifest mismatch, invalid schema/URL/photo/path/ID/parent/count | blocked; pointer unchanged |
| C1 | concurrency | two submits for same property/open status | exactly one succeeds; unique partial index blocks other |
| C2 | concurrency | two reviews of same pending submission | exactly one succeeds after row lock; one decision/audit |
| C3 | concurrency | publish and revoke racing | exactly one valid transition; no published revoked artifact |
| C4 | concurrency | two pointer updates with same expected version | exactly one commits; loser is stale; no forked history |
| D1 | idempotency | retry identical publish after ambiguous response | success identifies same artifact; no new pointer/history |
| D2 | idempotency | reuse snapshot ID with different bytes/manifest | blocked as immutable conflict |
| B1 | rollback | active worker, previously selected fully verified target, current CAS | new pointer version selects target; artifacts unchanged |
| B2 | rollback | browser/user JWT, revoked worker, stale CAS, never-published/corrupt target | blocked; current pointer unchanged |
| B3 | rollback | retry when target already current | idempotent; no new pointer/history |
| J1 | JWT | expired, wrong audience/issuer/signature, anon token, forged app/user metadata role | blocked |

For concurrency cases use two independent database connections, explicit barriers, and at least 25 repetitions. Capture both transaction results and the invariant queries after each repetition. Do not infer concurrency safety from sequential calls.

## RLS and revocation timing

Test with the real request-role setup used by the disposable Supabase gateway, not only `SET ROLE` as an owner. For each readable table, verify own-company visibility and foreign-company denial. Delete the reviewer/publisher role row after token issuance and before RPC execution; the old token must fail because authorization comes from current database state. Also revoke during a deliberately blocked concurrent transaction and document lock ordering and the resulting winner.

## Migration failure and rollback rehearsal

Before acceptance, snapshot the disposable schema only. Exercise these failures: missing column, renamed policy, missing `extensions.digest`, extra client write grant/policy, and wrong migration order. Each must abort without partial objects or revoked grants.

Rollback rehearsal is a security rollback, not restoration of the bypass:

1. Stop application traffic and revoke EXECUTE on submission/review/publication/rollback RPCs from client roles first.
2. Disable the worker and prove worker calls fail.
3. Preserve immutable snapshots, pointer history, submissions, and audit evidence.
4. Drop public transition functions only after dependency inspection; drop the immutability trigger/function last.
5. Do **not** recreate `owner_update_properties` or grant direct `properties` UPDATE. If service restoration requires that bypass, rollback is rejected and requires a new security review.
6. Re-run privilege/policy inventory and prove all client writes and browser publication remain blocked.
7. Destroy the disposable stack after exporting redacted test evidence and checksums.

## Exit evidence and decision

Acceptance requires the full matrix, invariant queries, migration/rollback transcripts, versions, checksums, and concurrency results. Any skipped row is BLOCKED, not PASS. A successful disposable run permits review of the SQL candidate; it is not authorization for hosted application, production migration, deployment, merge, or credential creation.
