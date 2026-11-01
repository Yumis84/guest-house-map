import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildPublicSnapshot } from '../publication/build-public-snapshot.mjs';
import {
  createOfflinePublicationWorker,
  createPublicationArtifact,
  PUBLICATION_WORKER_AUDIENCE,
  verifyPublicationArtifact
} from '../publication/offline-publication-worker.mjs';
import { resolvePublishedSnapshot } from '../publication/snapshot-store.mjs';

const catalog = await readFile(new URL('../guest-houses.js', import.meta.url), 'utf8');
const photos = await readFile(new URL('../guest-photos-v4.js', import.meta.url), 'utf8');
const at = day => `2026-10-${String(day).padStart(2, '0')}T00:00:00Z`;
const build = (id, day, previousSnapshotId = null) => buildPublicSnapshot({
  legacyCatalogSource: catalog, photoMapSource: photos, snapshotId: id,
  publishedAt: at(day), previousSnapshotId
});
const context = {
  surface: 'worker', credentialKind: 'service_identity',
  audience: PUBLICATION_WORKER_AUDIENCE, principalId: 'worker-1'
};

async function fixture() {
  const outputRoot = await mkdtemp(join(tmpdir(), 'guest-house-worker-v1-'));
  const principals = new Map([['worker-1', { id: 'worker-1', active: true, revoked: false, roles: ['publisher'] }]]);
  const worker = createOfflinePublicationWorker({ outputRoot, resolvePrincipal: async id => principals.get(id) });
  return { outputRoot, principals, worker };
}

test('verified artifact publishes once and identical retry is idempotent', async () => {
  const { outputRoot, worker } = await fixture();
  const artifact = createPublicationArtifact(build('catalog-v1', 16));
  const first = await worker.publish({ context, artifact, expectedPointerVersion: 0 });
  const retry = await worker.publish({ context, artifact, expectedPointerVersion: 1 });
  assert.equal(first.idempotent, false);
  assert.equal(retry.idempotent, true);
  assert.equal(retry.pointer.snapshotSha256, artifact.snapshotSha256);
  assert.equal(retry.pointer.manifestSha256, artifact.manifestSha256);
  assert.deepEqual(await readdir(join(outputRoot, 'pointers')), ['000000000001.json']);
});

test('created artifact graph is immutable to callers', () => {
  const artifact = createPublicationArtifact(build('catalog-v1', 16));
  assert.equal(Object.isFrozen(artifact.snapshot.houses[0]), true);
  assert.throws(() => { artifact.snapshot.houses[0].description = 'mutated'; }, TypeError);
  assert.throws(() => { artifact.manifest.houseCount = 0; }, TypeError);
});

test('snapshot, manifest and declared hash tampering fail before any store write', async () => {
  for (const mutate of [
    artifact => { artifact.snapshot.houses[0].description = 'tampered'; },
    artifact => { artifact.manifest.houseCount = 8; },
    artifact => { artifact.snapshotSha256 = '0'.repeat(64); },
    artifact => { artifact.manifestSha256 = 'f'.repeat(64); }
  ]) {
    const { outputRoot, worker } = await fixture();
    const artifact = structuredClone(createPublicationArtifact(build('catalog-v1', 16)));
    mutate(artifact);
    await assert.rejects(worker.publish({ context, artifact, expectedPointerVersion: 0 }), /manifest|hash mismatch/i);
    assert.deepEqual(await readdir(outputRoot), []);
  }
});

test('artifact verifier rejects invalid whole-snapshot contract even with recomputed-looking metadata', () => {
  const artifact = structuredClone(createPublicationArtifact(build('catalog-v1', 16)));
  artifact.snapshot.houses[0].lat = 999;
  assert.throws(() => verifyPublicationArtifact(artifact), /Invalid public snapshot/);
});

test('browser, user JWT, wrong audience, unknown identity and missing role cannot publish', async () => {
  for (const badContext of [
    { ...context, surface: 'browser' },
    { ...context, credentialKind: 'user_jwt' },
    { ...context, audience: 'public-browser' },
    { ...context, principalId: 'missing' }
  ]) {
    const { outputRoot, worker } = await fixture();
    await assert.rejects(worker.publish({ context: badContext, artifact: createPublicationArtifact(build('catalog-v1', 16)), expectedPointerVersion: 0 }), /forbidden|audience|unknown/i);
    assert.deepEqual(await readdir(outputRoot), []);
  }
  const { outputRoot, principals, worker } = await fixture();
  principals.set('worker-1', { id: 'worker-1', active: true, revoked: false, roles: ['reviewer'] });
  await assert.rejects(worker.publish({ context, artifact: createPublicationArtifact(build('catalog-v1', 16)), expectedPointerVersion: 0 }), /publisher role/);
  assert.deepEqual(await readdir(outputRoot), []);
});

test('role revocation is checked on every publish and rollback command', async () => {
  const { principals, worker } = await fixture();
  await worker.publish({ context, artifact: createPublicationArtifact(build('catalog-v1', 16)), expectedPointerVersion: 0 });
  principals.set('worker-1', { id: 'worker-1', active: true, revoked: true, roles: ['publisher'] });
  await assert.rejects(worker.publish({ context, artifact: createPublicationArtifact(build('catalog-v2', 17, 'catalog-v1')), expectedPointerVersion: 1 }), /revoked/);
  await assert.rejects(worker.rollback({ context, snapshotId: 'catalog-v1', expectedPointerVersion: 1, selectedAt: at(18) }), /revoked/);
});

test('concurrent CAS commands serialize and only one expected version can win', async () => {
  const { outputRoot, worker } = await fixture();
  const attempts = await Promise.allSettled([
    worker.publish({ context, artifact: createPublicationArtifact(build('catalog-a', 16)), expectedPointerVersion: 0 }),
    worker.publish({ context, artifact: createPublicationArtifact(build('catalog-b', 16)), expectedPointerVersion: 0 })
  ]);
  assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 1);
  assert.match(attempts.find(item => item.status === 'rejected').reason.message, /Stale pointer version/);
  const selected = await resolvePublishedSnapshot({ outputRoot });
  assert.equal(selected.pointer.pointerVersion, 1);
  assert.equal((await readdir(join(outputRoot, 'pointers'))).length, 1);
});

test('rollback is publisher-only, CAS-protected, validated and idempotent at current target', async () => {
  const { outputRoot, worker } = await fixture();
  await worker.publish({ context, artifact: createPublicationArtifact(build('catalog-v1', 16)), expectedPointerVersion: 0 });
  await worker.publish({ context, artifact: createPublicationArtifact(build('catalog-v2', 17, 'catalog-v1')), expectedPointerVersion: 1 });
  await assert.rejects(worker.rollback({ context: { ...context, surface: 'browser' }, snapshotId: 'catalog-v1', expectedPointerVersion: 2, selectedAt: at(18) }), /forbidden/);
  await assert.rejects(worker.rollback({ context, snapshotId: 'never-published', expectedPointerVersion: 2, selectedAt: at(18) }), /not previously published/);
  const rolledBack = await worker.rollback({ context, snapshotId: 'catalog-v1', expectedPointerVersion: 2, selectedAt: at(18) });
  assert.equal(rolledBack.pointer.pointerVersion, 3);
  assert.equal(rolledBack.pointer.operation, 'rollback');
  const retry = await worker.rollback({ context, snapshotId: 'catalog-v1', expectedPointerVersion: 3, selectedAt: at(19) });
  assert.equal(retry.idempotent, true);
  assert.equal(retry.pointer.pointerVersion, 3);
  assert.equal((await readdir(join(outputRoot, 'pointers'))).length, 3);
});
