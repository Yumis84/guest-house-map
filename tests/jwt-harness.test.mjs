import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ISOLATION_CONFIRMATION,readOwnerTestConfig,requireLoopbackUrl} from '../scripts/owner-test-config.mjs';

const valid = {
  OWNER_TEST_CONFIRM_ISOLATED: ISOLATION_CONFIRMATION,
  OWNER_TEST_SUPABASE_URL: 'http://127.0.0.1:54321',
  OWNER_TEST_DATABASE_URL: 'postgresql://postgres:postgres@localhost:54322/postgres',
  OWNER_TEST_ANON_KEY: 'local-anon',
  OWNER_TEST_SERVICE_ROLE_KEY: 'local-service'
};

test('acceptance config permits explicit disposable loopback stack',()=>{
  assert.deepEqual(readOwnerTestConfig(valid),{
    url:valid.OWNER_TEST_SUPABASE_URL,database:valid.OWNER_TEST_DATABASE_URL,
    anon:'local-anon',service:'local-service'
  });
});

test('acceptance config requires explicit isolation confirmation',()=>{
  assert.throws(()=>readOwnerTestConfig({...valid,OWNER_TEST_CONFIRM_ISOLATED:''}),/disposable local stack/);
});

for(const value of ['https://example.supabase.co','http://127.0.0.1.example.com']){
  test(`Supabase endpoint rejects ${value}`,()=>assert.throws(()=>requireLoopbackUrl('URL',value,['http:']),/non-loopback/));
}

test('acceptance config rejects hosted database and duplicate keys',()=>{
  assert.throws(()=>readOwnerTestConfig({...valid,OWNER_TEST_DATABASE_URL:'postgresql://db.example.com/postgres'}),/non-loopback/);
  assert.throws(()=>readOwnerTestConfig({...valid,OWNER_TEST_SERVICE_ROLE_KEY:'local-anon'}),/must be different/);
});
