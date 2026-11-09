import fs from 'node:fs';

export const NUMEN_HTTP_URL = 'http://127.0.0.1:39002/status';
export const NUMEN_CONFIG_PATH = process.env.LIULI_NUMEN_CONFIG||'';
export const NUMEN_COMPANION_UUID = process.env.LIULI_NUMEN_COMPANION_UUID||'00000000-0000-0000-0000-000000000001';

let cachedToken = undefined;
let cachedTokenAt = 0;
const TOKEN_TTL_MS = 30000;

export function loadNumenToken(cfgPath = NUMEN_CONFIG_PATH) {
  const isDefault = cfgPath === NUMEN_CONFIG_PATH;
  const now = Date.now();
  if (isDefault && cachedToken !== undefined && now - cachedTokenAt < TOKEN_TTL_MS) return cachedToken;
  let token = null;
  try {
    if (cfgPath && fs.existsSync(cfgPath) && fs.statSync(cfgPath).size <= 16384) {
      const j = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      token = typeof j.token === 'string' && /^[0-9a-f]{16,128}$/i.test(j.token) ? j.token : null;
    }
  } catch {
    token = null;
  }
  if (isDefault) { cachedToken = token; cachedTokenAt = now; }
  return token;
}

export async function probeNumenStatus({
  url = NUMEN_HTTP_URL,
  token = loadNumenToken(),
  companionUuid = NUMEN_COMPANION_UUID,
  timeoutMs = 600,
  fetchImpl = globalThis.fetch
} = {}) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: token ? { 'X-Numen-Token': token } : {},
      signal: ac.signal
    });
    if (!res.ok) {
      return { ok: false, status: '未启动 / 离线', code: `HTTP_${res.status}`, source: 'Numen HTTP Bridge (127.0.0.1:39002)' };
    }
    const text = await res.text();
    const data = JSON.parse(text);
    if (!data || data.ok !== true || data.worldLoaded !== true) {
      return { ok: false, status: '未启动 / 离线', reason: 'world_not_loaded', source: 'Numen HTTP Bridge (127.0.0.1:39002)' };
    }
    const players = Array.isArray(data.numenPlayers) ? data.numenPlayers : [];
    const companion = companionUuid ? players.find(p => p && p.uuid === companionUuid) : null;
    return {
      ok: true,
      status: '在线',
      world: data.levelName,
      source: 'Numen HTTP Bridge (127.0.0.1:39002)',
      companion: companion ? {
        uuid: companion.uuid,
        dimension: companion.dimension,
        x: companion.x,
        y: companion.y,
        z: companion.z,
        health: companion.health
      } : null
    };
  } catch (e) {
    return {
      ok: false,
      status: '未启动 / 离线',
      code: e.cause?.code || e.code || 'OFFLINE',
      source: 'Numen HTTP Bridge (127.0.0.1:39002)'
    };
  } finally {
    clearTimeout(timer);
  }
}
