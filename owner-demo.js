const byId=id=>document.getElementById(id);
const houses=[
{name:'Демонстрационный дом № 1',description:'Пример описания. Это не настоящий гостевой дом.',phone:'',email:'',published:false,confirmed:false,type:'Гостевой дом',guests:4,bedrooms:2,beds:4,locality:'Краснолесье',amenities:[],address:'',lat:'',lng:'',photos:[]},
{name:'Демонстрационный дом № 2',description:'Второй вымышленный объект.',phone:'',email:'',published:true,confirmed:false,type:'Коттедж',guests:6,bedrooms:3,beds:6,locality:'Чистые Пруды',amenities:['Wi-Fi'],address:'',lat:'',lng:'',photos:[]}
];
let current=0,changed=false,step=0;
function showStep(){document.querySelectorAll('.demo-step').forEach((el,i)=>el.hidden=i!==step);byId('demoProgress').textContent='Шаг '+(step+1)+' из 4';byId('demoPrev').hidden=step===0;byId('demoNext').hidden=step===3;}
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
   btn.addEventListener('click',()=>{const arr=houses[current].photos;[arr[index],arr[index+delta]]=[arr[index+delta],arr[index]];changed=true;drawPhotos()});
   controls.append(btn);
  }
  const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='×';remove.setAttribute('aria-label','Удалить фото');
  remove.addEventListener('click',()=>{houses[current].photos.splice(index,1);changed=true;drawPhotos()});
  controls.append(remove);tile.append(img,controls);
  if(index===0){const cover=document.createElement('small');cover.textContent='Обложка';tile.append(cover)}
  grid.append(tile);
 });
}

byId('demoPrev').addEventListener('click',()=>{step=Math.max(0,step-1);showStep()});
byId('demoNext').addEventListener('click',()=>{step=Math.min(3,step+1);showStep()});
byId('demoPhotos').addEventListener('change',async e=>{const files=Array.from(e.target.files).slice(0,8);const images=await Promise.all(files.map(file=>new Promise(resolve=>{if(!file.type.startsWith('image/')||file.size>5_000_000)return resolve(null);const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>resolve(null);reader.readAsDataURL(file)})));houses[current].photos.push(...images.filter(Boolean));houses[current].photos=houses[current].photos.slice(0,8);drawPhotos();changed=true;});
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
   if(changed&&!confirm('Отменить несохранённые изменения?'))return;
   current=index;changed=false;step=0;draw();
  });
  row.append(title,open);list.append(row);
 });
 const h=houses[current];
 byId('demoTitle').textContent=h.name;
 byId('demoType').value=h.type;byId('demoGuests').value=h.guests;
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
  const summary=document.createElement('p');summary.textContent=h.type+' · '+h.locality+' · До '+h.guests+' гостей · '+h.bedrooms+' спален · '+h.beds+' спальных мест'+(h.amenities.length?' · '+h.amenities.join(', '):'');guest.append(summary);if(h.photos.length){const img=document.createElement('img');img.src=h.photos[0];img.alt='Обложка';img.className='demo-preview-img';guest.append(img);}
  if(h.confirmed)for(const value of [h.phone,h.email])if(value){
   const line=document.createElement('p');line.textContent=value;guest.append(line);
  }
 }
}
byId('demoAdd').addEventListener('click',()=>{
 if(changed&&!confirm('Отменить несохранённые изменения?'))return;
 houses.push({name:'Новый гостевой дом',description:'',phone:'',email:'',published:false,confirmed:false,type:'Гостевой дом',guests:2,bedrooms:1,beds:2,locality:'Краснолесье',amenities:[],address:'',lat:'',lng:'',photos:[]});
 current=houses.length-1;changed=false;step=0;draw();byId('demoName').focus();
});
byId('demoForm').addEventListener('input',()=>changed=true);
byId('demoForm').addEventListener('submit',event=>{
 event.preventDefault();const h=houses[current];
 h.name=byId('demoName').value.trim();h.description=byId('demoDescription').value.trim();
 h.type=byId('demoType').value;h.guests=Number(byId('demoGuests').value);
 h.address=byId('demoAddress').value.trim();h.lat=byId('demoLat').value;h.lng=byId('demoLng').value;
 h.locality=byId('demoLocality').value.trim();h.bedrooms=Number(byId('demoBedrooms').value);h.beds=Number(byId('demoBeds').value);
 h.amenities=[['demoWifi','Wi-Fi'],['demoParking','Парковка'],['demoKitchen','Кухня'],['demoPets','Можно с животными']].filter(([id])=>byId(id).checked).map(([,label])=>label);
 const phone=byId('demoPhone').value.trim(),email=byId('demoEmail').value.trim();
 if(h.phone!==phone||h.email!==email)h.confirmed=false;
 h.phone=phone;h.email=email;changed=false;draw();
});
byId('demoPublish').addEventListener('click',()=>{
 if(changed){alert('Сначала сохраните изменения.');return;}
 const h=houses[current];
 if(!h.published&&(!h.name.trim()||!h.locality.trim())){alert('Укажите название и населённый пункт.');step=0;showStep();return;}
 if(!h.published&&!confirm('Опубликовать этот демонстрационный объект?'))return;
 h.published=!h.published;draw();
});
byId('demoConfirm').addEventListener('click',()=>{
 if(changed){alert('Сначала сохраните изменения.');return;}
 const h=houses[current];if(!h.phone&&!h.email)return;
 if(!confirm('Подтвердить публичность телефона и email для посетителей?'))return;
 h.confirmed=true;draw();
});
draw();
