import {readFile} from 'node:fs/promises';import {seed,ids} from './seed.mjs';
export const legacyId='33333333-3333-4333-8333-333333333333';
export async function seedM4(db,{active=false}={}){
 const widget=await seed(db);await db.query(await readFile(new URL('./legacy-fixture.sql',import.meta.url),'utf8'));await db.query("update properties set source_key='house_001' where id=$1",[ids.property]);
 for(const name of ['compat','pilot','outbox'])await db.query(await readFile(new URL('../../../sql/booking-m4-'+name+'.CANDIDATE.sql',import.meta.url),'utf8'));
 await db.query("insert into booking_requests(id,property_id,unit_id,checkin,checkout,guests,source) values($1,$2,$3,current_date+10,current_date+12,2,'synthetic-legacy')",[legacyId,ids.property,ids.unit]);
 await db.query("insert into booking_guest_contacts(request_id,guest_name,phone,email,guest_comment) values($1,'Synthetic Legacy','+79000009999','old@example.test','Synthetic historical comment')",[legacyId]);
 await db.query('select booking_pilot_set($1,$2)',[ids.property,active?'active':'prepared']);return widget;
}
