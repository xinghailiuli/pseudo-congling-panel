import { check } from './errors.mjs';
export function defaultConfig() {
  return {
    night: { allowSleep: false, sleepHour: 23, wakeHour: 7, wakePolicy: 'private', maxWakeAttempts: 6, minSleepMinutes: 30, maxSleepHours: 9, dreamEnabled: true },
    memory: { enabled: true, autoExtract: true, maxPerMessage: 3, recallBudget: 4000, forgetting: true, halfLifeDays: [0, 365, 180, 90, 30, 7], archiveThreshold: 0.08, profileEnabled: true },
    affinity: { enabled: true, dailyCap: 8, decayPerDay: 0.2, stages: [0, 20, 50, 80] },
    proactive: { quietStart: 23, quietEnd: 8, minAffinity: 0, unansweredBackoffMinutes: 120, maxUnanswered: 2 },
    generation: { timeoutMs: 90000, maxJobsPerHour: 6 },
    expression: { style: '', perceptionNotes: '' },
  };
}
export function validateConfig(value) {
  const fail = (ok, field) => check(ok, 'INVALID_CONFIG', `设置 ${field} 不合法`);
  const base = defaultConfig();
  fail(value && typeof value === 'object' && !Array.isArray(value), 'root');
  fail(Object.keys(value).length === Object.keys(base).length && Object.keys(value).every(k => k in base), 'sections');
  for (const [group, fields] of Object.entries(base)) {
    const v = value[group];
    fail(v && typeof v === 'object' && !Array.isArray(v), group);
    fail(Object.keys(v).length === Object.keys(fields).length && Object.keys(v).every(k => Object.hasOwn(fields, k)), group);
    for (const [k, sample] of Object.entries(fields)) {
      const entry = v[k]; const field = `${group}.${k}`;
      if (Array.isArray(sample)) fail(Array.isArray(entry) && entry.length === sample.length && entry.every(x => Number.isFinite(x) && x >= 0 && x <= 36500), field);
      else if (typeof sample === 'number') fail(Number.isFinite(entry) && entry >= 0, field);
      else fail(typeof entry === typeof sample, field);
    }
  }
  for (const k of ['sleepHour', 'wakeHour']) fail(Number.isInteger(value.night[k]) && value.night[k] <= 23, `night.${k}`);
  fail(['private', 'all', 'none'].includes(value.night.wakePolicy), 'night.wakePolicy');
  fail(Number.isInteger(value.night.maxWakeAttempts) && value.night.maxWakeAttempts >= 1 && value.night.maxWakeAttempts <= 50, 'night.maxWakeAttempts');
  fail(value.night.minSleepMinutes <= 240 && value.night.maxSleepHours >= 1 && value.night.maxSleepHours <= 24, 'night.duration');
  fail(Number.isInteger(value.memory.maxPerMessage) && value.memory.maxPerMessage >= 1 && value.memory.maxPerMessage <= 10, 'memory.maxPerMessage');
  fail(value.memory.recallBudget >= 100 && value.memory.recallBudget <= 16000, 'memory.recallBudget');
  fail(value.memory.archiveThreshold <= 1 && value.memory.halfLifeDays[0] === 0 && value.memory.halfLifeDays.slice(1).every(x => x >= 1), 'memory.forgetting');
  fail(value.affinity.dailyCap <= 100 && value.affinity.decayPerDay <= 10 && value.affinity.stages.every((n,i,a) => n <= 100 && (!i || n > a[i-1])), 'affinity');
  fail(value.proactive.quietStart <= 23 && value.proactive.quietEnd <= 23 && Number.isInteger(value.proactive.quietStart) && Number.isInteger(value.proactive.quietEnd), 'proactive.quiet');
  fail(value.proactive.minAffinity <= 100 && value.proactive.maxUnanswered <= 20 && Number.isInteger(value.proactive.maxUnanswered) && value.proactive.unansweredBackoffMinutes <= 10080, 'proactive.backoff');
  fail(value.generation.timeoutMs >= 1000 && value.generation.timeoutMs <= 180000 && value.generation.maxJobsPerHour >= 1 && value.generation.maxJobsPerHour <= 60, 'generation');
  fail(value.expression.style.length <= 8000 && value.expression.perceptionNotes.length <= 8000, 'expression');
  return structuredClone(value);
}
