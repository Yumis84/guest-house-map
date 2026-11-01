import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { assertPublicSnapshot } from './validate-public-snapshot.mjs';
import { serializeDeterministically } from './build-public-snapshot.mjs';

const STORE_VERSION = 'guest-house-publication-store/v1';
const POINTER_VERSION = 'guest-house-publication-pointer/v1';
const MANIFEST_VERSION = 'guest-house-publication-manifest/v1';
const SNAPSHOT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const UTC_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const fixturesRoot = resolve(fileURLToPath(new URL('../test/fixtures/', import.meta.url)));

const sha256 = text => createHash('sha256').update(text).digest('hex');

function isWithin(parent, child) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
}

export function assertIsolatedOutputRoot(outputRoot) {
  if (typeof outputRoot !== 'string' || !outputRoot) throw new Error('An explicit outputRoot is required');
  const target = resolve(outputRoot);
  if (!isWithin(resolve(tmpdir()), target) && !isWithin(fixturesRoot, target)) {
    throw new Error('Refusing output outside the system temp directory or test/fixtures');
  }
  return target;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function writeExclusive(path, text) {
  const handle = await open(path, 'wx');
  try { await handle.writeFile(text, 'utf8'); } finally { await handle.close(); }
}

async function writePointerAtomically(root, pointer) {
  const target = resolve(root, 'current.json');
  const temporary = resolve(root, `.current-${randomUUID()}.tmp`);
  await writeExclusive(temporary, serializeDeterministically(pointer));
  try {
    await rename(temporary, target);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

async function currentVersion(root) {
  try {
    const pointer = await readJson(resolve(root, 'current.json'));
    return Number.isSafeInteger(pointer.pointerVersion) ? pointer.pointerVersion : null;
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    return null;
  }
}

async function verifiedSelection(root, pointer) {
  if (!pointer || pointer.schemaVersion !== POINTER_VERSION || pointer.storeVersion !== STORE_VERSION ||
      !Number.isSafeInteger(pointer.pointerVersion) || pointer.pointerVersion < 1 ||
      !SNAPSHOT_ID.test(pointer.snapshotId || '') || !/^[a-f0-9]{64}$/.test(pointer.snapshotSha256 || '') ||
      !/^[a-f0-9]{64}$/.test(pointer.manifestSha256 || '') || !['publish', 'rollback'].includes(pointer.operation) ||
      !UTC_DATE_TIME.test(pointer.selectedAt || '') || Number.isNaN(Date.parse(pointer.selectedAt))) throw new Error('Invalid pointer');
  const snapshotText = await readFile(resolve(root, 'snapshots', `${pointer.snapshotId}.json`), 'utf8');
  const manifestText = await readFile(resolve(root, 'manifests', `${pointer.snapshotId}.json`), 'utf8');
  if (sha256(snapshotText) !== pointer.snapshotSha256 || sha256(manifestText) !== pointer.manifestSha256) throw new Error('Pointer hash mismatch');
  const snapshot = assertPublicSnapshot(JSON.parse(snapshotText));
  const manifest = JSON.parse(manifestText);
  if (manifest.schemaVersion !== MANIFEST_VERSION || manifest.snapshotId !== snapshot.snapshotId ||
      manifest.publishedAt !== snapshot.publishedAt || manifest.previousSnapshotId !== snapshot.previousSnapshotId ||
      manifest.snapshotSha256 !== pointer.snapshotSha256 || manifest.houseCount !== snapshot.houses.length) throw new Error('Invalid manifest');
  return { pointer, manifest, snapshot };
}

export async function publishSnapshot({ outputRoot, snapshot, expectedPointerVersion }) {
  const root = assertIsolatedOutputRoot(outputRoot);
  assertPublicSnapshot(snapshot);
  await Promise.all(['snapshots', 'manifests', 'pointers'].map(dir => mkdir(resolve(root, dir), { recursive: true })));
  const actualVersion = await currentVersion(root);
  if (actualVersion === null) throw new Error('Current pointer is corrupted');
  if (expectedPointerVersion !== actualVersion) throw new Error(`Stale pointer version: expected ${expectedPointerVersion}, current ${actualVersion}`);
  const current = actualVersion === 0 ? null : await verifiedSelection(root, await readJson(resolve(root, 'current.json')));

  const snapshotText = serializeDeterministically(snapshot);
  const snapshotSha256 = sha256(snapshotText);
  const manifest = {
    schemaVersion: MANIFEST_VERSION,
    snapshotId: snapshot.snapshotId,
    publishedAt: snapshot.publishedAt,
    previousSnapshotId: snapshot.previousSnapshotId,
    snapshotSha256,
    houseCount: snapshot.houses.length
  };
  const manifestText = serializeDeterministically(manifest);
  const manifestSha256 = sha256(manifestText);
  const snapshotPath = resolve(root, 'snapshots', `${snapshot.snapshotId}.json`);
  const manifestPath = resolve(root, 'manifests', `${snapshot.snapshotId}.json`);

  try {
    const [existingSnapshot, existingManifest] = await Promise.all([readFile(snapshotPath, 'utf8'), readFile(manifestPath, 'utf8')]);
    const selected = await resolvePublishedSnapshot({ outputRoot: root });
    if (existingSnapshot === snapshotText && existingManifest === manifestText && selected.pointer.snapshotId === snapshot.snapshotId) return { ...selected, idempotent: true };
    throw new Error(`Snapshot ID ${snapshot.snapshotId} already exists and is immutable`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const requiredPreviousId = current?.snapshot.snapshotId ?? null;
  if (snapshot.previousSnapshotId !== requiredPreviousId) {
    throw new Error(`previousSnapshotId must match current snapshot (${requiredPreviousId ?? 'null'})`);
  }

  await writeExclusive(snapshotPath, snapshotText);
  try { await writeExclusive(manifestPath, manifestText); }
  catch (error) { await unlink(snapshotPath).catch(() => {}); throw error; }

  const pointer = {
    schemaVersion: POINTER_VERSION,
    storeVersion: STORE_VERSION,
    pointerVersion: actualVersion + 1,
    snapshotId: snapshot.snapshotId,
    snapshotSha256,
    manifestSha256,
    previousSnapshotId: snapshot.previousSnapshotId,
    operation: 'publish',
    selectedAt: snapshot.publishedAt
  };
  const pointerText = serializeDeterministically(pointer);
  const historyPath = resolve(root, 'pointers', `${String(pointer.pointerVersion).padStart(12, '0')}.json`);
  const pendingHistoryPath = `${historyPath}.${randomUUID()}.pending`;
  await writeExclusive(pendingHistoryPath, pointerText);
  try {
    await writePointerAtomically(root, pointer);
    await rename(pendingHistoryPath, historyPath);
  } catch (error) {
    await unlink(pendingHistoryPath).catch(() => {});
    throw error;
  }
  return { pointer, manifest, snapshot, idempotent: false };
}

export async function rollbackSnapshot({ outputRoot, snapshotId, expectedPointerVersion, selectedAt }) {
  const root = assertIsolatedOutputRoot(outputRoot);
  if (!SNAPSHOT_ID.test(snapshotId || '')) throw new Error('Invalid rollback snapshot ID');
  if (!UTC_DATE_TIME.test(selectedAt || '') || Number.isNaN(Date.parse(selectedAt))) throw new Error('Rollback selectedAt must be a UTC date-time');
  const actualVersion = await currentVersion(root);
  if (actualVersion === null) throw new Error('Current pointer is corrupted');
  if (expectedPointerVersion !== actualVersion) throw new Error(`Stale pointer version: expected ${expectedPointerVersion}, current ${actualVersion}`);
  const current = await resolvePublishedSnapshot({ outputRoot: root });
  if (!current.fallback && current.pointer.snapshotId === snapshotId) return { ...current, idempotent: true };
  const historyNames = (await readdir(resolve(root, 'pointers'))).filter(name => /^\d{12}\.json$/.test(name));
  let wasPublished = false;
  for (const name of historyNames) {
    try {
      const prior = await verifiedSelection(root, await readJson(resolve(root, 'pointers', name)));
      if (prior.snapshot.snapshotId === snapshotId) { wasPublished = true; break; }
    } catch { /* Invalid history entries are never rollback candidates. */ }
  }
  if (!wasPublished) throw new Error(`Rollback target ${snapshotId} was not previously published and validated`);
  const targetPointer = { ...current.pointer, snapshotId };
  const manifestText = await readFile(resolve(root, 'manifests', `${snapshotId}.json`), 'utf8');
  const manifest = JSON.parse(manifestText);
  targetPointer.snapshotSha256 = manifest.snapshotSha256;
  targetPointer.manifestSha256 = sha256(manifestText);
  await verifiedSelection(root, targetPointer);
  const pointer = {
    ...targetPointer,
    pointerVersion: actualVersion + 1,
    previousSnapshotId: current.pointer.snapshotId,
    operation: 'rollback',
    selectedAt
  };
  const historyPath = resolve(root, 'pointers', `${String(pointer.pointerVersion).padStart(12, '0')}.json`);
  const pendingHistoryPath = `${historyPath}.${randomUUID()}.pending`;
  await writeExclusive(pendingHistoryPath, serializeDeterministically(pointer));
  try {
    await writePointerAtomically(root, pointer);
    await rename(pendingHistoryPath, historyPath);
  } catch (error) {
    await unlink(pendingHistoryPath).catch(() => {});
    throw error;
  }
  return { ...(await verifiedSelection(root, pointer)), idempotent: false };
}

export async function resolvePublishedSnapshot({ outputRoot }) {
  const root = assertIsolatedOutputRoot(outputRoot);
  try {
    return { ...(await verifiedSelection(root, await readJson(resolve(root, 'current.json')))), fallback: false };
  } catch (currentError) {
    let names;
    try { names = (await readdir(resolve(root, 'pointers'))).filter(name => /^\d{12}\.json$/.test(name)).sort().reverse(); }
    catch { throw new Error(`No valid published snapshot: ${currentError.message}`); }
    for (const name of names) {
      try {
        return { ...(await verifiedSelection(root, await readJson(resolve(root, 'pointers', name)))), fallback: true };
      } catch { /* Continue to the last known good selection. */ }
    }
    throw new Error(`No valid published snapshot: ${currentError.message}`);
  }
}
