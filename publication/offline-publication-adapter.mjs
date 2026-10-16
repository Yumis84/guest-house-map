import { PublicationReviewWorkflow } from './review-workflow.mjs';
import {
  createOfflinePublicationWorker,
  createPublicationArtifact,
  PUBLICATION_WORKER_AUDIENCE
} from './offline-publication-worker.mjs';
import { resolvePublishedSnapshot } from './snapshot-store.mjs';
import { assertPublicSnapshot } from './validate-public-snapshot.mjs';

export const PUBLICATION_SERVER_AUDIENCE = 'guest-house-publication-server/v1';
const copy = value => structuredClone(value);

function requestPrincipal(context) {
  if (!context || context.surface !== 'server' || context.credentialKind !== 'verified_session') {
    throw new Error('Publication commands require a verified server session');
  }
  if (context.audience !== PUBLICATION_SERVER_AUDIENCE || typeof context.principalId !== 'string' || !context.principalId) {
    throw new Error('Invalid publication server audience or principal');
  }
  return context.principalId;
}

function workerContext(principalId) {
  return {
    surface: 'worker',
    credentialKind: 'service_identity',
    audience: PUBLICATION_WORKER_AUDIENCE,
    principalId
  };
}

/**
 * Offline reference adapter for the complete trust-boundary flow. Browser input
 * must first be authenticated by a server; roles and company membership are
 * always loaded by principal ID and are never accepted from request payloads.
 */
export function createOfflinePublicationAdapter({
  properties,
  outputRoot,
  resolveActor,
  resolveWorkerPrincipal,
  workerPrincipalId
}) {
  if (typeof resolveActor !== 'function') throw new Error('resolveActor is required');
  if (typeof resolveWorkerPrincipal !== 'function') throw new Error('resolveWorkerPrincipal is required');
  if (typeof workerPrincipalId !== 'string' || !workerPrincipalId) throw new Error('workerPrincipalId is required');

  const workflow = new PublicationReviewWorkflow(properties);
  const worker = createOfflinePublicationWorker({ outputRoot, resolvePrincipal: resolveWorkerPrincipal });
  let queue = Promise.resolve();
  const serialize = operation => {
    const result = queue.then(operation, operation);
    queue = result.catch(() => {});
    return result;
  };
  const actorFor = async context => {
    const principalId = requestPrincipal(context);
    const actor = await resolveActor(principalId);
    if (!actor || actor.id !== principalId || actor.active !== true || actor.revoked === true) {
      throw new Error('Request principal is unknown, inactive, or revoked');
    }
    return copy(actor);
  };

  return Object.freeze({
    bootstrapBaseline(command) {
      return serialize(async () => {
        const publisher = await actorFor(command.context);
        if (!publisher.roles?.some(role => role === 'publisher' || role === 'admin')) {
          throw new Error('Actor cannot bootstrap publication');
        }
        if (command.snapshot?.previousSnapshotId !== null) throw new Error('Baseline previousSnapshotId must be null');
        return worker.publish({
          context: workerContext(workerPrincipalId),
          artifact: createPublicationArtifact(command.snapshot),
          expectedPointerVersion: 0
        });
      });
    },

    submit(command) {
      return serialize(async () => workflow.submit({ ...command, submittedBy: await actorFor(command.context) }));
    },

    review(command) {
      return serialize(async () => workflow.review({ ...command, reviewedBy: await actorFor(command.context) }));
    },

    revoke(command) {
      return serialize(async () => workflow.revoke({ ...command, revokedBy: await actorFor(command.context) }));
    },

    publish(command) {
      return serialize(async () => {
        const publisher = await actorFor(command.context);
        const candidate = workflow.createPublicationCandidate({ ...command, publisher });
        const artifact = createPublicationArtifact(candidate);
        const result = await worker.publish({
          context: workerContext(workerPrincipalId),
          artifact,
          expectedPointerVersion: command.expectedPointerVersion
        });
        workflow.markPublished({
          submissionId: command.submissionId,
          snapshotId: candidate.snapshotId,
          publishedAt: command.publishedAt,
          publisher
        });
        return { ...result, artifact };
      });
    },

    rollback(command) {
      return serialize(async () => {
        const publisher = await actorFor(command.context);
        if (!publisher.roles?.some(role => role === 'publisher' || role === 'admin')) {
          throw new Error('Actor cannot rollback');
        }
        if (typeof command.reason !== 'string' || !command.reason.trim()) throw new Error('Rollback reason is required');
        const result = await worker.rollback({
          context: workerContext(workerPrincipalId),
          snapshotId: command.snapshotId,
          expectedPointerVersion: command.expectedPointerVersion,
          selectedAt: command.selectedAt
        });
        if (!result.idempotent) workflow.recordRollback({
          fromSnapshotId: result.pointer.previousSnapshotId,
          toSnapshotId: result.pointer.snapshotId,
          reason: command.reason,
          rolledBackAt: command.selectedAt,
          rolledBackBy: publisher
        });
        return result;
      });
    },

    async readPublicContract() {
      const selected = await resolvePublishedSnapshot({ outputRoot });
      return copy(assertPublicSnapshot(copy(selected.snapshot)));
    },

    state() {
      return {
        properties: workflow.properties(),
        submissions: workflow.submissions(),
        auditTrail: workflow.auditTrail(),
        auditValid: workflow.verifyAuditTrail()
      };
    }
  });
}
