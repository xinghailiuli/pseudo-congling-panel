import test from 'node:test';import assert from 'node:assert/strict';import { mkdtemp,readFile,writeFile,rm } from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {BasicMemory} from '../src/basic-memory.mjs';import {ToolCatalog} from '../src/tools.mjs';
const bridge=await import('../src/bridge-api.mjs').catch(()=>null),diary=await import('../src/diary.mjs').catch(()=>null),model=await import('../src/model.mjs').catch(()=>null),qq=await import('../src/qq.mjs').catch(()=>null);
test('bounded bridge methods reject arbitrary paths and never retry unknown writes',async()=>{
 assert.ok(bridge);let calls=0;
 const api=new bridge.BridgeApi({config:async()=>({consolePort:3100}),token:async()=>'secret',fetch:async()=>{calls++;throw Error('lost');}});
 await assert.rejects(api.request('evil',{}),{code:'INVALID_ACTION'});
 await assert.rejects(api.request('wake',{key:'private:1',reason:'admin'}),{code:'UPSTREAM_UNKNOWN'});assert.equal(calls,1);
 const good=new bridge.BridgeApi({config:async()=>({consolePort:3100}),token:async()=>'secret',fetch:async(url,init)=>{assert.equal(init.headers['x-console-token'],'secret');return new Response('{"ok":true,"token":"secret","count":3}',{status:200});}});
 const r=await good.request('status');assert.equal(r.count,3);assert.equal(r.token,'[redacted]');
});
test('diary reconciles a committed write after a lost tool response',async t=>{const root=await mkdtemp(join(tmpdir(),'liuli-diary-'));t.after(()=>rm(root,{recursive:true,force:true}));const file=join(root,'diary.jsonl');const d=new diary.Diary(file,async(name,args)=>{await writeFile(file,JSON.stringify({time:'now',content:args.content})+'\n');throw Error('timeout after commit');});assert.equal((await d.write({content:'committed'})).content,'committed');});
test('both lost diary response and failed readback remain unknown, never retryable failed',async()=>{let reads=0,writes=0;const d=new diary.Diary('unused',async()=>{writes++;throw Error('response lost after commit');});d.list=async()=>{if(++reads===1)return [];throw Object.assign(Error('readback unavailable'),{code:'DIARY_UNAVAILABLE'});};await assert.rejects(d.write({content:'committed'}),{code:'UPSTREAM_UNKNOWN'});assert.equal(writes,1);});
test('Basic Memory reconciles deterministic note after lost index commit',async()=>{const record={id:'stable',scope:'private:1',subject:'1',sourceId:'m1',content:'likes cats',evidence:'likes cats'};const memory=new BasicMemory(async(name,args)=>{if(name.endsWith('write_note'))throw Error('note already exists');return {content:`---\nliuli_id: "stable"\nscope: "private:1"\nsubject: "1"\nsource_id: "m1"\n---\n\nlikes cats\n\n## 来源证据\nlikes cats`};});assert.equal(await memory.write(record),'liuli/private-1/liuli-stable');});
test('weather, web summary and Minecraft status reuse exact loaded tool names',async()=>{const calls=[];const tools=new ToolCatalog({list:async()=>[],call:async(name,args)=>{calls.push({name,args});return {content:[{type:'text',text:'source text'}]};},model:{generate:async(kind,source)=>source}});await tools.test({name:'weather',input:'Shanghai'},{});await tools.test({name:'web_summary',input:'https://example.com'},{});await tools.test({name:'mcp__minecraft__mc_status'},{});assert.deepEqual(calls.map(x=>x.name),['mcp__web-search-safe__web_search','mcp__web-search-safe__web_fetch','mcp__minecraft__mc_status']);});
test('FastMCP union envelopes and server-enriched frontmatter reconcile correctly',async()=>{const r={id:'abc',scope:'group:2',subject:'1',sourceId:'msg',content:'cats',evidence:'cats'};const memory=new BasicMemory(async name=>{if(name.endsWith('write_note'))throw Error('exists');return {structuredContent:{result:{permalink:'liuli/group-2/liuli-abc',frontmatter:{liuli_id:'abc',scope:'group:2',subject:'1',source_id:'msg',title:'liuli-abc'},content:'---\ntitle: liuli-abc\ntype: note\n---\n\ncats\n\n## 来源证据\ncats'}}};});assert.equal(await memory.write(r),'liuli/group-2/liuli-abc');assert.equal(await memory.read('liuli/group-2/liuli-abc'),'cats');const write=new BasicMemory(async()=>({structuredContent:{result:{permalink:'saved'}}}));assert.equal(await write.write(r),'saved');});
test('diary reads stable IDs, delegates writes and preserves all existing bytes',async t=>{
 assert.ok(diary);const root=await mkdtemp(join(tmpdir(),'liuli-diary-'));t.after(()=>rm(root,{recursive:true,force:true}));const file=join(root,'diary.jsonl');
 const original=JSON.stringify({time:'2026-10-29 10:00',content:'原文'})+'\n';await writeFile(file,original);
 const d=new diary.Diary(file,async(name,args)=>{assert.equal(name,'mcp__diary__diary_write');await writeFile(file,original+JSON.stringify({time:'2026-10-30 10:00',content:args.content})+'\n');return {content:[{type:'text',text:'已写下'}]};});
 const before=await d.list();await d.write({content:'新日记'});const after=await d.list();assert.equal(before[0].id,after.find(x=>x.content==='原文').id);assert.ok((await readFile(file,'utf8')).startsWith(original));
});
test('model rejects partial/error results and accepts complete bounded generation',async()=>{
 assert.ok(model);const m=new model.Model({llm:()=>({async *stream(){yield {type:'text-delta',text:'正文'};yield {type:'finish',reason:{kind:'stop'}};}}),target:async()=>({provider:'p',model:'m'})});
 assert.equal(await m.generate('dream','资料',1000),'正文');
 const failed=new model.Model({llm:()=>({async *stream(){yield {type:'text-delta',text:'半截'};yield {type:'finish',reason:{kind:'error'}};}}),target:async()=>({provider:'p',model:'m'})});
 await assert.rejects(failed.generate('dream','资料',1000),{code:'MODEL_FAILED'});
});
test('QQ URL policy, numeric IDs and upstream status are validated',async()=>{
 assert.ok(qq);let count=0;const q=new qq.QQ({config:async()=>({snowluma:{httpUrl:'http://127.0.0.1:3000'}}),fetch:async()=>{count++;return new Response('{"status":"failed","retcode":1404}',{status:200});}});
 await assert.rejects(q.profile({nickname:'name'}),{code:'QQ_REJECTED'});assert.equal(count,1);
 await assert.rejects(q.avatar('http://127.0.0.1/private'),{code:'INVALID_IMAGE'});
 await assert.rejects(q.card({groupId:'../',userId:'1',card:'x'}),{code:'INVALID_INPUT'});
 assert.equal(qq.parseQzone('_Callback({"code":0,"msglist":[]});').code,0);
 assert.equal(qq.parseQzone('{"code":0,"data":{main:{hasMoreFeeds:false,text:"literal {unquoted: value}"}}}').data.main.text,'literal {unquoted: value}');
 assert.deepEqual(qq.parseQzone('{code:0,data:{main:{hasMoreFeeds:false},data:[undefined]}}').data.data,[null]);
 assert.equal(qq.parseQzone("{code:0,data:{text:'it\\'s \\x61 test',},}").data.text,"it's a test");
 assert.throws(()=>qq.parseQzone('{code:0,data:process.exit()}'),{code:'QZONE_FORMAT'});
 assert.throws(()=>qq.parseQzone('<script>'),{code:'QZONE_FORMAT'});
});
test('Qzone empty sentinel is valid and a malformed publish receipt remains unknown',async()=>{const q=new qq.QQ({config:async()=>({}),fetch:async()=>new Response('{code:0,data:{main:{hasMoreFeeds:false},data:[undefined]}}')});q.auth={uin:'1',gtk:1,cookies:'fixture',at:Date.now()};assert.equal((await q.qzone('feed')).items.length,0);await assert.rejects(q.qzone('publish',{content:'fixture-only'}),{code:'UPSTREAM_UNKNOWN'});});
