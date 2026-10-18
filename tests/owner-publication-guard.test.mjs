import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(path,'utf8');

test('publication controls are disabled until server capability is available',async()=>{
 const html=await read('owner.html');
 const js=await read('owner-dashboard.js');
 assert.match(html,/id="publishToggle"[^>]*hidden disabled/);
 assert.match(html,/id="confirmContacts"[^>]*hidden disabled/);
 assert.match(js,/publicationReady=version===2/);
 assert.match(js,/publicationReady\?',contact_confirmed_at':'/);
 assert.match(js,/\[1,2\]\.includes\(version\)/);
 assert.match(js,/client\.rpc\(action,args\)/);
 assert.match(js,/kind==='confirm'&&!confirm\(/);
 assert.match(js,/kind==='publish'&&!p\.published&&!confirm\(/);
 assert.match(js,/Сначала сохраните изменения в карточке/);
 assert.match(js,/\['owner','admin'\]/);
});

test('self-publish migration requires authorization and excludes broad base-table SELECT',async()=>{
 const sql=await read('supabase/migrations/20261018100000_owner_self_publish_DRAFT.sql');
 assert.match(sql,/security definer set search_path=''/i);
 assert.match(sql,/drop policy if exists published_properties_read/i);
 assert.match(sql,/grant select \(id,company_id,name,description,published/i);
 assert.doesNotMatch(sql,/grant select on public\.properties to authenticated/i);
 assert.match(sql,/revoke all on function public\.set_property_published\(uuid,boolean\) from public, anon/i);
});

test('rollback is fail closed and never restores published_properties_read',async()=>{
 const sql=await read('supabase/rollback/owner_self_publish.sql');
 assert.match(sql,/drop policy if exists published_properties_read/i);
 assert.doesNotMatch(sql,/create policy published_properties_read/i);
 assert.doesNotMatch(sql,/grant select on public\.properties to authenticated/i);
 assert.match(sql,/revoke select on public\.properties from anon,authenticated/i);
});
