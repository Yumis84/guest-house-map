import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const cases=[
 ['remote host','postgresql://test:test@remote.example/synthetic_booking_m3','Refusing non-loopback'],
 ['production database','postgresql://test:test@127.0.0.1/production','Refusing non-synthetic'],
 ['host override query','postgresql://test:test@127.0.0.1/synthetic_booking_m3?host=remote.example','query parameters are forbidden'],
 ['alternate protocol','http://test:test@127.0.0.1/synthetic_booking_m3','PostgreSQL URI required'],
 ['empty synthetic name','postgresql://test:test@127.0.0.1/synthetic_booking_','Refusing non-synthetic'],
];
for(const [name,uri,message] of cases)test(name,()=>{
 const result=spawnSync(process.execPath,['tests/booking/postgres-preflight.mjs'],{encoding:'utf8',env:{...process.env,BOOKING_TEST_DATABASE_URL:uri},timeout:5000});
 assert.notEqual(result.status,0);
 assert.match(result.stderr,message instanceof RegExp?message:new RegExp(message));
});
