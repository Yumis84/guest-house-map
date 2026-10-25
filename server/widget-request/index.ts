// Deployment CANDIDATE, not registered/deployed by this repository.
import {handleWidgetRequest} from './handler.mjs';
import {handleAvailability} from './availability.mjs';
const env=(name:string)=>Deno.env.get(name)||'';
const api=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
const origin=env('WIDGET_ORIGIN'),salt=env('WIDGET_HASH_SECRET');
const captchaSecret=env('TURNSTILE_SECRET_KEY'),captchaHostname=env('TURNSTILE_EXPECTED_HOSTNAME');
const trustedHeader=env('WIDGET_TRUSTED_IP_HEADER');
const enabled=env('WIDGET_BOOKING_ENABLED')==='true'&&env('WIDGET_GATEWAY_REVIEWED')==='true'
 &&/^https:\/\/[^/]+\.supabase\.co$/.test(api)&&!!key&&salt.length>=32&&!!captchaSecret&&!!captchaHostname
 &&/^https:\/\/[^/]+$/.test(origin)&&['x-real-ip','x-forwarded-for'].includes(trustedHeader);
async function rpc(name:string,args:unknown){
 const response=await fetch(api+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(8000)});
 if(!response.ok){const data=await response.json().catch(()=>({};
Deno.serve((request:Request)=>new URL(request.url).pathname.endsWith('/availability')?handleAvailability(request,deps):handleWidgetRequest(request,deps));throw {code:data.code};}
 return response.json();
}
async function hash(value:string){
 const secret=await crypto.subtle.importKey('raw',new TextEncoder().encode(salt),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return [...new Uint8Array(await crypto.subtle.sign('HMAC',secret,new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');
}
const deps={
 origin,enabled,
 // Must be a header OVERWRITTEN by the reviewed trusted gateway; never enable
 // based merely on an incoming user-supplied X-Forwarded-For. See deployment notes.
 clientIp:(req:Request)=>req.headers.get(trustedHeader)?.split(',')[0].trim(),
 today:()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kaliningrad',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),
 hash,
 rateLimit:(p_key:string,p_limit:number,p_seconds:number)=>rpc('widget_v2_rate_limit',{p_key,p_limit,p_seconds}),
 verifyCaptcha:async(token:string,ip:string,widgetId:string)=>{
  const result=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:captchaSecret,response:token,remoteip:ip}),signal:AbortSignal.timeout(8000)});
  if(!result.ok)return false;const data=await result.json();
  return data.success===true&&data.hostname===captchaHostname&&data.action==='booking'&&data.cdata===widgetId;
 },
 availability:(p_widget:string,p_start:string,p_end:string)=>rpc('booking_public_availability',{p_widget,p_start,p_end}),
 submit:(p_widget:string,p_payload:unknown,p_idempotency:string,p_fingerprint:string,p_actor:string)=>rpc('booking_submit',{p_widget,p_payload,p_idempotency,p_fingerprint,p_actor})
};
Deno.serve((request:Request)=>new URL(request.url).pathname.endsWith('/availability')?handleAvailability(request,deps):handleWidgetRequest(request,deps));
