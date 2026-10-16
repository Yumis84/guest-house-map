# Public snapshot V1: consumer audit and validation prototype

Status: isolated offline prototype for Issue 10 and Publication Pipeline V1 phase B. Nothing in this directory is loaded by the public site. No database, n8n, booking, migration or deployment action is implemented here.

## Audited consumers

### `guest-house-map`

The runtime catalog is `window.GUEST_HOUSES` from `guest-houses.js`. `index.html` excludes inactive entries and child entries from the seven-item main catalog, but `openHouse` can open the two child room records. The observed field contract is:

| Field | Actual consumer |
| --- | --- |
| `id` | DOM identity, favorites, marker lookup, room links and booking `house_id` |
| `name` | cards, details, search, booking display and n8n payload |
| `address` | cards, search, route link and geocoding fallback |
| `lat`, `lng` | Leaflet markers, map movement and bounds |
| `capacity`, `price` | cards/details, filters and booking price |
| `amenities` | search, chips, amenity filters and details |
| `description` | search and details |
| `active`, `parentId` | visibility and the seven-main-house boundary |
| `phone`, `email`, `site` | catalog/contact data retained for compatibility |
| `photos` | added at runtime by `guest-photos-v4.js`; thumbnails and gallery |

The stable main IDs are `house_001`, `house_002`, `house_003`, `house_004`, `house_007`, `house_008`, and `house_009`. `house_005` and `house_006` are children of `house_004`; they remain in the snapshot because current room and booking paths address them by ID. `guest-inventory.js` remains a separate, unchanged contract.

Photo paths and provenance currently live in `guest-photos-v4.js`. The compatibility test verifies that every mapped local photo exists. Publication must only use reviewed public derivatives; private or signed Storage URLs are outside this schema.

### `vishtynets-eco-museum` (read-only audit of `main`, 2026-10-16)

`app.js` fetches the raw `guest-houses.js` file from `Yumis84/guest-house-map/main`, extracts the array with a regular expression and executes it with `Function`. It filters `active !== false`, creates markers from finite `lat`/`lng`, searches `name`/`address`/`description`, renders name and address/description, and links details back to the guest-house catalog. `map-v3.js` supplies the guest-house layer UI but does not introduce more data fields.

This is the compatibility target only; this branch does not modify that repository. A later, separately approved consumer change should fetch JSON, validate it, then atomically replace its last-known-good in-memory snapshot. Its existing static/raw catalog path remains the fallback until that rollout is approved.

## Snapshot and fail-closed rules

`publication/public-snapshot-v1.schema.json` defines the portable JSON contract. The matching dependency-free validator in `publication/validate-public-snapshot.mjs` additionally enforces cross-record rules JSON Schema cannot express conveniently:

- exactly seven main houses, while retaining child records;
- unique `id` and `sourceKey`, with `sourceKey === id` in V1;
- existing parents only;
- finite bounded coordinates and non-negative nullable capacity/price;
- active published records only;
- HTTPS remote URLs or traversal-free `assets/` paths only;
- no credentials in URLs, no unknown fields and no duplicate photos/amenities.

Any validation error rejects the complete candidate. Consumers must keep serving their prior validated snapshot, or their current static catalog if no validated snapshot has ever been accepted. A pointer must only move after the complete immutable file has validated; rollback means atomically selecting `previousSnapshotId` (or another previously validated ID), never partially copying houses between versions.

The two current `http://` website values are deliberately mapped to `null` in the fixture builder rather than admitted as safe publication URLs. No source data is changed.

## Offline publication store (phase B)

`publication/build-public-snapshot.mjs` deterministically maps the current legacy catalog and photo mapping into the validated V1 contract. Callers must supply the snapshot ID and UTC publication time; the builder does not read a clock or network service.

`publication/snapshot-store.mjs` writes only below the operating-system temp directory or `test/fixtures`. Snapshot and manifest files are created exclusively and never overwritten. Each publish or rollback stages a pointer-history record, atomically selects it through `current.json`, and then makes the immutable, monotonically versioned history record visible. Selection verifies the snapshot and manifest hashes and the complete snapshot contract. A corrupt current pointer or corrupt selected artifact falls back through pointer history to the newest fully valid selection.

This is a filesystem mechanism only. It has no production path, authorization service, reviewer workflow, signature verification, public consumer integration or live publication command.

## Run the isolated checks

Requires Node.js 20 or newer and no installed packages:

```text
node --test --test-isolation=none test/public-snapshot-v1.test.mjs
```

`--test-isolation=none` also makes the command work in restricted environments that prohibit child processes. The tests build a candidate snapshot in memory from the current static catalog and photo map. They do not write a snapshot, call a network service, or alter runtime files.

Phase B checks, which write only to per-test operating-system temp directories, run with:

```text
node --test --test-isolation=none test/public-snapshot-v1.test.mjs test/publication-pipeline-v1.test.mjs
```
