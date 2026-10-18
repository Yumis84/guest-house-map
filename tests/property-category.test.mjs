import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('all seven existing top-level listings remain guest houses',async()=>{
 const context={window:{},document:{createElement:()=>({}),head:{appendChild(){}}}};
 vm.runInNewContext(await readFile('guest-houses.js','utf8'),context);
 const listings=context.window.GUEST_HOUSES.filter(item=>!item.parentId&&item.active!==false);
 assert.equal(listings.length,7);
 assert.deepEqual([...new Set(listings.map(item=>item.category))],['guest_house']);
});

test('catalog category drives cards, empty state, filters and marker icon',async()=>{
 const html=await readFile('index.html','utf8');
 assert.match(html,/activeCategory='guest_house'/);
 assert.match(html,/apartment:\{label:'Апартаменты',icon:'▣'\}/);
 assert.match(html,/h\.category===activeCategory/);
 assert.match(html,/пока нет опубликованных объектов/);
 assert.match(html,/function markerIcon\(h\)/);
});

test('owner demo captures category and non-ownership listing roles',async()=>{
 const html=await readFile('owner-demo.html','utf8');
 const js=await readFile('owner-demo.js','utf8');
 for(const value of ['guest_house','apartment','owner','authorized_intermediary','admin'])assert.match(html,new RegExp('value="'+value+'"'));
 assert.match(html,/не используется как доказательство собственности/);
 assert.match(js,/listingRole:'authorized_intermediary'/);
 assert.match(js,/category:h\.category\|\|'guest_house'/);
});
