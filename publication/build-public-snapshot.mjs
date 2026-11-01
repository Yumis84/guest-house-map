import vm from 'node:vm';
import { assertPublicSnapshot } from './validate-public-snapshot.mjs';

const CATALOG_END = '// Load integrations/enhancements';

export function readLegacyCatalog(source) {
  if (typeof source !== 'string' || !source.includes(CATALOG_END)) {
    throw new Error('Legacy catalog boundary was not found');
  }
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source.split(CATALOG_END)[0], context, {
    filename: 'guest-houses.js',
    timeout: 1_000
  });
  if (!Array.isArray(context.window.GUEST_HOUSES)) throw new Error('Legacy catalog did not define window.GUEST_HOUSES');
  return structuredClone(context.window.GUEST_HOUSES);
}

export function readLegacyPhotoMap(source) {
  if (typeof source !== 'string') throw new Error('Photo mapping source must be text');
  const match = source.match(/const SOURCES=(\{[\s\S]*?\n  \});/);
  if (!match) throw new Error('Legacy photo map was not found');
  const value = vm.runInNewContext(`(${match[1]})`, Object.create(null), {
    filename: 'guest-photos-v4.js',
    timeout: 1_000
  });
  return structuredClone(value);
}

export function buildPublicSnapshot({ legacyCatalogSource, photoMapSource, snapshotId, publishedAt, previousSnapshotId = null }) {
  const catalog = readLegacyCatalog(legacyCatalogSource);
  const photoMap = readLegacyPhotoMap(photoMapSource);
  const catalogIds = new Set(catalog.map(house => house.id));
  const photoIds = Object.keys(photoMap);
  const missing = [...catalogIds].filter(id => !photoMap[id]);
  const unknown = photoIds.filter(id => !catalogIds.has(id));
  if (missing.length || unknown.length) {
    throw new Error(`Photo mapping mismatch (missing: ${missing.join(', ') || 'none'}; unknown: ${unknown.join(', ') || 'none'})`);
  }

  const snapshot = {
    schemaVersion: 'guest-house-public-snapshot/v1',
    snapshotId,
    publishedAt,
    previousSnapshotId,
    houses: catalog.map(house => ({
      id: house.id,
      sourceKey: house.id,
      name: house.name,
      address: house.address,
      lat: house.lat,
      lng: house.lng,
      capacity: house.capacity ?? null,
      price: house.price ?? null,
      amenities: house.amenities,
      phone: house.phone ?? null,
      email: house.email ?? null,
      site: house.site?.startsWith('https://') ? house.site : null,
      description: house.description,
      active: house.active,
      parentId: house.parentId ?? null,
      photos: photoMap[house.id].images
    }))
  };
  return assertPublicSnapshot(snapshot);
}

export function serializeDeterministically(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
