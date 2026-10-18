const byId=id=>document.getElementById(id);
const houses=[
{id:'demo-1',category:'guest_house',listingRole:'owner',name:'Демонстрационный дом № 1',description:'Пример описания. Это не настоящий гостевой дом.',phone:'',email:'',published:false,confirmed:false,type:'Гостевой дом',guests:4,bedrooms:2,beds:4,price:4500,minNights:2,available:false,locality:'Краснолесье',amenities:[],address:'',lat:'',lng:'',photos:[]},
{id:'demo-2',category:'guest_house',listingRole:'authorized_intermediary',name:'Демонстрационный дом № 2',description:'Второй вымышленный объект.',phone:'',email:'',published:true,confirmed:false,type:'Коттедж',guests:6,bedrooms:3,beds:6,price:7200,minNights:2,available:false,locality:'Чистые Пруды',amenities:['Wi-Fi'],address:'',lat:'',lng:'',photos:[]}
];
let current=0,changed=false,step=0;
const storageKey='krasnolesye-owner-demo-v3',legacyStorageKey='krasnolesye-owner-demo-v2';
let saveTimer,lastContacts={phone:'',email:''};
function snapshotForm(){
 const h=houses[current];
 for(const [key,id] of Object.entries({name:'demoName',category:'demoCategory',listingRole:'demoListingRole',locality:'demoLocality',type:'demoType',description:'demoDescription',phone:'demoPhone',email:'demoEmail',address:'demoAddress',lat:'demoLat',lng:'demoLng'}))h[key]=byId(id).value.trim();
 for(const [key,id] of Object.entries({guests:'demoGuests',bedrooms:'demoBedrooms',beds:'demoBeds',price:'demoPrice',minNights:'demoMinNights'}))h[key]=Number(byId(id).value);
 h.available=byId('demoAvailable').checked;
 h.amenities=[['demoWifi','Wi-Fi'],['demoParking','Парковка'],['demoKitchen','Кухня'],['demoPets','Можно с животными']].filter(([id])=>byId(id).checked).map(([,label])=>label);
 if(h.phone!==lastContacts.phone||h.email!==lastContacts.email)h.confirmed=false;
}
function persist(){
 clearTimeout(saveTimer);
 try{
  localStorage.setItem(storageKey,JSON.stringify({current,step,houses:houses.map(({photos,...house})=>house)}));
  byId('demoHint').textContent='Черновик автоматически сохранён в этом браузере.';
  changed=false;
 }catch{byId('demoHint').textContent='Не удалось сохранить черновик. Не закрывайте страницу.'}
}
function scheduleSave(){
 changed=true;byId('demoHint').textContent='Сохраняем черновик…';
 clearTimeout(saveTimer);saveTimer=setTimeout(()=>{snapshotForm();persist()},450);
}
try{
 const stored=JSON.parse(localStorage.getItem(storageKey)||localStorage.getItem(legacyStorageKey)||'null');
 if(stored&&Array.isArray(stored.houses)&&stored.houses.length&&stored.houses.length<100){
  houses.splice(0,houses.length,...stored.houses.map((h,index)=>({...h,id:h.id||'migrated-'+index,category:h.category||'guest_house',listingRole:h.listingRole||'owner',price:Number(h.price)||4500,minNights:Number(h.minNights)||1,available:h.available===true,photos:[]})));
  current=Math.max(0,Math.min(houses.length-1,Number(stored.current)||0));
  step=Math.max(0,Math.min(4,Number(stored.step)||0));
 }
}catch{/* Fall back to demo data when browser storage is unavailable. */}

let demoMap=null,demoMarker=null;
const defaultLocation=[54.42,22.43];
function updateMapMarker(lat,lng){
 if(!demoMap)return;
 if(demoMarker)demoMarker.setLatLng([lat,lng]);
 else demoMarker=L.marker([lat,lng],{draggable:true}).addTo(demoMap);
 demoMarker.off('dragend');demoMarker.on('dragend',()=>{const p=demoMarker.getLatLng();setMapFields(p.lat,p.lng)});
}
function setMapFields(lat,lng){
 byId('demoLat').value=lat.toFixed(6);byId('demoLng').value=lng.toFixed(6);
 updateMapMarker(lat,lng);scheduleSave();
}
function syncMap(){
 if(!window.L)return;
 if(!demoMap){
  demoMap=L.map('demoMap').setView(defaultLocation,12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap contributors'}).addTo(demoMap);
  demoMap.on('click',e=>setMapFields(e.latlng.lat,e.latlng.lng));
 }
 const lat=Number(byId('demoLat').value),lng=Number(byId('demoLng').value);
 if(byId('demoLat').value&&byId('demoLng').value&&Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180){updateMapMarker(lat,lng);demoMap.setView([lat,lng],13)}
 else if(demoMarker){demoMap.removeLayer(demoMarker);demoMarker=null}
 requestAnimationFrame(()=>demoMap.invalidateSize());
}
byId('demoMapCenter').addEventListener('click',()=>{if(demoMap)demoMap.setView(defaultLocation,12)});
for(const id of ['demoLat','demoLng'])byId(id).addEventListener('change',syncMap);
function showStep(){document.querySelectorAll('.demo-step').forEach((el,i)=>el.hidden=i!==step);byId('demoProgress').textContent='Шаг '+(step+1)+' из 5';byId('demoPrev').hidden=step===0;byId('demoNext').hidden=step===4;if(step===3)requestAnimationFrame(syncMap);}
function validateStep(stepIndex,{focus=true}={}){
 const container=document.querySelector('.demo-step[data-step="'+stepIndex+'"]');
 const fields=Array.from(container.querySelectorAll('input:not([type="file"]),select,textarea'));
 for(const field of fields)field.setCustomValidity('');
 if(stepIndex===0){
  if(!byId('demoName').value.trim())byId('demoName').setCustomValidity('Укажите название.');
  if(!byId('demoLocality').value.trim())byId('demoLocality').setCustomValidity('Укажите населённый пункт.');
 }
 if(stepIndex===3){
  const lat=byId('demoLat'),lng=byId('demoLng');
  if(Boolean(lat.value.trim())!==Boolean(lng.value.trim()))(lat.value.trim()?lng:lat).setCustomValidity('Укажите и широту, и долготу либо оставьте оба поля пустыми.');
 }
 const invalid=fields.find(field=>!field.checkValidity());
 if(!invalid){byId('demoValidation').textContent='';return true}
 byId('demoValidation').textContent=invalid.validationMessage||'Проверьте заполнение поля.';
 if(focus){invalid.focus();invalid.reportValidity()}
 return false;
}
function validateAll(){
 for(let index=0;index<4;index++)if(!validateStep(index,{focus:false})){step=index;showStep();validateStep(index);return false}
 return true;
}
function drawPhotos(){
 const grid=byId('demoPhotoGrid');grid.replaceChildren();
 houses[current].photos.forEach((photo,index)=>{
  const tile=document.createElement('div');tile.className='demo-photo-tile';
  const img=document.createElement('img');img.src=photo;img.alt='Фото '+(index+1);
  const controls=document.createElement('div');
  for(const [label,delta] of [['←',-1],['→',1]]){
   const btn=document.createElement('button');btn.type='button';btn.className='secondary';btn.textContent=label;
   btn.setAttribute('aria-label',delta<0?'Передвинуть фото влево':'Передвинуть фото вправо');
   btn.disabled=index+delta<0||index+delta>=houses[current].photos.length;
   btn.addEventListener('click',()=>{const house=houses[current],arr=house.photos;[arr[index],arr[index+delta]]=[arr[index+delta],arr[index]];drawPhotos();savePhotos(house);scheduleSave()});
   controls.append(btn);
  }
  const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='×';remove.setAttribute('aria-label','Удалить фото');
  remove.addEventListener('click',()=>{const house=houses[current];house.photos.splice(index,1);drawPhotos();savePhotos(house);scheduleSave()});
  controls.append(remove);tile.append(img,controls);
  if(index===0){const cover=document.createElement('small');cover.textContent='Обложка';tile.append(cover)}
  grid.append(tile);
 });
}

const photoDb=new Promise((resolve,reject)=>{
 const request=indexedDB.open('krasnolesye-owner-demo',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('photos');
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
async function photoStore(mode,value,house=houses[current]){
 const houseId=house.id,db=await photoDb;
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('photos',mode),store=tx.objectStore('photos');
  const request=value===undefined?store.get(houseId):store.put(value,houseId);
  tx.oncomplete=()=>resolve(value===undefined?request.result:undefined);tx.onerror=()=>reject(tx.error);
 });
}
async function savePhotos(house=houses[current]){
 try{await photoStore('readwrite',house.photos,house);if(house===houses[current])byId('demoPhotoStatus').textContent=house.photos.length?'Фото сохранены в этом браузере.':'Фотографий пока нет.'}
 catch{if(house===houses[current])byId('demoPhotoStatus').textContent='Не удалось сохранить фото. Они останутся до перезагрузки страницы.'}
}
async function loadPhotos(){
 const house=houses[current];
 try{house.photos=await photoStore('readonly',undefined,house)||[]}catch{house.photos=[]}
 if(house!==houses[current])return;
 drawPhotos();byId('demoPhotoStatus').textContent=house.photos.length?'Загружено фото: '+house.photos.length:'Фотографий пока нет.';
}
function encodePhoto(file){
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file),image=new Image();
  image.onload=()=>{URL.revokeObjectURL(url);const scale=Math.min(1,1600/image.width,1600/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/webp',.82))};
  image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('decode'))};image.src=url;
 });
}

byId('demoPrev').addEventListener('click',()=>{snapshotForm();step=Math.max(0,step-1);showStep();persist()});
byId('demoNext').addEventListener('click',()=>{if(!validateStep(step))return;snapshotForm();step=Math.min(4,step+1);showStep();persist()});
byId('demoPhotos').addEventListener('change',async e=>{
 const input=e.currentTarget,house=houses[current],room=Math.max(0,8-house.photos.length),selected=Array.from(input.files),valid=selected.filter(file=>['image/jpeg','image/png','image/webp'].includes(file.type)&&file.size<=10_000_000).slice(0,room);
 byId('demoPhotoStatus').textContent='Обрабатываем фото…';input.disabled=true;
 const results=await Promise.allSettled(valid.map(encodePhoto));house.photos.push(...results.filter(r=>r.status==='fulfilled').map(r=>r.value));input.disabled=false;input.value='';if(house===houses[current])drawPhotos();await savePhotos(house);scheduleSave();
 const rejected=selected.length-valid.length+results.filter(r=>r.status==='rejected').length;if(rejected&&house===houses[current])byId('demoPhotoStatus').textContent+=' Не добавлено: '+rejected+' (формат, размер, ошибка или лимит 8).';
});
function draw(){
 const list=byId('demoProperties');list.replaceChildren();
 houses.forEach((house,index)=>{
  const row=document.createElement('div');
  row.className='demo-property';
  const title=document.createElement('span');
  title.textContent=house.name+' · '+(house.published?'Опубликован':'Черновик');
  const open=document.createElement('button');
  open.type='button';open.className='secondary';open.textContent='Открыть';
  open.addEventListener('click',()=>{
   snapshotForm();persist();current=index;changed=false;step=0;draw();loadPhotos();persist();
  });
  row.append(title,open);list.append(row);
 });
 const h=houses[current];
 byId('demoTitle').textContent=h.name;
 lastContacts={phone:h.phone||'',email:h.email||''};
 byId('demoCategory').value=h.category;byId('demoListingRole').value=h.listingRole;byId('demoType').value=h.type;byId('demoGuests').value=h.guests;byId('demoPrice').value=h.price;byId('demoMinNights').value=h.minNights;byId('demoAvailable').checked=h.available===true;
 byId('demoAddress').value=h.address||'';byId('demoLat').value=h.lat||'';byId('demoLng').value=h.lng||'';drawPhotos();showStep();
 byId('demoLocality').value=h.locality;byId('demoBedrooms').value=h.bedrooms;byId('demoBeds').value=h.beds;
 for(const [id,label] of [['demoWifi','Wi-Fi'],['demoParking','Парковка'],['demoKitchen','Кухня'],['demoPets','Можно с животными']])byId(id).checked=h.amenities.includes(label);
 for(const [id,key] of [['demoName','name'],['demoDescription','description'],['demoPhone','phone'],['demoEmail','email']])byId(id).value=h[key];
 byId('demoStatus').textContent=(h.published?'Опубликован':'Черновик')+(h.confirmed?' · контакты подтверждены':' · контакты скрыты');
 byId('demoPublish').textContent=h.published?'Снять с публикации':'Опубликовать';
 byId('demoConfirm').disabled=h.confirmed||(!h.phone&&!h.email);
 const guest=byId('demoGuest');guest.replaceChildren();
 const title=document.createElement('h3');title.textContent=h.published?h.name:'Объект не опубликован';guest.append(title);
 if(h.published){
  const description=document.createElement('p');description.textContent=h.description;guest.append(description);
  const summary=document.createElement('p');summary.textContent=(h.category==='apartment'?'Апартаменты':'Гостевой дом')+' · '+h.type+' · '+h.locality+' · До '+h.guests+' гостей · '+h.bedrooms+' спален · '+h.beds+' спальных мест'+(h.amenities.length?' · '+h.amenities.join(', '):'');guest.append(summary);
  const terms=document.createElement('p');terms.textContent=new Intl.NumberFormat('ru-RU').format(h.price)+' ₽ за ночь · минимум '+h.minNights+' '+(h.minNights===1?'ночь':h.minNights<5?'ночи':'ночей')+' · '+(h.available?'доступно для бронирования':'доступность закрыта');guest.append(terms);if(h.photos.length){const img=document.createElement('img');img.src=h.photos[0];img.alt='Обложка';img.className='demo-preview-img';guest.append(img);}
  if(h.confirmed)for(const value of [h.phone,h.email])if(value){
   const line=document.createElement('p');line.textContent=value;guest.append(line);
  }
 }
}
byId('demoAdd').addEventListener('click',()=>{
 snapshotForm();persist();
 houses.push({id:crypto.randomUUID(),category:'guest_house',listingRole:'owner',name:'Новый объект',description:'',phone:'',email:'',published:false,confirmed:false,type:'Гостевой дом',guests:2,bedrooms:1,beds:2,price:4500,minNights:1,available:false,locality:'Краснолесье',amenities:[],address:'',lat:'',lng:'',photos:[]});
 current=houses.length-1;changed=false;step=0;draw();persist();byId('demoName').focus();
});
byId('demoForm').addEventListener('input',scheduleSave);
byId('demoForm').addEventListener('change',scheduleSave);
byId('demoForm').addEventListener('submit',event=>{
 event.preventDefault();if(!validateAll())return;const h=houses[current];
 h.name=byId('demoName').value.trim();h.description=byId('demoDescription').value.trim();
 h.category=byId('demoCategory').value;h.listingRole=byId('demoListingRole').value;h.type=byId('demoType').value;h.guests=Number(byId('demoGuests').value);
 h.address=byId('demoAddress').value.trim();h.lat=byId('demoLat').value;h.lng=byId('demoLng').value;
 h.locality=byId('demoLocality').value.trim();h.bedrooms=Number(byId('demoBedrooms').value);h.beds=Number(byId('demoBeds').value);h.price=Number(byId('demoPrice').value);h.minNights=Number(byId('demoMinNights').value);h.available=byId('demoAvailable').checked;
 h.amenities=[['demoWifi','Wi-Fi'],['demoParking','Парковка'],['demoKitchen','Кухня'],['demoPets','Можно с животными']].filter(([id])=>byId(id).checked).map(([,label])=>label);
 const phone=byId('demoPhone').value.trim(),email=byId('demoEmail').value.trim();
 if(h.phone!==phone||h.email!==email)h.confirmed=false;
 h.phone=phone;h.email=email;changed=false;persist();draw();
});
byId('demoPublish').addEventListener('click',()=>{
 if(!validateAll())return;snapshotForm();persist();
 const h=houses[current];
 if(!h.published&&(!h.name.trim()||!h.locality.trim())){alert('Укажите название и населённый пункт.');step=0;showStep();return;}
 if(!h.published&&!confirm('Опубликовать этот демонстрационный объект?'))return;
 h.published=!h.published;persist();draw();
});
byId('demoConfirm').addEventListener('click',()=>{
 snapshotForm();persist();
 const h=houses[current];if(!h.phone&&!h.email)return;
 if(!confirm('Подтвердить публичность телефона и email для посетителей?'))return;
 h.confirmed=true;persist();draw();
});
window.addEventListener('pagehide',()=>{if(changed){snapshotForm();persist()}});
draw();loadPhotos();
