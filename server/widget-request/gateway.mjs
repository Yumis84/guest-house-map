const encoder=new TextEncoder();
async function bodyHash(request){const reader=request.clone().body?.getReader();const chunks=[];let size=0;if(reader)try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await Promise.all([reader.cancel(),request.body?.cancel()]);throw Error('body_too_large');}chunks.push(value);}}finally{reader.releaseLock();}const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');}
const validIp=ip=>typeof ip==='string'&&ip.length<=45&&(/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)?ip.split('.').every(n=>Number(n)<=255):/^[a-fA-F0-9:]+$/.test(ip)&&ip.includes(':'));
async function message(request,timestamp,ip){return encoder.encode([timestamp,request.method,new URL(request.url).pathname,request.headers.get('origin')||'',ip,await bodyHash(request)].join('\n'));}
const key=(secret,uses)=>crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,uses);
// Use only in a server-side ingress that derives IP from its authenticated socket/proxy.
export async function signGateway(request,secret,ip,now=Date.now()){
 if(secret.length<32||!validIp(ip))throw Error('gateway_not_configured');const timestamp=String(Math.floor(now/1000));const signature=await crypto.subtle.sign('HMAC',await key(secret,['sign']),await message(request,timestamp,ip));return {'x-booking-gateway-time':timestamp,'x-booking-client-ip':ip,'x-booking-gateway-signature':[...new Uint8Array(signature)].map(n=>n.toString(16).padStart(2,'0')).join('')};
}
export async function trustedGatewayIp(request,secret,now=Date.now()){
 try{if(secret.length<32)return null;const timestamp=request.headers.get('x-booking-gateway-time'),ip=request.headers.get('x-booking-client-ip'),signature=request.headers.get('x-booking-gateway-signature');if(!/^\d{10}$/.test(timestamp||'')||Math.abs(now/1000-Number(timestamp))>30||!validIp(ip)||!/^[a-f0-9]{64}$/.test(signature||''))return null;const bytes=new Uint8Array(signature.match(/../g).map(x=>parseInt(x,16)));return await crypto.subtle.verify('HMAC',await key(secret,['verify']),bytes,await message(request,timestamp,ip))?ip:null;}catch{return null;}
}
