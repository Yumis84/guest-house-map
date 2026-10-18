import {getClient,canEdit,propertyPatch,photoPath,preparePhoto,BUCKET,errorMessage} from './owner-common.js';
const $=s=>document.querySelector(s);
let client,user,items=[],members=[],selected=null,epoch=0,busy=false,dirty=false,signingOut=false,publicationReady=false;
function show(title,text){$('#heading').textContent=title;$('#message').textContent=text;}
function clearPrivate(){epoch++;items=[];members=[];selected=null;dirty=false;$('#properties').replaceChildren();$('#photos').replaceChildren();$('#editor').hidden=true;$('#publishToggle').hidden=true;$('#confirmContacts').hidden=true;$('#publicationStatus').textContent='';$('#propertyForm').reset();$('#photo').value='';}
function expired(){clearPrivate();location.replace('./login.html');}
function editorBusy(value){busy=value;$('#fields').disabled=value||!selected||!canEdit(members.find(m=>m.company_id===selected.company_id)?.member_role);$('#save').disabled=$('#fields').disabled;$('#upload').disabled=$('#fields').disabled;$('#photo').disabled=$('#fields').disabled;$('#cancel').disabled=value;$('#signout').disabled=value;$('#reload').disabled=value;$('#photos').querySelectorAll('button').forEach(b=>b.disabled=value);$('#publishToggle').disabled=value||!selected||!publicationReady||!['owner','admin'].includes(members.find(m=>m.company_id===selected.company_id)?.member_role);$('#confirmContacts').disabled=$('#publishToggle').disabled;}
function leave(){if(dirty&&!confirm('Закрыть без сохранения изменений?'))return;epoch++;selected=null;dirty=false;$('#editor').hidden=true;$('#photos').replaceChildren();$('#propertyForm').reset();$('#photo').value='';}
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
$('#propertyForm').addEventListener('input',()=>{dirty=true;});
$('#cancel').onclick=leave;
async function ensureUser(){
  const {data,error}=await client.auth.getUser();
  if(error||!data.user||data.user.id!==user?.id){expired();throw Error('Session ended');}
}
async function load(){
  if(busy||(dirty&&!confirm('Обновить список и отменить несохранённые изменения?')))return;
  clearPrivate();const token=epoch;
  show('Загружаем объекты…','');
  try{
    await ensureUser();
    const {data:membership,error:me}=await client.from('company_members').select('company_id,member_role').eq('user_id',user.id);
    if(me)throw me;if(token!==epoch)return;members=membership||[];
    if(!members.length){show('Доступ к объектам пока не выдан','Администратор должен подтвердить владельца и привязать аккаунт к компании. Регистрация не назначает права автоматически.');return;}
    const {data:version,error:ve}=await client.rpc('owner_cabinet_version');
    if(ve||![1,2].includes(version)){show('Кабинет ожидает настройки','Серверное обновление ещё не установлено. Управление объектами пока недоступно.');return;}
    publicationReady=version===2;
    const {data,error}=await client.from('properties').select('id,company_id,name,description,published,contact_phone,contact_email,website_url,owner_revision,contact_confirmed_at').in('company_id',members.map(m=>m.company_id)).order('name');
    if(error)throw error;if(token!==epoch)return;
    items=(data||[]).filter(p=>members.some(m=>m.company_id===p.company_id));
    show('Мои объекты',items.length?'Выберите объект для просмотра или редактирования.':'У вашей компании пока нет объектов.');
    render();
  }catch(error){if(token===epoch)show('Не удалось загрузить объекты',errorMessage(error));}
}
function render(){
  $('#properties').replaceChildren();
  for(const p of items){
    const row=document.createElement('article');row.className='property';
    const info=document.createElement('div'),name=document.createElement('h3'),badge=document.createElement('span'),button=document.createElement('button');
    name.textContent=p.name;badge.className='badge';badge.textContent=p.published?'Опубликован':'Черновик';info.append(name,badge);
    button.textContent=canEdit(members.find(m=>m.company_id===p.company_id)?.member_role)?'Открыть и изменить':'Просмотреть';
    button.onclick=()=>{if(!busy)open(p);};row.append(info,button);$('#properties').append(row);
  }
}
function open(p){
  if(dirty&&!confirm('Отменить несохранённые изменения?'))return;
  selected=p;dirty=false;epoch++;
  $('#editor').hidden=false;$('#editorTitle').textContent=p.name;$('#editorStatus').textContent='';
  for(const key of ['name','description','contact_phone','contact_email','website_url'])$('#'+key).value=p[key]||'';
  $('#photo').value='';
  const publisher=['owner','admin'].includes(members.find(m=>m.company_id===p.company_id)?.member_role);
  $('#publishToggle').hidden=!publicationReady||!publisher;$('#confirmContacts').hidden=!publicationReady||!publisher;
  $('#publishToggle').textContent=p.published?'Снять с публикации':'Опубликовать';
  $('#publicationStatus').textContent=publicationReady?(p.contact_confirmed_at?'Публичность контактов подтверждена.':'Контакты пока не подтверждены для публикации.'):'Публикация будет доступна после серверного обновления.';
  const editable=canEdit(members.find(m=>m.company_id===p.company_id)?.member_role);
  $('#uploadControls').hidden=!editable;editorBusy(false);
  if(!editable)$('#editorStatus').textContent='Доступ только для просмотра.';
  $('#editorTitle').focus();void photos(p,epoch);
}
async function photos(p,token){
  $('#photos').replaceChildren();$('#photoStatus').textContent='Загружаем фотографии…';
  try{
    const prefix=p.company_id+'/'+p.id;
    let all=[],offset=0;
    while(true){
      const {data,error}=await client.storage.from(BUCKET).list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
      if(error)throw error;all.push(...data);if(data.length<100)break;offset+=100;
    }
    if(token!==epoch)return;
    const valid=all.filter(f=>f.id&&/^[0-9a-f-]{36}\.webp$/i.test(f.name));
    $('#photoStatus').textContent=valid.length?'Ссылки на просмотр действуют 60 секунд. Откройте объект заново для обновления.':'Фотографий пока нет.';
    for(const f of valid){
      const path=photoPath(p,f.name);
      const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,60);
      if(error)throw error;if(token!==epoch)return;
      const figure=document.createElement('figure'),img=document.createElement('img');img.alt='Фотография: '+p.name;img.src=data.signedUrl;img.loading='lazy';figure.append(img);
      if(canEdit(members.find(m=>m.company_id===p.company_id)?.member_role)){
        const del=document.createElement('button');del.type='button';del.className='secondary';del.textContent='Удалить фото';del.disabled=busy;
        del.onclick=async()=>{
          if(busy||!confirm('Удалить эту фотографию?'))return;editorBusy(true);
          try{
            await ensureUser();
            const {data:removed,error}=await client.storage.from(BUCKET).remove([path]);
            if(error)throw error;if(!removed?.length)throw Error('Not removed');
            if(token===epoch)await photos(p,token);
          }catch(error){if(token===epoch)$('#photoStatus').textContent=errorMessage(error);}
          finally{editorBusy(false);}
        };figure.append(del);
      }
      $('#photos').append(figure);
    }
  }catch(error){if(token===epoch)$('#photoStatus').textContent='Не удалось загрузить фотографии. '+errorMessage(error);}
}
$('#propertyForm').onsubmit=async event=>{
  event.preventDefault();if(busy||!selected||$('#fields').disabled)return;
  const p=selected,token=epoch;
  let patch;try{patch=propertyPatch(Object.fromEntries(new FormData($('#propertyForm'))));}catch(error){$('#editorStatus').textContent=error.message;return;}
  editorBusy(true);$('#editorStatus').textContent='Сохраняем…';
  try{
    await ensureUser();
    const {data,error}=await client.from('properties').update(patch).eq('id',p.id).eq('company_id',p.company_id).eq('owner_revision',p.owner_revision).select('id,company_id,name,description,published,contact_phone,contact_email,website_url,owner_revision,contact_confirmed_at').maybeSingle();
    if(error)throw error;if(token!==epoch)return;
    if(!data){$('#editorStatus').textContent='Объект изменён другим пользователем или доступ отозван. Обновите список перед повторным сохранением.';return;}
    selected=data;items=items.map(x=>x.id===data.id?data:x);dirty=false;render();$('#editorTitle').textContent=data.name;$('#editorStatus').textContent='Изменения сохранены.';
  }catch(error){if(token===epoch)$('#editorStatus').textContent=errorMessage(error);}
  finally{editorBusy(false);}
};
$('#upload').onclick=async()=>{
  if(busy||!selected||$('#fields').disabled)return;const p=selected,token=epoch;editorBusy(true);$('#photoStatus').textContent='Подготавливаем фото…';
  try{
    const blob=await preparePhoto($('#photo').files[0]);await ensureUser();
    const path=photoPath(p,crypto.randomUUID()+'.webp');
    const {error}=await client.storage.from(BUCKET).upload(path,blob,{contentType:'image/webp',upsert:false,cacheControl:'60'});
    if(error)throw error;if(token!==epoch)return;$('#photo').value='';await photos(p,token);
  }catch(error){if(token===epoch)$('#photoStatus').textContent=error?.message?.match(/фото|JPEG|разрешение/)?error.message:errorMessage(error);}
  finally{editorBusy(false);}
};
async function publicationAction(kind){
 if(busy||dirty||!selected||!publicationReady)return;
 const p=selected,token=epoch;
 editorBusy(true);$('#publicationStatus').textContent='Выполняем действие…';
 try{
  await ensureUser();
  const action=kind==='publish'?'set_property_published':'confirm_property_contacts';
  const args=kind==='publish'?{p_property:p.id,p_published:!p.published}:{p_property:p.id};
  const {error}=await client.rpc(action,args);if(error)throw error;
  if(token!==epoch)return;
  $('#publicationStatus').textContent='Изменение сохранено. Обновляем список…';
  editorBusy(false);await load();
 }catch(error){if(token===epoch)$('#publicationStatus').textContent=errorMessage(error);}
 finally{editorBusy(false);}
}
$('#publishToggle').onclick=()=>publicationAction('publish');
$('#confirmContacts').onclick=()=>publicationAction('confirm');
$('#reload').onclick=load;
try{
  client=getClient();
  const authKey='sb-'+new URL(window.GUEST_HOUSE_SUPABASE_CONFIG.url).hostname.split('.')[0]+'-auth-token';
  window.addEventListener('storage',event=>{if(event.key===authKey&&!event.newValue)expired();});
  client.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT'){if(signingOut)clearPrivate();else expired();}
    else if(user&&session?.user?.id&&session.user.id!==user.id)expired();
  });
  const {data,error}=await client.auth.getUser();
  if(error||!data.user){expired();}
  else{
    user=data.user;$('#signout').hidden=false;$('#reload').hidden=false;
    $('#signout').onclick=async()=>{
      if(busy||(dirty&&!confirm('Выйти без сохранения изменений?')))return;
      $('#signout').disabled=true;signingOut=true;
      try{
        const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;
        expired();
      }catch(error){
        const {data}=await client.auth.getSession();
        if(!data.session){clearPrivate();location.replace('./login.html?notice=logout-local');return;}
        signingOut=false;$('#signout').disabled=false;show('Не удалось выйти',errorMessage(error));
      }
    };
    await load();
  }
}catch(error){show('Кабинет недоступен',error.message?.startsWith('Подключение')?error.message:errorMessage(error));}
