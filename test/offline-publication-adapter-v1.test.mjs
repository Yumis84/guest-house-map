import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildPublicSnapshot, readLegacyCatalog } from '../publication/build-public-snapshot.mjs';
import {
  createOfflinePublicationAdapter,
  PUBLICATION_SERVER_AUDIENCE
} from '../publication/offline-publication-adapter.mjs';

const catalogSource = await readFile(new URL('../guest-houses.js', import.meta.url), 'utf8');
const photoSource = await readFile(new URL('../guest-photos-v4.js', import.meta.url), 'utf8');
const legacy = readLegacyCatalog(catalogSource);
const baseline = buildPublicSnapshot({
  legacyCatalogSource: catalogSource,
  photoMapSource: photoSource,
  snapshotId: 'catalog-v1',
  publishedAt: '2026-10-16T00:00:00Z'
});
const at = day => `2026-10-${String(day).padStart(2, '0')}T00:00:00Z`;
const context = principalId => ({
  surface: 'server', credentialKind: 'verified_session',
  audience: PUBLICATION_SERVER_AUDIENCE, principalId
});

async function fixture() {
  const outputRoot = await mkdtemp(join(tmpdir(), 'guest-house-e2e-v1-'));
  const actors = new Map([
    ['owner-1', { id: 'owner-1', active: true, revoked: false, roles: ['owner'], companyIds: ['company-1'] }],
    ['reviewer-1', { id: 'reviewer-1', active: true, revoked: false, roles: ['reviewer'], companyIds: [] }],
    ['publisher-1', { id: 'publisher-1', active: true, revoked: false, roles: ['publisher'], companyIds: [] }]
  ]);
  const workers = new Map([
    ['worker-1', { id: 'worker-1', active: true, revoked: false, roles: ['publisher'] }]
  ]);
  const adapter = createOfflinePublicationAdapter({
    properties: [{ id: 'property-1', companyId: 'company-1', sourceKey: 'house_001', revision: 4 }],
    outputRoot,
    resolveActor: async id => actors.get(id),
    resolveWorkerPrincipal: async id => workers.get(id),
    workerPrincipalId: 'worker-1'
  });
  await adapter.bootstrapBaseline({ context: context('publisher-1'), snapshot: baseline });
  return { adapter, actors, workers, outputRoot };
}

async function approve(adapter, submissionId = 'submission-1', description = 'Owner reviewed text') {
  await adapter.submit({
    context: context('owner-1'), submissionId, propertyId: 'property-1', baseRevision: 4,
    patch: { description }, submittedAt: at(16)
  });
  await adapter.review({
    context: context('reviewer-1'), submissionId, decision: 'approved', reason: 'Evidence checked', reviewedAt: at(17)
  });
}

test('owner submission to independent review to worker to public contract is end-to-end', async () => {
  const { adapter } = await fixture();
  await approve(adapter);
  const published = await adapter.publish({
    context: context('publisher-1'), submissionId: 'submission-1', baselineSnapshot: baseline,
    snapshotId: 'catalog-v2', publishedAt: at(18), expectedPointerVersion: 1
  });
  const publicContract = await adapter.readPublicContract();
  assert.equal(published.artifact.snapshotSha256, published.pointer.snapshotSha256);
  assert.equal(publicContract.houses.find(house => house.id === 'house_001').description, 'Owner reviewed text');
  assert.equal(Object.isFrozen(published.artifact.snapshot), true);
  assert.equal(adapter.state().auditValid, true);
  assert.equal(adapter.state().properties[0].revision, 5);
});

test('public contract preserves nine booking IDs, seven parent houses and every photo', async () => {
  const { adapter } = await fixture();
  await approve(adapter);
  await adapter.publish({
    context: context('publisher-1'), submissionId: 'submission-1', baselineSnapshot: baseline,
    snapshotId: 'catalog-v2', publishedAt: at(18), expectedPointerVersion: 1
  });
  const actual = await adapter.readPublicContract();
  assert.deepEqual(actual.houses.map(h => h.id), legacy.map(h => h.id));
  assert.deepEqual(actual.houses.map(h => h.sourceKey), legacy.map(h => h.id));
  assert.equal(actual.houses.length, 9);
  assert.equal(actual.houses.filter(h => h.parentId === null).length, 7);
  assert.deepEqual(actual.houses.map(h => h.photos), baseline.houses.map(h => h.photos));
});

test('browser assertions and unauthorized principals cannot publish or rollback', async () => {
  const { adapter } = await fixture();
  await approve(adapter);
  for (const badContext of [
    { ...context('publisher-1'), surface: 'browser' },
    context('reviewer-1'),
    context('missing')
  ]) {
    await assert.rejects(adapter.publish({
      context: badContext, submissionId: 'submission-1', baselineSnapshot: baseline,
      snapshotId: 'catalog-v2', publishedAt: at(18), expectedPointerVersion: 1
    }), /server session|candidate|unknown|publish/i);
  }
  assert.equal((await adapter.readPublicContract()).snapshotId, 'catalog-v1');
  await assert.rejects(adapter.rollback({
    context: context('reviewer-1'), snapshotId: 'catalog-v1', expectedPointerVersion: 0,
    selectedAt: at(19), reason: 'Unauthorized'
  }), /cannot rollback/);
});

test('stale approval fails closed after another approved revision is published', async () => {
  const { adapter } = await fixture();
  await approve(adapter, 'submission-1', 'First');
  await approve(adapter, 'submission-2', 'Second');
  await adapter.publish({
    context: context('publisher-1'), submissionId: 'submission-1', baselineSnapshot: baseline,
    snapshotId: 'catalog-v2', publishedAt: at(18), expectedPointerVersion: 1
  });
  await assert.rejects(adapter.publish({
    context: context('publisher-1'), submissionId: 'submission-2', baselineSnapshot: await adapter.readPublicContract(),
    snapshotId: 'catalog-v3', publishedAt: at(19), expectedPointerVersion: 2
  }), /stale/);
  assert.equal((await adapter.readPublicContract()).snapshotId, 'catalog-v2');
});

test('failed candidate may be revoked and can never publish', async () => {
  const { adapter } = await fixture();
  await approve(adapter);
  await assert.rejects(adapter.publish({
    context: context('publisher-1'), submissionId: 'submission-1', baselineSnapshot: baseline,
    snapshotId: 'catalog-v2', publishedAt: at(18), expectedPointerVersion: 0
  }), /Stale pointer version/);
  await adapter.revoke({
    context: context('owner-1'), submissionId: 'submission-1', reason: 'Withdrawn', revokedAt: at(19)
  });
  await assert.rejects(adapter.publish({
    context: context('publisher-1'), submissionId: 'submission-1', baselineSnapshot: baseline,
    snapshotId: 'catalog-v2', publishedAt: at(18), expectedPointerVersion: 1
  }), /not approved/);
});

test('rollback is authorized, optimistic and returns the prior compatible catalog', async () => {
  const { adapter } = await fixture();
  await approve(adapter);
  await adapter.publish({
    context: context('publisher-1'), submissionId: 'submission-1', baselineSnapshot: baseline,
    snapshotId: 'catalog-v2', publishedAt: at(18), expectedPointerVersion: 1
  });
  const catalogV2 = await adapter.readPublicContract();
  await adapter.submit({
    context: context('owner-1'), submissionId: 'submission-2', propertyId: 'property-1', baseRevision: 5,
    patch: { description: 'Second publication' }, submittedAt: at(19)
  });
  await adapter.review({
    context: context('reviewer-1'), submissionId: 'submission-2', decision: 'approved',
    reason: 'Evidence checked', reviewedAt: at(20)
  });
  await adapter.publish({
    context: context('publisher-1'), submissionId: 'submission-2', baselineSnapshot: catalogV2,
    snapshotId: 'catalog-v3', publishedAt: at(21), expectedPointerVersion: 2
  });
  await assert.rejects(adapter.rollback({
    context: context('publisher-1'), snapshotId: 'catalog-v2', expectedPointerVersion: 2,
    selectedAt: at(22), reason: 'stale command'
  }), /Stale pointer version/);
  const rolledBack = await adapter.rollback({
    context: context('publisher-1'), snapshotId: 'catalog-v2', expectedPointerVersion: 3,
    selectedAt: at(22), reason: 'regression'
  });
  assert.equal(rolledBack.pointer.operation, 'rollback');
  assert.equal((await adapter.readPublicContract()).houses.length, 9);
  assert.equal(adapter.state().auditTrail.at(-1).type, 'publication.rolled_back');
});
