import test from 'node:test';
import assert from 'node:assert/strict';
import {safeTestDatabaseUrl} from './safe-test-db-url.mjs';
const valid=['postgresql://tester:secret@127.0.0.1:5432/synthetic_booking_m3','postgresql://tester:secret@localhost/synthetic_booking_2026'];
for(const raw of valid)test('accepts isolated database URL',()=>assert.equal(safeTestDatabaseUrl(raw).protocol,'postgresql:'));
const invalid=[
 ['missing URL',undefined,/required/],
 ['remote hostname','postgresql://x:y@remote.example/synthetic_booking_m3',/non-loopback/],
 ['IPv6 loopback not in allowlist','postgresql://x:y@[::1]/synthetic_booking_m3',/non-loopback/],
 ['production name','postgresql://x:y@localhost/production',/non-synthetic/],
 ['empty synthetic suffix','postgresql://x:y@localhost/synthetic_booking_',/non-synthetic/],
 ['slash in encoded database','postgresql://x:y@localhost/synthetic_booking_%2Fproduction',/non-synthetic/],
 ['host override','postgresql://x:y@localhost/synthetic_booking_m3?host=remote.example',/query parameters/],
 ['service override','postgresql://x:y@localhost/synthetic_booking_m3?service=prod',/query parameters/],
 ['fragment','postgresql://x:y@localhost/synthetic_booking_m3#fragment',/fragments/],
 ['http protocol','http://x:y@localhost/synthetic_booking_m3',/PostgreSQL URI/],
];
for(const [name,raw,error] of invalid)test('rejects '+name,()=>assert.throws(()=>safeTestDatabaseUrl(raw),error));
