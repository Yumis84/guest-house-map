// At-least-once, PII-free local candidate. Consumer must deduplicate Idempotency-Key.
import {createRequire} from 'node:module';import {safeTestDatabaseUrl} from '../tests/booking/safe-test-db-url.mjs';
const url=process.env.BOOKING_TEST_DATABASE_URL;safeTestDatabaseUrl(url);
const raw=process.env.BOOKING_SYNTHETIC_NOTIFICATION_URL;
if(!raw)throw Error('Synthetic notification sink required');const sink=new URL(raw);
if(sink.protocol!=='http:'||!['127.0.0.1','localhost'].includes(sink.hostname)||sink.username||sink.password||sink.search||sink.hash)throw Error('Loopback-only synthetic sink required');
const {Client}=createRequire(process.env.PG_MODULE_ROOT||import.meta.url)('pg');const db=new Client({connectionString:url,connectionTimeoutMillis:3000});await db.connect();let stopping=false;for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>stopping=true);
const log=(event,fields={})=>console.log(JSON.stringify({at:new Date().toISOString(),event,...fields}));
try{await db.query('set role service_role');do{
 try{const {rows}=await db.query('select booking_outbox_claim(20) as events');for(const event of rows[0].events){let ok=false;try{const {lease,attempts,...payload}=event;const response=await fetch(sink,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','Idempotency-Key':'booking-event:'+event.id},body:JSON.stringify(payload),signal:AbortSignal.timeout(5000)});ok=response.ok;await response.body?.cancel();}catch{}
 const ack=await db.query('select booking_outbox_ack($1,$2,$3,$4) as acknowledged',[event.id,event.lease,ok,ok?'DELIVERED':'SINK_UNAVAILABLE']);log('notification_attempt',{id:event.id,delivered:ok,acknowledged:ack.rows[0].acknowledged});}
 }catch{log('notification_worker_error',{code:'WORKER_ERROR'});if(!process.argv.includes('--watch')){process.exitCode=1;break;}}
 if(!process.argv.includes('--watch'))break;for(let i=0;i<10&&!stopping;i++)await new Promise(r=>setTimeout(r,100));
}while(!stopping);}finally{await db.end();log('notification_worker_stopped');}
