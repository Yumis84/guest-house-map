const ID=/^[a-f0-9]{32}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function normalizePayload(body,today){
 if(!body||Array.isArray(body)||Object.keys(body).some(k=>!['widgetId','checkin','checkout','guests','name','phone','comment','consent','captchaToken','website','idempotency'].includes(k)))throw Error('invalid_payload');
 if(!ID.test(body.widgetId)||!UUID.test(body.idempotency)||typeof body.captchaToken!=='string'||body.captchaToken.length<1||body.captchaToken.length>2048||body.website)throw Error('invalid_payload');
 const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 if(!validDate(body.checkin)||!validDate(body.checkout))throw Error('invalid_dates');
 const nights=(Date.parse(body.checkout)-Date.parse(body.checkin))/86400000;
 if(body.checkin<today||nights<1||nights>30||(Date.parse(body.checkin)-Date.parse(today))/86400000>365)throw Error('invalid_dates');
 if(!Number.isInteger(body.guests)||body.guests<1||body.guests>100||typeof body.name!=='string'||body.name.trim().length<1||body.name.trim().length>120||typeof body.phone!=='string'||body.phone.length>40||typeof body.comment!=='string'||body.comment.length>1000||body.consent!==true)throw Error('invalid_payload');
 const phone=body.phone.replace(/[\s()-]/g,'');if(!/^\+[1-9][0-9]{6,14}$/.test(phone))throw Error('invalid_phone');
 return {checkin:body.checkin,checkout:body.checkout,guests:body.guests,name:body.name.trim(),phone,comment:body.comment.trim(),consent:true};
}
async function readJson(request){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('unsupported_media_type');
 const reader=request.body?.getReader();if(!reader)throw Error('invalid_payload');
 let size=0;const chunks=[];
 try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw Error('body_too_large');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
export async function handleWidgetRequest(request,deps){
 const origin=request.headers.get('origin');
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff'};
 const reply=(status,error,extra={})=>Response.json(error?{error}:extra,{status,headers});
 if(!origin||origin!==deps.origin)return reply(403,'origin_not_allowed');
 headers['Access-Control-Allow-Origin']=origin;
 if(request.method==='OPTIONS'){headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers['Access-Control-Allow-Headers']='content-type';return new Response(null,{status:204,headers});}
 if(request.method!=='POST')return reply(405,'method_not_allowed');
 if(!deps.enabled)return reply(503,'booking_not_activated');
 try{
  const ip=deps.clientIp(request);if(!ip||ip.length>100)return reply(503,'gateway_not_configured');
  // Bound requests even before parsing or paying for a CAPTCHA verification.
  if(!await deps.rateLimit(await deps.hash('ip:'+ip),30,3600))return reply(429,'rate_limited');
  let body;try{body=await readJson(request);}catch(e){return reply(e.message==='body_too_large'?413:e.message==='unsupported_media_type'?415:400,'invalid_payload');}
  let payload;try{payload=normalizePayload(body,deps.today());}catch{return reply(400,'invalid_payload');}
  if(!await deps.verifyCaptcha(body.captchaToken,ip,body.widgetId))return reply(403,'captcha_failed');
  for(const [key,limit,seconds] of [[`widget-ip:${body.widgetId}:${ip}`,5,900],[`widget:${body.widgetId}`,200,900],[`phone:${payload.phone}`,5,3600]]){
   if(!await deps.rateLimit(await deps.hash(key),limit,seconds))return reply(429,'rate_limited');
  }
  const fingerprint=await deps.hash('payload:'+JSON.stringify(payload));
  const result=await deps.submit(body.widgetId,payload,body.idempotency,fingerprint,await deps.hash('actor:'+ip));
  if(result?.accepted!==true||!UUID.test(result.requestId||''))return reply(503,'booking_unavailable');
  return reply(202,null,{accepted:true,requestId:result.requestId});
 }catch(error){
  // Never echo DB messages, stack traces, payloads, telephone or CAPTCHA tokens.
  if(error?.code==='55P03'||error?.code==='57014')return reply(503,'temporarily_busy');
  if(error?.code==='22023')return reply(400,'invalid_payload');
  if(error?.code==='54000')return reply(429,'hold_limit');
  if(error?.code==='23P01')return reply(409,'dates_unavailable');
  if(error?.code==='23505')return reply(409,'idempotency_conflict');
  return reply(503,'booking_unavailable');
 }
}
