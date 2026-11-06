import test from 'node:test';import assert from 'node:assert/strict';
const diagnostics=await import('../src/room-diagnostics.mjs').catch(()=>({}));
test('room diagnostics retain a bounded sanitized event history',()=>{
 assert.equal(typeof diagnostics.createRoomDiagnostics,'function');
 const d=diagnostics.createRoomDiagnostics({limit:4,now:()=>12});
 for(let i=0;i<8;i++)d.record('decode',{asset:'desk',mode:'type',url:'secret',content:'private',index:i});
 assert.equal(d.snapshot().length,4);assert.equal(d.snapshot()[0].asset,'desk');
 assert.ok(!JSON.stringify(d.snapshot()).includes('secret'));assert.ok(!JSON.stringify(d.snapshot()).includes('private'));
});
test('image decode has a deadline even when the decoder never settles',async()=>{
 assert.equal(typeof diagnostics.roomResourceDeadline,'function');
 await assert.rejects(diagnostics.roomResourceDeadline(new Promise(()=>{}),5),/timeout/);
 assert.equal(await diagnostics.roomResourceDeadline(Promise.resolve('decoded'),5),'decoded');
});
test('room restore reveals fallback after deadline and still accepts late assets',async()=>{
 assert.equal(typeof diagnostics.createRoomRestoreGate,'function');
 let resolveAssets,visible='1',restored=0,warning=0,now=0;
 const scene={setAttribute(k,v){if(k==='opacity')visible=v;},roomLifeReady:new Promise(r=>resolveAssets=r),restoreRoomRuntime(){restored++;}};
 let deadline;const gate=diagnostics.createRoomRestoreGate({scene,runtimeReady:Promise.resolve(),getRuntime:()=>({version:1}),hasAssets:()=>true,isActive:()=>true,onWait:()=>warning++,schedule:fn=>(deadline=fn,1),cancel:()=>{}});
 const pending=gate.restore();await Promise.resolve();assert.equal(visible,'0');deadline();assert.equal(visible,'1');assert.equal(warning,1);assert.equal(gate.done,false);
 resolveAssets(true);await pending;assert.equal(restored,1);assert.equal(gate.done,true);gate.dispose();
});
test('disposed room restore cannot update a new scene',async()=>{
 assert.equal(typeof diagnostics.createRoomRestoreGate,'function');
 let resolveAssets,restored=0;
 const scene={setAttribute(){},roomLifeReady:new Promise(r=>resolveAssets=r),restoreRoomRuntime(){restored++;}};
 const gate=diagnostics.createRoomRestoreGate({scene,runtimeReady:Promise.resolve(),getRuntime:()=>({}),hasAssets:()=>true,isActive:()=>true,schedule:()=>1,cancel:()=>{}});
 const pending=gate.restore();await Promise.resolve();gate.dispose();resolveAssets(true);await pending;assert.equal(restored,0);
});
test('frame failure restores mutated attributes and keeps accepting later frames',()=>{
 assert.equal(typeof diagnostics.createRoomFrameGuard,'function');
 let queue=[],reported=0;const node={attrs:{display:'inline'},getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){queue.push({type:'attributes',target:this,attributeName:k,oldValue:this.getAttribute(k)});this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];}};
 class Observer{observe(){}disconnect(){}takeRecords(){const q=queue;queue=[];return q;}}
 const guard=diagnostics.createRoomFrameGuard({root:node,Observer,onError:()=>reported++});
 assert.equal(guard.draw(()=>node.setAttribute('display','inline')),true);
 assert.equal(guard.draw(()=>{node.setAttribute('display','none');node.setAttribute('transform','bad');throw Error('render failed');}),false);
 assert.equal(node.getAttribute('display'),'inline');assert.equal(node.getAttribute('transform'),null);assert.equal(reported,1);
 assert.equal(guard.draw(()=>node.setAttribute('transform','translate(1,2)')),true);
});
