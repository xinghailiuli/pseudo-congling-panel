export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function check(condition, code, message, status = 400) {
  if (!condition) throw new HttpError(status, code, message);
}
const sensitive = /^(?:authorization|cookie|set-cookie|password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|consoleToken|agentToken|token|credentials)$/i;
export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sensitive.test(k) ? '[redacted]' : redact(v)]));
  if (typeof value === 'string') return value.replace(/(?:authorization\s*[:=]\s*(?:Bearer\s+)?|(?:x-console-token|api[_-]?key|password|cookie|token)\s*[:=]\s*)[^\s,;]+/gi, '[redacted]');
  return value;
}
export function publicError(error) {
  return { code: error?.code || 'INTERNAL_ERROR', message: error instanceof HttpError ? redact(error.message) : '操作失败，请查看主机诊断日志。' };
}
export function text(value, name, max = 5000, allowEmpty = false) {
  check(typeof value === 'string' && value.length <= max && (allowEmpty || value.trim().length > 0), 'INVALID_INPUT', `${name}格式不正确或超过长度限制`);
  return value;
}
export function scopeKey(value) {
  check(typeof value === 'string' && /^(private|group):\d{1,20}$/.test(value), 'INVALID_SCOPE', '需要明确的 QQ 私聊或群聊会话');
  return value;
}
