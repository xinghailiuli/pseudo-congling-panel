import test from 'node:test';
import assert from 'node:assert/strict';

async function setup(){
  const m=await import('../src/runtime/room-module-loader.mjs').catch(()=>null);
  assert.ok(m,'optional features need a versioned, disposable module loader');return m;
}
const manifest={reader:{id:'reader',revision:'r1',chunk:'client.room-ui-reader-v52.js',dependencies:[]}};
const payload={id:'reader',revision:'r1',code:'reader',cssText:'.room-book-reader{}'};

test('concurrent feature loads share work and retry after a failed request',async()=>{
  const {createRoomModuleLoader}=await setup();let calls=0,fail=true;
  const loader=createRoomModuleLoader({manifest,requestChunk:async()=>{calls++;if(fail)throw Error('offline');return payload;},evaluateModule:()=>({value:3}),attachStyles:()=>()=>{}});
  const first=loader.load('reader');assert.equal(first,loader.load('reader'));
  await assert.rejects(first,/offline/);fail=false;
  assert.equal((await loader.load('reader')).value,3);assert.equal(calls,2);
  assert.equal((await loader.load('reader')).value,3);assert.equal(calls,2);
});

test('a stale JS/CSS revision is rejected before evaluation or style attachment',async()=>{
  const {createRoomModuleLoader}=await setup();let effects=0;
  const loader=createRoomModuleLoader({manifest,requestChunk:async()=>({...payload,revision:'old'}),evaluateModule:()=>effects++,attachStyles:()=>effects++});
  await assert.rejects(loader.load('reader'),/版本|revision/i);assert.equal(effects,0);
  await assert.rejects(loader.load('unknown'),/未知|unknown/i);
});

test('disposal suppresses a late module and releases only styles owned by this loader',async()=>{
  const {createRoomModuleLoader}=await setup();let deliver,effects=0,released=0;
  const loader=createRoomModuleLoader({manifest,requestChunk:()=>new Promise(r=>deliver=r),evaluateModule:()=>{effects++;return {};},attachStyles:()=>()=>released++});
  const pending=loader.load('reader');await Promise.resolve();loader.dispose();deliver(payload);
  await assert.rejects(pending,/关闭|disposed/i);assert.equal(effects,0);assert.equal(released,0);
  const ready=createRoomModuleLoader({manifest,requestChunk:async()=>payload,evaluateModule:()=>({}),attachStyles:()=>()=>released++});
  await ready.load('reader');ready.dispose();ready.dispose();assert.equal(released,1);
});

test('missing dependencies fail explicitly without fetching the feature',async()=>{
  const {createRoomModuleLoader}=await setup();let fetched=0;
  const loader=createRoomModuleLoader({manifest:{reader:{...manifest.reader,dependencies:['missing']}},requestChunk:()=>fetched++,evaluateModule:()=>({}),attachStyles:()=>()=>{}});
  await assert.rejects(loader.load('reader'),/未知|unknown/i);assert.equal(fetched,0);
});

test('frame module client rejects foreign replies and releases its listener and timeouts',async()=>{
  const {createRoomModuleClient}=await setup();const listeners=new Set(),timers=new Set(),sent=[];
  const parent={postMessage:x=>sent.push(x)},win={addEventListener:(type,fn)=>listeners.add(fn),removeEventListener:(type,fn)=>listeners.delete(fn)};
  const client=createRoomModuleClient({window:win,parent,uid:()=> 'request-1',schedule:fn=>{timers.add(fn);return fn;},cancel:fn=>timers.delete(fn)});
  const request=client.requestChunk(manifest.reader);
  const receive=[...listeners][0];receive({source:{},data:{channel:'liuli-companion',type:'room-module-assets',requestId:'request-1',id:'reader',payload}});
  assert.equal(timers.size,1);receive({source:parent,data:{channel:'liuli-companion',type:'room-module-assets',requestId:'request-1',id:'reader',payload}});
  assert.equal(await request,payload);assert.equal(timers.size,0);assert.equal(sent.length,1);
  const late=client.requestChunk(manifest.reader);client.dispose();
  await assert.rejects(late,/关闭|disposed/i);assert.equal(timers.size,0);assert.equal(listeners.size,0);
});
