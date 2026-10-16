import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';

const sqlRoot = new URL('../publication/sql/', import.meta.url);
const files = (await readdir(sqlRoot)).filter(name => name.endsWith('.sql'));
const sources = await Promise.all(files.map(async name => [name, await readFile(new URL(name, sqlRoot), 'utf8')]));
const integration = sources.find(([name]) => name.includes('owner_publication_integration'))?.[1];

test('publication SQL exposes no direct properties UPDATE path to client roles', () => {
  for (const [name, sql] of sources) {
    assert.doesNotMatch(sql,
      /\bgrant\s+update(?:\s*\([^;]*\))?\s+on\s+(?:table\s+)?public\.properties\s+to\s+(?:authenticated|anon|public)\b/i,
      `${name} grants a client role direct properties UPDATE`);
    assert.doesNotMatch(sql,
      /\bcreate\s+policy\s+\S+\s+on\s+public\.properties[\s\S]*?\bfor\s+(?:update|all)\s+to\s+(?:authenticated|anon|public)\b/i,
      `${name} creates a client properties write policy`);
  }
});

test('integration candidate removes the reviewed Owner Cabinet bypass and fails closed', () => {
  assert.ok(integration, 'integration migration candidate is missing');
  assert.match(integration, /revoke\s+update\s*\([\s\S]*?published[\s\S]*?\)\s+on\s+public\.properties\s+from\s+authenticated/i);
  assert.match(integration, /drop\s+policy\s+owner_update_properties\s+on\s+public\.properties/i);
  assert.match(integration, /a direct properties write path remains/i);
  assert.doesNotMatch(integration, /jsonb_object_keys\(p_patch\)[\s\S]{0,300}'published'/i,
    'submission RPC must not allow published in its patch allowlist');
});

test('transition RPCs are definer-isolated, locked, role-gated and atomically audited', () => {
  assert.match(integration, /security\s+definer\s+set\s+search_path\s*=\s*''/gi);
  assert.match(integration, /from\s+public\.properties[\s\S]*?for\s+update/i);
  assert.match(integration, /from\s+public\.publication_submissions[\s\S]*?for\s+update/i);
  assert.match(integration, /Reviewer cannot review their own submission/i);
  assert.match(integration, /publication_reviewer_roles/i);
  assert.match(integration, /create\s+trigger\s+publication_submission_immutable_v1/i);
  assert.match(integration, /Submitted fields are immutable/i);
  assert.match(integration, /perform\s+public\.publication_append_audit_v1/i);
  assert.match(integration, /revoke\s+all\s+on\s+function\s+public\.publication_append_audit_v1[\s\S]*?authenticated/i);
});
