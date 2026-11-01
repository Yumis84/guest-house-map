const SCHEMA_VERSION = 'guest-house-public-snapshot/v1';
const ID = /^house_\d{3}$/;
const SNAPSHOT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const PHONE = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeUrl(value) {
  if (typeof value !== 'string' || /\s/.test(value)) return false;
  if (value.startsWith('assets/')) return !value.includes('..') && value.length > 7;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function exactKeys(value, allowed, path, errors) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${path}: unknown property ${key}`);
  }
}

function validateHouse(house, index, errors) {
  const path = `houses[${index}]`;
  const required = ['id', 'sourceKey', 'name', 'address', 'lat', 'lng', 'capacity', 'price', 'amenities', 'phone', 'email', 'site', 'description', 'active', 'parentId', 'photos'];
  if (!house || typeof house !== 'object' || Array.isArray(house)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  exactKeys(house, new Set(required), path, errors);
  for (const key of required) if (!(key in house)) errors.push(`${path}.${key}: required`);
  if (!ID.test(house.id || '')) errors.push(`${path}.id: invalid stable ID`);
  if (!ID.test(house.sourceKey || '') || house.sourceKey !== house.id) errors.push(`${path}.sourceKey: must equal id`);
  for (const key of ['name', 'address', 'description']) if (typeof house[key] !== 'string' || !house[key].trim()) errors.push(`${path}.${key}: non-empty string required`);
  if (!Number.isFinite(house.lat) || house.lat < -90 || house.lat > 90) errors.push(`${path}.lat: invalid coordinate`);
  if (!Number.isFinite(house.lng) || house.lng < -180 || house.lng > 180) errors.push(`${path}.lng: invalid coordinate`);
  for (const key of ['capacity', 'price']) if (house[key] !== null && (!Number.isFinite(house[key]) || house[key] < 0)) errors.push(`${path}.${key}: must be null or a non-negative number`);
  if (!Array.isArray(house.amenities) || house.amenities.some(x => typeof x !== 'string' || !x.trim()) || new Set(house.amenities).size !== house.amenities.length) errors.push(`${path}.amenities: unique non-empty strings required`);
  if (house.phone !== null && !PHONE.test(house.phone || '')) errors.push(`${path}.phone: invalid E.164 phone`);
  if (house.email !== null && !EMAIL.test(house.email || '')) errors.push(`${path}.email: invalid email`);
  if (house.site !== null && !safeUrl(house.site)) errors.push(`${path}.site: unsafe URL`);
  if (house.active !== true) errors.push(`${path}.active: published entries must be active`);
  if (house.parentId !== null && !ID.test(house.parentId || '')) errors.push(`${path}.parentId: invalid parent ID`);
  if (!Array.isArray(house.photos) || !house.photos.length || house.photos.some(x => !safeUrl(x)) || new Set(house.photos).size !== house.photos.length) errors.push(`${path}.photos: unique safe public URLs required`);
}

export function validatePublicSnapshot(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return { ok: false, errors: ['snapshot: must be an object'] };
  exactKeys(snapshot, new Set(['schemaVersion', 'snapshotId', 'publishedAt', 'previousSnapshotId', 'houses']), 'snapshot', errors);
  if (snapshot.schemaVersion !== SCHEMA_VERSION) errors.push('schemaVersion: unsupported version');
  if (!SNAPSHOT_ID.test(snapshot.snapshotId || '')) errors.push('snapshotId: invalid identifier');
  if (typeof snapshot.publishedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(snapshot.publishedAt) || Number.isNaN(Date.parse(snapshot.publishedAt))) errors.push('publishedAt: UTC date-time required');
  if (snapshot.previousSnapshotId !== null && !SNAPSHOT_ID.test(snapshot.previousSnapshotId || '')) errors.push('previousSnapshotId: invalid identifier');
  if (!Array.isArray(snapshot.houses)) errors.push('houses: array required');
  else {
    snapshot.houses.forEach((house, index) => validateHouse(house, index, errors));
    const ids = snapshot.houses.map(h => h?.id);
    const sourceKeys = snapshot.houses.map(h => h?.sourceKey);
    if (new Set(ids).size !== ids.length) errors.push('houses: duplicate id');
    if (new Set(sourceKeys).size !== sourceKeys.length) errors.push('houses: duplicate sourceKey');
    const idSet = new Set(ids);
    for (const [index, house] of snapshot.houses.entries()) if (house?.parentId && !idSet.has(house.parentId)) errors.push(`houses[${index}].parentId: unknown parent`);
    const main = snapshot.houses.filter(h => h?.parentId === null);
    if (main.length !== 7) errors.push('houses: exactly seven main houses required');
  }
  return { ok: errors.length === 0, errors };
}

export function assertPublicSnapshot(snapshot) {
  const result = validatePublicSnapshot(snapshot);
  if (!result.ok) throw new Error(`Invalid public snapshot:\n${result.errors.join('\n')}`);
  return snapshot;
}
