import {renderMonth} from '../booking-calendar.js';
import {validId,validateConfig,contrast,overlaps} from './v2-core.js';
const $=id=>document.getElementById(id),id=new URL(location.href).searchParams.get('id'),cfg=window.GUEST_HOUSE_SUPABASE_CONFIG;
let month=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Kaliningrad'}).slice(0,7);
let blocks=[],ready=false,busy=false,token='',captcha=null,key=crypto.randomUUID(),payloadSignature='';
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kaliningrad',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
async function rpc(name,body){const r=await fetch(cfg.url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:cfg.publishableKey,'Content-Type':'application/json'},body:JSON.stringify(body),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();return r.json();}
function unavailable(){ready=false;$('fields').disabled=true;$('form').hidden=true;$('calendar').hidden=true;$('status').textContent='Приём заявок недоступен. Попробуйте позже.';}
async function load(){ready=false;$('fields').disabled=true;$('status').textContent='Проверяем доступность…';try{
 if(!validId(id))throw Error();const result=await rpc('widget_v2_config',{p_widget:id});if(result?.publicId!==id)throw Error();const c=validateConfig(result.config);$('title').textContent=c.title;document.title=c.title;$('policy').href=c.policyUrl;
 document.querySelector('main').style.maxWidth=c.maxWidth+'px';document.querySelector('main').style.width=c.fluid?'100%':`min(100%,${c.maxWidth}px)`;document.body.style.background=c.theme==='dark'?'#172d23':'#ffffff';document.body.style.color=c.theme==='dark'?'#ffffff':'#172d23';$('submit').style.background=c.accent;$('submit').style.color=contrast(c.accent);$('submit').style.borderRadius=c.radius+'px';$('submit').textContent=c.buttonText;
 if(c.template!=='calendar'&&!new URL(location.href).searchParams.has('full')){ $('form').hidden=true;$('refresh').hidden=true;$('launcher').hidden=false;$('launcher').textContent=c.buttonText;$('status').textContent='Откройте страницу, чтобы проверить даты.';$('launcher').onclick=()=>{const u=new URL(location.href);u.searchParams.set('full','1');if(c.opening==='modal'&&parent!==window)parent.postMessage({type:'guest-house-calendar:open'},'*');else if(c.opening==='inline')location.assign(u);else window.open(u,'_blank','noopener,noreferrer');};return;}
 const runtime=window.GUEST_WIDGET_V2_RUNTIME;
 if(!runtime?.endpoint)throw Error();
 const availabilityUrl=new URL(runtime.endpoint);availabilityUrl.pathname=availabilityUrl.pathname.replace(/\/$/,'')+'/availability';
 if(availabilityUrl.protocol!=='https:')throw Error();
 const first=month+'-01',next=new Date(first+'T12:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);const end=next.toISOString().slice(0,10);
 const response=await fetch(availabilityUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({widgetId:id,start:first,end}),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error();const a=await response.json();
 if(a?.ready!==true||!Array.isArray(a.blocks)||!Number.isInteger(a.capacity)||!c.policyUrl||!runtime?.endpoint||!runtime?.siteKey)throw Error();
 const endpoint=new URL(runtime.endpoint);if(endpoint.protocol!=='https:')throw Error();
 blocks=a.blocks;if(blocks.some(b=>!/^\d{4}-\d{2}-\d{2}$/.test(b.starts_on)||!/^\d{4}-\d{2}-\d{2}$/.test(b.ends_on)||b.ends_on<=b.starts_on))throw Error();
 $('calendar').hidden=false;$('monthLabel').textContent=new Date(first+'T12:00:00Z').toLocaleDateString('ru',{month:'long',year:'numeric'});
 renderMonth($('month'),{month,complete:true,events:blocks.map(b=>({...b,kind:'block'})),onDay:(day,hits)=>{if(day<today||hits.length)return;$('checkin').value=day;$('checkout').min=day;$('checkout').focus();}});
 for(const cell of $('month').querySelectorAll('.day')){const occupied=blocks.some(b=>b.starts_on<=cell.dataset.date&&b.ends_on>cell.dataset.date);cell.querySelector('small').textContent=cell.dataset.date<today?'Прошло':occupied?'▧ Занято':'○ Своб.';cell.disabled=cell.dataset.date<today;cell.setAttribute('aria-label',cell.dataset.date+': '+(cell.disabled?'Прошедшая дата':occupied?'Занято':'Свободно'));}
 $('guests').max=a.capacity;$('checkin').min=today;$('checkout').min=today;$('checkin').max=new Date(Date.now()+365*86400000).toISOString().slice(0,10);$('checkout').max=new Date(Date.now()+395*86400000).toISOString().slice(0,10);
 if(!window.turnstile){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.onload=resolve;s.onerror=reject;document.head.append(s);});}
 if(captcha===null)captcha=window.turnstile.render('#captcha',{sitekey:runtime.siteKey,action:'booking',cData:id,callback:t=>{token=t;},'expired-callback':()=>{token='';},'error-callback':()=>{token='';}});
 ready=true;$('form').hidden=false;$('fields').disabled=false;$('status').textContent='Выберите даты. Отправка заявки не подтверждает бронирование.';
 }catch{unavailable();}}
for(const [button,delta] of [['prev',-1],['next',1]])$(button).onclick=()=>{const d=new Date(month+'-01T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+delta);month=d.toISOString().slice(0,7);load();};
$('refresh').onclick=load;
$('form').onsubmit=async e=>{e.preventDefault();if(!ready||busy)return;const start=$('checkin').value,end=$('checkout').value;if(end<=start||overlaps(start,end,blocks)){ $('status').textContent='Выбранные даты недоступны.';return;}if(!token){$('status').textContent='Пройдите проверку.';return;}
 const payload={widgetId:id,checkin:start,checkout:end,guests:Number($('guests').value),name:$('name').value,phone:$('phone').value,comment:$('comment').value,consent:$('consent').checked,website:$('website').value};const signature=JSON.stringify(payload);if(payloadSignature&&signature!==payloadSignature)key=crypto.randomUUID();payloadSignature=signature;
 busy=true;$('fields').disabled=true;try{const r=await fetch(window.GUEST_WIDGET_V2_RUNTIME.endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,captchaToken:token,idempotency:key}),credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});const result=await r.json();if(r.status!==202||result.accepted!==true)throw Error();$('form').reset();key=crypto.randomUUID();payloadSignature='';$('status').textContent='Заявка получена. Хозяин свяжется с вами для подтверждения.';}catch{$('status').textContent='Отправка не подтверждена. Обновите доступность и повторите попытку.';}finally{busy=false;token='';window.turnstile.reset(captcha);$('fields').disabled=!ready;}};
new ResizeObserver(()=>parent.postMessage({type:'guest-house-calendar:resize',height:Math.ceil(document.body.getBoundingClientRect().height)},'*')).observe(document.body);load();
