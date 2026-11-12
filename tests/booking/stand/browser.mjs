import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {safeTestDatabaseUrl} from '../safe-test-db-url.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE_PATH||'playwright'),{Client}=require('pg');
const base=process.env.M3_BASE||'https://127.0.0.1:55440';assert.match(base,/^https:\/\/127\.0\.0\.1:\d+$/);
safeTestDatabaseUrl(process.env.BOOKING_TEST_DATABASE_URL);
const db=new Client({connectionString:process.env.BOOKING_TEST_DATABASE_URL});await db.connect();
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE});const context=await browser.newContext({ignoreHTTPSErrors:true});const page=await context.newPage();
const results=[],test=async(name,fn)=>{await fn();results.push({name,result:'PASS'});console.log('PASS',name);};
const wait=async(selector,part)=>page.waitForFunction(([s,p])=>document.querySelector(s)?.textContent.includes(p),[selector,part]);
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
const control=body=>context.request.post(base+'/synthetic-control',{data:body});
let meta,requestId;const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await mkdir('test-results/m3',{recursive:true});await page.goto(base+'/synthetic-owner');meta=await(await context.request.get(base+'/synthetic-meta')).json();
 await test('real browser public month calendar at 320/390/768/1440',async()=>{
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.goto(base+'/widget/v2.html?id='+meta.widget);await page.locator('#form').waitFor({state:'visible'});assert.equal(await page.locator('#month .day').count(),new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if([390,1440].includes(width))await page.screenshot({path:`test-results/m3/guest-${width}.png`,fullPage:true});}
 });
 await test('browser submit network failure then retry keeps key; HTTP handler -> real PostgREST -> hold',async()=>{
  await page.fill('#checkin',day(10));await page.fill('#checkout',day(12));await page.fill('#name','Synthetic Guest');await page.fill('#phone','+79000001234');await page.check('#consent');
  const keys=[];page.on('request',r=>{if(r.url()===base+'/gateway'&&r.method()==='POST')keys.push(r.postDataJSON().idempotency);});
  await control('fail-next');await page.click('#submit');await wait('#status','Отправка не подтверждена');
  const response=page.waitForResponse(r=>r.url()===base+'/gateway'&&r.status()===202);await page.click('#submit');requestId=(await(await response).json()).requestId;await wait('#status','Заявка получена');assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);
  const r=(await db.query('select status,expires_at-accepted_at as duration from widget_private.holds where request_id=$1',[requestId])).rows[0];assert.equal(r.status,'active');assert.equal(r.duration.minutes,15);
 });
 await test('owner real SDK session contract -> PostgREST/RLS: masked list/detail, explicit contacts, confirm',async()=>{
  await page.goto(base+'/booking-owner.html');await page.getByRole('button',{name:'Подробнее'}).first().waitFor();assert.ok(!(await page.locator('#rows').innerText()).includes('+79000001234'));
  await page.getByRole('button',{name:'Подробнее'}).first().click();assert.ok(!(await page.locator('#detailBody').innerText()).includes('+79000001234'));await page.getByRole('button',{name:'Показать контакты'}).click();await wait('#detailBody','+79000001234');await page.getByRole('button',{name:'Подтвердить — проверить даты'}).click();await wait('#detailBody','Подтверждена');await page.click('#close');
  assert.equal((await db.query("select count(*)::int n from reservations where status='confirmed'")).rows[0].n,1);
 });
 await test('owner calendar, unit switch, keyboard and widths; cancellation preserves reservation',async()=>{
  await page.locator('[data-view="calendar"]').click();await page.locator('#calendarUnit option').waitFor({state:'attached'});if(day(10).slice(0,7)!==new Date().toISOString().slice(0,7))await page.click('#next');await page.locator(`#month [data-date="${day(10)}"]`).waitFor();assert.ok((await page.locator(`#month [data-date="${day(10)}"]`).innerText()).includes('Бронь'));
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  const date=page.locator(`#month [data-date="${day(10)}"]`);await date.focus();await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>document.activeElement.dataset.date),day(11));await date.click();await page.getByRole('button',{name:'Открыть заявку'}).click();await page.getByRole('button',{name:'Отменить бронь'}).click();await wait('#detailBody','Отменена');await page.click('#close');assert.equal((await db.query("select count(*)::int n from reservations where status='cancelled' and idempotency_key like 'widget-request:%'")).rows[0].n,1);
 });
 await test('manual block server RPC, idempotency, calendar source and soft removal',async()=>{
  await page.locator('#manualControls summary').click();await page.fill('#blockStart',day(10));await page.fill('#blockEnd',day(12));await page.click('#blockSubmit');await wait('#status','Данные обновлены');await page.waitForFunction(d=>document.querySelector(`[data-date="${d}"]`)?.textContent.includes('Блок'),day(10));await page.locator(`#month [data-date="${day(10)}"]`).click();await page.getByRole('button',{name:'Снять ручную блокировку'}).click();await page.waitForFunction(()=>!document.querySelector('#detail').open);assert.equal((await db.query('select count(*)::int n from unit_blocks where released_at is not null')).rows[0].n,1);
 });
 await test('PostgREST JWT signature/expiry and owner isolation; no guest contacts leaked',async()=>{
  const post=(name,args,token)=>context.request.post(base+'/rest/v1/rpc/'+name,{headers:{Authorization:'Bearer '+token},data:args});
  let r=await post('booking_owner_detail',{p_id:requestId},meta.other);assert.equal((await r.json()).message,'not_found');assert.ok(!(await r.text()).includes('+79000001234'));
  r=await post('booking_owner_detail',{p_id:requestId},meta.expired);assert.equal(r.status(),401);
  r=await post('booking_owner_detail',{p_id:requestId},meta.other+'tamper');assert.equal(r.status(),401);
  const anon=await page.evaluate(()=>window.GUEST_HOUSE_SUPABASE_CONFIG.publishableKey);r=await post('booking_owner_contacts',{p_id:requestId},anon);assert.ok([401,403].includes(r.status()));
 });
 await test('expired hold retains pending request; owner late confirm repeats atomic availability',async()=>{
  await page.goto(base+'/widget/v2.html?id='+meta.widget);await page.locator('#form').waitFor({state:'visible'});await page.fill('#checkin',day(20));await page.fill('#checkout',day(22));await page.fill('#name','Synthetic Late');await page.fill('#phone','+79000005678');await page.check('#consent');const response=page.waitForResponse(r=>r.url()===base+'/gateway'&&r.status()===202);await page.click('#submit');const id=(await(await response).json()).requestId;
  await db.query("with t as(select clock_timestamp() n) update widget_private.holds set accepted_at=t.n-interval '16 minutes',expires_at=t.n-interval '1 minute' from t where request_id=$1",[id]);await db.query('select booking_expire_holds()');
  await page.goto(base+'/booking-owner.html');await page.getByRole('button',{name:'Подробнее'}).first().click();await wait('#detailBody','Удержание истекло');await wait('#detailBody','На рассмотрении');await page.getByRole('button',{name:'Подтвердить — проверить даты'}).click();await wait('#detailBody','Подтверждена');await page.click('#close');
 });
 await test('disabled gateway fails closed and no JavaScript errors',async()=>{await control('disable');await page.goto(base+'/widget/v2.html?id='+meta.widget);await wait('#status','Приём заявок недоступен');assert.equal(await page.locator('#form').isVisible(),false);await control('enable');assert.deepEqual(errors,[]);});
 await mkdir('test-results/m3',{recursive:true});await page.goto(base+'/booking-owner.html');await page.locator('[data-view="calendar"]').click();await page.locator('#month .day').first().waitFor();if(day(20).slice(0,7)!==new Date().toISOString().slice(0,7))await page.click('#next');await page.waitForFunction(d=>document.querySelector(`[data-date="${d}"]`)?.textContent.includes('Бронь'),day(20));for(const width of [390,1440]){await page.setViewportSize({width,height:900});await page.screenshot({path:`test-results/m3/owner-${width}.png`,fullPage:true});}
 await writeFile('test-results/m3/browser.json',JSON.stringify({base,postgrest:'16.5',auth:'Synthetic signed JWT + Auth getUser contract; NOT GoTrue',captcha:'Synthetic provider; NOT real Turnstile',results},null,2));console.log('PASS',results.length,'browser/real PostgREST integration groups');
}finally{await db.end();await browser.close();}
