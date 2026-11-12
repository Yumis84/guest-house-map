import assert from 'node:assert/strict';
export function safeTestDatabaseUrl(raw){
 if(!raw)throw Error('BOOKING_TEST_DATABASE_URL is required (loopback synthetic_booking_* only)');
 const url=new URL(raw);
 assert.equal(url.protocol,'postgresql:','PostgreSQL URI required');
 assert.ok(['127.0.0.1','localhost'].includes(url.hostname),'Refusing non-loopback PostgreSQL host');
 assert.match(decodeURIComponent(url.pathname),/^\/synthetic_booking_[a-zA-Z0-9_]+$/,'Refusing non-synthetic database');
 assert.equal(url.search,'','Connection query parameters are forbidden to prevent host overrides');
 assert.equal(url.hash,'','URI fragments are forbidden');
 return url;
}
