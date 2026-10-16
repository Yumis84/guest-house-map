import { createHash } from 'node:crypto';
import { assertPublicSnapshot } from './validate-public-snapshot.mjs';
import { serializeDeterministically } from './build-public-snapshot.mjs';

const EDITABLE_FIELDS = new Set(['description', 'phone', 'email', 'site', 'photos']);
const REVIEW_ROLES = new Set(['reviewer', 'publisher', 'admin']);
const PUBLISH_ROLES = new Set(['publisher', 'admin']);
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const hash = value => createHash('sha256').update(serializeDeterministically(value)).digest('hex');
const copy = value => structuredClone(value);

function required(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required`);
  return value;
}

function instant(value, label) {
  if (typeof value !== 'string' || !UTC.test(value) || Number.isNaN(Date.parse(value))) throw new Error(`${label} must be a UTC date-time`);
  return value;
}

function actor(value) {
  if (!value || !ID.test(value.id || '') || !Array.isArray(value.roles)) throw new Error('Invalid actor');
  return { id: value.id, roles: new Set(value.roles), companyIds: new Set(value.companyIds || []) };
}

function exactPatch(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || !Object.keys(patch).length) throw new Error('A non-empty field patch is required');
  for (const key of Object.keys(patch)) if (!EDITABLE_FIELDS.has(key)) throw new Error(`Field ${key} is not owner-editable`);
  return copy(patch);
}

function eventPayload(event) {
  const { eventHash, ...payload } = event;
  return payload;
}

export class PublicationReviewWorkflow {
  #properties = new Map();
  #submissions = new Map();
  #events = [];

  constructor(properties) {
    if (!Array.isArray(properties) || !properties.length) throw new Error('Properties are required');
    for (const property of properties) {
      if (!ID.test(property?.id || '') || !ID.test(property?.companyId || '') || !ID.test(property?.sourceKey || '') ||
          !Number.isSafeInteger(property?.revision) || property.revision < 0 || this.#properties.has(property.id)) throw new Error('Invalid or duplicate property');
      this.#properties.set(property.id, copy(property));
    }
  }

  #audit({ type, actorId, occurredAt, submissionId = null, details = {} }) {
    const sequence = this.#events.length + 1;
    const previousEventHash = this.#events.at(-1)?.eventHash ?? null;
    const event = { sequence, type, actorId, occurredAt: instant(occurredAt, 'occurredAt'), submissionId, details: copy(details), previousEventHash };
    event.eventHash = hash(event);
    this.#events.push(Object.freeze(event));
  }

  #getSubmission(submissionId) {
    const submission = this.#submissions.get(submissionId);
    if (!submission) throw new Error(`Unknown submission ${submissionId}`);
    return submission;
  }

  submit({ submissionId, propertyId, baseRevision, patch, submittedAt, submittedBy }) {
    const user = actor(submittedBy);
    if (!ID.test(submissionId || '') || this.#submissions.has(submissionId)) throw new Error('Invalid or duplicate submission ID');
    const property = this.#properties.get(propertyId);
    if (!property) throw new Error('Unknown property');
    if (!user.companyIds.has(property.companyId)) throw new Error('Owner does not belong to the property company');
    if (!user.roles.has('owner') && !user.roles.has('manager') && !user.roles.has('admin')) throw new Error('Actor cannot submit');
    if (baseRevision !== property.revision) throw new Error(`Stale property revision: expected ${property.revision}, received ${baseRevision}`);
    const submission = {
      id: submissionId,
      propertyId,
      companyId: property.companyId,
      sourceKey: property.sourceKey,
      baseRevision,
      patch: exactPatch(patch),
      submittedBy: user.id,
      submittedAt: instant(submittedAt, 'submittedAt'),
      status: 'pending',
      decision: null
    };
    this.#submissions.set(submissionId, submission);
    this.#audit({ type: 'submission.created', actorId: user.id, occurredAt: submittedAt, submissionId, details: { propertyId, baseRevision, patchHash: hash(submission.patch) } });
    return copy(submission);
  }

  review({ submissionId, decision, reason, reviewedAt, reviewedBy }) {
    const user = actor(reviewedBy);
    const submission = this.#getSubmission(submissionId);
    if (![...user.roles].some(role => REVIEW_ROLES.has(role))) throw new Error('Actor cannot review');
    if (submission.status !== 'pending') throw new Error(`Submission is not pending (${submission.status})`);
    if (submission.submittedBy === user.id) throw new Error('Reviewer cannot review their own submission');
    if (!['approved', 'rejected'].includes(decision)) throw new Error('Decision must be approved or rejected');
    const reviewReason = required(reason, 'Review reason');
    const reviewTime = instant(reviewedAt, 'reviewedAt');
    const property = this.#properties.get(submission.propertyId);
    if (property.revision !== submission.baseRevision) throw new Error('Submission is stale');
    submission.status = decision;
    submission.decision = { decision, reason: reviewReason, reviewedBy: user.id, reviewedAt: reviewTime };
    this.#audit({ type: `submission.${decision}`, actorId: user.id, occurredAt: reviewTime, submissionId, details: { reason: reviewReason } });
    return copy(submission);
  }

  revoke({ submissionId, reason, revokedAt, revokedBy }) {
    const user = actor(revokedBy);
    const submission = this.#getSubmission(submissionId);
    if (submission.submittedBy !== user.id && !user.roles.has('admin')) throw new Error('Actor cannot revoke this submission');
    if (!['pending', 'approved', 'candidate'].includes(submission.status)) throw new Error(`Submission cannot be revoked from ${submission.status}`);
    submission.status = 'revoked';
    submission.decision = { reason: required(reason, 'Revoke reason'), revokedBy: user.id, revokedAt: instant(revokedAt, 'revokedAt') };
    this.#audit({ type: 'submission.revoked', actorId: user.id, occurredAt: revokedAt, submissionId, details: { reason } });
    return copy(submission);
  }

  createPublicationCandidate({ submissionId, baselineSnapshot, snapshotId, publishedAt, publisher }) {
    const user = actor(publisher);
    if (![...user.roles].some(role => PUBLISH_ROLES.has(role))) throw new Error('Actor cannot create a publication candidate');
    const submission = this.#getSubmission(submissionId);
    if (!['approved', 'candidate'].includes(submission.status)) throw new Error(`Submission is not approved (${submission.status})`);
    const property = this.#properties.get(submission.propertyId);
    if (property.revision !== submission.baseRevision) throw new Error('Approved submission is stale');
    const snapshot = copy(assertPublicSnapshot(copy(baselineSnapshot)));
    const house = snapshot.houses.find(item => item.sourceKey === submission.sourceKey);
    if (!house) throw new Error('Approved property is absent from the baseline snapshot');
    Object.assign(house, copy(submission.patch));
    snapshot.snapshotId = snapshotId;
    snapshot.publishedAt = instant(publishedAt, 'publishedAt');
    snapshot.previousSnapshotId = baselineSnapshot.snapshotId;
    assertPublicSnapshot(snapshot);
    const snapshotHash = hash(snapshot);
    if (submission.status === 'candidate') {
      const existing = submission.decision.publicationCandidate;
      if (existing.snapshotId !== snapshotId || existing.snapshotHash !== snapshotHash) {
        throw new Error('Publication candidate is immutable');
      }
      return copy(snapshot);
    }
    submission.status = 'candidate';
    submission.decision.publicationCandidate = { snapshotId, createdBy: user.id, createdAt: publishedAt, snapshotHash };
    this.#audit({ type: 'publication.candidate_created', actorId: user.id, occurredAt: publishedAt, submissionId, details: { snapshotId, snapshotHash } });
    return copy(snapshot);
  }

  markPublished({ submissionId, snapshotId, publishedAt, publisher }) {
    const user = actor(publisher);
    if (![...user.roles].some(role => PUBLISH_ROLES.has(role))) throw new Error('Actor cannot publish');
    const submission = this.#getSubmission(submissionId);
    if (submission.status !== 'candidate' || submission.decision.publicationCandidate.snapshotId !== snapshotId) throw new Error('No matching validated publication candidate');
    const property = this.#properties.get(submission.propertyId);
    if (property.revision !== submission.baseRevision) throw new Error('Publication candidate is stale');
    Object.assign(property, copy(submission.patch), { revision: property.revision + 1 });
    submission.status = 'published';
    submission.decision.published = { snapshotId, publishedBy: user.id, publishedAt: instant(publishedAt, 'publishedAt') };
    this.#audit({ type: 'publication.published', actorId: user.id, occurredAt: publishedAt, submissionId, details: { snapshotId, revision: property.revision } });
    return copy(submission);
  }

  recordRollback({ fromSnapshotId, toSnapshotId, reason, rolledBackAt, rolledBackBy }) {
    const user = actor(rolledBackBy);
    if (![...user.roles].some(role => PUBLISH_ROLES.has(role))) throw new Error('Actor cannot rollback');
    if (!ID.test(fromSnapshotId || '') || !ID.test(toSnapshotId || '') || fromSnapshotId === toSnapshotId) throw new Error('Invalid rollback snapshots');
    this.#audit({ type: 'publication.rolled_back', actorId: user.id, occurredAt: rolledBackAt, details: { fromSnapshotId, toSnapshotId, reason: required(reason, 'Rollback reason') } });
  }

  submissions() { return [...this.#submissions.values()].map(copy); }
  properties() { return [...this.#properties.values()].map(copy); }
  auditTrail() { return this.#events.map(copy); }

  verifyAuditTrail() {
    let previousEventHash = null;
    return this.#events.every((event, index) => event.sequence === index + 1 && event.previousEventHash === previousEventHash &&
      (previousEventHash = event.eventHash) === hash(eventPayload(event)));
  }
}
