# Publication worker V1 trust-boundary architecture

Status: offline contract only. This design does not create a hosted worker, expose a publication endpoint, apply SQL, or alter either public consumer.

## Boundary and data flow

```text
owner browser --user JWT--> submit RPC --immutable submission--> database
reviewer browser --user JWT--> review RPC --decision/audit--------^

                                      (no browser publication edge)
service identity --> publication worker --> validate snapshot + manifest + hashes
                                           --> immutable artifact store
                                           --> CAS current pointer
public browser ----anonymous read only----> selected validated snapshot / LKG fallback
```

The owner and reviewer sides are untrusted input. A browser JWT, including one belonging to a publisher user, is not a publication credential. Only a non-browser service identity with audience `guest-house-publication-worker/v1` may enter the worker boundary. Its current server-side principal record must be active, not revoked, and contain `publisher` or `admin`; claims supplied by the caller are never used as authority.

`publication/offline-publication-worker.mjs` is an isolated reference adapter for that boundary. It has no HTTP listener, environment-secret handling, Supabase client, network calls, or production output path. The injected `resolvePrincipal` represents the required authoritative role/revocation lookup.

## Publish contract

1. Re-resolve service identity and role for every command.
2. Validate the complete snapshot schema and cross-record rules.
3. Deterministically serialize the snapshot and derive SHA-256.
4. Reconstruct the manifest from trusted snapshot fields and require byte-equivalent manifest content.
5. Verify both declared snapshot and manifest hashes.
6. Serialize pointer-changing commands in the worker and invoke the store with the caller's expected pointer version.
7. Create snapshot and manifest exclusively; an existing ID is accepted only for an identical artifact already selected.
8. Move `current.json` only after validation, then expose monotonically versioned pointer history.
9. Verify persisted hashes against the accepted artifact before returning success.

The expected pointer version is the compare-and-swap token. Two queued commands with the same version cannot both succeed: the first advances the pointer and the second fails stale. This adapter's serialization is process-local; a hosted design needs a database row lock/advisory lock or a storage system with native conditional writes shared by every worker instance.

## Rollback and recovery

Rollback is another privileged, role/revocation-checked CAS operation. Its target must occur in valid pointer history and its snapshot and manifest must still verify. It creates a new pointer version; it never edits or copies an older artifact. Re-selecting the current valid target is idempotent and does not create history. Reads reject corrupt current data and search newest-to-oldest validated pointer history for last-known-good.

## Explicitly excluded paths

- No `anon` or `authenticated` table grant/policy may update `properties` or the publication pointer.
- No browser/user JWT may call worker publish or rollback, even if user metadata says `publisher`.
- No service key or worker credential may be shipped in browser code.
- No artifact is trusted merely because a reviewer approved it; final whole-snapshot and hash verification is mandatory.
- No mutable overwrite of snapshots, manifests, or history is part of the contract.
- SQL candidates remain unexecuted and are not evidence of PostgreSQL correctness.

## Offline evidence

`test/publication-worker-contract-v1.test.mjs` covers positive publication and rollback plus tampered snapshot/manifest/hash, invalid schema, browser and user-JWT attempts, wrong audience, unknown identity, missing publisher role, post-publication revocation, concurrent stale CAS, unpublished rollback target, and idempotent retries.
