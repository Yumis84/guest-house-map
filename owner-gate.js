import {getUnit,getBlocks,addBlock,deleteBlock} from './owner-calendar.js?v=20261021d';
import {getClient,errorMessage} from './owner-common.js';
import {loadAccessibleProperties} from './owner-access.js?v=20261021b';
const $=selector=>document.querySelector(selector),views=[...document.querySelectorAll('[data-view]')],links=[...document.querySelectorAll('[data-view-link]')];
let client,selectedUnit=null,calendarBlocks=[];const selectedDays=new Set(),displayedMonth=new Date();displayedMonth.setDate(1);
const dayISO=(y,m,d)=>`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const addDays=(date,n)=>{const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return dayISO(d.getFullYear(),d.getMonth(),d.getDate());};
const isOccupied=day=>calendarBlocks.some(b=>day>=b.starts_on&&day<b.ends_on);
function syncSelection(){
 const selected=[...selectedDays].sort(),first=selected[0],last=selected[selected.length-1];
 let consecutive=!!selected.length;
 for(let i=1;i<selected.length;i++)if(addDays(selected[i-1],1)!==selected[i])consecutive=false;
 $('#blockStart').value=consecutive?first:'';
 $('#blockEnd').value=consecutive?addDays(last,1):'';
 const today=new Date(),todayISO=dayISO(today.getFullYear(),today.getMonth(),today.getDate());$('#blockForm button').disabled=!consecutive||first<todayISO;
 $('#ownerSelection').textContent=!selected.length?'Нажимайте на нужные дни. Повторное нажатие снимает выделение.':!consecutive?'Выбраны даты с пропусками. Для сохранения выделите дни подряд.':selected.length===1?`Выбран 1 день: ${first}`:`Выбрано дней: ${selected.length} · с ${first} по ${last} включительно`;
}
function drawOwnerCalendar(){
 const y=displayedMonth.getFullYear(),m=displayedMonth.getMonth(),container=$('#ownerDays');container.replaceChildren();
 $('#ownerMonth').textContent=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(displayedMonth);
 for(const w of ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']){const h=document.createElement('span');h.className='weekday';h.textContent=w;container.append(h);}
 for(let i=0;i<(new Date(y,m,1).getDay()+6)%7;i++)container.append(document.createElement('span'));
 const today=new Date(),todayISO=dayISO(today.getFullYear(),today.getMonth(),today.getDate());
 for(let d=1;d<=new Date(y,m+1,0).getDate();d++){
  const date=dayISO(y,m,d),btn=document.createElement('button');btn.type='button';btn.textContent=d;
  const busy=isOccupied(date),chosen=selectedDays.has(date);
  const past=date<todayISO;btn.className=busy?'occupied':chosen?'selected':past?'past':'';btn.style.backgroundColor=chosen?'#b6423c':busy?'#e6b7b4':past?'#f3f3f3':'#ffffff';btn.style.color=chosen?'#ffffff':busy?'#74251f':past?'#a2aaa5':'#243b30';btn.style.border=chosen?'2px solid #832b27':busy?'1px solid #b96862':'1px solid #ccd8d0';btn.style.display='flex';btn.style.alignItems='center';btn.style.justifyContent='center';btn.style.padding='0';btn.style.lineHeight='1';btn.style.textAlign='center';
  btn.setAttribute('aria-pressed',String(chosen));
  btn.disabled=busy||past;
  btn.title=busy?'Уже занято':past?'Прошедшая дата':chosen?'Снять выделение':'Выделить день';
  btn.onclick=()=>{if(selectedDays.has(date))selectedDays.delete(date);else selectedDays.add(date);syncSelection();drawOwnerCalendar();};
  container.append(btn);
 }
}
function selectView(){const requested=location.hash.slice(1),view=views.some(node=>node.dataset.view===requested)?requested:'properties';views.forEach(node=>{node.hidden=node.dataset.view!==view;});links.forEach(link=>link.toggleAttribute('aria-current',link.dataset.viewLink===view));}
function show(title,text,{retry=false}={}){$('#loadingMark').hidden=true;$('#heading').textContent=title;$('#message').textContent=text;$('#reload').hidden=!retry;}
async function refreshCalendar(){const status=$('#calendarStatus'),list=$('#calendarBlocks');list.replaceChildren();selectedUnit=null;calendarBlocks=[];syncSelection();drawOwnerCalendar();const id=$('#calendarProperty').value;if(!id){status.textContent='Выберите объект.';return;}try{selectedUnit=await getUnit(client,id);if(!selectedUnit){status.textContent='Для выбранного объекта не настроена единица размещения. Чтобы сохранить даты сейчас, выберите «Гостевой дом «У Степана»». Для остальных домов настройка будет добавлена отдельно.';return;}const blocks=await getBlocks(client,selectedUnit.id);calendarBlocks=blocks;syncSelection();drawOwnerCalendar();status.textContent=blocks.length?`Занятых периодов: ${blocks.length}`:'Пока нет занятых периодов.';for(const b of blocks){const line=document.createElement('div');line.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid #d8e3de';const span=document.createElement('span');span.textContent=`${b.starts_on} — ${b.ends_on} (выезд)`;const button=document.createElement('button');button.className='secondary';button.type='button';button.textContent='Удалить';button.onclick=async()=>{if(!confirm('Снять блокировку дат?'))return;button.disabled=true;try{await deleteBlock(client,b.id);await refreshCalendar();}catch(e){status.textContent=errorMessage(e);button.disabled=false;}};line.append(span,button);list.append(line);}}catch(e){status.textContent=errorMessage(e);}}
function renderProperties(items){const container=$('#properties');container.replaceChildren();if(!items.length){show('Объектов пока нет','Ваш аккаунт ещё не привязан ни к одному объекту или компании. Обратитесь к администратору — регистрация сама по себе не выдаёт доступ.');const empty=document.createElement('div');empty.className='empty-illustration';empty.setAttribute('aria-hidden','true');empty.textContent='⌂';container.append(empty);return;}show('Доступные объекты',`${items.length} ${items.length===1?'объект':'объекта'} в вашем кабинете.`);for(const property of items){const card=document.createElement('article');card.className='property-card';const icon=document.createElement('div');icon.className='property-icon';icon.setAttribute('aria-hidden','true');icon.textContent='⌂';const content=document.createElement('div'),name=document.createElement('h3'),meta=document.createElement('p'),badge=document.createElement('span');name.textContent=property.name||'Объект без названия';meta.textContent='Доступ предоставлен через членство';badge.className='status-pill';badge.textContent=property.published?'Опубликован':'Не опубликован';content.append(name,meta,badge);card.append(icon,content);container.append(card);}}
async function load(){
  $('#reload').hidden=true;$('#loadingMark').hidden=false;$('#properties').replaceChildren();$('#heading').textContent='Загружаем объекты…';$('#message').textContent='Проверяем права доступа.';
  try{const {data,error}=await client.auth.getUser();if(error||!data.user){location.replace('./login.html');return;}$('#accountEmail').textContent=data.user.email||'Email не указан';const items=await loadAccessibleProperties(client,data.user.id);renderProperties(items);const select=$('#calendarProperty');select.replaceChildren();for(const p of items){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;select.append(option);}await refreshCalendar();}catch(error){show('Не удалось загрузить объекты',errorMessage(error),{retry:true});}
}
$('#ownerPrev').onclick=()=>{displayedMonth.setMonth(displayedMonth.getMonth()-1);drawOwnerCalendar();};$('#ownerNext').onclick=()=>{displayedMonth.setMonth(displayedMonth.getMonth()+1);drawOwnerCalendar();};$('#calendarProperty').onchange=()=>{selectedDays.clear();refreshCalendar();};$('#blockForm').onsubmit=async event=>{event.preventDefault();const status=$('#calendarStatus'),button=$('#blockForm button[type=submit]');if(!selectedUnit){status.textContent='Сохранение пока недоступно: для этого дома нужно настроить единицу размещения. Выбранные даты не потеряны.';return;}button.disabled=true;try{await addBlock(client,selectedUnit.id,$('#blockStart').value,$('#blockEnd').value);selectedDays.clear();syncSelection();await refreshCalendar();status.textContent='Период сохранён в базе данных.';}catch(e){status.textContent=errorMessage(e);}finally{syncSelection();}};
window.addEventListener('hashchange',selectView);selectView();drawOwnerCalendar();$('#reload').onclick=load;
try{client=getClient();const {data,error}=await client.auth.getUser();if(error||!data.user){location.replace('./login.html');}else{$('#accountEmail').textContent=data.user.email||'Email не указан';$('#signout').hidden=false;$('#signout').onclick=async()=>{$('#signout').disabled=true;const {error}=await client.auth.signOut();if(error){$('#signout').disabled=false;show('Не удалось выйти','Проверьте соединение и повторите попытку.');return;}location.replace('./login.html');};await load();}}catch(error){show('Кабинет недоступен',errorMessage(error),{retry:true});}
