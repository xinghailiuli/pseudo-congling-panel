import { check } from './errors.mjs';

export const MAX_EXPAND_CHARS = 4000;
export const MAX_INJECT_CHARS = 4000;

// 回复前只注入有界摘要与稳定引用；每条摘要都带可续读的引用信息。
export function summarizeForInjection(rows, config = {}) {
  const per = Math.max(80, Math.min(Number(config.summaryChars || 240), 1000));
  const total = Math.max(per, Math.min(Number(config.injectionBudgetChars || 1200), MAX_INJECT_CHARS));
  const lines = []; let used = 0;
  for (const r of rows || []) {
    const body = String(r.content || '').replace(/\s+/g, ' ').trim();
    const slice = body.length > per ? body.slice(0, per) + "…" : body;
    const line = `[${r.id}] ${slice}`;
    if (used + line.length > total) break;
    used += line.length + 1; lines.push(line);
  }
  return lines.join('\n');
}

// 详情读取：每页都重新校验 scope 归属、当前状态与版本指纹，再按硬上限截断。
export function expandFromRecords(records, { scope, id, offset = 0, max = 1200, expectedHidden = null } = {}) {
  check(typeof id === 'string' && /^[0-9a-f]{8,64}$/.test(id), 'INVALID_INPUT', '记忆 ID 不合法');
  check(Number.isInteger(offset) && offset >= 0, 'INVALID_INPUT', 'offset 应为非负整数');
  const row = (records || []).find(r => r.id === id);
  check(row && row.scope === scope, 'NOT_FOUND', '记忆不存在', 404);
  check(row.status === 'active', 'MEMORY_UNAVAILABLE', `记忆当前状态为 ${row.status}，不作为当前事实使用`, 409);
  if (expectedHidden && row.hiddenAt) check(false, 'MEMORY_UNAVAILABLE', '记忆已被遗忘，不作为当前事实使用', 409);
  const body = String(row.content || '');
  const limit = Math.max(200, Math.min(Number(max) || 1200, MAX_EXPAND_CHARS));
  const from = Math.min(offset, body.length);
  const text = body.slice(from, from + limit);
  const nextOffset = from + text.length < body.length ? from + text.length : null;
  return { id: row.id, scope: row.scope, subject: row.subject, sourceId: row.sourceId, level: row.level, status: row.status,
    version: row.version || null, offset: from, limit, text, truncated: nextOffset !== null, nextOffset };
}

// 与被注入摘要严格一致：只返回真正进入注入的条目。
export function buildMemoryRefs(rows, config = {}) {
  const text = summarizeForInjection(rows, config);
  if (!text) return [];
  const ids = new Set(text.split('\n').filter(Boolean).map(l => l.slice(1, l.indexOf(']'))));
  return (rows || []).filter(r => ids.has(r.id)).map(r => ({
    id: r.id, scope: r.scope, subject: r.subject, sourceId: r.sourceId, level: r.level,
    chars: String(r.content || '').length,
    truncated: String(r.content || '').length > Math.max(80, Number(config.summaryChars || 240)),
  }));
}
