const byId=id=>document.getElementById(id);
const houses=[
{name:'Демонстрационный дом № 1',description:'Пример описания. Это не настоящий гостевой дом.',phone:'',email:'',published:false,confirmed:false},
{name:'Демонстрационный дом № 2',description:'Второй вымышленный объект.',phone:'',email:'',published:true,confirmed:false}
];
let current=0,changed=false;
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
   current=index;changed=false;draw();
  });
  row.append(title,open);list.append(row);
 });
 const h=houses[current];
 byId('demoTitle').textContent=h.name;
 for(const [id,key] of [['demoName','name'],['demoDescription','description'],['demoPhone','phone'],['demoEmail','email']])byId(id).value=h[key];
 byId('demoStatus').textContent=(h.published?'Опубликован':'Черновик')+(h.confirmed?' · контакты подтверждены':' · контакты скрыты');
 byId('demoPublish').textContent=h.published?'Снять с публикации':'Опубликовать';
 byId('demoConfirm').disabled=h.confirmed||(!h.phone&&!h.email);
 const guest=byId('demoGuest');guest.replaceChildren();
 const title=document.createElement('h3');title.textContent=h.published?h.name:'Объект не опубликован';guest.append(title);
 if(h.published){
  const description=document.createElement('p');description.textContent=h.description;guest.append(description);
  if(h.confirmed)for(const value of [h.phone,h.email])if(value){
   const line=document.createElement('p');line.textContent=value;guest.append(line);
  }
 }
}
byId('demoForm').addEventListener('input',()=>changed=true);
byId('demoForm').addEventListener('submit',event=>{
 event.preventDefault();const h=houses[current];
 h.name=byId('demoName').value.trim();h.description=byId('demoDescription').value.trim();
 const phone=byId('demoPhone').value.trim(),email=byId('demoEmail').value.trim();
 if(h.phone!==phone||h.email!==email)h.confirmed=false;
 h.phone=phone;h.email=email;changed=false;draw();
});
byId('demoPublish').addEventListener('click',()=>{
 if(changed){alert('Сначала сохраните изменения.');return;}
 const h=houses[current];
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
