import assert from 'node:assert/strict';
import {safeTestDatabaseUrl} from './safe-test-db-url.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {Client}=require('pg');
const raw=process.env.BOOKING_TEST_DATABASE_URL;
const url=safeTestDatabaseUrl(raw);
const db=new Client({connectionString:raw,connectionTimeoutMillis:5000});
try{
 await db.connect();
 const result=await db.query("select current_database() db, current_setting('server_version_num')::integer version, inet_server_addr()::text host, exists(select 1 from pg_available_extensions where name='btree_gist') has_btree_gist");
 const row=result.rows[0];
 assert.equal(row.db,decodeURIComponent(url.pathname.slice(1)),'Connected to unexpected database');
 assert.ok(row.version>=170000&&row.version<190000,'Expected PostgreSQL 17/18');
 assert.equal(row.has_btree_gist,true,'btree_gist must be available');
 console.log(`PASS native PG preflight: ${row.db}, PostgreSQL ${Math.floor(row.version/10000)}, btree_gist available`);
}finally{await db.end();}
