import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,descendants,settle} from './helpers/workspace-dom.mjs';
const mod=await import('../src/room-workspace.mjs').catch(()=>null);
const list={items:[],page:1,limit:30,total:0};
function fixture(){
 assert.ok(mod?.createRoomWorkspace,'furniture needs its own in-room workspace');
 const document=createDocument(),requests=[],held=new Map(),store={},revisions={},handlers=new Map();
 const data={
  '/memory/list':{...list,total:1,items:[{id:'m1',content:'记得窗边的花',level:3,scope:'private:12',subject:'12',status:'active',strength:0.7,sourceId:'source-1',createdAt:'2026-10-01T00:00:00Z'}]},
  '/persona':{name:'琉璃',content:'原人格',etag:'etag-one',preview:'实际预览',sections:{},history:[{id:'p1',name:'旧版',at:'2026-09-01T00:00:00Z'}]},
  '/diary/list':{...list,total:2,items:[{id:'d1',content:'今天一起听雨。',time:'2026-10-31',mood:'平静'},{id:'d2',content:'第二页日记',time:'2026-10-30',mood:'开心'}]},
  '/diary/export':{text:'# 今天的日记'},'/memory/library':{notes:['旧笔记']},
  '/night/state':{stage:'awake',sleeping:false,energy:80,mood:60,attempts:0,unread:{'private:12':2},timeline:[]},
  '/settings':{config:{night:{allowSleep:false,sleepHour:23,wakeHour:8,wakePolicy:'private',maxWakeAttempts:3,minSleepMinutes:30,maxSleepHours:10,dreamEnabled:true},memory:{enabled:true}}},
  '/proactive/sessions':{conversations:[{key:'private:12'}]},'/night/unread':{messages:['晚安']},
  '/night/dreams':{...list,total:1,items:[{id:'dream-1',content:'梦见了会发光的小麦。',scope:'private:12',at:'2026-10-31T00:00:00Z',strength:1,source:'memory',pinned:false,archived:false}]}
 };
 const request=(action,body={},revision)=>{requests.push({action,body,revision});if(held.has(action))return new Promise((resolve,reject)=>held.set(action,{resolve,reject}));if(handlers.has(action))return handlers.get(action)(body,revision);return Promise.resolve({data:structuredClone(data[action]??{ok:true}),revision:revisions[action]??(action==='/settings'?15:10)});};
 const workspace=mod.createRoomWorkspace({document,request,store});
 const all=()=>descendants(workspace.element),button=text=>all().find(e=>e.tagName==='BUTTON'&&(e.textContent===text||e.getAttribute('aria-label')===text)),click=async text=>{const b=button(text);assert.ok(b,'button '+text);await b.fire('click');await settle();};
 const input=(name,value)=>{const e=all().find(e=>e.name===name);assert.ok(e,'field '+name);e.value=value;return e;};
 const edit=(name,value)=>{const e=input(name,value);let f=e;while(f&&f.tagName!=='FORM')f=f.parentNode;assert.ok(f,'editable form');f.fire('input');};
 return {workspace,document,store,requests,data,held,all,revisions,handlers,button,click,input,edit};
}

test('computer, book and bedside have distinct in-room models and opening never writes',async()=>{
 const f=fixture();for(const [kind,text]of [['computer','记忆档案'],['enchant','今天一起听雨。'],['bed','让她休息']]){await f.workspace.open(kind);assert.equal(f.workspace.element.getAttribute('data-workspace'),kind);assert.match(f.workspace.element.textContent,new RegExp(text));assert.ok(f.button('回到小屋'));f.workspace.close();}
 assert.equal(f.requests.some(r=>r.revision!==undefined),false);
});
test('computer edits real facts and persona with each read revision and persona etag',async()=>{
 const f=fixture();await f.workspace.open('computer');await f.click('编辑这条记忆');f.edit('content','更正后的事实');await f.click('保存记忆');let r=f.requests.find(r=>r.action==='/memory/update');assert.equal(r.body.id,'m1');assert.equal(r.body.content,'更正后的事实');assert.equal(r.revision,10);
 await f.click('人格档案');f.edit('content','修改后的人格');await f.click('保存人格');r=f.requests.find(r=>r.action==='/persona/save');assert.equal(r.body.etag,'etag-one');assert.equal(r.body.content,'修改后的人格');assert.equal(r.revision,10);
 await f.click('历史版本');await f.click('恢复这一版');assert.equal(f.requests.at(-2)?.action==='/persona/rollback'||f.requests.some(r=>r.action==='/persona/rollback'),true);
});
test('diary pages, handwritten entry, bookmark and export use existing contracts',async()=>{
 const f=fixture();await f.workspace.open('enchant');await f.click('下一篇');assert.match(f.workspace.element.textContent,/第二页日记/);await f.click('收藏');assert.equal(f.requests.find(r=>r.action==='/diary/pin').body.id,'d2');
 await f.click('写一页');f.edit('mood','开心');f.edit('content','写下新的片段');await f.click('保存这一页');assert.deepEqual(f.requests.find(r=>r.action==='/diary/write').body,{mood:'开心',content:'写下新的片段'});
 await f.click('导出日记');assert.ok(f.all().some(e=>e.value==='# 今天的日记'));assert.ok(f.button('回到小屋'));
});
test('bed controls and settings preserve independent revisions and unrelated configuration',async()=>{
 const f=fixture();await f.workspace.open('bed');await f.click('让她休息');assert.equal(f.requests.find(r=>r.action==='/night/sleep').revision,10);
 await f.click('作息设置');await f.click('保存作息');const saved=f.requests.find(r=>r.action==='/settings/save');assert.equal(saved.revision,15);assert.deepEqual(saved.body.config.memory,{enabled:true});
 await f.click('梦的收藏');await f.click('保留这个梦');assert.deepEqual(f.requests.find(r=>r.action==='/night/dream/pin').body,{id:'dream-1',pinned:true});
});
test('close/reopen and sibling tabs preserve new drafts after a late acknowledgement',async()=>{
 const f=fixture();await f.workspace.open('computer');await f.click('人格档案');f.edit('content','草稿 A');f.held.set('/persona/save',true);const pending=f.click('保存人格');await settle();
 f.workspace.close();await f.workspace.open('computer');await f.click('人格档案');f.edit('content','草稿 B');f.held.get('/persona/save').resolve({data:{ok:true},revision:30});await pending;
 await f.click('记忆档案');await f.click('人格档案');
 const value=f.all().find(e=>e.name==='content').value;assert.equal(value,'草稿 B');
});
test('late reads and export responses cannot replace another furniture workspace',async()=>{
 const f=fixture();f.held.set('/memory/list',true);const old=f.workspace.open('computer');await settle();f.workspace.close();await f.workspace.open('enchant');f.held.get('/memory/list').resolve({data:f.data['/memory/list'],revision:99});await old;assert.equal(f.workspace.element.getAttribute('data-workspace'),'enchant');
 f.held.set('/diary/export',true);const exportPending=f.click('导出日记');await settle();f.workspace.close();await f.workspace.open('bed');f.held.get('/diary/export').resolve({data:{text:'迟到的导出'},revision:99});await exportPending;assert.ok(!f.all().some(e=>e.value==='迟到的导出'));
});
test('failed reads retain a themed escape/retry and closing restores triggering focus',async()=>{
 const f=fixture(),trigger=f.document.createElement('button');f.document.body.append(trigger);f.held.set('/diary/list',true);const opening=f.workspace.open('enchant',trigger);await settle();f.held.get('/diary/list').reject(Error('服务暂时不可用'));await opening;
 assert.ok(f.button('重新读取'));assert.match(f.workspace.element.textContent,/服务暂时不可用/);await f.click('回到小屋');assert.equal(f.workspace.isOpen(),false);assert.equal(f.document.activeElement,trigger);
});

test('reopened persona drafts require reconciliation with external changes and stay with their original persona',async()=>{
 const f=fixture();await f.workspace.open('computer');await f.click('人格档案');f.edit('content','旧版本上的草稿');f.workspace.close();
 f.data['/persona']={...f.data['/persona'],content:'外部更正',etag:'etag-two'};f.revisions['/persona']=20;
 await f.workspace.open('computer');assert.equal(f.all().find(e=>e.name==='content').value,'旧版本上的草稿');await f.click('保存人格');
 assert.equal(f.requests.filter(r=>r.action==='/persona/save').length,0,'old draft must not silently inherit current version');
 assert.match(f.workspace.element.textContent,/外部更正/);await f.click('已核对，继续编辑这份草稿');await f.click('保存人格');
 const saved=f.requests.find(r=>r.action==='/persona/save');assert.equal(saved.revision,20);assert.equal(saved.body.etag,'etag-two');
 f.edit('content','只属于琉璃');f.workspace.close();f.data['/persona']={...f.data['/persona'],name:'另一个人格',content:'另一份正文',etag:'different'};
 await f.workspace.open('computer');assert.equal(f.all().find(e=>e.name==='content').value,'另一份正文');
});

test('memory and settings drafts retain read baselines across navigation and explicit reconciliation preserves current other settings',async()=>{
 const f=fixture();await f.workspace.open('computer');await f.click('编辑这条记忆');f.edit('content','记忆草稿');f.workspace.close();f.revisions['/memory/list']=20;
 f.data['/memory/list'].items[0].content='其他窗口改过的记忆';await f.workspace.open('computer');await f.click('编辑这条记忆');await f.click('保存记忆');
 assert.equal(f.requests.filter(r=>r.action==='/memory/update').length,0);await f.click('已核对，继续编辑这份草稿');await f.click('保存记忆');assert.equal(f.requests.find(r=>r.action==='/memory/update').revision,20);
 f.workspace.close();await f.workspace.open('bed');await f.click('作息设置');f.edit('sleepHour','22');f.workspace.close();f.revisions['/settings']=40;f.data['/settings'].config.memory.enabled=false;
 await f.workspace.open('bed');await f.click('作息设置');await f.click('保存作息');assert.equal(f.requests.filter(r=>r.action==='/settings/save').length,0);
 await f.click('已核对，继续编辑这份草稿');await f.click('保存作息');const saved=f.requests.find(r=>r.action==='/settings/save');assert.equal(saved.revision,40);assert.equal(saved.body.config.night.sleepHour,22);assert.equal(saved.body.config.memory.enabled,false);
});

test('edits made during a save continue from that receipt only and still conflict with later external writes',async()=>{
 const f=fixture();await f.workspace.open('computer');await f.click('人格档案');f.edit('content','A');f.held.set('/persona/save',true);const pending=f.click('保存人格');await settle();f.edit('content','B');
 f.held.get('/persona/save').resolve({data:{name:'琉璃',content:'A',etag:'etag-two'},revision:30});await pending;f.held.delete('/persona/save');
 f.handlers.set('/persona/save',async(body,revision)=>{assert.equal(revision,30);assert.equal(body.etag,'etag-two');assert.equal(body.content,'B');return {data:{name:'琉璃',content:'B',etag:'etag-three'},revision:40};});
 const second=f.click('保存人格');f.edit('content','C');await second;assert.equal(f.requests.filter(r=>r.action==='/persona/save').length,2);
 f.handlers.set('/persona/save',async(body,revision)=>{assert.equal(revision,40);assert.equal(body.etag,'etag-three');throw Error('外部版本已变化');});
 await f.click('保存人格');assert.match(f.workspace.element.textContent,/外部版本已变化/);assert.equal(f.all().find(e=>e.name==='content').value,'C');
});

test('backward diary page boundary selects the last entry and forward selects the first',async()=>{
 const f=fixture(),entries=Array.from({length:60},(_,i)=>({id:'d'+(i+1),time:'day '+(i+1),content:'Entry '+(i+1)}));
 f.handlers.set('/diary/list',async b=>{const page=b.page||1;return {data:{items:entries.slice((page-1)*30,page*30),page,limit:30,total:60},revision:10};});
 await f.workspace.open('enchant');await f.click('下一页');
 const reading=()=>f.all().find(e=>e.className==='ws-diary-reading').textContent;assert.equal(reading(),'Entry 31');
 await f.click('上一篇');assert.equal(reading(),'Entry 30');await f.click('下一篇');assert.equal(reading(),'Entry 31');
});

test('Tab and Shift-Tab stay within the furniture dialog and skip hidden or disabled controls',async()=>{
 const f=fixture();await f.workspace.open('computer');const first=f.button('回到小屋'),last=f.button('归档'),disabled=f.document.createElement('button'),hidden=f.document.createElement('button');
 disabled.disabled=true;for(const n of [first,last,disabled,hidden]){n.tabIndex=0;n.getClientRects=()=>n===hidden?[]:[{}];}
 f.workspace.element.querySelectorAll=()=>[first,disabled,last,hidden];let prevented=false;
 last.focus();await f.workspace.element.fire('keydown',{key:'Tab',preventDefault(){prevented=true;}});assert.equal(f.document.activeElement===first,true);assert.equal(prevented,true);
 first.focus();await f.workspace.element.fire('keydown',{key:'Tab',shiftKey:true});assert.equal(f.document.activeElement===last,true);
});
