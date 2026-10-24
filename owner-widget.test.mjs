import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {generateEmbed,STEPAN_ID,WIDGET_URL} from './owner-widget-code.js';
const options={propertyId:STEPAN_ID,id:'ghw-test'};
for(const type of ['calendar','compact','button']){
  const code=generateEmbed({...options,type});
  assert.ok(code.includes(WIDGET_URL));assert.ok(code.includes(STEPAN_ID));
  assert.equal(code.includes('<iframe'),type!=='button');
}
for(const overrides of [{propertyId:'other'},{color:'"><script>'},{id:"x');alert(1)//"},{radius:33},{width:100},{type:'fake'},{fluid:'yes'}])assert.throws(()=>generateEmbed({...options,...overrides}));
const code=generateEmbed(options),script=code.match(/<script>([\s\S]*)<\/script>/)[1];
let listener;const frame={contentWindow:{},style:{height:'1100px'}};
vm.runInNewContext(script,{document:{getElementById:()=>frame},window:{addEventListener:(type,fn)=>listener=fn}});
const valid={origin:'https://yumis84.github.io',source:frame.contentWindow,data:{type:'guest-house-calendar:resize',height:800}};
for(const event of [{...valid,origin:'https://evil.test'},{...valid,source:{}},{...valid,data:null},...['800',NaN,Infinity,0,349,3001].map(height=>({...valid,data:{...valid.data,height}}))]){listener(event);assert.equal(frame.style.height,'1100px');}
listener(valid);assert.equal(frame.style.height,'824px');
assert.ok((await readFile(new URL('./owner.html',import.meta.url),'utf8')).includes('data-view-link="widget"'));
console.log('PASS: formats, verified URLs, property isolation, injection validation, resize origin/source/type/finite/bounds.');
