import {generateEmbed,STEPAN_ID} from './owner-widget-code.js';
const $=id=>document.getElementById(id);
let properties=[];
const instanceId='ghw-'+crypto.randomUUID();
let previewObserver;
$('widgetPreview').addEventListener('load',()=>{
  previewObserver?.disconnect();
  const body=$('widgetPreview').contentDocument?.body;
  if(!body)return;
  previewObserver=new ResizeObserver(()=>{
    const height=Math.ceil(body.getBoundingClientRect().height)+24;
    if(Number.isFinite(height)&&height>0&&height<4000)$('widgetPreview').style.height=Math.max(100,height)+'px';
  });
  previewObserver.observe(body);
});
export function setWidgetProperties(items=[],message=''){
  properties=items;
  const select=$('widgetProperty'),previous=select.value;
  select.replaceChildren();
  for(const property of items){const option=document.createElement('option');option.value=property.id;option.textContent=property.name;select.append(option);}
  if(!items.length){const option=document.createElement('option');option.value='';option.textContent=message||'Нет доступных объектов';select.append(option);}
  select.value=items.some(p=>p.id===previous)?previous:items.find(p=>p.id===STEPAN_ID)?.id||items[0]?.id||'';
  update();
}
function update(){
  const allowed=properties.some(p=>p.id===$('widgetProperty').value&&p.id===STEPAN_ID);
  $('widgetControls').disabled=!allowed;
  $('widgetCopy').disabled=true;
  $('widgetCode').value='';$('widgetPreview').removeAttribute('srcdoc');
  $('widgetPreview').hidden=!allowed;
  $('widgetNotice').textContent=!properties.length?'Загрузите доступные объекты в кабинете.':!allowed?'Для этого объекта публичный источник дат ещё не подключён. Код не выдаётся, чтобы не показать календарь другого дома.':'Подключён действующий виджет «У Степана». Заявка требует подтверждения хозяином.';
  if(!allowed)return;
  try{
    const code=generateEmbed({propertyId:$('widgetProperty').value,type:$('widgetType').value,color:$('widgetColor').value,radius:Number($('widgetRadius').value),width:Number($('widgetWidth').value),fluid:$('widgetFluid').checked,id:instanceId});
    $('widgetCode').value=code;
    $('widgetPreview').srcdoc='<!doctype html><html lang="ru"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:8px">'+code+'</body></html>';
    $('widgetCopy').disabled=false;
    $('widgetStatus').textContent='';
  }catch(error){$('widgetStatus').textContent=error.message;}
}
for(const id of ['widgetProperty','widgetType','widgetColor','widgetRadius','widgetWidth','widgetFluid'])$(id).addEventListener('input',update);
$('widgetViewport').onchange=()=>{$('widgetPreview').style.width=$('widgetViewport').value==='mobile'?'min(100%,375px)':'100%';};
$('widgetCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('widgetCode').value);$('widgetStatus').textContent='Код скопирован. Вставьте его целиком в HTML-блок сайта.';}catch{$('widgetCode').focus();$('widgetCode').select();$('widgetStatus').textContent='Выделен весь код. Скопируйте его вручную.';}};
