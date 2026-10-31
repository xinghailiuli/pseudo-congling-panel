import { randomUUID } from 'node:crypto';
import { check, text, scopeKey } from './errors.mjs';
import { beijingDate } from './night.mjs';
export function canonicalSubject(s,id) {let value=id;const seen=new Set();while(s.subjects[value]?.mergedInto&&!seen.has(value)){seen.add(value);value=s.subjects[value].mergedInto;}return value;}
export function mergeSubjects(s,from,to,now=Date.now()) {
  text(from,'源主体',100);text(to,'目标主体',100);check(!['__proto__','constructor','prototype'].includes(from)&&!['__proto__','constructor','prototype'].includes(to),'INVALID_MERGE','主体标识不合法');check(from!==to&&canonicalSubject(s,to)!==from&&!s.subjects[from]?.mergedInto,'INVALID_MERGE','不能循环合并或重复合并');
  const row={id:randomUUID(),from,to,at:now,active:true,previous:structuredClone(s.subjects[from]||null)};
  s.subjects[from]={...(s.subjects[from]||{}),mergedInto:to};s.merges.push(row);return row;
}
export function rollbackMerge(s,id,now=Date.now()) {
  const row=s.merges.find(r=>r.id===id&&r.active);check(row,'NOT_FOUND','有效的合并记录不存在',404);
  check(!s.merges.some(r=>r.active&&r.at>row.at&&(r.from===row.to||r.to===row.from)),'MERGE_DEPENDENCY','请先撤销后续关联的合并',409);
  if(row.previous)s.subjects[row.from]=row.previous;else delete s.subjects[row.from];row.active=false;row.rolledBackAt=now;return row;
}
export function profileEvidence(s,records,scope,subject) {
  scopeKey(scope);const id=canonicalSubject(s,subject);
  return records.filter(r=>r.scope===scope&&canonicalSubject(s,r.subject)===id&&r.status==='active');
}
export function affinityView(s,scope,subject,now=Date.now()) {
  const row=s.affinity[`${scope}|${subject}`]||{value:0,updatedAt:now,daily:0,date:beijingDate(now)};
  const value=Math.max(0,row.value-Math.max(0,now-row.updatedAt)/86400000*s.config.affinity.decayPerDay);
  return {...row,value,stage:s.config.affinity.stages.filter(n=>value>=n).length-1};
}
export function settleAffinity(s,input,now=Date.now()) {
  const scope=scopeKey(input.scope),subject=text(input.subject,'主体 ID',100),id=`${scope}|${subject}|${text(input.id,'事件 ID',200)}`;
  if(s.settlements.includes(id)||!s.config.affinity.enabled)return {duplicate:true};
  check(Number.isFinite(input.delta)&&Math.abs(input.delta)<=10,'INVALID_INPUT','单次好感变化应在 -10 到 10 之间');
  const row=affinityView(s,scope,subject,now),date=beijingDate(now);const used=row.date===date?row.daily:0;
  const delta=Math.sign(input.delta)*Math.min(Math.abs(input.delta),Math.max(0,s.config.affinity.dailyCap-used));
  s.affinity[`${scope}|${subject}`]={value:Math.max(0,Math.min(100,row.value+delta)),updatedAt:now,daily:used+Math.abs(delta),date};
  s.settlements.push(id);s.settlements=s.settlements.slice(-20000);return {delta,value:s.affinity[`${scope}|${subject}`].value};
}
