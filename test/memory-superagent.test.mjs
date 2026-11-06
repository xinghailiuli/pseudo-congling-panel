import test from 'node:test';
import assert from 'node:assert/strict';
import { addMemory, recall, applyForgetting, strength, recordAccess } from '../src/memory.mjs';
import { summarizeForInjection, expandFromRecords } from '../src/memory-inject.mjs';

const CFG = { forgetting: true, halfLifeDays: { 1: 7, 3: 30, 5: 90 }, archiveThreshold: 0.08, recallBudget: 4000, summaryChars: 240, injectionBudgetChars: 1200 };
const DAY = 86400000;
const T0 = Date.parse('2026-11-01T00:00:00Z');
const base = (o = {}) => ({ scope: 'private:1', subject: 'u1', sourceId: 'msg-1', content: '主人喜欢紫色纸飞机', level: 3, evidence: '喜欢紫色纸飞机', ...o });

test('1. 读取不强化：recordAccess 只记访问，不动 reinforcements/证据时间', () => {
  const recs = [];
  addMemory(recs, base(), T0);
  const r = recs[0];
  const before = { reinf: r.reinforcements, recalled: r.lastRecalledAt, s: strength(r, T0 + 30 * DAY, CFG) };
  for (let i = 0; i < 5; i++) recordAccess(r, T0 + i * 1000);
  assert.equal(r.reinforcements, before.reinf, '读取不得增加强化计数');
  assert.equal(r.lastRecalledAt, before.recalled, '读取不得推进证据时间');
  assert.equal(r.accessCount, 5);
  assert.equal(strength(r, T0 + 30 * DAY, CFG), before.s, '读取不得提升留存强度');
});

test('2. 新证据强化，重复消息不重复入库', () => {
  const recs = [];
  const a = addMemory(recs, base(), T0);
  const b = addMemory(recs, base({ sourceId: 'msg-2' }), T0 + 1000);
  assert.equal(a.duplicate, false);
  assert.equal(b.duplicate, true);
  assert.equal(recs.length, 1, '同一事实不得新增记录');
  assert.equal(recs[0].reinforcements, 1, '重复证据计一次强化');
  assert.equal(recs[0].lastRecalledAt, T0 + 1000, '证据时间推进');
  assert.ok(strength(recs[0], T0 + 30 * DAY, CFG) > strength({ ...recs[0], reinforcements: 0 }, T0 + 30 * DAY, CFG));
});

test('3. 跨作用域读取被拒绝', () => {
  const recs = [];
  addMemory(recs, base(), T0);
  const id = recs[0].id;
  assert.throws(() => expandFromRecords(recs, { scope: 'group:999', id }), e => e.status === 404);
  assert.throws(() => expandFromRecords(recs, { scope: 'private:2', id }), e => e.status === 404);
  assert.equal(expandFromRecords(recs, { scope: 'private:1', id }).id, id);
});

test('4. 纠正/遗忘后摘要与详情都不再注入旧事实', () => {
  const recs = [];
  addMemory(recs, base(), T0);
  const id = recs[0].id;
  recs[0].status = 'archived'; recs[0].archiveReason = 'decay';
  assert.throws(() => expandFromRecords(recs, { scope: 'private:1', id }), e => e.status === 409);
  const recalled = recall(recs, { scope: 'private:1', config: CFG, now: T0 + DAY });
  assert.equal(recalled.length, 0, '归档记录不得进入召回');
  assert.equal(summarizeForInjection(recalled, CFG), '');
});

test('5. 注入摘要受预算约束且可展开，详情按上限截断可续读', () => {
  const recs = [];
  for (let i = 0; i < 40; i++) addMemory(recs, base({ sourceId: 'm' + i, content: '事实' + i + '：' + 'x'.repeat(600) }), T0 + i);
  const text = summarizeForInjection(recs, CFG);
  assert.ok(text.length <= CFG.injectionBudgetChars + 260, '注入长度受预算约束: ' + text.length);
  const lines = text.split('\n').filter(Boolean);
  assert.ok(lines.length < recs.length, '不得全量注入');
  assert.ok(lines[0].length < 600, '单条为摘要而非全文');
  const one = expandFromRecords(recs, { scope: 'private:1', id: recs[0].id, max: 200 });
  assert.equal(one.truncated, true);
  assert.equal(one.text.length, 200);
  assert.equal(one.nextOffset, 200);
  const full = expandFromRecords(recs, { scope: 'private:1', id: recs[0].id, max: 5000 });
  assert.equal(full.truncated, false);
  assert.equal(full.nextOffset, null);
});

test('6. 过期记忆被遗忘后不出现在摘要，新证据可提升强度', () => {
  const recs = [];
  addMemory(recs, base(), T0);
  const archived = applyForgetting(recs, CFG, T0 + 400 * DAY);
  assert.equal(archived.length, 1);
  assert.equal(recs[0].status, 'archived');
  const fresh = [];
  addMemory(fresh, base(), T0);
  addMemory(fresh, base({ sourceId: 'msg-9' }), T0 + 20 * DAY);
  assert.ok(strength(fresh[0], T0 + 40 * DAY, CFG) > strength({ ...fresh[0], reinforcements: 0, lastRecalledAt: fresh[0].lastRecalledAt }, T0 + 40 * DAY, CFG));
});