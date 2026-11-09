import {defaultRoom} from './room-defaults.mjs';
import { mkdir, open, readFile, rename, unlink, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { defaultConfig, validateConfig } from './config.mjs';
import { HttpError, check, redact } from './errors.mjs';

export function initialState(now = Date.now()) {
  return {
    schemaVersion: 1, companionId: 'liuli', revision: 0, createdAt: now, updatedAt: now,
    config: defaultConfig(),
    night: { energy: 80, mood: 60, initialized: true, updatedAt: now, sleeping: false, startedAt: null, wokeAt: now, attempts: 0, seen: [], timeline: [], dreamCycles: [], unread: {} },
    room: defaultRoom(),
    memories: [], subjects: {}, merges: [], profiles: {}, affinity: {}, settlements: [], dreams: [],
    diaryMeta: {}, avatars: [], avatarCurrent: null, personaHistory: [], jobs: [], events: [], receipts: {}, sessions: {}, checkpoints: {},
  };
}
export function validateState(s) {
  check(s?.schemaVersion === 1 && s.companionId === 'liuli' && Number.isSafeInteger(s.revision) && s.revision >= 0, 'STATE_CORRUPT', '状态文件版本或结构损坏，原文件已保留', 503);
  validateConfig(s.config);
  for (const k of ['memories','merges','settlements','dreams','avatars','personaHistory','jobs','events']) check(Array.isArray(s[k]), 'STATE_CORRUPT', `状态集合 ${k} 损坏`, 503);
  for (const k of ['night','room','subjects','profiles','affinity','diaryMeta','receipts','sessions','checkpoints']) check(s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]), 'STATE_CORRUPT', `状态字段 ${k} 损坏`, 503);
  check(Number.isFinite(s.night.energy) && Number.isFinite(s.night.mood) && typeof s.night.sleeping === 'boolean' && Array.isArray(s.night.timeline) && Array.isArray(s.night.seen) && Array.isArray(s.night.dreamCycles) && s.night.unread && typeof s.night.unread === 'object', 'STATE_CORRUPT', '长夜状态损坏', 503);
  check(typeof s.room.lamp === 'boolean' && typeof s.room.curtain === 'boolean' && Array.isArray(s.room.items) && Array.isArray(s.room.interactions), 'STATE_CORRUPT', '房间状态损坏', 503);
  return s;
}
async function atomicWrite(path, data) {
  const temp = `${path}.${randomUUID()}.tmp`;
  const handle = await open(temp, 'wx', 0o600);
  try { await handle.writeFile(data, 'utf8'); await handle.sync(); } finally { await handle.close(); }
  try { await rename(temp, path); } catch (error) { await unlink(temp).catch(() => {}); throw error; }
}
export function logEvent(state, type, detail, now = Date.now()) {
  state.events.push({ id: randomUUID(), at: now, type, detail: redact(detail) });
  state.events = state.events.slice(-1000);
}
export class CompanionStore {
  static async open(root) {
    await mkdir(root, { recursive: true });
    const lockPath = join(root, '.owner.lock');
    let lock;
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner; try { owner = JSON.parse(await readFile(lockPath, 'utf8')); } catch { throw new HttpError(503, 'STATE_LOCKED', '状态锁内容不可读，需要检查原文件'); }
      let alive = true;
      if (Number.isInteger(owner.pid) && owner.pid > 0) { try { process.kill(owner.pid, 0); } catch (e) { if(e.code === 'ESRCH') alive = false; } }
      if (alive) throw new HttpError(503, 'STATE_LOCKED', '已有陪伴中心进程正在管理状态');
      await unlink(lockPath); lock = await open(lockPath, 'wx', 0o600);
    }
    const ownerId = randomUUID();
    await lock.writeFile(JSON.stringify({ pid: process.pid, id: ownerId })); await lock.close();
    const store = new CompanionStore(root, lockPath, ownerId);
    try {
      let raw;
      try { raw = await readFile(store.path, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      if (raw === undefined) { store.state = initialState(); await atomicWrite(store.path, JSON.stringify(store.state, null, 2)); }
      else { try { store.state = validateState(JSON.parse(raw)); } catch { throw new HttpError(503, 'STATE_CORRUPT', '状态文件损坏，已保留原文件与备份，未恢复默认值'); } }
      return store;
    } catch (e) { await store.close(); throw e; }
  }
  constructor(root, lockPath, ownerId) { this.root = root; this.path = join(root, 'state.json'); this.lockPath = lockPath; this.ownerId = ownerId; this.queue = Promise.resolve(); this.closed = false; }
  revision() { check(!this.closed, 'STORE_CLOSED', '状态服务已停止', 503); return this.state.revision; }
  read() { check(!this.closed, 'STORE_CLOSED', '状态服务已停止', 503); return structuredClone(this.state); }
  update(expectedRevision, fn) {
    const run = this.queue.then(async () => {
      check(!this.closed, 'STORE_CLOSED', '状态服务已停止', 503);
      if (expectedRevision !== null) check(Number.isSafeInteger(expectedRevision) && expectedRevision === this.state.revision, 'REVISION_CONFLICT', '数据已被更新，请刷新后再保存', 409);
      const next = structuredClone(this.state);
      await fn(next);
      next.revision = this.state.revision + 1; next.updatedAt = Date.now(); validateState(next);
      await atomicWrite(join(this.root, 'state.backup.json'), JSON.stringify(this.state, null, 2));
      await atomicWrite(this.path, JSON.stringify(next, null, 2));
      this.state = next; return this.read();
    });
    this.queue = run.catch(() => {}); return run;
  }
  async backup() {
    await this.queue; const name = `snapshot-${Date.now()}-${randomUUID()}.json`;
    await copyFile(this.path, join(this.root, name)); return { name, revision: this.state.revision };
  }
  async close() {
    await this.queue; this.closed = true;
    try { const lock = JSON.parse(await readFile(this.lockPath, 'utf8')); if (lock.id === this.ownerId) await unlink(this.lockPath); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
}
