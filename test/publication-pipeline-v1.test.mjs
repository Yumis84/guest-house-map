import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  buildPublicSnapshot,
  readLegacyCatalog,
  serializeDeterministically
} from '../publication/build-public-snapshot.mjs';
import {
  assertIsolatedOutputRoot,
  publishSnapshot,
  resolvePublishedSnapshot,
  rollbackSnapshot
} from '../publication/snapshot-store.mjs';

const legacyCatalogSource = await readFile(new URL('../guest-houses.js', import.meta.url), 'utf8');
const photoMapSource = await readFile(new URL('../guest-photos-v4.js', import.meta.url), 'utf8');

function build(snapshotId, publishedAt, previousSnapshotId = null) {
  return buildPublicSnapshot({ legacyCatalogSource, photoMapSource, snapshotId, publishedAt, previousSnapshotId });
}

async function store() {
  return mkdtemp(join(tmpdir(), 'guest-house-publication-v1-'));
}

test('build is deterministic for identical inputs and metadata', () => {
  const first = build('catalog-v1', '2026-10-16T00:00:00Z');
  const second = build('catalog-v1', '2026-10-16T00:00:00Z');
  assert.equal(serializeDeterministically(first), serializeDeterministically(second));
});

test('build preserves stable IDs and parent relationships', () => {
  const legacy = readLegacyCatalog(legacyCatalogSource);
  const snapshot = build('catalog-v1', '2026-10-16T00:00:00Z');
  assert.deepEqual(snapshot.houses.map(house => house.id), legacy.map(house => house.id));
  assert.deepEqual(
    snapshot.houses.map(house => [house.id, house.parentId]),
    legacy.map(house => [house.id, house.parentId ?? null])
  );
});

test('malformed snapshot is rejected without writing output', async () => {
  const root = await store();
  const malformed = structuredClone(build('catalog-v1', '2026-10-16T00:00:00Z'));
  malformed.houses[0].lat = 1000;
  await assert.rejects(publishSnapshot({ outputRoot: root, snapshot: malformed, expectedPointerVersion: 0 }), /Invalid public snapshot/);
  assert.deepEqual(await readdir(root), []);
});

test('double publish is idempotent and does not create another pointer', async () => {
  const root = await store();
  const snapshot = build('catalog-v1', '2026-10-16T00:00:00Z');
  const first = await publishSnapshot({ outputRoot: root, snapshot, expectedPointerVersion: 0 });
  const second = await publishSnapshot({ outputRoot: root, snapshot, expectedPointerVersion: 1 });
  assert.equal(first.idempotent, false);
  assert.equal(second.idempotent, true);
  assert.equal(second.pointer.pointerVersion, 1);
  assert.deepEqual(await readdir(join(root, 'pointers')), ['000000000001.json']);
});

test('stale pointer version fails closed', async () => {
  const root = await store();
  await publishSnapshot({ outputRoot: root, snapshot: build('catalog-v1', '2026-10-16T00:00:00Z'), expectedPointerVersion: 0 });
  await assert.rejects(
    publishSnapshot({ outputRoot: root, snapshot: build('catalog-v2', '2026-10-17T00:00:00Z', 'catalog-v1'), expectedPointerVersion: 0 }),
    /Stale pointer version/
  );
  assert.deepEqual(await readdir(join(root, 'snapshots')), ['catalog-v1.json']);
});

test('corrupted current pointer falls back to immutable pointer history', async () => {
  const root = await store();
  await publishSnapshot({ outputRoot: root, snapshot: build('catalog-v1', '2026-10-16T00:00:00Z'), expectedPointerVersion: 0 });
  await writeFile(join(root, 'current.json'), '{broken', 'utf8');
  const selected = await resolvePublishedSnapshot({ outputRoot: root });
  assert.equal(selected.snapshot.snapshotId, 'catalog-v1');
  assert.equal(selected.fallback, true);
});

test('rollback selects a prior immutable snapshot with a new pointer version', async () => {
  const root = await store();
  await publishSnapshot({ outputRoot: root, snapshot: build('catalog-v1', '2026-10-16T00:00:00Z'), expectedPointerVersion: 0 });
  await publishSnapshot({ outputRoot: root, snapshot: build('catalog-v2', '2026-10-17T00:00:00Z', 'catalog-v1'), expectedPointerVersion: 1 });
  const rolledBack = await rollbackSnapshot({ outputRoot: root, snapshotId: 'catalog-v1', expectedPointerVersion: 2, selectedAt: '2026-10-18T00:00:00Z' });
  assert.equal(rolledBack.snapshot.snapshotId, 'catalog-v1');
  assert.equal(rolledBack.pointer.pointerVersion, 3);
  assert.equal(rolledBack.pointer.operation, 'rollback');
  assert.equal(rolledBack.pointer.previousSnapshotId, 'catalog-v2');
});

test('selection skips a corrupted newest snapshot and returns last known good', async () => {
  const root = await store();
  await publishSnapshot({ outputRoot: root, snapshot: build('catalog-v1', '2026-10-16T00:00:00Z'), expectedPointerVersion: 0 });
  await publishSnapshot({ outputRoot: root, snapshot: build('catalog-v2', '2026-10-17T00:00:00Z', 'catalog-v1'), expectedPointerVersion: 1 });
  await writeFile(join(root, 'snapshots', 'catalog-v2.json'), '{corrupt', 'utf8');
  const selected = await resolvePublishedSnapshot({ outputRoot: root });
  assert.equal(selected.snapshot.snapshotId, 'catalog-v1');
  assert.equal(selected.pointer.pointerVersion, 1);
  assert.equal(selected.fallback, true);
});

test('writer refuses paths outside temp and isolated fixtures', () => {
  assert.throws(() => assertIsolatedOutputRoot(process.cwd()), /Refusing output/);
});
