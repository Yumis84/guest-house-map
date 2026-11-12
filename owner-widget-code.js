// Only verified public widgets may be offered. Never substitute another property's dates.
export const STEPAN_ID='4372d741-eab4-4c42-9ddc-88f78368f9b6';
export const WIDGET_URL='https://yumis84.github.io/guest-house-map/widget/booking.html';
export function generateEmbed({propertyId,type='calendar',color='#226b50',radius=18,width=720,fluid=true,id}={}){
  if(propertyId!==STEPAN_ID)throw Error('Для этого объекта публичный виджет ещё не подключён.');
  if(!['calendar','compact','button'].includes(type)||!/^#[\da-f]{6}$/i.test(color)||!Number.isInteger(radius)||radius<0||radius>32||!Number.isInteger(width)||width<280||width>960||typeof fluid!=='boolean'||!/^ghw-[a-z0-9-]{1,80}$/.test(id||''))throw Error('Проверьте настройки виджета.');
  const url=WIDGET_URL+'?v=20261021capacity8&property='+propertyId;
  const style=`box-sizing:border-box;width:${fluid?'100%':width+'px'};max-width:100%;margin:0 auto;border:1px solid ${color};border-radius:${radius}px;overflow:hidden;background:#fff;color:#243129;font:16px/1.5 system-ui`;
  const action=`display:inline-block;padding:12px 18px;min-height:44px;border-radius:${radius}px;background:${color};color:#fff;font:600 16px/1.5 system-ui;cursor:pointer`;
  if(type==='button')return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="${action};box-sizing:border-box;max-width:100%;text-align:center;text-decoration:none;overflow-wrap:anywhere">Запросить бронирование ↗</a>`;
  const frame=`<iframe id="${id}" src="${url}" title="Календарь и форма бронирования — У Степана" scrolling="no" referrerpolicy="no-referrer" style="display:block;width:100%;height:1100px;border:0;overflow:hidden;background:transparent"></iframe>`;
  const content=type==='compact'?`<details style="${style};max-width:${width}px"><summary style="${action}">Выбрать даты и открыть форму</summary>${frame}</details>`:`<div style="${style};max-width:${width}px">${frame}</div>`;
  // Include the listener with every iframe; scope it to its unique element and source.
  return content+`\n<script>\n(()=>{const frame=document.getElementById('${id}');window.addEventListener('message',event=>{const data=event.data;if(event.origin!=='https://yumis84.github.io'||event.source!==frame.contentWindow||!data||data.type!=='guest-house-calendar:resize'||!Number.isFinite(data.height)||data.height<350||data.height>3000)return;frame.style.height=(data.height+24)+'px';});})();\n</script>`;
}
