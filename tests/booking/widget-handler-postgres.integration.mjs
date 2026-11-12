import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {safeTestDatabaseUrl} from './safe-test-db-url.mjs';
import {handleWidgetRequest} from '../../server/widget-request/handler.mjs';

const url=process.env.BOOKING_TEST_DATABASE_URL;
safeTestDatabaseUrl(url);
const require=createRequire(process.env.PG_MODULE_ROOT||import.meta.url);
const {Client}=require('pg');
const db=new Client({connectionString:url});
await db.connect();
try {
  const found=await db.query('select public_id from public.widget_configs where published is not null limit 1');
  assert.equal(found.rowCount,1,'Requires existing synthetic M2 acceptance fixture');
  const widgetId=found.rows[0].public_id;
  const d=n=>new Date(Date.now()+86400000*n).toISOString().slice(0,10);
  const idempotency=randomUUID();
  const payload={widgetId,checkin:d(240),checkout:d(242),guests:2,name:'Synthetic Guest',phone:'+79000000000',comment:'synthetic only',consent:true,captchaToken:'synthetic',website:'',idempotency};
  const request=()=>new Request('https://synthetic.example.test/book',{method:'POST',headers:{origin:'https://synthetic.example.test','content-type':'application/json'},body:JSON.stringify(payload)});
  const deps={
    origin:'https://synthetic.example.test',enabled:true,
    clientIp:()=> '192.0.2.42',today:()=>d(0),
    hash:async v=>'synthetic-'+v,rateLimit:async()=>true,verifyCaptcha:async()=>true,
    submit:async(p_widget,p_payload,p_idempotency,p_fingerprint,p_actor)=>{
      await db.query('reset role');
      await db.query('set role service_role');
      const {rows}=await db.query('select booking_submit($1,$2,$3,$4,$5) as result',[p_widget,p_payload,p_idempotency,'f'.repeat(64),'a'.repeat(64)]);
      return rows[0].result;
    }
  };
  const first=await handleWidgetRequest(request(),deps);
  assert.equal(first.status,202);
  const accepted=await first.json();
  assert.equal(accepted.accepted,true);
  const retry=await handleWidgetRequest(request(),deps);
  assert.equal(retry.status,202);
  assert.equal((await retry.json()).requestId,accepted.requestId);
  await db.query('reset role');
  const state=await db.query('select r.status, count(h.id)::int as holds from widget_private.requests r left join widget_private.holds h on h.request_id=r.id where r.id=$1 group by r.id',[accepted.requestId]);
  assert.equal(state.rowCount,1);
  assert.equal(state.rows[0].status,'pending');
  assert.equal(state.rows[0].holds,1);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",['11111111-1111-4111-8111-111111111111']);
  await db.query('set role authenticated');
  const ownerView=await db.query('select booking_owner_list($1) as result',['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);
  const page=ownerView.rows[0].result;
  assert.ok(page.rows.some(row=>row.id===accepted.requestId),'Owner inbox must include widget request');
  assert.ok(!JSON.stringify(page).includes('+79000000000'),'Owner list must mask contact details');
  const transitionKey=randomUUID();
  const confirmed=await db.query('select booking_owner_transition($1,$2,$3,$4) as result',[accepted.requestId,'confirm',1,transitionKey]);
  assert.equal(confirmed.rows[0].result.status,'confirmed','Owner confirmation must succeed');
  await db.query('reset role');
  const reservation=await db.query('select count(*)::int as total from public.reservations where status=$1',['confirmed']);
  assert.equal(reservation.rows[0].total,1,'Owner confirmation must persist one reservation');
  console.log('PASS widget HTTP -> PG17 M2 hold -> owner inbox masked -> owner confirmation -> reservation; retry idempotent');
} finally {await db.end();}
