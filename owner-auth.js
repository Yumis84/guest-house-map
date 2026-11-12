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
$('#form').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!client)return;
  if(['signup','update'].includes(mode)&&$('#password').value!==$('#confirm').value){$('#status').textContent='Пароли не совпадают.';return;}
  interaction++;setBusy(true);$('#status').textContent='Подождите…';
  try{
    const email=$('#email').value.trim(),password=$('#password').value;
    let result;
    if(mode==='signin') result=await client.auth.signInWithPassword({email,password});
    if(mode==='signup') result=await client.auth.signUp({email,password});
    if(mode==='recovery') result=await client.auth.resetPasswordForEmail(email,{redirectTo:new URL('./login.html?flow=recovery',location.href).href});
    if(mode==='update'){
      if(!recoverySession)throw Error();
      result=await client.auth.updateUser({password});
    }
    if(result.error)throw result.error;
    $('#password').value='';$('#confirm').value='';
    if(mode==='signin'||(mode==='signup'&&result.data.session)){location.assign('./owner.html');return;}
    if(mode==='signup')$('#status').textContent='Если регистрация доступна для этого адреса, на него придёт письмо подтверждения. Проверьте почту, затем войдите.';
    if(mode==='recovery')$('#status').textContent='Если адрес зарегистрирован, на него придёт ссылка. Откройте её в этом браузере.';
    if(mode==='update'){
      const {error}=await client.auth.signOut({scope:'local'});if(error)throw error;
      recoverySession=false;busy=false;setMode('signin');history.replaceState(null,'',location.pathname);$('#status').textContent='Пароль обновлён. Войдите с новым паролем.';
    }
  }catch(error){$('#status').textContent=error?.code==='invalid_credentials'?'Неверный email или пароль.':error?.code==='email_not_confirmed'?'Подтвердите email по ссылке из письма.':errorMessage(error);}
  finally{setBusy(false);if(recoverySession&&mode!=='update')setMode('update');}
});

// Bind submit before starting any asynchronous session work.
let interaction=0;
for(const m of ['signin','signup','recovery'])$('#'+m).onclick=()=>{interaction++;setMode(m);};
async function initialize(){
  const initial=interaction;
  try{
    client=getClient();setMode('signin');setBusy(false);
    client.auth.onAuthStateChange(event=>{
      // Keep this callback synchronous: Auth may still own its session lock.
      if(event==='PASSWORD_RECOVERY'){recoverySession=true;if(!busy)setMode('update');}
    });
    const {data,error}=await client.auth.getSession();
    if(initial!==interaction||busy)return;
    if(error){$('#status').textContent=errorMessage(error);return;}
    const params=new URL(location.href).searchParams;
    if(params.get('flow')==='recovery'){
      if(data.session){recoverySession=true;setMode('update');}
      else{setMode('recovery');$('#status').textContent='Ссылка недействительна или истекла. Запросите новую ссылку в этом браузере.';}
    }else if(data.session&&!recoverySession){
      const verified=await client.auth.getUser();
      if(initial!==interaction||busy)return;
      if(!verified.error&&verified.data.user){location.replace('./owner.html');return;}
      $('#status').textContent=errorMessage(verified.error);
    }else $('#status').textContent='';
    if(location.hash.includes('error'))$('#status').textContent='Ссылка недействительна или истекла. Запросите новую.';
    if(params.get('notice')==='logout-local')$('#status').textContent='Вы вышли на этом устройстве. Завершение серверной сессии не подтверждено.';
    history.replaceState(null,'',location.pathname+(recoverySession?'?flow=recovery':''));
  }catch(error){
    if(initial!==interaction||busy)return;
    $('#status').textContent=client?errorMessage(error):'Не удалось загрузить подключение кабинета. Обновите страницу.';
    setBusy(false);
  }
}
void initialize();
