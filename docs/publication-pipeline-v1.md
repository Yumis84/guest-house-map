# Publication Pipeline V1 — design specification (draft)

Status: DESIGN ONLY. No production rollout, migration, public catalog modification, or booking/n8n changes are authorized.

## Goal
Let authorized guest-house owners submit edits in Owner Cabinet V1, while retaining the current static public catalog as the stable source until an explicit review/publish action. Preserve existing house IDs and coordinates, and provide a single reviewed public feed usable by Krasnolesye and Vishtynets Eco Museum maps.

## Current boundaries
- Owner Cabinet candidate lives in Draft PR #7; real Auth/JWT/Storage acceptance is still blocked pending isolated Supabase.
- Existing public `guest-houses.js` contains top-level `house_001` etc., plus coordinates, descriptions, prices, amenities and contact fields. Do not replace this file or break current consumers in V1.
- Existing booking and inventory logic, n8n integrations, public photo galleries, and main branch remain unchanged.

## Proposed flow
1. Authenticated owner edits only properties belonging to their verified company; edits are saved to an owner-side draft. Draft writes do NOT publish.
2. Explicit 'Submit for review' creates an immutable, versioned submission with a field-level diff and author/time metadata. Only approved fields may be submitted.
3. Reviewer with separately provisioned authority approves or rejects with a reason. Review must never be granted by user-editable metadata.
4. Publish job validates the approval and version, maps stable `source_key` to the existing house ID, and builds a validated, immutable public snapshot. Unknown IDs, duplicate IDs, invalid coordinates, unsafe URLs, unapproved photos and schema mismatches fail closed.
5. Two public maps consume the same versioned published feed with last-known-good fallback. No private Storage URLs or privileged Supabase keys in client bundles.
6. Rollback switches the published snapshot pointer to a prior approved version; keep audit trail. Publish and rollback are idempotent.

## Initial editable fields
Candidate for owner review: description, contact phone/email, website and photo submissions. Price, capacity, amenities, address, name, and coordinates require separate field-level policy decision. Do not let owner edits alter `id`, `source_key`, `company_id`, `published`, ownership or booking availability.

## Photos
Keep Owner Cabinet's private bucket private. A separately reviewed publication process may create sanitized public derivatives with new stable URLs. Signed private URLs must never be copied into public catalog. Record provenance and content moderation/review outcome.

## Acceptance gates
- Unauthorized owners/viewers cannot submit, review, publish, or rollback.
- Reviewers cannot approve their own submissions without explicit policy approval; prefer separation of duties.
- Concurrent edits, double publish, revoke-after-submit, rejected revisions and stale snapshots fail safely.
- Snapshot schema validates all seven main houses; existing map markers, filters, cards, contact links and booking paths retain compatibility.
- A failed publish cannot leave one map with half-applied data; version/fallback behavior tested.
- Offline/static fallback remains available; public site does not depend on live private Auth or Storage.
- No production DB writes, migration application, merge or deployment without separate owner approval.

## Next implementation task
Audit actual public consumers in this repo and the eco-museum repo, produce a concrete field mapping, propose minimal snapshot schema, tests and migration candidate in this branch. Keep PR separate from Owner Cabinet PR #7; do not deploy.

## Isolated validation prototype

Issue #10's read-only consumer audit, proposed V1 JSON contract, fail-closed/rollback notes and test command are documented in [`public-snapshot-v1.md`](public-snapshot-v1.md). The prototype is not referenced by either public runtime.

## Phase C: review workflow prototype

`publication/review-workflow.mjs` is an offline reference state machine. It enforces current company ownership, an allowlist of owner-editable fields, optimistic property revisions, independent reviewer decisions with reasons, publisher-only candidate creation, revoke-before-publication, stale-submission rejection and a hash-chained audit trail. Candidate construction applies an approved patch to a copy of the last validated snapshot and validates the whole result before it can be handed to the immutable snapshot store.

`publication/sql/20261016_publication_pipeline_v1.candidate.sql` is a design candidate only. It defines the proposed tables, least-privilege grants and initial RLS boundaries, but deliberately leaves privileged transition functions blocked until disposable Supabase acceptance. It has not been applied anywhere.
