import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicConfig,propertyPatch,canEdit,photoPath} from '../owner-common.js';
test('public config rejects secret/service-role and remote cleartext',()=>{
 for(const config of [{url:'https://example.supabase.co',publishableKey:'sb_secret_test'},{url:'http://example.com',publishableKey:'sb_publishable_test'},{url:'https://example.com',publishableKey:'a.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.s'}])assert.throws(()=>publicConfig(config));
 assert.equal(publicConfig({url:'https://example.supabase.co',publishableKey:'sb_publishable_test'}).url,'https://example.supabase.co');
});
test('patch is an allowlist and validates unsafe inputs',()=>{
 const p=propertyPatch({name:' House ',company_id:'forged',owner_revision:999,published:true});
 assert.deepEqual(Object.keys(p),['name','description','contact_phone','contact_email','website_url','published']);
 assert.equal(p.name,'House');
 for(const website_url of ['javascript:alert(1)','https://user:pass@example.com','data:text/html,a'])assert.throws(()=>propertyPatch({name:'A',website_url}));
 assert.throws(()=>propertyPatch({name:' '}));
 assert.equal(canEdit('viewer'),false);assert.equal(canEdit('owner'),true);assert.equal(canEdit('unknown'),false);
});
test('photo paths cannot escape the property prefix',()=>{
 assert.throws(()=>photoPath({id:'../x',company_id:'x'},'bad.svg'));
});
