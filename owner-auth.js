import {getClient,errorMessage} from './owner-common.js';
const $=s=>document.querySelector(s);
let mode='signin',busy=false,client,recoverySession=false;
const labels={signin:'Войти',signup:'Зарегистрироваться',recovery:'Отправить ссылку',update:'Сохранить пароль'};
function setMode(next){
  if(busy)return;
  mode=next;
  $('#formTitle').textContent={signin:'Вход владельца',signup:'Создание аккаунта',recovery:'Восстановление пароля',update:'Новый пароль'}[mode];
  $('#submit').textContent=labels[mode];
  $('#emailField').hidden=mode==='update';$('#email').required=mode!=='update';
  $('#passwordField').hidden=mode==='recovery';$('#password').required=mode!=='recovery';
  $('#confirmField').hidden=!['signup','update'].includes(mode);$('#confirm').required=!$('#confirmField').hidden;
  $('#password').minLength=mode==='signin'?1:8;
  $('#password').autocomplete=mode==='signin'?'current-password':'new-password';
  $('#signin').setAttribute('aria-pressed',String(mode==='signin'));$('#signup').setAttribute('aria-pressed',String(mode==='signup'));
  $('#tabs').hidden=mode==='update';$('#recovery').hidden=mode==='update';
  $('#password').value='';$('#confirm').value='';
  $('#hint').textContent=mode==='signup'||mode==='update'?'Не менее 8 символов. Используйте уникальный пароль.':'';
  $('#status').textContent='';
}
for(const m of ['signin','signup','recovery'])$('#'+m).onclick=()=>setMode(m);
function setBusy(value){busy=value;$('#form').setAttribute('aria-busy',String(value));document.querySelectorAll('button').forEach(b=>b.disabled=value||!client);}
try{
  client=getClient();
  client.auth.onAuthStateChange((event)=>{
    if(event==='PASSWORD_RECOVERY'){recoverySession=true;setMode('update');}
  });
  const {data,error}=await client.auth.getSession();
  if(error)throw error;
  // A recovery URL alone grants no authority; updateUser still requires a valid Auth session.
  if(new URL(location.href).searchParams.get('flow')==='recovery'){
    if(data.session){recoverySession=true;setMode('update');}
    else {setMode('recovery');$('#status').textContent='Ссылка недействительна или истекла. Запросите новую ссылку в этом браузере.';}
  }else if(data.session&&!recoverySession){
    const {data:verified,error:verifyError}=await client.auth.getUser();
    if(!verifyError&&verified.user)location.replace('./owner.html');
    else $('#status').textContent='Сессию не удалось подтвердить. Войдите снова.';
  }
  else $('#status').textContent='';
  if(location.hash.includes('error')){$('#status').textContent='Ссылка недействительна или истекла. Запросите новую.';}
  if(new URL(location.href).searchParams.get('notice')==='logout-local')$('#status').textContent='Вы вышли на этом устройстве. Завершение серверной сессии не подтверждено.';
  history.replaceState(null,'',location.pathname+(recoverySession?'?flow=recovery':''));
}catch(error){$('#status').textContent=error.message?.startsWith('Подключение')?error.message:'Подключение недоступно. Попробуйте позже.';client=null;}
setBusy(false);
$('#form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!client)return;
  if(['signup','update'].includes(mode)&&$('#password').value!==$('#confirm').value){$('#status').textContent='Пароли не совпадают.';return;}
  setBusy(true);$('#status').textContent='Подождите…';
  try{
    const email=$('#email').value.trim(),password=$('#password').value;
    let result;
    if(mode==='signin') result=await client.auth.signInWithPassword({email,password});
    if(mode==='signup') result=await client.auth.signUp({email,password,options:{emailRedirectTo:new URL('./login.html',location.href).href}});
    if(mode==='recovery') result=await client.auth.resetPasswordForEmail(email,{redirectTo:new URL('./login.html?flow=recovery',location.href).href});
    if(mode==='update'){
      if(!recoverySession)throw Error();
      result=await client.auth.updateUser({password});
    }
    if(result.error)throw result.error;
    $('#password').value='';$('#confirm').value='';
    if(mode==='signin'||(mode==='signup'&&result.data.session)){location.assign('./owner.html');return;}
    if(mode==='signup')$('#status').textContent='Проверьте почту и подтвердите адрес. Если аккаунт уже есть, воспользуйтесь входом или восстановлением.';
    if(mode==='recovery')$('#status').textContent='Если адрес зарегистрирован, на него придёт ссылка. Откройте её в этом браузере.';
    if(mode==='update'){
      const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;
      recoverySession=false;busy=false;setMode('signin');history.replaceState(null,'',location.pathname);$('#status').textContent='Пароль обновлён. Войдите с новым паролем.';
    }
  }catch(error){$('#status').textContent=mode==='signin'?'Не удалось войти. Проверьте email, пароль и подтверждение адреса.':errorMessage(error);}
  finally{setBusy(false);}
});
