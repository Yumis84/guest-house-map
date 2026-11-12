import {setWidgetProperties} from './owner-widget.js';
import {getClient,errorMessage} from './owner-common.js';
import {loadAccessibleProperties} from './owner-access.js';
const $=s=>document.querySelector(s),views=[...document.querySelectorAll('[data-view]')];
let client,loading=false,signingOut=false;
function selectView(){const requested=location.hash.slice(1),view=views.some(n=>n.dataset.view===requested)?requested:'properties';views.forEach(n=>n.hidden=n.dataset.view!==view);document.querySelectorAll('[data-view-link]').forEach(n=>n.toggleAttribute('aria-current',n.dataset.viewLink===view));}
function show(title,message){$('#loadingMark').hidden=true;$('#heading').textContent=title;$('#message').textContent=message;}
function bookingLink(label,view,property){const a=document.createElement('a');a.className='secondary';a.textContent=label;const url=new URL('./booking-owner.html',location.href);url.searchParams.set('view',view);if(property)url.searchParams.set('property',property);a.href=url.href;return a;}
async function load(){
 if(loading)return;loading=true;$('#reload').hidden=true;$('#loadingMark').hidden=false;$('#properties').replaceChildren();setWidgetProperties();
 try{
  const {data,error}=await client.auth.getUser();
  if(error){if([401,403].includes(error.status)){location.replace('./login.html');return;}throw error;}
  if(!data.user){location.replace('./login.html');return;}
  $('#accountEmail').textContent=data.user.email||'Email не указан';
  const membership=await client.from('company_members').select('company_id,member_role').eq('user_id',data.user.id);if(membership.error)throw membership.error;
  const roleLabels={owner:'Владелец',admin:'Администратор',manager:'Управляющий',staff:'Сотрудник'};
  $('#accountRoles').textContent=[...new Set((membership.data||[]).map(m=>roleLabels[m.member_role]||'Доступ по назначенной роли'))].join(' · ')||'Нет назначенных ролей';
  const items=await loadAccessibleProperties(client,data.user.id);setWidgetProperties(items);
  show(items.length?'Доступные объекты':'Объектов пока нет',items.length?`Количество объектов в кабинете: ${items.length}.`:'Аккаунт ещё не привязан к объектам. Обратитесь к администратору. Регистрация не выдаёт права автоматически.');
  for(const p of items){
   const card=document.createElement('article');card.className='property-card';const info=document.createElement('div'),name=document.createElement('h3'),status=document.createElement('p');
   name.textContent=p.name||'Объект без названия';status.textContent=p.published?'Опубликован':'Не опубликован';info.append(name,status,bookingLink('Календарь','calendar',p.id),document.createTextNode(' · '),bookingLink('Заявки гостей','requests',p.id));card.append(info);$('#properties').append(card);
  }
 }catch(e){show('Не удалось загрузить объекты',errorMessage(e));$('#reload').hidden=false;}
 finally{loading=false;}
}
$('#reload').onclick=()=>load();window.addEventListener('hashchange',selectView);selectView();
try{
 client=getClient();$('#signout').hidden=false;
 $('#signout').onclick=async()=>{
  signingOut=true;$('#signout').disabled=true;
  try{const r=await client.auth.signOut();if(r.error)throw r.error;location.replace('./login.html');}
  catch(e){signingOut=false;show('Не удалось выйти',errorMessage(e));$('#signout').disabled=false;}
 };
 client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'&&!signingOut)location.replace('./login.html');});
 void load();
}catch(e){show('Кабинет недоступен',errorMessage(e));}
