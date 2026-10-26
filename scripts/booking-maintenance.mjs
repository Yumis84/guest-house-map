// Local synthetic runner. Installing a production scheduler requires separate approval.
import {createRequire} from 'node:module';
import {safeTestDatabaseUrl} from '../tests/booking/safe-test-db-url.mjs';
const require=createRequire(process.env.PG_MODULE_ROOT||import.meta.url),{Client}=require('pg');
const url=process.env.BOOKING_TEST_DATABASE_URL;safeTestDatabaseUrl(url);
let stopping=false,client,failures=0;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;});
const log=(event,fields={})=>console.log(JSON.stringify({at:new Date().toISOString(),event,...fields}));
const code=e=>/^[A-Z0-9_]{2,20}$/.test(e?.code||'')?e.code:'WORKER_ERROR';
try{do{
 try{
  if(!client){client=new Client({connectionString:url,connectionTimeoutMillis:3000});client.on('error',()=>{});await client.connect();await client.query('set role service_role');await client.query("set statement_timeout='5s'");}
  const {rows}=await client.query('select booking_expire_holds() as expired,booking_cleanup_limits() as cleaned');failures=0;log('maintenance_ok',rows[0]);
 }catch(e){failures++;log('maintenance_error',{code:code(e),failures});if(client){await client.end().catch(()=>{});client=null;}if(!process.argv.includes('--watch')){process.exitCode=1;break;}}
 if(!process.argv.includes('--watch'))break;
 const delay=Math.min(30000,1000*2**Math.min(failures,5));for(let elapsed=0;elapsed<delay&&!stopping;elapsed+=100)await new Promise(r=>setTimeout(r,100));
}while(!stopping);}finally{if(client)await client.end().catch(()=>{});log('maintenance_stopped');}
