import test from 'node:test';import assert from 'node:assert/strict';
const mod=await import('../src/hud-energy.mjs').catch(()=>null),api=()=>{assert.ok(mod,'room energy module must exist');return mod;};
test('actual rest recovers from zero, work consumes, and switching or polling does not grant free energy',()=>{
 const {createRoomEnergyModel}=api();let t=1000;const m=createRoomEnergyModel(0,{now:()=>t});m.sample('sleep');for(let i=0;i<20;i++)m.sample('sleep');assert.equal(m.sample('sleep').energy,0);t+=30000;assert.equal(m.sample('sleep').energy,1);m.sample('type');t+=60000;assert.ok(Math.abs(m.sample('type').energy-0.4)<1e-9);m.sample('lounge');t+=60000;assert.ok(Math.abs(m.sample('lounge').energy-1.2)<1e-9);
});
test('energy remains bounded, preserves fractions and ignores backwards clock elapsed time',()=>{
 const {createRoomEnergyModel}=api();let t=100000;const m=createRoomEnergyModel(99.99,{now:()=>t});m.sample('sleep');t+=60000;assert.equal(m.sample('sleep').energy,100);m.sample('garden');t+=60000;assert.equal(m.sample('garden').energy,99.2);t-=30000;assert.equal(m.sample('garden').energy,99.2);t+=30000;assert.equal(m.sample('garden').energy,99.2);t+=1000;assert.ok(m.sample('garden').energy<99.2);
});
test('walking to bed is consumption and only a settled resting pose restores',()=>{
 const {roomEnergyActivity}=api();assert.equal(roomEnergyActivity({roomActivity:'sleep',residentTravel:'true',lifeMode:'sleep',lifePhase:'perform'}),'walk');assert.equal(roomEnergyActivity({roomActivity:'sleep',lifeMode:'sleep',lifePhase:'enter'}),'idle');assert.equal(roomEnergyActivity({roomActivity:'sleep',lifeMode:'sleep',lifePhase:'perform'}),'sleep');assert.equal(roomEnergyActivity({roomActivity:'auto',lifeMode:'lounge',lifePhase:'perform'}),'lounge');assert.equal(roomEnergyActivity({roomActivity:'sleep',lifeMode:'sleep',lifePhase:'perform'},false),'paused');
});
test('local choreography walks consume and original-art fallback still recognizes settled work/rest',()=>{
 const {roomEnergyActivity}=api();assert.equal(roomEnergyActivity({roomActivity:'sleep',residentTravel:'false',lifeMode:'sleep',lifePhase:'enter',lifeMoving:'true'}),'walk');assert.equal(roomEnergyActivity({roomActivity:'garden',lifeMode:'garden',lifePhase:'perform',lifeMoving:'true'}),'walk');
 for(const mode of ['type','write','sleep','lounge','rest'])assert.equal(roomEnergyActivity({roomActivity:mode,residentTravel:'false',lifeMode:'',lifePhase:''}),mode);
});
function fixture(){const {createRoomEnergy}=api();let t=1000;const handlers={},posts=[],parent={postMessage:m=>posts.push(m)},win={addEventListener:(k,f)=>handlers[k]=f,removeEventListener:(k,f)=>{if(handlers[k]===f)delete handlers[k];}},energy=createRoomEnergy({win,parent,now:()=>t});return{energy,posts,parent,handlers,time:v=>t=v,reply:(value,source=parent)=>handlers.message?.({source,data:{channel:'liuli-companion',type:'room-energy',value}})};}
test('saved energy wins over night polls, exact zero is valid, and reload never invents offline credit',()=>{
 const {validateRoomEnergySnapshot}=api();const f=fixture();f.energy.acceptNight({energy:0});assert.equal(f.energy.sample('sleep'),null);f.reply({version:1,energy:42.25,updatedAt:1});assert.equal(f.energy.sample('sleep').energy,42.25);f.energy.acceptNight({energy:0});f.time(61000);assert.equal(f.energy.sample('sleep').energy,44.25);const saved=f.energy.save(true);assert.equal(saved.energy,44.25);assert.equal(validateRoomEnergySnapshot(saved),true);assert.equal(validateRoomEnergySnapshot({...saved,energy:101}),false);f.energy.dispose();const g=fixture();g.reply(saved);g.energy.acceptNight({energy:0});assert.equal(g.energy.sample('type').energy,44.25);g.energy.dispose();
 const zero=fixture();zero.reply({version:1,energy:0,updatedAt:1});zero.energy.acceptNight({energy:80});assert.equal(zero.energy.sample('idle').energy,0);zero.energy.dispose();
});
test('hidden/unmounted pause retains energy and closed controllers ignore late replies',()=>{
 const f=fixture();f.reply(null);f.energy.acceptNight({energy:20});f.energy.sample('sleep');f.time(31000);f.energy.pause();f.time(331000);assert.equal(f.energy.sample('paused').energy,21);f.energy.sample('type');f.time(391000);assert.equal(f.energy.sample('type').energy,20.4);f.energy.dispose();const count=f.posts.length;f.reply({version:1,energy:99,updatedAt:1});f.energy.sample('sleep');assert.equal(f.posts.length,count);assert.equal(f.handlers.message,undefined);
});
test('foreign frame cannot replace energy and malformed snapshots seed only once from real night energy',()=>{
 const f=fixture();f.reply({version:1,energy:99,updatedAt:1},{});f.energy.acceptNight({energy:17});assert.equal(f.energy.sample('idle'),null);f.reply({version:1,energy:-1,updatedAt:1});assert.equal(f.energy.sample('idle').energy,17);f.energy.acceptNight({energy:80});assert.equal(f.energy.sample('idle').energy,17);f.energy.dispose();
});
