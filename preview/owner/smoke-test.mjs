import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const files = ['index.html', 'styles.css', 'app.js'];
const source = Object.fromEntries(await Promise.all(files.map(async (name) => [name, await readFile(join(root, name), 'utf8')])));

assert.match(source['index.html'], /value="guest_house"/);
assert.match(source['index.html'], /value="apartment"/);
assert.match(source['index.html'], /value="owner"/);
assert.match(source['index.html'], /value="intermediary"/);
assert.match(source['app.js'], /localStorage\.setItem/);
assert.doesNotMatch(Object.values(source).join('\n'), /supabase|https?:\/\/|fetch\s*\(|XMLHttpRequest|WebSocket/i);

const assetReferences = [...source['index.html'].matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(assetReferences.sort(), ['./app.js', './styles.css']);
for (const reference of assetReferences) {
  assert.ok(reference.startsWith('./'), `Asset must be relative: ${reference}`);
  await access(join(root, reference.slice(2)));
}

for (const marker of ['addEventListener', "form.addEventListener('submit'", "$('togglePublish').addEventListener", "$('addListing').addEventListener"]) {
  assert.ok(source['app.js'].includes(marker), `Missing behavior marker: ${marker}`);
}

assert.doesNotThrow(() => new Function(source['app.js']), 'app.js must contain valid JavaScript');
console.log('Owner preview smoke test passed: syntax, local-only persistence, options, and relative assets verified.');
