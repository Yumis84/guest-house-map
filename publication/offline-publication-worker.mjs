import { createHash } from 'node:crypto';
import { assertPublicSnapshot } from './validate-public-snapshot.mjs';
import { serializeDeterministically } from './build-public-snapshot.mjs';
import { publishSnapshot, rollbackSnapshot } from './snapshot-store.mjs';

export const PUBLICATION_WORKER_AUDIENCE = 'guest-house-publication-worker/v1';
export const PUBLICATION_MANIFEST_VERSION = 'guest-house-publication-manifest/v1';

const SHA256 = /^[a-f0-9]{64}$/;
const WORKER_ROLES = new Set(['publisher', 'admin']);
const copy = value => structuredClone(value);
const sha256 = text => createHash('sha256').update(text).digest('hex');

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function createPublicationArtifact(snapshot) {
  const validated = copy(assertPublicSnapshot(copy(snapshot)));
  const snapshotText = serializeDeterministically(validated);
  const manifest = {
    schemaVersion: PUBLICATION_MANIFEST_VERSION,
    snapshotId: validated.snapshotId,
    publishedAt: validated.publishedAt,
    previousSnapshotId: validated.previousSnapshotId,
    snapshotSha256: sha256(snapshotText),
    houseCount: validated.houses.length
  };
  const manifestText = serializeDeterministically(manifest);
  return deepFreeze({
    snapshot: validated,
    manifest,
    snapshotSha256: manifest.snapshotSha256,
    manifestSha256: sha256(manifestText)
  });
}

export function verifyPublicationArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') throw new Error('Publication artifact is required');
  const snapshot = copy(assertPublicSnapshot(copy(artifact.snapshot)));
  const expected = createPublicationArtifact(snapshot);
  if (!artifact.manifest || serializeDeterministically(artifact.manifest) !== serializeDeterministically(expected.manifest)) {
    throw new Error('Publication manifest does not match the validated snapshot');
  }
  if (!SHA256.test(artifact.snapshotSha256 || '') || artifact.snapshotSha256 !== expected.snapshotSha256) {
    throw new Error('Publication snapshot hash mismatch');
  }
  if (!SHA256.test(artifact.manifestSha256 || '') || artifact.manifestSha256 !== expected.manifestSha256) {
    throw new Error('Publication manifest hash mismatch');
  }
  return expected;
}

function assertWorkerContext(context) {
  if (!context || context.surface !== 'worker' || context.credentialKind !== 'service_identity') {
    throw new Error('Direct browser or user-token publication is forbidden');
  }
  if (context.audience !== PUBLICATION_WORKER_AUDIENCE) throw new Error('Invalid publication worker audience');
  if (typeof context.principalId !== 'string' || !context.principalId) throw new Error('Worker principal is required');
  return context.principalId;
}

async function authorize(context, resolvePrincipal) {
  const principalId = assertWorkerContext(context);
  const principal = await resolvePrincipal(principalId);
  if (!principal || principal.id !== principalId || principal.revoked === true || principal.active !== true) {
    throw new Error('Publication worker identity is unknown, inactive, or revoked');
  }
  if (!Array.isArray(principal.roles) || !principal.roles.some(role => WORKER_ROLES.has(role))) {
    throw new Error('Current publisher role is required');
  }
  return copy(principal);
}

export function createOfflinePublicationWorker({ outputRoot, resolvePrincipal }) {
  if (typeof resolvePrincipal !== 'function') throw new Error('resolvePrincipal is required');
  let queue = Promise.resolve();
  const serialize = operation => {
    const result = queue.then(operation, operation);
    queue = result.catch(() => {});
    return result;
  };

  return Object.freeze({
    publish({ context, artifact, expectedPointerVersion }) {
      return serialize(async () => {
        await authorize(context, resolvePrincipal);
        const verified = verifyPublicationArtifact(artifact);
        const result = await publishSnapshot({ outputRoot, snapshot: verified.snapshot, expectedPointerVersion });
        if (result.pointer.snapshotSha256 !== verified.snapshotSha256 || result.pointer.manifestSha256 !== verified.manifestSha256) {
          throw new Error('Persisted publication hashes differ from the verified artifact');
        }
        return result;
      });
    },

    rollback({ context, snapshotId, expectedPointerVersion, selectedAt }) {
      return serialize(async () => {
        await authorize(context, resolvePrincipal);
        return rollbackSnapshot({ outputRoot, snapshotId, expectedPointerVersion, selectedAt });
      });
    }
  });
}
