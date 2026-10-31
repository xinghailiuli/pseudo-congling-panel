import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const modules = await Promise.allSettled(['store', 'config', 'errors'].map(n => import(`../src/${n}.mjs`)));
const get = n => { assert.equal(modules[n].status, 'fulfilled', `${['store','config','errors'][n]} module must exist`); return modules[n].value; };
async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'liuli-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
test('atomic round trip, backup and isolated read snapshots', async t => {
  const { CompanionStore } = get(0); const root = await fixture(t);
  const store = await CompanionStore.open(root);
  const initial = store.read(); initial.room.description = 'external mutation';
  assert.notEqual(store.read().room.description, 'external mutation');
  await store.update(0, s => { s.room.description = '灯下读书'; });
  assert.equal(JSON.parse(await readFile(join(root, 'state.backup.json'), 'utf8')).revision, 0);
  await store.close(); const reopened = await CompanionStore.open(root);
  assert.equal(reopened.read().room.description, '灯下读书');
  assert.equal(reopened.read().revision, 1); await reopened.close();
});
test('concurrent edits reject stale revision and enforce single owner', async t => {
  const { CompanionStore } = get(0); const root = await fixture(t); const s = await CompanionStore.open(root);
  await assert.rejects(CompanionStore.open(root), { code: 'STATE_LOCKED' });
  const results = await Promise.allSettled([s.update(0, x => { x.room.lamp = true; }), s.update(0, x => { x.room.curtain = false; })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'REVISION_CONFLICT');
  await s.close();
});
test('corrupt state is never replaced with defaults', async t => {
  const { CompanionStore } = get(0); const root = await fixture(t);
  await writeFile(join(root, 'state.json'), '{BROKEN');
  await assert.rejects(CompanionStore.open(root), { code: 'STATE_CORRUPT' });
  assert.equal(await readFile(join(root, 'state.json'), 'utf8'), '{BROKEN');
});
test('settings are strict, bounded and retain existing defaults', () => {
  const { defaultConfig, validateConfig } = get(1); const config = defaultConfig();
  assert.equal(config.night.allowSleep, false);
  assert.equal(validateConfig(config).night.wakePolicy, 'private');
  assert.throws(() => validateConfig({ ...config, token: 'secret' }), { code: 'INVALID_CONFIG' });
  config.night.maxWakeAttempts = -1;
  assert.throws(() => validateConfig(config), { code: 'INVALID_CONFIG' });
});
test('redaction removes credentials recursively and in error text', () => {
  const { redact } = get(2);
  const clean = redact({ auth: { cookie: 'abc', apiKey: 'secret', count: 12 }, message: 'Authorization: Bearer abc123 x-console-token=verySecret' });
  assert.equal(clean.auth.count, 12);
  assert.ok(!JSON.stringify(clean).includes('verySecret'));
  assert.ok(!JSON.stringify(clean).includes('abc123'));
  assert.ok(!JSON.stringify(clean).includes('secret'));
});
