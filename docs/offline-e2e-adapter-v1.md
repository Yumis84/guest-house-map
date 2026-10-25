# Offline publication E2E adapter V1

Status: branch-only reference implementation. It performs no network, database,
deployment, Owner Cabinet, eco-museum, booking or production write.

## Implemented flow

`publication/offline-publication-adapter.mjs` joins the existing review state
machine, immutable artifact builder, service-identity worker and snapshot store:

1. A server endpoint authenticates a user session and passes only a verified
   principal ID to the adapter. The adapter reloads roles and company membership.
2. An owner submits an allowlisted patch against an exact property revision.
3. A different reviewer approves the immutable submission with a reason.
4. A publisher asks the adapter to build a whole-catalog candidate. The candidate
   is schema validated, hashed and deep-frozen before the service worker sees it.
5. The worker reloads its own service principal, rejects browser/user credentials,
   checks revocation and publisher role, and advances the pointer with compare-and-
   swap semantics.
6. The adapter marks the property revision published only after the worker succeeds.
7. Consumers receive only a revalidated snapshot selected from the current pointer
   or immutable last-known-good history.

All adapter mutations are serialized in-process. A failed worker call leaves an
immutable candidate that can only be retried with identical content or revoked.
Candidate revocation prevents later publication. Rollback is independently role-
checked, reasoned, CAS-protected and limited to previously validated selections.

## Current catalog guarantees

Contract tests preserve all nine `house_001` through `house_009` values in both
`id` and `sourceKey` (the booking/inventory join keys), exactly seven top-level
houses, the `house_005`/`house_006` relationship to `house_004`, and all existing
public photo arrays. The public runtime and `guest-inventory.js` remain unchanged.

## Owner Cabinet integration patch (do not apply here)

In the Owner Cabinet repository:

1. Remove any authenticated direct `UPDATE` grant/policy on `properties`; do not
   allow client writes to `published`, identity, ownership, revision or public data.
2. Apply the equivalent of
   `publication/sql/20261016_owner_publication_integration_v1.candidate.sql` only
   after its prerequisite base migration, ideally folding the removal into the
   original Owner Cabinet migration so no bypass is briefly live.
3. Change “Save draft” to owner-private draft storage. Change “Submit for review”
   to the narrow submission RPC with `property_id`, `base_revision`, allowlisted
   patch and an idempotency/submission ID. Never send roles/company IDs as authority.
4. Add a server endpoint that validates the user session and maps its subject to a
   server-loaded actor. The browser must never receive a service credential or call
   publish/rollback functions.
5. Reviewer UI calls the review RPC; publisher UI queues a command for a separately
   authenticated worker. Re-read approval status/revision in the same transaction
   that claims the command.

Required Owner Cabinet contract tests:

- forged company membership, role, property ID and non-allowlisted field fail;
- reviewer cannot approve their own submission;
- rejected/revoked/stale approvals never enqueue a publication command;
- two commands with the same base revision have at most one winner;
- revocation concurrent with command claim has one transactionally defined winner;
- no `anon`/`authenticated` direct property update or privileged function execute.

## Eco-museum/public consumer patch (do not apply here)

In each consumer repository, add a loader behind the current static-catalog adapter:

1. Fetch `current.json`, then the addressed snapshot and manifest from the same
   immutable publication origin.
2. Verify pointer/manifest versions, snapshot ID, SHA-256 hashes and the complete
   `guest-house-public-snapshot/v1` schema before replacing the in-memory catalog.
3. Map `sourceKey`/`id` without rewriting either value; preserve `parentId`, photos,
   contacts and nullable fields exactly.
4. Cache the last validated snapshot. On fetch, hash, schema or compatibility error,
   retain last-known-good/static catalog and surface telemetry; never partially mix
   versions.

Required consumer contract tests:

- the current nine IDs and seven-parent boundary match the static fixture;
- booking requests continue sending the exact selected `house.id` as `house_id`;
- every photo URL is safe and resolvable under the public asset policy;
- corrupt pointer, manifest, hash, schema and unknown fields all select fallback;
- pointer changes during fetch trigger a retry/fallback, never a mixed catalog;
- rollback to an older valid snapshot is accepted despite lower snapshot content age.

## Security audit and known limitations

No critical bug remains in the exercised offline path. During this work two failure
modes were closed: a failed publish candidate was previously non-retryable, and an
adapter could have performed a worker rollback before checking the requesting human
publisher/reason. Both are now tested fail-closed.

The following limitations block production use:

- Serialization and actor state are process-local; multiple processes require a DB
  transaction, row/advisory lock and durable command state.
- Human/session and worker-principal resolution are callbacks, not cryptographic
  authentication. Revocation cannot be atomic with an external identity store here.
- The filesystem pointer update and history rename are not one transactional write;
  recovery is last-known-good, but crash-injection/durability guarantees are absent.
- Artifact hashes provide integrity, not authenticity; production artifacts need a
  signed envelope/key rotation policy or an equally trusted private channel.
- Photo moderation, derivative generation, malware scanning and provenance are not
  implemented. Only safe public URL syntax and current local asset existence are tested.
- The legacy JavaScript parser uses `vm` on repository-controlled source and is not
  suitable for untrusted uploads.
- Real Owner Cabinet JWT/RLS, disposable Supabase concurrency, eco-museum runtime,
  CDN cache behavior and browser SHA-256 support remain unverified.
- Bootstrap is an explicit offline publisher-only operation. Production bootstrap
  needs an audited migration/ceremony and must not be exposed as a routine endpoint.

These limitations are why the implementation remains offline and branch-only.
