import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomRuntimePersistence} from '../src/room-panel-controller.mjs';
import {createRoomWardrobeController} from '../src/room-wardrobe-controller.mjs';
import {createDressingAssetClient} from '../src/runtime/room-dressing-assets.mjs';

test('closing the whole panel releases a pending dressing-art request',async()=>{
  const listeners=new Set(),client=createDressingAssetClient({win:{addEventListener:(type,fn)=>listeners.add(fn),removeEventListener:(type,fn)=>listeners.delete(fn)},parent:{postMessage(){}},uid:()=> 'art'});
  assert.equal(typeof client.dispose,'function');const pending=client.load();client.dispose();
  await assert.rejects(pending,/关闭/);assert.equal(listeners.size,0);
});

test('room session delegates snapshots and releases UI without restarting or cloning the resident',async()=>{
  const mod=await import('../src/runtime/room-session.mjs').catch(()=>null);assert.ok(mod,'scene ownership must be explicit');
  let state={mode:'lounge'},disposed=0,notified=0;
  const scene={getRoomRuntime:()=>state,disposeRoomAmbient:()=>disposed++};
  const session=mod.createRoomSession({scene});session.subscribe(()=>notified++);
  state={mode:'type'};assert.equal(session.getSnapshot().runtime,state);session.publish();assert.equal(notified,1);
  session.dispose();session.dispose();session.publish();assert.equal(notified,1);assert.equal(disposed,1);
});

test('asset session shares loading and releases an asset that arrives after disposal',async()=>{
  const mod=await import('../src/runtime/room-asset-session.mjs').catch(()=>null);assert.ok(mod);
  let deliver,released=0;const session=mod.createRoomAssetSession({load:()=>new Promise(r=>deliver=r),release:()=>released++});
  const first=session.acquire('coat');assert.equal(first,session.acquire('coat'));
  session.dispose();deliver({id:'coat'});await assert.rejects(first,/关闭|disposed/i);assert.equal(released,1);
});

test('runtime persistence detaches all listeners and cancels its ready timeout',()=>{
  const listeners=new Set(),timers=new Set(),posted=[];
  const target={addEventListener:(type,fn)=>listeners.add(fn),removeEventListener:(type,fn)=>listeners.delete(fn)};
  const persistence=createRoomRuntimePersistence({window:target,document:target,parent:{postMessage:x=>posted.push(x)},
    setTimeout:fn=>{timers.add(fn);return fn;},clearTimeout:fn=>timers.delete(fn),getActiveRoomScene:()=>({getRoomRuntime:()=>({state:{}})})});
  assert.equal(typeof persistence.dispose,'function','persistence needs a disposal boundary');
  persistence.dispose();persistence.dispose();assert.equal(listeners.size,0);assert.equal(timers.size,0);
  const count=posted.length;persistence.saveRoomRuntime(true);assert.equal(posted.length,count);
});

test('wardrobe disposal cancels prefetch and prevents late responses from changing the resident',async()=>{
  const listeners=new Set(),timers=new Set(),posted=[],equipped=[];
  const target={addEventListener:(type,fn)=>listeners.add(fn),removeEventListener:(type,fn)=>listeners.delete(fn)};
  const wardrobe=createRoomWardrobeController({window:target,parent:{postMessage:x=>posted.push(x)},uid:()=> 'req',
    setTimeout:fn=>{timers.add(fn);return fn;},clearTimeout:fn=>timers.delete(fn),getActiveRoomScene:()=>({setRoomOutfit:x=>equipped.push(x)})});
  wardrobe.requestOutfit('navy-gala');const late=[...listeners][0];
  assert.equal(typeof wardrobe.dispose,'function','wardrobe lifetime must be independent from its UI');
  wardrobe.dispose();await late({source:{},data:{channel:'liuli-companion',type:'wardrobe-assets',id:'original',requestId:'req'}});
  wardrobe.requestOutfit('original');assert.equal(listeners.size,0);assert.equal(timers.size,0);assert.equal(equipped.length,0);assert.equal(posted.length,1);
});
