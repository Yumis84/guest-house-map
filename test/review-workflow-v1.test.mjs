import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildPublicSnapshot } from '../publication/build-public-snapshot.mjs';
import { PublicationReviewWorkflow } from '../publication/review-workflow.mjs';

const catalog = await readFile(new URL('../guest-houses.js', import.meta.url), 'utf8');
const photos = await readFile(new URL('../guest-photos-v4.js', import.meta.url), 'utf8');
const baseline = buildPublicSnapshot({ legacyCatalogSource: catalog, photoMapSource: photos, snapshotId: 'catalog-v1', publishedAt: '2026-10-16T00:00:00Z' });
const owner = { id: 'owner-1', roles: ['owner'], companyIds: ['company-1'] };
const otherOwner = { id: 'owner-2', roles: ['owner'], companyIds: ['company-2'] };
const reviewer = { id: 'reviewer-1', roles: ['reviewer'], companyIds: [] };
const publisher = { id: 'publisher-1', roles: ['publisher'], companyIds: [] };
const property = { id: 'property-1', companyId: 'company-1', sourceKey: 'house_001', revision: 4 };
const at = n => `2026-10-${String(16 + n).padStart(2, '0')}T00:00:00Z`;
const make = () => new PublicationReviewWorkflow([property]);

function approved(workflow = make()) {
  workflow.submit({ submissionId: 'submission-1', propertyId: property.id, baseRevision: 4, patch: { description: 'Reviewed description' }, submittedAt: at(0), submittedBy: owner });
  workflow.review({ submissionId: 'submission-1', decision: 'approved', reason: 'Verified', reviewedAt: at(1), reviewedBy: reviewer });
  return workflow;
}

test('independent approval creates a validated immutable publication candidate and audit chain', () => {
  const workflow = approved();
  const candidate = workflow.createPublicationCandidate({ submissionId: 'submission-1', baselineSnapshot: baseline, snapshotId: 'catalog-v2', publishedAt: at(2), publisher });
  assert.equal(candidate.houses.find(h => h.id === 'house_001').description, 'Reviewed description');
  assert.equal(baseline.houses.find(h => h.id === 'house_001').description === 'Reviewed description', false);
  workflow.markPublished({ submissionId: 'submission-1', snapshotId: 'catalog-v2', publishedAt: at(3), publisher });
  assert.equal(workflow.properties()[0].revision, 5);
  assert.equal(workflow.verifyAuditTrail(), true);
  assert.deepEqual(workflow.auditTrail().map(e => e.type), ['submission.created', 'submission.approved', 'publication.candidate_created', 'publication.published']);
});

test('ownership, editable fields and optimistic version are enforced', () => {
  for (const args of [
    { submittedBy: otherOwner, patch: { description: 'x' }, baseRevision: 4, error: /does not belong/ },
    { submittedBy: owner, patch: { name: 'forged' }, baseRevision: 4, error: /not owner-editable/ },
    { submittedBy: owner, patch: { description: 'x' }, baseRevision: 3, error: /Stale property revision/ }
  ]) {
    assert.throws(() => make().submit({ submissionId: 'submission-1', propertyId: property.id, submittedAt: at(0), ...args }), args.error);
  }
});

test('review is independent, reasoned, role-gated and single-decision', () => {
  const workflow = make();
  workflow.submit({ submissionId: 'submission-1', propertyId: property.id, baseRevision: 4, patch: { description: 'x' }, submittedAt: at(0), submittedBy: owner });
  assert.throws(() => workflow.review({ submissionId: 'submission-1', decision: 'approved', reason: 'self', reviewedAt: at(1), reviewedBy: owner }), /cannot review/);
  assert.throws(() => workflow.review({ submissionId: 'submission-1', decision: 'approved', reason: 'self', reviewedAt: at(1), reviewedBy: { ...owner, roles: ['owner', 'reviewer'] } }), /own submission/);
  assert.throws(() => workflow.review({ submissionId: 'submission-1', decision: 'approved', reason: '', reviewedAt: at(1), reviewedBy: reviewer }), /reason is required/);
  workflow.review({ submissionId: 'submission-1', decision: 'rejected', reason: 'Unsafe URL evidence', reviewedAt: at(1), reviewedBy: reviewer });
  assert.throws(() => workflow.review({ submissionId: 'submission-1', decision: 'approved', reason: 'again', reviewedAt: at(2), reviewedBy: reviewer }), /not pending/);
  assert.throws(() => workflow.createPublicationCandidate({ submissionId: 'submission-1', baselineSnapshot: baseline, snapshotId: 'catalog-v2', publishedAt: at(2), publisher }), /not approved/);
});

test('revoked approval cannot become a candidate', () => {
  const workflow = approved();
  workflow.revoke({ submissionId: 'submission-1', reason: 'Owner withdrew changes', revokedAt: at(2), revokedBy: owner });
  assert.throws(() => workflow.createPublicationCandidate({ submissionId: 'submission-1', baselineSnapshot: baseline, snapshotId: 'catalog-v2', publishedAt: at(3), publisher }), /not approved/);
});

test('candidate validation fails closed for unsafe approved content', () => {
  const workflow = make();
  workflow.submit({ submissionId: 'submission-1', propertyId: property.id, baseRevision: 4, patch: { site: 'javascript:alert(1)' }, submittedAt: at(0), submittedBy: owner });
  workflow.review({ submissionId: 'submission-1', decision: 'approved', reason: 'mistaken review', reviewedAt: at(1), reviewedBy: reviewer });
  assert.throws(() => workflow.createPublicationCandidate({ submissionId: 'submission-1', baselineSnapshot: baseline, snapshotId: 'catalog-v2', publishedAt: at(2), publisher }), /Invalid public snapshot/);
});

test('published revision makes another approved submission stale', () => {
  const workflow = make();
  for (const id of ['submission-1', 'submission-2']) {
    workflow.submit({ submissionId: id, propertyId: property.id, baseRevision: 4, patch: { description: id }, submittedAt: at(0), submittedBy: owner });
    workflow.review({ submissionId: id, decision: 'approved', reason: 'Verified', reviewedAt: at(1), reviewedBy: reviewer });
  }
  workflow.createPublicationCandidate({ submissionId: 'submission-1', baselineSnapshot: baseline, snapshotId: 'catalog-v2', publishedAt: at(2), publisher });
  workflow.markPublished({ submissionId: 'submission-1', snapshotId: 'catalog-v2', publishedAt: at(3), publisher });
  assert.throws(() => workflow.createPublicationCandidate({ submissionId: 'submission-2', baselineSnapshot: baseline, snapshotId: 'catalog-v3', publishedAt: at(4), publisher }), /stale/);
});

test('rollback requires publisher authority and adds a reasoned audit event', () => {
  const workflow = make();
  assert.throws(() => workflow.recordRollback({ fromSnapshotId: 'catalog-v2', toSnapshotId: 'catalog-v1', reason: 'bad', rolledBackAt: at(1), rolledBackBy: reviewer }), /cannot rollback/);
  workflow.recordRollback({ fromSnapshotId: 'catalog-v2', toSnapshotId: 'catalog-v1', reason: 'Regression', rolledBackAt: at(1), rolledBackBy: publisher });
  assert.equal(workflow.auditTrail()[0].type, 'publication.rolled_back');
  assert.equal(workflow.verifyAuditTrail(), true);
});
