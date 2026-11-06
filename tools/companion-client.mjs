import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';import {join} from 'node:path';
export function createCompanionClient({api,baseUrl,root,eligibility,log=()=>{},timeoutMs=1800}){
 let queue=Promise.resolve(),outbox=null,lastErrorAt=0;
 const serial=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
 const report=error=>{if(Date.now()-lastErrorAt>60000){lastErrorAt=Date.now();log('[liuli] 陪伴服务暂不可用，消息保留待补读：'+String(error?.code||'connection'));}};
 const outboxPath=join(root,'bridge-outbox.json');
 async function load(){if(outbox)return;try{outbox=JSON.parse(await readFile(outboxPath,'utf8'));if(!Array.isArray(outbox))throw Error('outbox-invalid');}catch(e){if(e.code==='ENOENT')outbox=[];else throw e;}}
 async function save(){await mkdir(root,{recursive:true});const temp=outboxPath+'.tmp-'+process.pid;await writeFile(temp,JSON.stringify(outbox),{mode:0o600});await rename(temp,outboxPath);}
 async function call(action,body,budgetMs=timeoutMs){
  const url=new URL('/api/liuli/runtime',baseUrl);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('local-only');
  const token=(await readFile(join(root,'runtime-token'),'utf8')).trim();
  const response=await api.doFetch(url,{method:'POST',headers:{'content-type':'application/json','x-liuli-runtime':token},body:JSON.stringify({action,body}),signal:AbortSignal.timeout(budgetMs)});
  const result=await response.json();if(!response.ok||result.error)throw Object.assign(Error('companion-request-failed'),{code:result.error?.code||response.status});return result.data;
 }
 async function offlineGate(reason){if(['proactiveCheck','manualProactive','proactive','idle'].includes(reason))return {allow:false,offline:true,reason:'陪伴条件暂时无法核对，暂缓主动联系'};try{const state=JSON.parse(await readFile(join(root,'state.json'),'utf8'));return {allow:!state.night?.sleeping||['admin','dailyDiary','dailyDiaryPost'].includes(reason),offline:true,reason:'陪伴服务离线，按已保存的睡眠状态处理'};}catch(e){return {allow:e.code==='ENOENT',offline:true,reason:e.code==='ENOENT'?'陪伴服务尚未启用':'陪伴状态不可读取，暂缓自动唤醒'};}}
 async function flushInner(){await load();let last;for(let i=0;i<20&&outbox.length;i++){try{const original=outbox[0],current=eligibility?.(original.scope);const event={...original,...current,authorized:original.authorized===true&&(current?.authorized??true),catchup:original.catchup||Number.isFinite(original.at)&&Date.now()-original.at>60000};last=await call('ingest',event);outbox.shift();await save();}catch(e){report(e);break;}}return last;}
 return {
  async sleeping(){return !(await offlineGate()).allow;},
  async ingest(event){return serial(async()=>{await load();if(!outbox.some(e=>e.scope===event.scope&&e.id===event.id)){if(outbox.length>=5000)throw Error('companion-outbox-full');outbox.push(event);await save();}const result=await flushInner();return result||{sleeping:!(await offlineGate()).allow,offline:true};}).catch(e=>{report(e);return {offline:true};});},
  flush(){return serial(flushInner).catch(report);},
  async beforeWake(body){try{return await call('beforeWake',body);}catch(e){report(e);return offlineGate(body.reason);}},
  async context(body){try{return await call('context',body,8000);}catch(e){report(e);return {text:'',offline:true};}},
  async delivered(body){try{return await call('delivered',body);}catch(e){report(e);return {offline:true};}},
  async memorySearch(body){return call('memorySearch',body,12000);},
  async memoryRead(body){return call('memoryRead',body,12000);},
  async memoryExpand(body){return call('memoryExpand',body,12000);},
 };
}
