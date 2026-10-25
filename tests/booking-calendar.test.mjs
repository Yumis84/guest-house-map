import test from 'node:test';
import assert from 'node:assert/strict';
import {monthDays,dayOccupancy} from '../booking-calendar.js';
test('month grid starts Monday and includes leap day',()=>{const days=monthDays('2028-02');assert.equal(days.filter(Boolean).length,29);assert.equal(days.filter(Boolean).at(-1),'2028-02-29');assert.equal(days.length,30);});
test('checkout is exclusive, allowing same-day turnover',()=>{const events=[{starts_on:'2026-11-01',ends_on:'2026-11-03',kind:'reservation'},{starts_on:'2026-11-03',ends_on:'2026-11-06',kind:'hold'}];assert.equal(dayOccupancy('2026-11-02',events).length,1);assert.equal(dayOccupancy('2026-11-03',events).length,1);assert.equal(dayOccupancy('2026-11-06',events).length,0);});
test('overlapping hold and block are both visible',()=>{const events=[{starts_on:'2026-11-01',ends_on:'2026-11-05',kind:'hold'},{starts_on:'2026-11-02',ends_on:'2026-11-04',kind:'block'}];assert.equal(dayOccupancy('2026-11-03',events).length,2);});
