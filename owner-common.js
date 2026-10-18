export const BUCKET='owner-property-photos';
export const MAX_PHOTO_BYTES=5*1024*1024;
export const canEdit=role=>['owner','admin','manager'].includes(role);
export function publicConfig(config) {
  if(!config?.url || !config.publishableKey) throw Error('Подключение кабинета ещё не настроено.');
  const url=new URL(config.url);
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/' ||
    (url.protocol!=='https:' && !(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)))) throw Error('Некорректный адрес подключения.');
  const key=config.publishableKey;
  if(!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)){
    try{
      const body=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      if(body.role!=='anon') throw Error();
    }catch{throw Error('Для кабинета требуется публичный ключ.');}
  }
  return {url:url.origin,key};
}
let client;
export function getClient(){
  if(!client){
    const {url,key}=publicConfig(window.GUEST_HOUSE_SUPABASE_CONFIG);
    if(!window.supabase?.createClient) throw Error('Не удалось загрузить подключение. Обновите страницу.');
    client=window.supabase.createClient(url,key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  }
  return client;
}
export function propertyPatch(input){
  const name=String(input.name||'').trim(),description=String(input.description||'').trim();
  const contact_phone=String(input.contact_phone||'').trim(),contact_email=String(input.contact_email||'').trim();
  const website_url=String(input.website_url||'').trim();
  if(!name||name.length>160||description.length>10000) throw Error('Название: 1–160 символов; описание: до 10 000.');
  if(contact_phone && !/^[+0-9 ()-]{5,40}$/.test(contact_phone)) throw Error('Проверьте номер телефона.');
  if(contact_email && (contact_email.length>254||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email))) throw Error('Проверьте email.');
  if(website_url){
    let u;try{u=new URL(website_url);}catch{throw Error('Укажите полный адрес сайта https://…');}
    if(!['https:','http:'].includes(u.protocol)||u.username||u.password||website_url.length>2048) throw Error('Укажите безопасный адрес сайта http:// или https://.');
  }
  return {name,description:description||null,contact_phone:contact_phone||null,contact_email:contact_email||null,website_url:website_url||null};
}
export function photoPath(property,fileName){
  if(!/^[0-9a-f-]{36}$/i.test(property.id)||!/^[0-9a-f-]{36}$/i.test(property.company_id)||! /^[0-9a-f-]{36}\.webp$/i.test(fileName)) throw Error('Некорректный путь фотографии.');
  return property.company_id+'/'+property.id+'/'+fileName;
}
export async function preparePhoto(file){
  if(!file || !['image/jpeg','image/png','image/webp'].includes(file.type)||!file.size||file.size>MAX_PHOTO_BYTES) throw Error('Выберите JPEG, PNG или WebP размером до 5 МБ.');
  const bitmap=await createImageBitmap(file);
  try{
    if(bitmap.width*bitmap.height>40000000) throw Error('Слишком большое разрешение фотографии.');
    const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',0.85));
    if(!blob||blob.type!=='image/webp'||blob.size>MAX_PHOTO_BYTES) throw Error('Не удалось подготовить фотографию.');
    return blob;
  }finally{bitmap.close();}
}
export function errorMessage(error){
  if(error?.status===401 || error?.code==='PGRST301') return 'Сессия истекла. Войдите снова.';
  if(error?.status===403 || error?.code==='42501') return 'Недостаточно прав. Обновите список объектов или обратитесь к администратору.';
  return 'Не удалось выполнить действие. Проверьте соединение и повторите попытку.';
}
