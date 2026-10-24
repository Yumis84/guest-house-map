// Set PLAYWRIGHT_MODULE to an absolute playwright/index.mjs path if not installed locally.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {STEPAN_ID,generateEmbed} from './owner-widget-code.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const root=new URL('./',import.meta.url);
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;const url=new URL('.'+decodeURIComponent(path),root);if(!url.href.startsWith(root.href))throw Error();const data=await readFile(url);res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'text/html');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(process.env.BROWSER_EXECUTABLE?{executablePath:process.env.BROWSER_EXECUTABLE}:{});
try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let mode='owner';
  await page.route('**/vendor/supabase.js',route=>route.fulfill({contentType:'text/javascript',body:`window.supabase={createClient:()=>({auth:{getUser:async()=>({data:{user:${'USER'}}})},from:table=>{const data=table==='properties'?${JSON.stringify([{id:STEPAN_ID,name:'У Степана',company_id:'c'},{id:'other',name:'Другой дом',company_id:'c'}])}:table==='company_members'?[{company_id:'c',member_role:'owner'}]:null;const q={};for(const m of ['select','eq','in','order','limit'])q[m]=()=>q;q.maybeSingle=async()=>({data:null});q.then=fn=>Promise.resolve({data}).then(fn);return q;}})};`.replace('USER',mode==='signedout'?'null':JSON.stringify({id:'test-user',email:'test@example.test'}))}));
  // No production booking writes: render the repository's existing widget with a read-only fixture.
  await page.route('https://yumis84.github.io/guest-house-map/widget/booking.html*',async route=>route.fulfill({contentType:'text/html',body:await readFile(new URL('./widget/booking.html',root),'utf8')}));
  await page.route('https://ojifyifewlwzkysgxogo.supabase.co/**',route=>{assert.ok(route.request().url().endsWith('/stepan_widget_blocks'),'Never submit a booking');return route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'[]'});});
  for(const width of [1440,375]){
    await page.setViewportSize({width,height:1000});await page.goto(base+'/owner.html?viewport='+width+'#widget');
    await page.waitForFunction(()=>!document.getElementById('widgetCopy').disabled);
    assert.equal(await page.locator('[data-view="widget"]').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const preview=page.frameLocator('#widgetPreview');
    await preview.locator('iframe').waitFor();
    await page.selectOption('#widgetType','compact');await preview.locator('summary').click();assert.ok(await preview.locator('details').getAttribute('open')!==null);
    await page.selectOption('#widgetType','button');assert.ok((await preview.locator('a').getAttribute('href')).includes(STEPAN_ID));
    await page.selectOption('#widgetProperty','other');assert.equal(await page.locator('#widgetCopy').isDisabled(),true);assert.equal(await page.locator('#widgetCode').inputValue(),'');
    await page.selectOption('#widgetProperty',STEPAN_ID);await page.selectOption('#widgetType','calendar');
    await page.fill('#widgetWidth','999');assert.equal(await page.locator('#widgetCopy').isDisabled(),true);await page.fill('#widgetWidth','720');
    await page.selectOption('#widgetViewport','mobile');
    await preview.frameLocator('iframe').locator('#calendarDays .day[data-date]').first().waitFor({timeout:10000}).catch(async e=>{console.log(await Promise.all(page.frames().map(async f=>({url:f.url(),body:await f.locator('body').innerText().catch(()=>'' )}))));throw e;});
    const embedded=preview.frameLocator('iframe');
    await embedded.locator('#bookingSubmit').scrollIntoViewIfNeeded();
    for(let month=0;month<12;month++){await embedded.locator('#nextMonth').click();if(await embedded.locator('#calendarDays .day').count()>35)break;}
    assert.ok(await embedded.locator('#calendarDays .day').count()>35,'Six-row month rendered');
    const actualHeight=await embedded.locator('.widget').evaluate(el=>Math.ceil(el.getBoundingClientRect().bottom)+12);
    await page.waitForTimeout(100);
    const frameHeight=await preview.locator('iframe').evaluate(el=>parseFloat(el.style.height));
    assert.ok(frameHeight>=actualHeight,`Auto height ${frameHeight} must cover ${actualHeight}`);
    await mkdir(new URL('./test-results/',root),{recursive:true});await page.screenshot({path:fileURLToPath(new URL(`./test-results/widget-${width}.png`,root)),fullPage:true});
  }
  mode='signedout';await page.goto(base+'/owner.html#widget');await page.waitForURL('**/login.html');
  assert.deepEqual(errors,[]);console.log('PASS: desktop/mobile owner navigation, scoped selection, 3 live previews, invalid settings, unavailable object, auth redirect, no booking writes.');
}finally{await browser.close();server.close();}

