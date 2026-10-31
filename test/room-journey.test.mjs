import test from 'node:test';
import assert from 'node:assert/strict';
const journey=await import('../src/room-journey.mjs').catch(()=>({}));
const make=()=>journey.createRoomJourney({nodes:{a:[0,0],b:[100,0],c:[100,100],d:[200,0]},edges:[['a','b'],['b','c'],['b','d']],targets:{read:'c',garden:'d'},start:'a',speed:100,stride:40});
test('journey walks the corridor once and holds the target after arrival',()=>{
 assert.equal(typeof journey.createRoomJourney,'function');
 const j=make();j.go('read',0);let previous=j.sample(0),turn=false,phases=new Set();
 for(let t=50;t<=4000;t+=50){const p=j.sample(t);assert.ok(Math.hypot(p.x-previous.x,p.y-previous.y)<=5.01);assert.ok(p.y===0||p.x===100,'respect the corridor instead of cutting its corner');if(p.x===100&&p.y>0)turn=true;if(p.moving)phases.add(p.frame);previous=p;}
 assert.ok(turn);assert.equal(phases.size,8);assert.deepEqual([previous.x,previous.y,previous.arrived],[100,100,true]);assert.equal(j.sample(100000).arrived,true);assert.equal(j.sample(100000).moving,false);
});
test('repeated choice does not restart travel and a new choice reroutes from the current position',()=>{
 assert.equal(typeof journey.createRoomJourney,'function');
 const j=make();j.go('read',0);const before=j.sample(500);j.go('read',500);assert.deepEqual(j.sample(500),before);
 j.go('garden',500);const rerouted=j.sample(500);assert.deepEqual([rerouted.x,rerouted.y],[before.x,before.y]);const final=j.sample(10000);assert.deepEqual([final.x,final.y,final.target,final.arrived],[200,0,'garden',true]);
});
test('a very short final step never overshoots its destination',()=>{
 const j=journey.createRoomJourney({nodes:{a:[0,0],b:[3,0]},edges:[['a','b']],targets:{read:'b'},start:'a',speed:100,stride:40});j.go('read',0);
 let last=0;for(let t=0;t<1000;t+=5){const p=j.sample(t);assert.ok(p.x>=last&&p.x<=3);last=p.x;}assert.equal(last,3);
});
