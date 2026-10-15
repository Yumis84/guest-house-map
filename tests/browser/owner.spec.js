import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const user={id:'20000000-0000-0000-0000-000000000001',aud:'authenticated',role:'authenticated',email:'owner@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'email'},user_metadata:{}};
const company='10000000-0000-0000-0000-000000000001';
const property={id:'30000000-0000-0000-0000-000000000001',company_id:company,name:'Дом в Краснолесье',description:'Тихий дом у леса',published:false,contact_phone:null,contact_email:null,website_url:null,owner_revision:0};
const session=()=>({access_token:'test.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})).toString('base64url')+'.signature',refresh_token:'fixture-only',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user});
async function setup(page,opts={}){
 const requests=[],state={property:{...property},photos:[]};
 // Deny all non-local network, including existing n8n integrations and map tile providers.
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='127.0.0.1')return route.continue();
  if(url.hostname==='unpkg.com'&&url.pathname.includes('leaflet@1.9.4')){
   const file=url.pathname.endsWith('.css')?'leaflet.css':'leaflet.js';
   return route.fulfill({body:await readFile('node_modules/leaflet/dist/'+file),contentType:file.endsWith('css')?'text/css':'text/javascript'});
  }
  if(url.hostname!=='owner-test.supabase.co')return route.abort();
  const req=route.request(),method=req.method(),body=req.headers()['content-type']?.includes('application/json')?req.postDataJSON():null;requests.push({url:url.pathname,method,body,query:url.search});
  const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(url.pathname==='/auth/v1/user')return opts.expired?json({message:'expired'},401):json(user);
  if(url.pathname==='/auth/v1/token')return opts.badLogin?json({msg:'Invalid login credentials'},400):json(session());
  if(url.pathname==='/auth/v1/signup')return json({user,session:null});
  if(url.pathname==='/auth/v1/recover')return json({});
  if(url.pathname==='/auth/v1/logout')return opts.logoutFail?json({message:'logout failed'},400):json({});
  if(url.pathname==='/rest/v1/company_members')return opts.membershipError?json({code:'42501'},403):json(opts.noMembership?[]:[{company_id:company,member_role:opts.viewer?'viewer':'owner'}]);
  if(url.pathname==='/rest/v1/rpc/owner_cabinet_version')return opts.noMigration?json({code:'PGRST202'},404):json(1);
  if(url.pathname==='/rest/v1/properties'){
   if(method==='PATCH'){if(opts.conflict)return json(null);state.property={...state.property,...body,owner_revision:state.property.owner_revision+1};return json(state.property);}
   return json(opts.empty?[]:[state.property]);
  }
  if(url.pathname==='/storage/v1/object/list/owner-property-photos')return json(state.photos);
  if(url.pathname.startsWith('/storage/v1/object/sign/'))return json({signedURL:'/object/sign/owner-property-photos/test?token=fixture'});
  if(url.pathname.startsWith('/storage/v1/object/owner-property-photos/')){
   if(method==='POST'){const name=url.pathname.split('/').at(-1);state.photos.push({id:'photo',name});return json({Key:company+'/'+property.id+'/'+name});}
   return route.fulfill({body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrQAAAABJRU5ErkJggg==','base64'),contentType:'image/png'});
  }
  if(url.pathname==='/storage/v1/object/owner-property-photos'&&method==='DELETE'){state.photos=[];return json([{name:body.prefixes[0]}]);}
  return json({});
 });
 await page.route('**/supabase-public-config.js',r=>r.fulfill({contentType:'text/javascript',body:"window.GUEST_HOUSE_SUPABASE_CONFIG={url:'https://owner-test.supabase.co',publishableKey:'sb_publishable_fixture'};"}));
 if(opts.signedIn!==false)await page.addInitScript(s=>{if(!sessionStorage.getItem('fixture-seeded')){localStorage.setItem('sb-owner-test-auth-token',JSON.stringify(s));sessionStorage.setItem('fixture-seeded','1');}},session());
 return {requests,state};
}
test('unconfigured page fails closed',async({page})=>{
 await page.goto('/login.html');await expect(page.locator('#submit')).toBeDisabled();await expect(page.locator('#status')).toContainText('не настроено');
});
test('signed-out owner redirects to login',async({page})=>{
 await setup(page,{signedIn:false});await page.goto('/owner.html');await expect(page).toHaveURL(/login.html/);
});
test('sign in and logout, no private content after logout',async({page})=>{
 await setup(page,{signedIn:false});await page.goto('/login.html');await page.getByLabel('Email',{exact:true}).fill('owner@example.test');await page.getByLabel('Пароль',{exact:true}).fill('strong-password');
 await page.locator('#submit').click();await expect(page).toHaveURL(/owner.html/);await expect(page.locator('#properties')).toContainText(property.name);
 await page.locator('#signout').click();await expect(page).toHaveURL(/login.html/);
});
test('bad password stays on login and permits retry',async({page})=>{
 await setup(page,{signedIn:false,badLogin:true});await page.goto('/login.html');await page.locator('#email').fill('owner@example.test');await page.locator('#password').fill('incorrect');await page.locator('#submit').click();await expect(page.locator('#status')).toContainText('Не удалось войти');await expect(page.locator('#submit')).toBeEnabled();
});
test('registration has confirmation and never assigns membership',async({page})=>{
 const {requests}=await setup(page,{signedIn:false});await page.goto('/login.html');await page.locator('#signup').click();await page.locator('#email').fill('new@example.test');await page.locator('#password').fill('strong-password');await page.locator('#confirm').fill('different');await page.locator('#submit').click();await expect(page.locator('#status')).toContainText('не совпадают');
 await page.locator('#confirm').fill('strong-password');await page.locator('#submit').click();await expect(page.locator('#status')).toContainText('подтвердите адрес');expect(requests.some(r=>r.url.includes('company_members'))).toBeFalsy();
});
test('recovery request uses fixed same-origin callback',async({page})=>{
 const {requests}=await setup(page,{signedIn:false});await page.goto('/login.html');await page.locator('#recovery').click();await page.locator('#email').fill('owner@example.test');await page.locator('#submit').click();await expect(page.locator('#status')).toContainText('Если адрес зарегистрирован');
 const req=requests.find(r=>r.url==='/auth/v1/recover');expect(decodeURIComponent(req.query)).toContain('http://127.0.0.1:4173/login.html?flow=recovery');
});
test('valid recovery session updates password',async({page})=>{
 const {requests}=await setup(page);await page.goto('/login.html?flow=recovery');await expect(page.locator('#formTitle')).toHaveText('Новый пароль');await page.locator('#password').fill('new-strong-password');await page.locator('#confirm').fill('new-strong-password');await page.locator('#submit').click();await expect(page.locator('#status')).toContainText('Пароль обновлён');expect(requests.some(r=>r.url==='/auth/v1/user'&&r.method==='PUT')).toBeTruthy();
});
for(const [label,opts,text] of [['no membership',{noMembership:true},'Доступ к объектам пока не выдан'],['missing grants',{membershipError:true},'Не удалось загрузить объекты'],['migration missing',{noMigration:true},'Кабинет ожидает настройки'],['empty company',{empty:true},'У вашей компании пока нет объектов.']]){
 test(label,async({page})=>{await setup(page,opts);await page.goto('/owner.html');await expect(page.locator('#dashboard')).toContainText(text);await expect(page.locator('#editor')).toBeHidden();});
}
test('viewer can inspect but cannot edit',async({page})=>{
 await setup(page,{viewer:true});await page.goto('/owner.html');await page.getByRole('button',{name:'Просмотреть',exact:true}).click();await expect(page.locator('#name')).toBeDisabled();await expect(page.locator('#uploadControls')).toBeHidden();await expect(page.locator('#save')).toBeDisabled();
});
test('save allowlisted fields with version check and literal XSS text',async({page})=>{
 const {requests}=await setup(page);await page.goto('/owner.html');await page.getByRole('button',{name:'Открыть и изменить'}).click();await page.locator('#name').fill('<img src=x onerror=alert(1)>');await page.locator('#contact_phone').fill('+7 900 123-45-67');await page.locator('#save').click();await expect(page.locator('#editorStatus')).toHaveText('Изменения сохранены.');await expect(page.locator('#properties img')).toHaveCount(0);const r=requests.find(r=>r.method==='PATCH');expect(r.body.company_id).toBeUndefined();expect(r.query).toContain('owner_revision=eq.0');expect(r.query).toContain('company_id=eq.');
});
test('concurrent update is reported instead of false success',async({page})=>{
 await setup(page,{conflict:true});await page.goto('/owner.html');await page.getByRole('button',{name:'Открыть и изменить'}).click();await page.locator('#name').fill('Changed');await page.locator('#save').click();await expect(page.locator('#editorStatus')).toContainText('изменён другим пользователем');
});
test('private photo upload re-encodes and scopes paths, then deletes',async({page})=>{
 const {requests}=await setup(page);await page.goto('/owner.html');await page.getByRole('button',{name:'Открыть и изменить'}).click();
 await page.locator('#photo').setInputFiles({name:'attack.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await page.locator('#upload').click();await expect(page.locator('#photoStatus')).toContainText('JPEG');
 const png=await page.screenshot();await page.locator('#photo').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});await page.locator('#upload').click();await expect(page.getByRole('button',{name:'Удалить фото'})).toBeVisible();
 expect(requests.find(r=>r.method==='POST'&&r.url.startsWith('/storage/v1/object/owner-property-photos/')).url).toMatch(new RegExp(company+'/'+property.id+'/[0-9a-f-]+.webp$'));
 page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Удалить фото'}).click();await expect(page.locator('#photos figure')).toHaveCount(0);
});
test('layout and screenshot',async({page},testInfo)=>{
 await setup(page);await page.goto('/owner.html');await page.getByRole('button',{name:'Открыть и изменить'}).click();await expect(page.locator('#photoStatus')).toHaveText('Фотографий пока нет.');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.artifacts/owner-'+testInfo.project.name+'.png',fullPage:true});
 await page.goto('/login.html?flow=recovery');await expect(page.locator('#formTitle')).toHaveText('Новый пароль');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.artifacts/auth-'+testInfo.project.name+'.png',fullPage:true});
});
test('catalog real addresses and visible markers stay synchronized',async({page})=>{
 await setup(page,{signedIn:false});await page.goto('/');await page.locator('[data-s=catalog]').click();
 for(const [locality,count] of [['Краснолесье',3],['Дмитриевка',2],['Сосновка',1],['Чистые Пруды',1],['',7]]){
  await page.locator('#catalogLocality').selectOption(locality);await expect(page.locator('#list > .item')).toHaveCount(count);
  await expect.poll(()=>page.evaluate(()=>Object.entries(markers).filter(([,m])=>map.hasLayer(m)).map(([id])=>id).sort().join(','))).toBe(await page.evaluate(()=>filtered().map(h=>h.id).sort().join(',')));
 }
});

test('invalid recovery callback cannot update password',async({page})=>{
 const {requests}=await setup(page,{signedIn:false});await page.goto('/login.html?flow=recovery');await expect(page.locator('#status')).toContainText('Ссылка недействительна');await expect(page.locator('#passwordField')).toBeHidden();expect(requests.some(r=>r.method==='PUT')).toBeFalsy();
});
test('expired session never reveals properties',async({page})=>{
 await setup(page,{expired:true});await page.goto('/owner.html');await expect(page).toHaveURL(/login.html/);await expect(page.locator('#properties')).toHaveCount(0);
});
test('failed server logout clears local data and explains the result',async({page})=>{
 await setup(page,{logoutFail:true});await page.goto('/owner.html');await expect(page.locator('#properties')).toContainText(property.name);await page.locator('#signout').click();await expect(page).toHaveURL(/login.html/);await expect(page.locator('#status')).toContainText('Вы вышли на этом устройстве');await expect(page.locator('#properties')).toHaveCount(0);
});
test('cross-tab signout clears the private editor',async({page})=>{
 await setup(page);await page.goto('/owner.html');await page.getByRole('button',{name:'Открыть и изменить'}).click();
 await page.evaluate(()=>{localStorage.removeItem('sb-owner-test-auth-token');window.dispatchEvent(new StorageEvent('storage',{key:'sb-owner-test-auth-token',newValue:null}));});
 await expect(page).toHaveURL(/login.html/);
});
test('PKCE recovery callback exchanges code and clears callback URL',async({page})=>{
 const {requests}=await setup(page,{signedIn:false});
 await page.addInitScript(()=>localStorage.setItem('sb-owner-test-auth-token-code-verifier',JSON.stringify('fixture-verifier/PASSWORD_RECOVERY')));
 await page.goto('/login.html?flow=recovery&code=fixture-auth-code');
 await expect(page.locator('#formTitle')).toHaveText('Новый пароль');expect(requests.some(r=>r.url==='/auth/v1/token'&&r.query.includes('pkce'))).toBeTruthy();expect(page.url()).not.toContain('code=');
});
