import {readFile} from 'node:fs/promises';
export const ids={owner:'11111111-1111-4111-8111-111111111111',other:'22222222-2222-4222-8222-222222222222',property:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',unit:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',resource:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'};
export async function seed(db){
 const exists=await db.query("select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' limit 1");if(exists.rowCount)throw Error('Stand requires empty synthetic database');
 await db.query(await readFile(new URL('../baseline.sql',import.meta.url),'utf8'));
 const metadata=JSON.parse(await readFile(new URL('../../../docs/evidence/widget-v2-live-metadata.json',import.meta.url),'utf8'));
 for(const name of ['ensure_unit_inventory_mapping','sync_reservation_inventory','sync_unit_block_inventory','guard_inventory_mapping_changes'])await db.query(metadata.rpcs.find(x=>x.name===name).definition);
 for(const t of metadata.triggers.filter(x=>!x.includes('owner_property_revision')))await db.query(t);
 for(const name of ['widget-v2-config','widget-v2-requests','booking-m1-lifecycle','booking-m2-ledger','booking-m3-owner'])await db.query(await readFile(new URL('../../../sql/'+name+'.CANDIDATE.sql',import.meta.url),'utf8'));
 const {owner,property,unit,resource}=ids;
 await db.query('insert into properties values($1,$1,true,$2)',[property,'У Степана · СИНТЕТИКА']);
 await db.query("insert into company_members values($1,$2,'owner')",[property,owner]);
 await db.query("insert into physical_units values($1,$2,true,'STEPAN-HOUSE')",[unit,property]);
 await db.query('insert into inventory_resources values($1,$2)',[resource,property]);
 await db.query('insert into unit_resource_requirements values($1,$2,$3)',[unit,resource,property]);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.query('set role authenticated');
 const config={template:'calendar',theme:'light',accent:'#226b50',radius:12,maxWidth:720,fluid:true,title:'У Степана · тестовая заявка',language:'ru',buttonText:'Отправить заявку',opening:'inline',policyUrl:'https://example.test/privacy'};
 const widget=(await db.query("select to_jsonb(widget_v2_save(null,$1,$2,'Synthetic pilot',$3,null)) w",[property,unit,config])).rows[0].w;
 await db.query('select widget_v2_publish($1,1)',[widget.id]);await db.query('reset role');await db.query('insert into widget_private.activation values($1,true,8,15,true)',[unit]);
 // Test-only authenticator role: no table grants, only switching to API roles.
 await db.query("do $$begin if not exists(select 1 from pg_roles where rolname='synthetic_authenticator') then create role synthetic_authenticator login noinherit;end if;end$$;grant anon,authenticated,service_role to synthetic_authenticator");
 // Supabase auth.uid reads request.jwt.claims on PostgREST; retain direct test GUC fallback.
 await db.query(`create or replace function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$`);
 return widget;
}
