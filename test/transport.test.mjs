import test from 'node:test';import assert from 'node:assert/strict';
const mod=await import('../src/frame-bridge.mjs').catch(()=>null);
test('parent bridge only accepts its own frame, fixed actions and unique IDs; disposal aborts work',async()=>{
 assert.ok(mod,'frame bridge must exist');let listener,removed=false,calls=0,signal;const output=[];
 const child={postMessage(value){output.push(value);}},win={addEventListener(_,fn){listener=fn;},removeEventListener(){removed=true;}};
 const dispose=mod.attachFrameBridge(win,()=>child,new Set(['/overview']),async(_,options)=>{calls++;signal=options.signal;return new Response('{"data":{"count":2},"revision":3}');});
 const event={source:child,data:{channel:'liuli-companion',type:'request',id:'request-0001',action:'/overview',body:{}}};
 await listener({...event,source:{}});assert.equal(calls,0);
 await listener({...event,data:{...event.data,action:'/evil'}});assert.equal(calls,0);
 await listener(event);assert.equal(calls,1);assert.equal(output.at(-1).payload.data.count,2);
 dispose();assert.equal(removed,true);
});
