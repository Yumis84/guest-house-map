import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(process.env.PGLITE_MODULE?pathToFileURL(process.env.PGLITE_MODULE).href:'@electric-sql/pglite');
const db=new PGlite();
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const p='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',unit='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const config={template:'calendar',theme:'light',accent:'#226b50',radius:12,maxWidth:720,fluid:true,title:'Дом А',language:'ru',buttonText:'Запросить даты',opening:'inline',policyUrl:'https://example.test/privacy'};
try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to public;grant execute on function auth.uid() to public;
 create table public.properties(id uuid primary key,company_id uuid,published boolean);
 create table public.company_members(company_id uuid,user_id uuid,member_role text);
 create table public.physical_units(id uuid primary key,property_id uuid,active boolean,unit_code text);
 grant select on public.properties,public.company_members,public.physical_units to authenticated;
 insert into properties values('${p}','${p}',true);
 insert into company_members values('${p}','${owner}','owner');
 insert into physical_units values('${unit}','${p}',true,'unit-a');`);
 for(const file of ['widget-v2-config','widget-v2-requests'])await db.exec(await readFile(new URL(`./sql/${file}.CANDIDATE.sql`,import.meta.url),'utf8'));
 async function role(name,user=''){await db.exec(`reset role;set role ${name};`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);}
 const scalar=async(sql,args=[])=>{if(/^select (public\.)?widget_v2_(save|publish)\(/.test(sql))sql='select to_jsonb('+sql.slice(7)+')';return Object.values((await db.query(sql,args)).rows[0])[0];};
 await role('authenticated',owner);
 let w=await scalar('select public.widget_v2_save(null,$1,$2,$3,$4::jsonb,null)',[p,unit,'Внутреннее имя',JSON.stringify(config)]);
 assert.match(w.public_id,/^[a-f0-9]{32}$/);
 await role('anon');assert.equal(await scalar('select widget_v2_config($1)',[w.public_id]),null);
 await assert.rejects(db.query('select * from widget_configs'));await assert.rejects(db.query('select * from widget_private.contacts'));
 await role('authenticated',other);assert.equal((await db.query('select * from widget_configs')).rows.length,0);
 await assert.rejects(db.query('select widget_v2_publish($1,1)',[w.id]));
 await role('authenticated',owner);w=await scalar('select widget_v2_publish($1,1)',[w.id]);
 await role('anon');let pub=await scalar('select widget_v2_config($1)',[w.public_id]);assert.equal(pub.config.title,config.title);
 assert.deepEqual(Object.keys(pub).sort(),['config','publicId','version']);
 assert.equal((await scalar('select widget_v2_availability($1,current_date,current_date+30)',[w.public_id])).ready,false);
 await role('authenticated',owner);
 const updated={...config,title:'Изменённый черновик'};
 await scalar('select widget_v2_save($1,$2,$3,$4,$5::jsonb,1)',[w.id,p,unit,'Изменить',JSON.stringify(updated)]);
 await assert.rejects(db.query('select widget_v2_publish($1,1)',[w.id]));
 assert.equal((await scalar('select widget_v2_config($1)',[w.public_id])).config.title,config.title);
 w=await scalar('select widget_v2_publish($1,2)',[w.id]);assert.equal(w.published_version,2);
 assert.equal(w.previous_published.title,config.title);
 await assert.rejects(db.query('select widget_v2_save(null,$1,$2,$3,$4::jsonb,null)',[p,unit,'X',JSON.stringify({...config,script:'alert(1)'})]));
 await db.exec(`reset role;insert into widget_private.activation values('${unit}',true,4,15,true);`);
 // The deliberately missing inventory adapter must fail, never return free dates.
 await assert.rejects(db.query('select widget_v2_availability($1,current_date,current_date+30)',[w.public_id]));
 // Synthetic adapter only inside this disposable database. Not a deployment candidate.
 await db.exec(`create or replace function widget_private.inventory_blocks(p_unit uuid,p_start date,p_end date)
 returns table(starts_on date,ends_on date) language sql set search_path='' as $$select current_date+5,current_date+7$$;`);
 await role('service_role');
 const checks=[];for(let n=0;n<6;n++)checks.push(await scalar("select widget_v2_rate_limit('test-hash',5,60)"));
 assert.deepEqual(checks,[true,true,true,true,true,false]);
 const start=await scalar("select to_char(current_date+30,'YYYY-MM-DD')"),end=await scalar("select to_char(current_date+33,'YYYY-MM-DD')");
 const payload={checkin:start,checkout:end,guests:2,name:'Тест',phone:'+79000000000',comment:'private',consent:true};
 const token='cccccccc-cccc-4ccc-8ccc-cccccccccccc',fingerprint='a'.repeat(64);
 const args=[w.public_id,JSON.stringify(payload),token,fingerprint];
 const accepted=await scalar('select widget_v2_submit($1,$2::jsonb,$3,$4)',args);
 assert.equal(accepted.accepted,true);
 assert.deepEqual(await scalar('select widget_v2_submit($1,$2::jsonb,$3,$4)',args),accepted);
 await assert.rejects(db.query('select widget_v2_submit($1,$2::jsonb,$3,$4)',[...args.slice(0,2),'dddddddd-dddd-4ddd-8ddd-dddddddddddd',fingerprint]));
 await role('anon');await assert.rejects(db.query('select widget_v2_submit($1,$2::jsonb,$3,$4)',args));
 const dates=await scalar('select widget_v2_availability($1,current_date,current_date+60)',[w.public_id]);
 assert.equal(dates.ready,true);assert.equal(dates.blocks.length,2);assert.doesNotMatch(JSON.stringify(dates),/private|phone|guest_name/);
 await role('authenticated',other);await assert.rejects(db.query('select widget_v2_owner_requests($1)',[p]));
 await role('authenticated',owner);assert.equal((await db.query('select * from widget_v2_owner_requests($1)',[p])).rows[0].phone,payload.phone);
 console.log('PASS SQL: synthetic schema, ACL/RLS two owners, drafts/publication/revision, public projection, activation gate, inventory failure, persistent limiter, idempotency, overlapping holds, private contacts. No production SQL.');
}finally{await db.close();}
