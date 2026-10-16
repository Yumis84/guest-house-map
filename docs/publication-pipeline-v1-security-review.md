# Publication Pipeline V1 security review

Scope: offline Phase B/C prototype on `feature/publication-pipeline-v1`. No hosted service, production database, OAuth, n8n, booking workflow, public runtime or Owner Cabinet worktree was modified.

| Gate | Result | Evidence / remaining boundary |
| --- | --- | --- |
| Nine stable records and seven main houses | PASS | Snapshot compatibility tests retain `house_001` through `house_009`, including two child records under `house_004`. |
| Public consumer field compatibility | PASS | Validator/build tests cover map, search, card, contact, photo and stable booking-ID fields. Booking/inventory code is unchanged. |
| Ownership and allowed fields | PASS (offline) | Workflow rejects foreign-company submissions, stale base revisions and non-allowlisted fields. |
| Independent review | PASS (offline) | Reviewer role is separate; self-review, missing reasons, second decisions and unapproved publication are rejected. |
| Revoke and stale submissions | PASS (offline) | Pending/approved submission can be revoked; publication after revoke or after competing revision advancement fails closed. |
| Immutable publication and rollback | PASS (offline) | Exclusive snapshot/manifest creation, hashes, compare-and-swap pointer version, validated history rollback and last-known-good fallback are tested. |
| Immutable audit trail | PASS (offline model) | Ordered events carry previous-event and current-event SHA-256 hashes; callers receive copies only. |
| Unsafe URLs/private paths/invalid schema | PASS | Final whole-snapshot validation rejects unsafe URLs, traversal, unknown fields, IDs, parents and coordinates. |
| Owner direct `properties` write bypass | MITIGATED IN NON-APPLIED CANDIDATE / BLOCKED | Read-only review found Owner Cabinet grants `authenticated` direct updates including `published`. The integration candidate fail-closes on drift, revokes the grant, drops `owner_update_properties`, and asserts no client write path remains. It has not been applied. |
| Submission/review SQL transitions | CANDIDATE / BLOCKED | Definer RPC candidates use empty `search_path`, controlled EXECUTE, membership/role checks, no self-review, patch allowlisting, version checks, row locks and same-transaction hash-chained audit. Disposable-stack validation is mandatory. |
| Hosted RLS/Auth/JWT/Storage | FAIL / BLOCKED | SQL is non-applied. Auth/JWT/RLS, `extensions.digest`, function ownership and concurrent transaction behavior require a disposable Supabase stack. Hosted/production Supabase must not be used for acceptance. |
| Public runtime integration | NOT STARTED / OUT OF SCOPE | Existing static files remain the serving path; no partial rollout or deployment occurred. |
| Rollback of database migration | NOT STARTED / BLOCKED | No migration was applied. A rollback script can only be finalized after disposable-stack migration acceptance. |

Conclusion: the offline state machine, snapshot contract and filesystem publication semantics pass their automated gates. Static regression checks reject any direct client-role `properties` update grant/policy and owner attempts to toggle `published`. The pipeline is not production-ready: the integration SQL is only a candidate, publication/pointer/rollback RPCs remain intentionally unimplemented, and all SQL transitions and rollback procedures require disposable Supabase acceptance plus a separate public-consumer rollout approval.
