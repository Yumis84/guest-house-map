import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve('.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png'};
createServer(async(req,res)=>{
  try {
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,'.'+(path.endsWith('/')?path+'index.html':path));
    const relative=file.slice(root.length+1);
    if(!file.startsWith(root+sep)||relative.split(/[\\/]/).some(p=>p.startsWith('.'))||!types[extname(file)]) throw Error();
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':types[extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(body);
  }catch{res.writeHead(404).end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('Local preview http://127.0.0.1:4173'));
