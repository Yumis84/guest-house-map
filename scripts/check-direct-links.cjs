const {chromium}=require('playwright');
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const data=fs.readFileSync('guest-houses.js','utf8');
const houses=vm.runInNewContext('('+data.match(/window\.GUEST_HOUSES\s*=\s*(\[[\s\S]*?\]);/)[1]+')').filter(h=>h.active!==false);
const site=process.env.PREVIEW_URL||'http://127.0.0.1:8766/';
const dir='/tmp/direct-link-artifacts';fs.mkdirSync(dir,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});let page;
 try{
  for(const viewport of [{width:390,height:844},{width:1366,height:900}]){
   for(const h of houses){
    page=await browser.newPage({viewport});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(site+'?house='+h.id,{waitUntil:'domcontentloaded'});
    await page.locator('#detail.on').waitFor();
    assert.equal((await page.locator('#detail h2').first().textContent()).trim(),h.name);
    await page.waitForFunction(()=>{const img=document.querySelector('#detail .gh-gallery-slide img');return img?.complete&&img.naturalWidth>0});
    if(h.parentId){
      await page.locator('#roomBack').click();
      assert.equal((await page.locator('#detail h2').first().textContent()).trim(),houses.find(p=>p.id===h.parentId).name);
    }
    if(h.id==='house_004'){
      await page.locator('[data-room="house_005"]').first().click();
      assert.equal((await page.locator('#detail h2').first().textContent()).trim(),houses.find(p=>p.id==='house_005').name);
      await page.locator('#roomBack').click();
      assert.equal((await page.locator('#detail h2').first().textContent()).trim(),h.name);
    }
    await page.screenshot({path:`${dir}/catalog-${viewport.width}-${h.id}.png`});
    assert.deepEqual(errors,[]);
    console.log('PASS',viewport.width,h.id,h.name,'exact detail, photo, parent/child navigation');
    await page.close();
   }
   for(const query of ['?house=unknown','?house=','?house=%3Cimg%20onerror%3Dalert(1)%3E','']){
    page=await browser.newPage({viewport});
    await page.goto(site+query,{waitUntil:'networkidle'});
    assert.equal(await page.locator('#detail.on').count(),0);
    assert.ok(await page.locator('.card').count()>0);
    console.log('PASS',viewport.width,'catalog fallback',query);await page.close();
   }
  }
 }catch(e){if(page&&!page.isClosed())await page.screenshot({path:dir+'/failure.png'});throw e}
 finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
