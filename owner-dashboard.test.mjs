import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadAccessibleProperties} from './owner-access.js';

function clientFixture(results){
  const calls=[];
  return {calls,from(table){
    const call={table};calls.push(call);
    const chain={select(columns){call.select=columns;return chain;},eq(column,value){call.eq=[column,value];return chain;},in(column,values){call.in=[column,values];return chain;},order(column){call.order=column;return chain;},then(resolve,reject){const key=table==='properties'?`${table}:${call.in?.[0]}`:table;return Promise.resolve(results[key]??{data:[],error:null}).then(resolve,reject);}};
    return chain;
  }};
}

{
  const client=clientFixture({
    property_members:{data:[{property_id:'p2',role:'owner'},{property_id:'shared',role:'manager'}],error:null},
    company_members:{data:[{company_id:'c1',member_role:'owner'}],error:null},
    'properties:id':{data:[{id:'p2',name:'Янтарный дом',published:false},{id:'shared',name:'Общий дом',published:true}],error:null},
    'properties:company_id':{data:[{id:'p1',name:'Альпийский дом',published:true},{id:'shared',name:'Общий дом',published:true}],error:null}
  });
  const items=await loadAccessibleProperties(client,'user-1');
  assert.deepEqual(items.map(item=>item.id),['p1','shared','p2'],'membership paths are merged, deduplicated, and sorted');
  const propertyCalls=client.calls.filter(call=>call.table==='properties');
  assert.equal(propertyCalls.length,2);
  assert.deepEqual(propertyCalls.map(call=>call.in[0]).sort(),['company_id','id']);
  assert.ok(propertyCalls.every(call=>call.in[1].length>0),'every property query must be membership scoped');
  assert.ok(client.calls.filter(call=>call.table.endsWith('_members')).every(call=>call.eq[0]==='user_id'&&call.eq[1]==='user-1'));
}

{
  const client=clientFixture({property_members:{data:[],error:{code:'PGRST205'}},company_members:{data:[],error:null}});
  assert.deepEqual(await loadAccessibleProperties(client,'user-2'),[]);
  assert.equal(client.calls.filter(call=>call.table==='properties').length,0,'no membership must never fall back to an unscoped catalog query');
}

{
  const client=clientFixture({property_members:{data:null,error:{code:'42501'}},company_members:{data:[],error:null}});
  await assert.rejects(()=>loadAccessibleProperties(client,'user-3'),error=>error.code==='42501');
}

const html=await readFile(new URL('./owner.html',import.meta.url),'utf8');
const gate=await readFile(new URL('./owner-gate.js',import.meta.url),'utf8');
for(const label of ['Мои объекты','Бронирования','Календарь','Настройки','Добавить объект'])assert.match(html,new RegExp(label));
assert.match(html,/class="add-property"[^>]*disabled/);
assert.match(html,/data-view="reservations"[^>]*hidden/);assert.match(html,/data-view="calendar"[^>]*hidden/);
assert.match(gate,/location\.replace\('\.\/login\.html'\)/);assert.match(gate,/client\.auth\.signOut\(\)/);
assert.doesNotMatch(gate,/demo-|mock|fixture|seed/i);assert.doesNotMatch(html,/demo-|mock|fixture/i);
console.log('Owner dashboard tests passed: auth redirects, stage navigation, disabled writes, and membership-scoped RLS reads.');
