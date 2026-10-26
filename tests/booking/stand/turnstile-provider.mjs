// Real Cloudflare Siteverify with PUBLIC official dummy keys, synthetic token only.
import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const results=[];
for(const [name,secret,expected] of [['pass','1x0000000000000000000000000000000AA',true],['fail','2x0000000000000000000000000000000AA',false],['duplicate','3x0000000000000000000000000000000AA',false]]){
 const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret,response:'XXXX.DUMMY.TOKEN.XXXX'}),signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);const data=await response.json();assert.equal(data.success,expected);if(name==='duplicate')assert.ok(data['error-codes'].includes('timeout-or-duplicate'));results.push({name,result:'PASS'});console.log('PASS real Siteverify public dummy key',name);
}
await mkdir('test-results/m4',{recursive:true});await writeFile('test-results/m4/turnstile.json',JSON.stringify({provider:'actual Cloudflare Siteverify, official PUBLIC dummy keys',limits:'Not production hostname/action/cdata or real challenge acceptance',results},null,2));
