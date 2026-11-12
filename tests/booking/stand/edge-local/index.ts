// Actual Supabase Edge Runtime test entrypoint; never a production deployment.
import {handleWidgetRequest} from '../../../../server/widget-request/handler.mjs';
import {trustedGatewayIp} from '../../../../server/widget-request/gateway.mjs';
if(Deno.env.get('M4_SYNTHETIC_TEST')!=='true')throw Error('Synthetic runtime only');
const api=Deno.env.get('M4_REST_URL')||'',jwt=Deno.env.get('M4_SERVICE_JWT')||'',secret=Deno.env.get('M4_GATEWAY_SECRET')||'';
if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(api)||secret.length<32)throw Error('Loopback required');
async function rpc(name:string,args:unknown){const r=await fetch(api+'/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:JSON.stringify(args)});const data=await r.json();if(!r.ok)throw {code:data.code};return data;}
Deno.serve(async(request:Request)=>{
 if(request.method==='GET')return Response.json({runtime:'actual supabase/edge-runtime',synthetic:true});
 const ip=await trustedGatewayIp(request,secret);if(!ip)return Response.json({error:'gateway_not_verified'},{status:403});
 return handleWidgetRequest(request,{enabled:true,origin:'https://synthetic.example.test',clientIp:()=>ip,today:()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kaliningrad'}).format(new Date()),hash:async(value:string)=>{const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',k,new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('');},rateLimit:(p_key:string,p_limit:number,p_seconds:number)=>rpc('widget_v2_rate_limit',{p_key,p_limit,p_seconds}),verifyCaptcha:async(token:string)=>token==='synthetic-pass',submit:(p_widget:string,p_payload:unknown,p_idempotency:string,p_fingerprint:string,p_actor:string)=>rpc('booking_submit',{p_widget,p_payload,p_idempotency,p_fingerprint,p_actor})});
});
