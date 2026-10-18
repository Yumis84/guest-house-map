import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('visual owner demo is isolated from Supabase and real listings',async()=>{
 const html=await readFile('owner-demo.html','utf8');
 const js=await readFile('owner-demo.js','utf8');
 for(const id of ['demoProperties','demoTitle','demoStatus','demoForm','demoName','demoDescription','demoPhone','demoEmail','demoPublish','demoConfirm','demoGuest'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/без подключения к базе/);
 assert.match(js,/Демонстрационный дом № 1/);
 assert.match(js,/Демонстрационный дом № 2/);
 assert.match(js,/h\.confirmed/);
 assert.doesNotMatch(js,/supabase|fetch\(|XMLHttpRequest|localStorage|sessionStorage/i);
 assert.match(html,/src="\.\/owner-demo\.js"/);
});
