import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {webcrypto} from 'node:crypto';import vm from 'node:vm';
import {createRoomWorkspace} from '../src/room-workspace.mjs';
import {createRoomBookReader} from '../src/room-book-reader.mjs';
import {createRoomRestoreGate as restoreGate} from '../src/room-diagnostics.mjs';
const createRoomRestoreGate=options=>restoreGate({...options,schedule:()=>0,cancel:()=>{}});
import {createDocument,Element,descendants,settle} from './helpers/workspace-dom.mjs';
async function fixture(){
 const document=createDocument(),requests=[],responded=new Set(),listeners=[],scenes=[],timers=new Map();let tid=0;
 const list={items:[],total:0,page:1,limit:30};
 const data={
  '/room':{lamp:true,curtain:true,description:'原房间',items:[{id:'bed',name:'床'}],interactions:[]},
  '/night/state':{sleeping:false,stage:'awake',energy:80,mood:60,unread:{},timeline:[]},
  '/jobs':{items:[]},
  '/overview':{night:{sleeping:false,stage:'awake',energy:80,mood:60},settings:{allowSleep:false},counts:{activeMemory:3,indexedMemory:3,diary:2,dreams:1,conflicts:0},connections:{bridge:{ok:true}},room:{lamp:true,curtain:true,description:'原房间'},events:[]},
  '/qzone':{account:{nickname:'琉璃',user_id:'10001'},auth:{ready:true}},
  '/avatar':{pool:[],current:null},
  '/proactive/state':{sleeping:false,bridge:{config:{proactive:{enabled:true}}},sessions:{}},
  '/proactive/sessions':{conversations:[]},
  '/proactive/log':{items:[]},
  '/settings':{config:{night:{allowSleep:false},memory:{},expression:{},proactive:{},affinity:{},generation:{}}},
  '/bridge/settings':{etag:'b1',config:{proactive:{},send:{}}},
  '/subjects/merge_candidates':{subjects:[],history:[]},
  '/affinity':{items:[]},
  '/memory/profile/config':{profiles:{}},
  '/tools':{tools:[{name:'clock',label:'查看时间',group:'system',available:true,readOnly:true}]},
  '/diagnostics':{sources:{},runtime:{},jobs:[],events:[]},
  '/system/backups':{items:[]},
  '/night/dreams':list,'/diary/list':list,'/memory/list':list,
  '/persona':{name:'琉璃',content:'原人格',preview:'原预览',history:[],etag:'one'},
  '/diary/export':{text:'# 日记'}
 };
 const parent={postMessage:r=>requests.push(r)};
 vm.runInNewContext(await readFile(new URL('../panel.js',import.meta.url),'utf8'),{document,parent,Node:Element,crypto:webcrypto,structuredClone,DAFEIYU_CLIPS:{},ROOM_ACTIONS:{house:{repairs:{1:{},2:{}},actions:{garden:{frames:[]}}}},WARDROBE_CATALOG:[],createRoomWorkspace,createRoomBookReader,createRoomRestoreGate,window:{addEventListener(t,fn){if(t==='message')listeners.push(fn);}},setTimeout(fn,delay){timers.set(++tid,{fn,delay});return tid;},clearTimeout(id){timers.delete(id);},createBlockRoom(r,options){const scene=document.createElement('svg');scene.options=options;scene.roomActions=[];scene.setRoomOutfit=()=>true;scene.setRoomFloor=f=>{scene.floor=f;options.onFloor(f,{detail:false});};scene.setRoomDetail=x=>scene.detail=x;scene.setRoomActivity=p=>{if(p.preview!==undefined){scene.preview=p.preview;options.onActivity({preview:p.preview,label:'活动',source:'preview'});}};scene.setRoomFloor('1');scenes.push(scene);return scene;}});
 const reply=(r,value=data[r.action],revision=20,error)=>{responded.add(r.id);listeners.forEach(fn=>fn({source:parent,data:{channel:'liuli-companion',type:'response',id:r.id,payload:error?{error:{message:error}}:{data:value,revision}}}));};
 const drain=async(except=[])=>{for(let i=0;i<15;i++){for(const r of requests.filter(r=>r.type==='request'&&!responded.has(r.id)&&Object.hasOwn(data,r.action)&&!except.includes(r.action)))reply(r);await settle();}};
 const all=()=>descendants(document.body),button=label=>all().find(e=>e.tagName==='BUTTON'&&(e.textContent===label||e.getAttribute('aria-label')===label));
 const click=async label=>{const b=button(label);assert.ok(b,label);const p=b.fire('click');await drain();await p;};
 const enter=async()=>{await drain();};
 return {document,requests,scenes,data,reply,drain,all,button,click,enter};
}
test('panel boots directly into Whale House without a sidebar and all 5 modal furniture stations preserve the live room',async()=>{
 const f=await fixture();await f.enter();
 assert.equal(f.document.getElementById('nav').children.length,0,'sidebar navigation must be removed');
 assert.equal(f.document.getElementById('title').textContent,'她的房间');
 const scene=f.scenes[0],roomShell=f.document.getElementById('content').children[0];
 assert.ok(scene,'room scene mounts immediately on startup');
 await f.click('敲键盘');await f.click('双层总览');
 for(const [kind,tabs] of [
  ['comms',['近况遥测','QQ 与空间','主动联系','表达与感知']],
  ['computer',['记忆档案','人格档案','关系与画像']],
  ['workbench',['能力工具箱','舱室与物品','系统与备份','航行铭牌']],
  ['enchant',['翻阅日记','写一页','请她写一篇']],
  ['bed',['今夜','梦的收藏']]
 ]){
  const p=scene.options.onFurniture(kind);await f.drain();await p;
  const dialog=f.all().find(e=>e.tagName==='DIALOG');
  assert.ok(dialog?.open,kind);
  assert.equal(dialog.getAttribute('data-workspace'),kind);
  for(const tab of tabs){await f.click(tab);assert.equal(f.button(tab).getAttribute('aria-pressed'),'true');}
  assert.equal(f.document.getElementById('title').textContent,'她的房间');
  assert.equal(f.document.getElementById('content').children[0],roomShell);
  await f.click('回到小屋');
  assert.equal(f.scenes.length,1);assert.equal(scene.floor,'all');assert.equal(scene.preview,'type');
 }
 assert.equal(f.requests.some(r=>r.revision!==undefined),false);
});
test('workspace writes never upgrade an older room inventory snapshot',async()=>{
 const f=await fixture();await f.enter();await f.click('电脑 · 记忆与人格');await f.click('人格档案');const save=f.button('保存人格').fire('click');await settle();const request=f.requests.find(r=>r.action==='/persona/save');assert.equal(request.revision,20);f.reply(request,{ok:true},30);await f.drain();await save;await f.click('回到小屋');
 await f.click('工坊台 · 工具与系统');await f.click('舱室与物品');
 const name=f.all().find(e=>e.name==='name');name.value='书桌';void f.button('放进房间').fire('click');await settle();assert.equal(f.requests.find(r=>r.action==='/room/save').revision,20);
});
test('mirror stays reachable and late furniture reads cannot recreate a closed modal',async()=>{
 const f=await fixture();await f.enter();const opening=f.scenes[0].options.onFurniture('enchant');await settle();const req=f.requests.find(r=>r.action==='/diary/list');assert.ok(f.button('回到小屋'));await f.click('回到小屋');f.reply(req);await opening;assert.equal(f.all().find(e=>e.tagName==='DIALOG').open,false);await f.click('全息镜 · 换装');assert.equal(f.all().find(e=>e.className==='room-mirror-wardrobe').hidden,false);await f.click('收起换装');assert.equal(f.all().find(e=>e.className==='room-mirror-wardrobe').hidden,true);
});

test('opening furniture releases the trigger before slow reads so Escape can restore focus',async()=>{
 const f=await fixture();await f.enter();const trigger=f.button('电脑 · 记忆与人格');const opening=trigger.fire('click');await settle();
 assert.equal(trigger.disabled,false,'dialog owns loading; its return target must remain focusable');const dialog=f.all().find(e=>e.tagName==='DIALOG');await dialog.fire('cancel');assert.equal(f.document.activeElement===trigger,true);
 const request=f.requests.find(r=>r.action==='/memory/list');f.reply(request);await opening;assert.equal(dialog.open,false);
});

test('mirror retains one independent preview below the choices and never changes the room activity',async()=>{
 const f=await fixture();await f.enter();await f.click('敲键盘');const main=f.scenes[0];await f.click('全息镜 · 换装');assert.equal(f.scenes.length,2);const preview=f.scenes[1];await f.click('沙发');assert.equal(preview.preview,'lounge');assert.equal(main.preview,'type');
 const choices=f.all().find(e=>e.className==='wardrobe-choices'),view=f.all().find(e=>e.className==='wardrobe-preview');assert.ok(f.all().indexOf(view)>f.all().indexOf(choices));
 await f.click('收起换装');await f.click('全息镜 · 换装');assert.equal(f.scenes.length,2);assert.equal(preview.preview,'lounge');assert.equal(main.preview,'type');assert.equal(f.requests.some(r=>r.revision!==undefined),false);
});
