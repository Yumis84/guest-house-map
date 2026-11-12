// Isolated UI harness. Mock Auth mode is explicitly NOT Supabase Auth acceptance.
import {createServer} from 'node:http';import {readFile} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';
const root=resolve(new URL('../../../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));
export async function startUI({port=55810,auth,rest,anon}={}){
 const server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1:'+port),path=url.pathname;
  const json=(code,obj)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(obj));};
  if(path==='/supabase-public-config.js'){res.setHeader('Content-Type','text/javascript');res.end(`window.GUEST_HOUSE_SUPABASE_CONFIG=${JSON.stringify({url:'http://127.0.0.1:'+port,publishableKey:anon||'sb_publishable_synthetic_only'})}`);return;}
  if(path.startsWith('/auth/v1/')&&auth||path.startsWith('/rest/v1/')&&rest){const target=path.startsWith('/auth/')?auth+path.slice('/auth/v1'.length):rest+path.slice('/rest/v1'.length);let body='';for await(const b of req)body+=b;const h={'Content-Type':'application/json',...(req.headers.authorization?{Authorization:req.headers.authorization}:{})};const r=await fetch(target+url.search,{method:req.method,headers:h,...(body?{body}:{})});res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')||'application/json',...(r.headers.get('x-supabase-api-version')?{'X-Supabase-Api-Version':r.headers.get('x-supabase-api-version')}:{})});res.end(await r.text());return;}
  if(!['GET','HEAD'].includes(req.method))return json(405,{error:'test_proxy_not_configured'});
  const file=resolve(root,'.'+decodeURIComponent(path==='/'?'/index.html':path));
  if(!file.startsWith(root+sep)||!['.html','.js','.css','.svg','.png','.jpg','.webp','.json'].includes(extname(file))||path.includes('test-results')||path.includes('node_modules')||path.includes('/.'))return json(404,{});
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(503);res.end('Isolated test service unavailable');}});
 await new Promise(r=>server.listen(port,'127.0.0.1',r));return {server,base:'http://127.0.0.1:'+port};
}
