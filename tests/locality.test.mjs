import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
import '../catalog-locality.js';
test('all real top-level catalog houses have exact localities',async()=>{
 const context={window:{},document:{createElement:()=>({}),head:{appendChild(){}}}};vm.runInNewContext(await readFile('guest-houses.js','utf8'),context);
 const houses=context.window.GUEST_HOUSES.filter(h=>!h.parentId&&h.active!==false);
 const counts={};for(const h of houses){const l=GuestLocality.localityOf(h);assert.ok(l);counts[l]=(counts[l]||0)+1;}
 assert.deepEqual(counts,{'Краснолесье':3,'Дмитриевка':2,'Сосновка':1,'Чистые Пруды':1});
});
test('locality supports variations without prefix false positives',()=>{
 for(const prefix of ['п.','пос.','посёлок','поселок','с.','село','дер.','деревня'])assert.equal(GuestLocality.matches({address:'Область, '+prefix+' Краснолесье, ул. 1'},'Краснолесье'),true);
 assert.equal(GuestLocality.matches({address:'пос. Краснолесье Новое, ул. 1'},'Краснолесье'),false);
});
