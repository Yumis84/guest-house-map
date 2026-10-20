import {getClient} from './owner-common.js';
const heading=document.querySelector('#heading'),message=document.querySelector('#message'),signout=document.querySelector('#signout');
try {
 const client=getClient();
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user){location.replace('./login.html');}
 else {
  heading.textContent='Вы вошли в личный кабинет';
  message.textContent='Аккаунт: '+(user.email||'зарегистрирован')+'. Объекты пока не привязаны.';
  signout.hidden=false;
  signout.onclick=async()=>{const {error}=await client.auth.signOut();if(error){message.textContent='Не удалось выйти. Повторите попытку.';return;}location.replace('./login.html');};
 }
} catch {heading.textContent='Не удалось проверить вход';message.textContent='Проверьте соединение и обновите страницу.';}