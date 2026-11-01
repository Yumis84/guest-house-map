import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { validatePublicSnapshot } from '../publication/validate-public-snapshot.mjs';

const legacySource = await readFile(new URL('../guest-houses.js', import.meta.url), 'utf8');
const photoSource = await readFile(new URL('../guest-photos-v4.js', import.meta.url), 'utf8');
const fixture = JSON.parse(await readFile(new URL('./fixtures/public-snapshot-v1.json', import.meta.url), 'utf8'));

function loadLegacyCatalog() {
  const source = legacySource.split('// Load integrations/enhancements')[0];
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'guest-houses.js' });
  return JSON.parse(JSON.stringify(context.window.GUEST_HOUSES));
}

function photosByHouse() {
  const match = photoSource.match(/const SOURCES=(\{[\s\S]*?\n  \});/);
  assert.ok(match, 'photo source map must remain extractable');
  return vm.runInNewContext(`(${match[1]})`, Object.create(null));
}

function candidateSnapshot() {
  const photos = photosByHouse();
  return {
    ...fixture,
    houses: loadLegacyCatalog().map(h => ({
      id: h.id,
      sourceKey: h.id,
      name: h.name,
      address: h.address,
      lat: h.lat,
      lng: h.lng,
      capacity: h.capacity ?? null,
      price: h.price ?? null,
      amenities: h.amenities,
      phone: h.phone ?? null,
      email: h.email ?? null,
      site: h.site?.startsWith('https://') ? h.site : null,
      description: h.description,
      active: h.active,
      parentId: h.parentId ?? null,
      photos: photos[h.id].images
    }))
  };
}

const clone = value => structuredClone(value);

test('current catalog maps to a valid isolated V1 snapshot', () => {
  const snapshot = candidateSnapshot();
  assert.deepEqual(validatePublicSnapshot(snapshot), { ok: true, errors: [] });
  assert.equal(snapshot.houses.filter(h => h.parentId === null).length, 7);
});

test('legacy Krasnolesye fields and all stable IDs remain compatible', () => {
  const legacy = loadLegacyCatalog();
  const snapshot = candidateSnapshot();
  assert.deepEqual(snapshot.houses.map(h => h.id), legacy.map(h => h.id));
  for (const house of snapshot.houses) {
    for (const field of ['id', 'name', 'address', 'lat', 'lng', 'capacity', 'price', 'amenities', 'phone', 'email', 'site', 'description', 'active', 'parentId']) assert.ok(field in house, `${house.id}.${field}`);
  }
  assert.deepEqual(snapshot.houses.filter(h => h.parentId === null).map(h => h.id), ['house_001', 'house_002', 'house_003', 'house_004', 'house_007', 'house_008', 'house_009']);
  assert.equal(snapshot.houses.find(h => h.id === 'house_005').parentId, 'house_004');
  assert.equal(snapshot.houses.find(h => h.id === 'house_006').parentId, 'house_004');
});

test('eco-museum consumer fields remain present and searchable', () => {
  for (const house of candidateSnapshot().houses) {
    assert.equal(house.active, true);
    assert.ok(Number.isFinite(house.lat) && Number.isFinite(house.lng));
    assert.doesNotThrow(() => [house.name, house.address, house.description].join(' ').toLowerCase());
  }
});

test('every published photo is an existing local public asset', async () => {
  for (const house of candidateSnapshot().houses) {
    for (const photo of house.photos) await assert.doesNotReject(readFile(new URL(`../${photo}`, import.meta.url)));
  }
});

test('validator fails closed on unknown fields, IDs, coordinates and URLs', () => {
  const mutations = [
    s => { s.debug = true; },
    s => { s.houses[1].id = s.houses[0].id; },
    s => { s.houses[0].sourceKey = 'house_999'; },
    s => { s.houses[0].lat = 91; },
    s => { s.houses[0].photos[0] = 'javascript:alert(1)'; },
    s => { s.houses[0].site = 'http://example.test'; },
    s => { s.houses[0].parentId = 'house_999'; },
    s => { s.houses.pop(); }
  ];
  for (const mutate of mutations) {
    const snapshot = clone(candidateSnapshot());
    mutate(snapshot);
    assert.equal(validatePublicSnapshot(snapshot).ok, false);
  }
});
