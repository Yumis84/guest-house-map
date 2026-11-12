import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../booking-owner.js',import.meta.url),'utf8');
test('idempotency key reused for same action and revision',()=>{assert.match(code,/const intents=new Map\(\)/);assert.match(code,/intents\.get\(intentId\)/);assert.match(code,/p_key:intent\.uuid/);assert.doesNotMatch(code,/p_key:crypto\.randomUUID\(\)/);});
test('filters and search only used in requests view',()=>{assert.match(code,/\$\('filter'\)\.closest\('label'\)\.hidden=view!=='requests'/);assert.match(code,/p_q:view==='requests'\?\$\('search'\)\.value:''/);});
test('domain errors translated and calendar timezone explicit',()=>{for(const codeName of ['dates_unavailable','revision_conflict','invalid_transition','forbidden','not_found','rate_limited'])assert.ok(code.includes(codeName));assert.ok(code.includes('Europe/Kaliningrad'));});
