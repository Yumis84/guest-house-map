// Opt-in full-stack acceptance. Refuses every non-loopback URL; never applies migrations.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
function local(name,protocols){
 const value=process.env[name];if(!value)throw Error(name+' is required for an isolated local Supabase stack.');
 const url=new URL(value);if(!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||!protocols.includes(url.protocol))throw Error('Refusing non-loopback '+name);
 return value;
}
let db,admin;const users=[],companies=[randomUUID(),randomUUID()],properties=[randomUUID(),randomUUID(),randomUUID()];
const paths=[];
try{
 const url=local('OWNER_TEST_SUPABASE_URL',['http:']);
 const database=local('OWNER_TEST_DATABASE_URL',['postgres:','postgresql:']);
 const anon=process.env.OWNER_TEST_ANON_KEY,service=process.env.OWNER_TEST_SERVICE_ROLE_KEY;
 if(!anon||!service)throw Error('Local anon and service-role keys are required; do not use hosted credentials.');
 admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
 db=new pg.Client({connectionString:database});await db.connect();
 assert.equal((await db.query('select public.owner_cabinet_version() version')).rows[0].version,1,'Install candidate on the isolated local baseline first');
 const clients=[];
 for(let i=0;i<4;i++){
  const email='owner-v1-'+randomUUID()+'@example.test',password=randomUUID()+randomUUID();
  const made=await admin.auth.admin.createUser({email,password,email_confirm:true});
  if(made.error)throw Error('Local Auth fixture creation failed');users.push(made.data.user.id);
  const client=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const signed=await client.auth.signInWithPassword({email,password});if(signed.error)throw Error('Local password sign-in failed');
  clients.push(client);
 }
 await db.query('insert into public.companies(id,name) values($1,$2),($3,$4)',[companies[0],'Owner V1 test A',companies[1],'Owner V1 test B']);
 for(const [i,c,role]of [[0,0,'owner'],[1,1,'owner'],[2,0,'viewer']])await db.query('insert into company_members(company_id,user_id,member_role) values($1,$2,$3)',[companies[c],users[i],role]);
 for(const [i,c,published]of [[0,0,false],[1,1,false],[2,1,true]])await db.query('insert into properties(id,company_id,name,locality,published) values($1,$2,$3,$4,$5)',[properties[i],companies[c],'Owner V1 fixture '+i,'Test',published]);
 const visitor=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
 for(const [client,expected]of [[clients[0],[properties[0],properties[2]]],[clients[1],[properties[1],properties[2]]],[clients[2],[properties[0],properties[2]]],[clients[3],[properties[2]]],[visitor,[properties[2]]]]){
  const r=await client.from('properties').select('id').in('id',properties);assert.equal(r.error,null);assert.deepEqual(r.data.map(x=>x.id).sort(),expected.sort());
 }
 console.log('PASS JWT reads: A, B, viewer, no membership, anon');
 const own=await clients[0].from('properties').update({description:'Edited'}).eq('id',properties[0]).select('id');assert.equal(own.error,null);assert.equal(own.data.length,1);
 for(const [client,id]of [[clients[0],properties[1]],[clients[0],properties[2]],[clients[2],properties[0]],[clients[3],properties[0]]]){
  const r=await client.from('properties').update({description:'Forbidden'}).eq('id',id).select('id');assert.ok(r.error||r.data.length===0);
 }
 assert.ok((await clients[0].from('properties').update({company_id:companies[1]}).eq('id',properties[0])).error);
 assert.ok((await clients[0].from('company_members').insert({company_id:companies[1],user_id:users[0],member_role:'owner'})).error);
 await clients[3].auth.updateUser({data:{role:'owner',company_id:companies[0]}});
 const forged=await clients[3].from('properties').select('id').eq('id',properties[0]);assert.equal(forged.data.length,0);
 console.log('PASS JWT mutations: own edit, foreign denial, viewer denial, no self-membership/transfer/metadata escalation');
 const bucket='owner-property-photos',path=companies[0]+'/'+properties[0]+'/'+randomUUID()+'.webp';paths.push(path);
 const photo=await readFile('assets/stepan/stepan-01.webp');
 assert.equal((await clients[0].storage.from(bucket).upload(path,photo,{contentType:'image/webp',upsert:false})).error,null);
 assert.ok((await clients[1].storage.from(bucket).download(path)).error);
 assert.ok((await visitor.storage.from(bucket).download(path)).error);
 assert.equal((await clients[2].storage.from(bucket).download(path)).error,null);
 const forbiddenPath=companies[1]+'/'+properties[1]+'/'+randomUUID()+'.webp';paths.push(forbiddenPath);
 assert.ok((await clients[0].storage.from(bucket).upload(forbiddenPath,photo,{contentType:'image/webp'})).error);
 const viewerPath=companies[0]+'/'+properties[0]+'/'+randomUUID()+'.webp';paths.push(viewerPath);
 assert.ok((await clients[2].storage.from(bucket).upload(viewerPath,photo,{contentType:'image/webp'})).error);
 assert.ok((await clients[0].storage.from(bucket).upload(path,photo,{contentType:'image/webp',upsert:true})).error);
 await clients[1].storage.from(bucket).remove([path]);assert.equal((await clients[0].storage.from(bucket).download(path)).error,null);
 const removed=await clients[0].storage.from(bucket).remove([path]);assert.equal(removed.error,null);assert.equal(removed.data.length,1);
 await db.query('delete from company_members where user_id=$1',[users[0]]);
 const revoked=await clients[0].from('properties').select('id').eq('id',properties[0]);assert.equal(revoked.data.length,0);
 for(const client of clients)await client.auth.signOut();
 console.log('PASS JWT Storage and membership revocation; local password sign-in/sign-out');
}catch(error){
 console.error('FAIL local JWT acceptance: '+(error instanceof assert.AssertionError?'assertion failed (inspect isolated fixture stack)':error.message));
 process.exitCode=1;
}finally{
 if(db){
  if(admin&&paths.length)await admin.storage.from('owner-property-photos').remove(paths);
  await db.query('delete from public.properties where id=any($1::uuid[])',[properties]).catch(()=>{});
  await db.query('delete from public.company_members where company_id=any($1::uuid[])',[companies]).catch(()=>{});
  await db.query('delete from public.companies where id=any($1::uuid[])',[companies]).catch(()=>{});
  if(admin)for(const id of users)await admin.auth.admin.deleteUser(id);
  await db.end();
 }
}
