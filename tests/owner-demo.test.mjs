import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('visual owner demo is isolated from Supabase and real listings',async()=>{
 const html=await readFile('owner-demo.html','utf8');
 const js=await readFile('owner-demo.js','utf8');
 for(const id of ['demoProperties','demoTitle','demoStatus','demoForm','demoName','demoCategory','demoListingRole','demoDescription','demoPrice','demoMinNights','demoAvailable','demoValidation','demoPhone','demoEmail','demoPublish','demoConfirm','demoGuest'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/без подключения к базе/);
 assert.match(js,/Демонстрационный дом № 1/);
 assert.match(js,/Демонстрационный дом № 2/);
 assert.match(js,/h\.confirmed/);
 assert.doesNotMatch(js,/supabase|fetch\(|XMLHttpRequest|sessionStorage/i);
 assert.match(js,/localStorage\.setItem/);
 assert.match(js,/indexedDB\.open/);
 assert.match(js,/canvas\.toDataURL\('image\/webp'/);
 assert.match(html,/src="\.\/owner-demo\.js"/);
 assert.match(html,/id="demoPrice"[^>]+min="1"[^>]+required/);
 assert.match(html,/id="demoMinNights"[^>]+min="1"[^>]+required/);
 assert.match(js,/available:false/);
 assert.match(js,/function validateStep/);
 assert.match(js,/if\(!validateStep\(step\)\)return/);
 assert.match(js,/₽ за ночь/);
});
