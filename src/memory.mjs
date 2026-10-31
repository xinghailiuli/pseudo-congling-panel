import { createHash } from 'node:crypto';
import { check, scopeKey, text } from './errors.mjs';
export const hash = value => createHash('sha256').update(value).digest('hex');
const normal = value => String(value).normalize('NFKC').toLowerCase().replace(/[\p{P}\s]/gu,'');
export function addMemory(records, input, now = Date.now()) {
  const scope=scopeKey(input.scope), subject=text(input.subject,'主体 ID',100), sourceId=text(input.sourceId,'来源 ID',200), content=text(input.content,'记忆正文',12000);
  const level=input.level??3;check(Number.isInteger(level)&&level>=0&&level<=5,'INVALID_INPUT','记忆等级应为 0–5');
  const attribute=String(input.attribute||'').slice(0,120), value=String(input.value||'').slice(0,4000);
  const digest=hash(normal(content)), semantic=hash(`${normal(attribute)}|${normal(value)}`);
  const same=records.find(r=>r.scope===scope&&r.subject===subject&&(r.digest===digest || (attribute&&value&&r.semantic===semantic)));
  if(same){same.lastRecalledAt=now;same.reinforcements=(same.reinforcements||0)+1;return {record:same,duplicate:true};}
  const id=hash(`${scope}|${subject}|${sourceId}|${digest}`).slice(0,32);
  const duplicate=records.find(r=>r.id===id);if(duplicate)return {record:duplicate,duplicate:true};
  const conflicts=records.filter(r=>r.scope===scope&&r.subject===subject&&r.status==='active'&&attribute&&r.attribute===attribute&&r.value!==value);
  const record={id,scope,subject,sourceId,content,attribute,value,digest,semantic,level,status:conflicts.length?'conflict':'active',conflicts:conflicts.map(r=>r.id),createdAt:now,updatedAt:now,lastRecalledAt:now,reinforcements:0,evidence:String(input.evidence||content),kind:input.kind==='event'?'event':'fact',sourceRef:null};
  records.push(record);return {record,duplicate:false};
}
export function resolveMemory(records,id,patch,now=Date.now()) {
  const row=records.find(r=>r.id===id);check(row,'NOT_FOUND','记忆不存在',404);
  check(patch&&typeof patch==='object','INVALID_INPUT','缺少修改内容');
  if('level' in patch)check(Number.isInteger(patch.level)&&patch.level>=0&&patch.level<=5,'INVALID_INPUT','记忆等级应为 0–5');
  if('status' in patch)check(['active','archived','conflict'].includes(patch.status),'INVALID_INPUT','记忆状态不正确');
  if(patch.supersedes){const old=records.find(r=>r.id===patch.supersedes);check(old&&old.id!==row.id&&old.scope===row.scope&&old.subject===row.subject,'INVALID_INPUT','只能修订同一会话、同一主体的记忆');old.status='archived';old.updatedAt=now;row.supersedes=old.id;}
  for(const key of ['level','status'])if(key in patch)row[key]=patch[key];row.updatedAt=now;
  return row;
}
export function strength(r,now,config) {
  if(r.level===0||!config.forgetting)return 1;
  const age=Math.max(0,now-(r.lastRecalledAt??r.createdAt))/86400000;
  return Math.min(1,Math.pow(0.5,age/config.halfLifeDays[r.level])*(1+Math.min(5,r.reinforcements||0)*0.12));
}
export function recall(records,{scope,subject,query='',now=Date.now(),budget,config}) {
  scopeKey(scope);const limit=budget??config.recallBudget;
  const queryText=normal(query);const tokens=[...new Set(queryText.match(/[a-z0-9]+|[\u3400-\u9fff]/g)||[])];
  let used=0;
  return records.filter(r=>r.scope===scope&&(!subject||r.subject===subject)&&r.status==='active')
    .map(r=>{const content=String(r.content||'');const n=normal(content);const relevance=tokens.length?tokens.filter(t=>n.includes(t)).length/tokens.length:0.5;return {...r,strength:strength(r,now,config),score:relevance*0.7+strength(r,now,config)*0.2+(5-r.level)*0.02};})
    .filter(r=>r.strength>=config.archiveThreshold&&(tokens.length===0||r.score>0.3))
    .sort((a,b)=>b.score-a.score||b.updatedAt-a.updatedAt)
    .filter(r=>{const length=String(r.content||'').length+80;if(used+length>limit)return false;used+=length;return true;});
}
export function applyForgetting(records,config,now=Date.now()) {
  const archived=[];if(!config.forgetting)return archived;
  for(const r of records)if(r.status==='active'&&r.level!==0&&strength(r,now,config)<config.archiveThreshold){r.status='archived';r.archiveReason='decay';r.updatedAt=now;archived.push(r.id);}
  return archived;
}
export function parseExtraction(raw,event,max=3) {
  let data;try{data=JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g,''));}catch{check(false,'MODEL_OUTPUT','记忆抽取未返回合法 JSON',502);}
  check(Array.isArray(data.facts)&&data.facts.length<=max,'MODEL_OUTPUT','记忆抽取格式不正确',502);
  return data.facts.map(f=>{
    text(f.content,'事实正文',4000);text(f.evidence,'事实证据',2000);
    check(f.evidence.length>=3&&event.text.includes(f.evidence),'UNGROUNDED_MEMORY','记忆缺少当前用户原话证据',502);
    check(!f.subject||f.subject===event.subject,'UNGROUNDED_MEMORY','不能把第三人的推测记入当前用户事实',502);
    return {...f,scope:event.scope,subject:event.subject,sourceId:event.id,level:Math.max(1,Math.min(5,Number.isInteger(f.level)?f.level:3))};
  });
}
