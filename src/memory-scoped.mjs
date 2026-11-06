import { check } from './errors.mjs';
import { factBody } from './basic-memory.mjs';

// 受限记忆适配器：两道闸
//   1) Vault frontmatter 与权威记录必须一致（scope / subject / source_id 三项等值）；
//   2) 权威记录必须为当前事实（存在、active、未被取代）。
// 返回的 id 是可再次传入的稳定标识（permalink），调用方无需自行拼接。
export function createScopedMemory({ basicMemory, session, authority, previewChars = 240 }) {
  check(basicMemory && typeof basicMemory.invoke === 'function', 'INVALID_INPUT', '缺少 Basic Memory 客户端');
  check(typeof authority === 'function', 'INVALID_INPUT', '缺少权威状态查询');
  const scope = session && session.scope, subject = session && session.subject;
  check(typeof scope === 'string' && scope, 'INVALID_INPUT', '会话缺少 scope');

  async function resolve(identifier) {
    if (!identifier) return null;
    const internal=authority(identifier);
    if(internal){
      if(internal.scope!==scope||internal.status!=='active'||(subject&&String(internal.subject)!==subject)||!internal.sourceRef)return null;
      identifier=internal.sourceRef;
    }
    let note;
    try {
      note = await basicMemory.invoke('read_note', { identifier, include_content: true, include_frontmatter: true, output_format: 'json' });
    } catch { return null; }
    const meta = note && note.frontmatter;
    if (!meta || String(meta.scope) !== scope) return null;
    const liuliId = String(meta.liuli_id || '');
    const rec = authority(liuliId);
    // 引用必须来自权威记录：若记录带 sourceRef，笔记标识必须与它一致（否则视为他人/伪造笔记）。
    if (rec && rec.sourceRef && String(rec.sourceRef) !== String(identifier)) return null;
    if (!rec || rec.status !== 'active' || rec.supersededBy) return null;
    // 三项等值核对：笔记不得冒充别的会话/主体/来源。
    if (String(rec.scope) !== scope) return null;
    if (String(meta.subject || '') !== String(rec.subject || '')) return null;
    if (subject && String(rec.subject || '') !== subject) return null;
    if (String(meta.source_id || '') !== String(rec.sourceId || '')) return null;
    const content = factBody(note.content);
    return { id: String(rec.sourceRef || identifier), liuliId, scope: String(meta.scope), subject: String(meta.subject || ''),
      sourceId: String(meta.source_id || ''), level: rec.level, chars: content.length, content };
  }

  const preview = v => {
    const limit = Math.max(80, Math.min(Number(previewChars) || 240, 1000));
    const text = v.content.slice(0, limit);
    return { id: v.id, liuliId: v.liuliId, scope: v.scope, subject: v.subject, sourceId: v.sourceId, level: v.level,
      chars: v.chars, text, truncated: v.content.length > limit };
  };

  return {
    // 整库检索命中后逐条回读校验；只返回有界摘要，完整正文走 expand。
    async search(query, { limit = 5 } = {}) {
      const cap = Math.max(1, Math.min(Number(limit) || 5, 20));
      const raw = await basicMemory.invoke('search_notes', { query, page_size: Math.max(cap * 3, 10), output_format: 'json' });
      const hits = Array.isArray(raw && raw.results) ? raw.results : [];
      const kept = [];
      for (const hit of hits) {
        const v = await resolve(hit && (hit.permalink || hit.identifier));
        if (v) kept.push(preview(v));
        if (kept.length >= cap) break;
      }
      // A later read can yield to a correction/forget of an earlier hit.
      return kept.filter(hit=>{const r=authority(hit.liuliId);return r&&r.status==='active'&&!r.supersededBy&&r.scope===scope&&(!subject||String(r.subject)===subject)&&(!r.sourceRef||r.sourceRef===hit.id);});
    },

    async read(identifier, { max = 600 } = {}) {
      const v = await resolve(identifier);
      if (!v) check(false, 'NOT_FOUND', '记忆不存在', 404);
      const limit = Math.max(200, Math.min(Number(max) || 600, 4000));
      const text = v.content.slice(0, limit);
      return { id: v.id, liuliId: v.liuliId, scope: v.scope, subject: v.subject, sourceId: v.sourceId, level: v.level,
        chars: v.chars, text, truncated: v.content.length > limit, nextOffset: v.content.length > limit ? limit : null };
    },

    async expand(identifier, { offset = 0, max = 1200 } = {}) {
      const v = await resolve(identifier);
      if (!v) check(false, 'NOT_FOUND', '记忆不存在', 404);
      check(Number.isInteger(offset) && offset >= 0, 'INVALID_INPUT', 'offset 应为非负整数');
      const limit = Math.max(200, Math.min(Number(max) || 1200, 4000));
      const from = Math.min(offset, v.content.length);
      const text = v.content.slice(from, from + limit);
      const nextOffset = from + text.length < v.content.length ? from + text.length : null;
      return { id: v.id, liuliId: v.liuliId, scope: v.scope, subject: v.subject, sourceId: v.sourceId, level: v.level,
        chars: v.chars, offset: from, limit, text, truncated: nextOffset !== null, nextOffset };
    },
  };
}
