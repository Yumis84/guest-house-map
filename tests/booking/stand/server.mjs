// Loopback-only SYNTHETIC stand. Not a deployable Auth server or production gateway.
import {createServer} from 'node:https';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {randomBytes,createHmac} from 'node:crypto';
import {safeTestDatabaseUrl} from '../safe-test-db-url.mjs';
import {seed,ids} from './seed.mjs';
import {seedM4} from './seed-m4.mjs';
import {handleWidgetRequest} from '../../../server/widget-request/handler.mjs';
import {handleAvailability} from '../../../server/widget-request/availability.mjs';
const require=createRequire(import.meta.url),{Client}=require('pg');
const uri=process.env.BOOKING_TEST_DATABASE_URL;safeTestDatabaseUrl(uri);
if(!process.env.POSTGREST_BIN||!process.env.M3_TLS_KEY||!process.env.M3_TLS_CERT)throw Error('Requires PostgREST binary and ephemeral localhost TLS certificate');
const db=new Client({connectionString:uri});await db.connect();const widget=process.env.M4_STAND==='true'?await seedM4(db,{active:true}):await seed(db);const restPassword=randomBytes(24).toString('hex');await db.query("alter role synthetic_authenticator password '"+restPassword+"'");await db.end();
const secret=randomBytes(48).toString('hex'),jwt=(claims)=>{const b=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const data=b({alg:'HS256',typ:'JWT'})+'.'+b({iss:'synthetic-local',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,...claims});return data+'.'+createHmac('sha256',secret).update(data).digest('base64url');};
const anon=jwt({role:'anon'}),service=jwt({role:'service_role'}),owner=jwt({role:'authenticated',sub:ids.owner,aud:'authenticated'}),other=jwt({role:'authenticated',sub:ids.other,aud:'authenticated'});
const pgurl=new URL(uri);pgurl.username='synthetic_authenticator';pgurl.password=restPassword;
const pgport=process.env.M3_REST_PORT||'55441',port=Number(process.env.M3_PORT||55440),base='https://127.0.0.1:'+port;
const rest=spawn(process.env.POSTGREST_BIN,[],{env:{...process.env,PGRST_DB_URI:pgurl.href,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret,PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:pgport,PGRST_DB_POOL:'8'},stdio:['ignore','pipe','pipe']});
let restErrors='';rest.stderr.on('data',b=>{restErrors+=b;});rest.stdout.on('data',b=>{restErrors+=b;});rest.on('error',e=>{restErrors+=e.message;});
for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:'+pgport+'/');if(r.ok)break;}catch{}if(i===99)throw Error('PostgREST unavailable '+restErrors);await new Promise(r=>setTimeout(r,100));}
const root=resolve('.');let disabled=false,failNext=false;
async function rpc(name,args,token=service){const r=await fetch(`http://127.0.0.1:${pgport}/rpc/${name}`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args)});const data=await r.json();if(!r.ok)throw {code:data.code,message:data.message};return data;}
const deps={origin:base,enabled:true,clientIp:()=> '192.0.2.42',today:()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kaliningrad'}).format(new Date()),hash:async value=>createHmac('sha256',secret).update(value).digest('hex'),rateLimit:(p_key,p_limit,p_seconds)=>rpc('widget_v2_rate_limit',{p_key,p_limit,p_seconds}),verifyCaptcha:async token=>token==='synthetic-pass',submit:(p_widget,p_payload,p_idempotency,p_fingerprint,p_actor)=>rpc('booking_submit',{p_widget,p_payload,p_idempotency,p_fingerprint,p_actor}),availability:(p_widget,p_start,p_end)=>rpc('booking_public_availability',{p_widget,p_start,p_end})};
const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
function verified(token){try{const [h,p,s]=token.split('.');if(createHmac('sha256',secret).update(h+'.'+p).digest('base64url')!==s)return null;const c=JSON.parse(Buffer.from(p,'base64url'));return c.exp>Date.now()/1000?c:null;}catch{return null;}}
const server=createServer({key:await readFile(process.env.M3_TLS_KEY),cert:await readFile(process.env.M3_TLS_CERT)},async(req,res)=>{try{
 const url=new URL(req.url,base),path=url.pathname;
 if(path==='/synthetic-owner'){res.writeHead(200,{'Content-Type':'text/html'});res.end(`<title>Синтетический стенд</title><h1>Только синтетические данные</h1><a href="/widget/v2.html?id=${widget.public_id}">Форма гостя</a><br><a href="/booking-owner.html">Кабинет владельца</a><script>localStorage.setItem('sb-127-auth-token',JSON.stringify({access_token:'${owner}',refresh_token:'synthetic-no-refresh',expires_at:${Math.floor(Date.now()/1000)+3600},token_type:'bearer',user:{id:'${ids.owner}',aud:'authenticated'}}));</script>`);return;}
 if(path==='/synthetic-meta')return json(res,200,{widget:widget.public_id,property:ids.property,other,expired:jwt({role:'authenticated',sub:ids.owner,exp:1}),note:'SYNTHETIC local JWTs; no service key'});
 if(path==='/synthetic-control'&&req.method==='POST'){let body='';for await(const b of req)body+=b;if(body==='disable')disabled=true;if(body==='enable')disabled=false;if(body==='fail-next')failNext=true;return json(res,200,{synthetic:true});}
 if(path==='/auth/v1/user'){const c=verified((req.headers.authorization||'').replace('Bearer ',''));return c?.role==='authenticated'?json(res,200,{id:c.sub,aud:'authenticated',role:'authenticated',email:'synthetic@example.test'}):json(res,401,{message:'Unauthorized'});}
 if(path==='/supabase-public-config.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(`window.GUEST_HOUSE_SUPABASE_CONFIG=${JSON.stringify({url:base,publishableKey:anon})};`);return;}
 if(path==='/widget/v2-runtime.js'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(`window.GUEST_WIDGET_V2_RUNTIME={endpoint:'${base}/gateway',siteKey:'synthetic-only'};window.turnstile={render:(s,o)=>{window.__syntheticCaptcha=o.callback;setTimeout(()=>o.callback('synthetic-pass'),0);return 'synthetic';},reset:()=>setTimeout(()=>window.__syntheticCaptcha('synthetic-pass'),0)};`);return;}
 if(path.startsWith('/rest/v1/')){let body='';for await(const b of req)body+=b;const r=await fetch('http://127.0.0.1:'+pgport+path.slice('/rest/v1'.length)+url.search,{method:req.method,headers:{Authorization:req.headers.authorization||'Bearer '+anon,'Content-Type':'application/json'},...(body?{body}: {})});res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')||'application/json'});res.end(await r.text());return;}
 if(path==='/gateway'||path==='/gateway/availability'){let body='';for await(const b of req){body+=b;if(body.length>8192)return json(res,413,{error:'invalid_payload'});}if(failNext){failNext=false;return json(res,503,{error:'synthetic_network_failure'});}const r=await (path.endsWith('/availability')?handleAvailability:handleWidgetRequest)(new Request(base+path,{method:req.method,headers:{origin:req.headers.origin||'', 'content-type':req.headers['content-type']||''},...(body?{body}:{})}),{...deps,enabled:!disabled});res.writeHead(r.status,Object.fromEntries(r.headers));res.end(await r.text());return;}
 const allowed=['/booking-owner.html','/booking-owner.js','/booking-owner.css','/booking-calendar.js','/owner-common.js','/owner-access.js','/vendor/supabase.js','/widget/v2.html','/widget/v2.js','/widget/v2-core.js','/widget/v2.css'];if(!allowed.includes(path))return json(res,404,{error:'not_found'});
 const file=resolve(root,'.'+decodeURIComponent(path));if(!file.startsWith(root+sep)||!['.html','.js','.css','.svg'].includes(extname(file)))return json(res,404,{error:'not_found'});
 res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[extname(file)]});res.end(await readFile(file));
 }catch{json(res,503,{error:'synthetic_stand_unavailable'});}});
await new Promise(r=>server.listen(port,'127.0.0.1',r));console.log('READY '+base+'/synthetic-owner');
const shutdown=()=>{server.close();rest.kill();};process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
