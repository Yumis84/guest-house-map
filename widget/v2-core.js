export const validId=id=>/^[a-f0-9]{32}$/.test(id||'');
export function contrast(hex){const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#000000':'#ffffff';}
export function validateConfig(c){
 if(!c||!['calendar','button','link'].includes(c.template)||!['light','dark'].includes(c.theme)||!/^#[a-f0-9]{6}$/i.test(c.accent)||![0,12,24].includes(c.radius)||!Number.isInteger(c.maxWidth)||c.maxWidth<320||c.maxWidth>900||typeof c.fluid!=='boolean'||typeof c.title!=='string'||!c.title.trim()||c.title.length>100||c.language!=='ru'||typeof c.buttonText!=='string'||!c.buttonText.trim()||c.buttonText.length>60||!['inline','modal','newtab'].includes(c.opening))throw Error('Проверьте настройки виджета.');
 if(c.policyUrl){const u=new URL(c.policyUrl);if(u.protocol!=='https:'||u.username||u.password||c.policyUrl.length>2048)throw Error('Укажите HTTPS-ссылку на политику.');}return c;
}
export function overlaps(start,end,blocks){return blocks.some(b=>b.starts_on<end&&b.ends_on>start);}
export function embed(id,base){if(!validId(id))throw Error('Некорректный ID');const u=new URL('widget/loader.js',base);return `<script async src="${u.href}" data-widget="${id}"></script>`;}
