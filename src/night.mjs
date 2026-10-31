import { check, scopeKey, text } from './errors.mjs';
const MIN = 60000, HOUR = 60 * MIN;
const clamp = n => Math.min(100, Math.max(0, n));
export const beijingHour = now => new Date(now + 8 * HOUR).getUTCHours();
export const beijingDate = now => new Date(now + 8 * HOUR).toISOString().slice(0, 10);
export function inHours(hour, from, to) { return from === to ? false : from < to ? hour >= from && hour < to : hour >= from || hour < to; }
export function sleepStage(start, now) {
  const elapsed = Math.max(0, (now - start) / MIN);
  if (elapsed < 10) return 'onset';
  const cycle = elapsed % 90;
  return cycle < 30 ? 'light' : cycle < 65 ? 'deep' : 'rem';
}
function event(s, now, type, detail = '') { s.timeline.push({ at: now, type, detail }); s.timeline = s.timeline.slice(-400); }
export function startSleep(s, now, reason = 'manual') {
  if (s.sleeping) return false;
  Object.assign(s, { sleeping: true, startedAt: now, updatedAt: now, attempts: 0, dreamCycles: [] });
  event(s, now, 'sleep', reason); return true;
}
export function wakeNight(s, now, reason = 'manual') {
  if (!s.sleeping) return false;
  s.sleeping = false; s.wokeAt = now; s.updatedAt = Math.max(now, s.updatedAt); s.attempts = 0;
  event(s, now, 'wake', reason); return true;
}
export function advanceNight(s, config, now) {
  check(Number.isFinite(now), 'INVALID_TIME', '时间不合法');
  if (now <= s.updatedAt) return { dreams: [], woke: false };
  const elapsedHours = Math.min(24, (now - s.updatedAt) / HOUR);
  const stage = s.sleeping ? sleepStage(s.startedAt, now) : 'awake';
  s.energy = clamp(s.energy + elapsedHours * (s.sleeping ? (stage === 'deep' ? 15 : 10) : -3));
  s.mood = clamp(s.mood + (60 - s.mood) * (1 - Math.exp(-elapsedHours / 12)));
  s.updatedAt = now;
  const dreams = []; let woke = false;
  if (s.sleeping) {
    const elapsed = now - s.startedAt;
    if (elapsed >= config.maxSleepHours * HOUR || (elapsed >= config.minSleepMinutes * MIN && !inHours(beijingHour(now), config.sleepHour, config.wakeHour))) {
      woke = wakeNight(s, now, 'natural');
    } else if (stage === 'rem' && config.dreamEnabled) {
      const key = `${s.startedAt}:${Math.floor(elapsed / (90 * MIN))}`;
      if (!s.dreamCycles.includes(key)) { s.dreamCycles.push(key); dreams.push({ key, at: now }); }
    }
  } else if (config.allowSleep && now - s.wokeAt > HOUR && (s.energy < 15 || inHours(beijingHour(now), config.sleepHour, config.wakeHour))) startSleep(s, now, 'automatic');
  return { dreams, woke };
}
export function receiveNightMessage(s, input, config, now, random = Math.random) {
  const scope = scopeKey(input.scope); const id = `${scope}:${text(input.id, '消息 ID', 200)}`;
  if (s.seen.includes(id)) return { duplicate: true, woke: false };
  s.seen.push(id); s.seen = s.seen.slice(-5000);
  if(input.catchup)return {woke:false,historical:true};
  if (s.sleeping) s.unread[scope] = (s.unread[scope] || 0) + 1;
  // Input may record while paused, but can never bypass the existing bridge gates.
  if (!input.authorized || input.paused || input.disabled) return { woke: false, gated: true };
  s.initialized = false; s.energy = clamp(s.energy - 0.08); s.mood = clamp(s.mood + 0.05);
  if (!s.sleeping) return { woke: false };
  if (input.adminWake) return { woke: wakeNight(s, now, 'administrator') };
  const allowed = config.wakePolicy === 'all' || (config.wakePolicy === 'private' && scope.startsWith('private:'));
  if (!allowed) return { woke: false };
  s.attempts++;
  const probabilities = { onset: 0.5, light: 0.35, deep: 0.08, rem: 0.2 };
  const chance = Math.min(0.95, probabilities[sleepStage(s.startedAt, now)] + (s.attempts - 1) * 0.08);
  if (s.attempts >= config.maxWakeAttempts || random() < chance) return { woke: wakeNight(s, now, 'message') };
  return { woke: false, attempts: s.attempts, chance };
}
export function nightContext(s, now) {
  const labels = { awake: '清醒', onset: '刚入睡', light: '浅睡', deep: '深睡', rem: '快速眼动睡眠' };
  return `当前状态：${labels[s.sleeping ? sleepStage(s.startedAt, now) : 'awake']}；精力 ${Math.round(s.energy)}/100；心情 ${Math.round(s.mood)}/100。这是陪伴模拟状态，不是现实健康测量。`;
}
export function dreamStrength(dream, now) { return dream.pinned ? dream.intensity : dream.intensity * Math.pow(0.5, Math.max(0, now - dream.at) / (7 * 86400000)); }
