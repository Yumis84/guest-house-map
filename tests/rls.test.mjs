import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
let db;
const uid=n=>'20000000-0000-0000-0000-'+String(n).padStart(12,'0');
const cid=n=>'10000000-0000-0000-0000-'+String(n).padStart(12,'0');
const pid=n=>'30000000-0000-0000-0000-'+String(n).padStart(12,'0');
const path=(c,p)=>cid(c)+'/'+pid(p)+'/40000000-0000-0000-0000-000000000001.webp';
before(async()=>{
 db=new PGlite();
 await db.exec(await readFile('tests/fixtures/baseline.sql','utf8'));
 const name=(await readdir('supabase/migrations')).find(n=>n.endsWith('_owner_cabinet_v1.sql'));
 await db.exec(await readFile('supabase/migrations/'+name,'utf8'));
 await db.exec(await readFile('supabase/migrations/20261018100000_owner_self_publish_DRAFT.sql','utf8'));
 await db.query("insert into storage.objects(bucket_id,name) values ('owner-property-photos',$1),('owner-property-photos',$2)",[path(1,1),path(2,2)]);
});
after(async()=>{await db?.close();});
async function as(n,fn){
 await db.exec('begin');
 try{
  await db.query("select set_config('request.jwt.claim.sub',$1,true)",[n?uid(n):'']);
  await db.exec('set local role '+(n?'authenticated':'anon'));
  await fn();
 }finally{await db.exec('rollback');}
}
const rows=async(sql,params=[])=>(await db.query(sql,params)).rows;
test('anonymous cannot read base properties; private photos denied',()=>as(0,async()=>{
 await assert.rejects(db.query('select name from properties'),e=>e.code==='42501');
 assert.equal((await rows('select * from storage.objects')).length,0);
}));
for(const [n,expected] of [[1,['A draft']],[2,['B draft','B public']],[3,['A draft']],[4,[]]]){
 test('private owner-only property reads for user '+n,()=>as(n,async()=>{
  const names=(await rows('select name from properties order by name')).map(r=>r.name);
  assert.deepEqual(names,expected);
 }));
}
test('membership SELECT returns only caller',()=>as(1,async()=>{const r=await rows('select * from company_members');assert.equal(r.length,1);assert.equal(r[0].user_id,uid(1));}));
for(const n of [1,5,6])test('owner/manager/admin can update own draft and revision: '+n,()=>as(n,async()=>{
 const r=await rows('update properties set name=$1,contact_phone=$2 where id=$3 returning owner_revision,name',['Edited','+7 900 123-45-67',pid(1)]);
 assert.deepEqual(r,[{owner_revision:1,name:'Edited'}]);
 assert.equal((await rows('update properties set name=$1 where id=$2 and owner_revision=0 returning id',['Stale',pid(1)])).length,0);
}));
for(const [n,p] of [[1,2],[1,3],[3,1],[4,1],[2,1]])test('foreign/viewer/nonmember update changes zero rows '+n+'/'+p,()=>as(n,async()=>assert.equal((await rows("update properties set name='Forbidden' where id=$1 returning id",[pid(p)])).length,0)));
for(const sql of [
 "update properties set company_id='"+cid(2)+"' where id='"+pid(1)+"'",
 "update properties set owner_revision=99 where id='"+pid(1)+"'",
 "update properties set source_key='injected' where id='"+pid(1)+"'",
 "insert into company_members values('"+cid(2)+"','"+uid(1)+"','owner')",
 "update company_members set member_role='owner'",
 "delete from company_members",
 "delete from properties",
 "truncate properties",
 "insert into properties(id,company_id,name,locality) values(gen_random_uuid(),'"+cid(1)+"','New','A')"
])test('forbidden privilege: '+sql.split(' ').slice(0,3).join(' '),()=>as(1,async()=>assert.rejects(db.exec(sql),e=>e.code==='42501')));
test('no company transfer even with membership in both',async()=>{
 await db.query('insert into company_members values($1,$2,$3)',[cid(2),uid(1),'owner']);
 try{await as(1,()=>assert.rejects(db.query('update properties set company_id=$1 where id=$2',[cid(2),pid(1)]),e=>e.code==='42501'));}
 finally{await db.query('delete from company_members where company_id=$1 and user_id=$2',[cid(2),uid(1)]);}
});
test('invalid URL rejected by database constraint',()=>as(1,()=>assert.rejects(db.query("update properties set website_url='javascript:alert(1)' where id=$1",[pid(1)]),e=>e.code==='23514')));
test('own private photo readable, foreign private photo hidden',()=>as(1,async()=>assert.deepEqual((await rows('select name from storage.objects')).map(r=>r.name),[path(1,1)])));
for(const [n,p] of [[1,path(2,2)],[1,path(1,2)],[1,cid(1)+'/../x.webp'],[3,path(1,1)],[4,path(1,1)],[0,path(1,1)]])test('photo upload denied: '+n+' '+p,()=>as(n,()=>assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('owner-property-photos',$1)",[p.replace('40000000','50000000')]),e=>e.code==='42501')));
test('owner photo upload and delete own succeeds',()=>as(1,async()=>{
 const p=path(1,1).replace('40000000','50000000');
 assert.equal((await rows("insert into storage.objects(bucket_id,name) values('owner-property-photos',$1) returning id",[p])).length,1);
 assert.equal((await rows('delete from storage.objects where name=$1 returning id',[p])).length,1);
}));
for(const n of [3,4,2])test('viewer/foreign/nonmember cannot delete A photo '+n,()=>as(n,async()=>assert.equal((await rows('delete from storage.objects where name=$1 returning id',[path(1,1)])).length,0)));
test('storage overwrite/rename denied',()=>as(1,async()=>assert.equal((await rows("update storage.objects set name='changed.webp' returning id")).length,0)));
test('revocation takes effect without JWT refresh',async()=>{
 await db.query('delete from company_members where user_id=$1',[uid(1)]);
 try{await as(1,async()=>{assert.equal((await rows('select * from properties where id=$1',[pid(1)])).length,0);assert.equal((await rows('select * from storage.objects')).length,0);});}
 finally{await db.query('insert into company_members values($1,$2,$3)',[cid(1),uid(1),'owner']);}
});
test('restrictive storage guard survives an unrelated broad policy',async()=>{
 await db.exec('create policy unrelated_broad on storage.objects for all to anon,authenticated using(true) with check(true)');
 try{await as(4,async()=>{assert.equal((await rows('select * from storage.objects')).length,0);});await as(0,async()=>assert.equal((await rows('select * from storage.objects')).length,0));}
 finally{await db.exec('drop policy unrelated_broad on storage.objects');}
});

test('publication RPC enforces ownership and anonymous denial',async()=>{
 await as(1,async()=>{
  await db.query('select public.set_property_published($1,true)',[pid(1)]);
  assert.equal((await rows('select published from properties where id=$1',[pid(1)]))[0].published,true);
  await assert.rejects(db.query('select public.set_property_published($1,true)',[pid(2)]),e=>e.code==='42501');
  await assert.rejects(db.query('update properties set published=false where id=$1',[pid(1)]),e=>e.code==='42501');
 });
 await as(3,()=>assert.rejects(db.query('select public.set_property_published($1,true)',[pid(1)]),e=>e.code==='42501'));
 await as(0,()=>assert.rejects(db.query('select public.set_property_published($1,true)',[pid(1)]),e=>e.code==='42501'));
});
test('public catalog hides contacts until owner confirmation',async()=>{
 await db.query("update properties set contact_phone='+7 900 111-22-33' where id=$1",[pid(3)]);
 await as(0,async()=>{
  const [p]=await rows('select contact_phone from public.public_catalog_properties where id=$1',[pid(3)]);
  assert.equal(p.contact_phone,null);
 });
 await as(2,async()=>await db.query('select public.confirm_property_contacts($1)',[pid(3)]));
 await as(0,async()=>{
  const [p]=await rows('select contact_phone from public.public_catalog_properties where id=$1',[pid(3)]);
  assert.equal(p.contact_phone,'+7 900 111-22-33');
 });
});
test('candidate rollback disables owner writes and locks private photos without deleting data',async()=>{
 await db.exec(await readFile('supabase/rollback/owner_self_publish.sql','utf8'));
 await as(1,async()=>{
  await assert.rejects(db.query('select public.set_property_published($1,true)',[pid(1)]),e=>e.code==='42883'||e.code==='42501');
  assert.equal((await rows('select public.owner_cabinet_version() as version'))[0].version,1);
 });
 await db.exec(await readFile('supabase/rollback/owner_cabinet_v1.sql','utf8'));
 await as(1,async()=>{
  assert.equal((await rows('select name from properties')).length,1);
  assert.equal((await rows('select * from storage.objects')).length,0);
  await assert.rejects(db.query("update properties set name='Blocked' where id=$1",[pid(1)]),e=>e.code==='42501');
 });
 assert.equal((await rows('select * from storage.objects')).length,2);
 await db.exec(await readFile('supabase/rollback/owner_cabinet_v1.sql','utf8'));
});
