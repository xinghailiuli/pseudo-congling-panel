import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomJourney} from '../src/room-journey.mjs';
import {roomNavigation} from '../src/room-navigation.mjs';

test('visible free-floor target redirects from the current feet instead of either old endpoint',()=>{
 const j=createRoomJourney({nodes:{a:[0,0],b:[100,0],c:[50,50]},edges:[['a','b'],['b','c']],targets:{b:'b',c:'c'},start:'a',speed:100,canWalk:(a,b)=>a.floor===b.floor});
 j.go('b',0);j.go('c',500);const p=j.sample(750);
 assert.ok(Math.abs(p.x-50)<.01);assert.ok(Math.abs(p.y-25)<.01);assert.equal(j.sample(1001).arrived,true);
});
test('redirect keeps walking around an obstacle and cannot cut across a stair portal',()=>{
 const j=createRoomJourney({nodes:{a:[0,0],b:[100,0],c:[100,100]},edges:[['a','b'],['b','c']],targets:{b:'b',c:'c'},start:'a',speed:100,canWalk:()=>false});
 j.go('b',0);j.go('c',500);assert.deepEqual([j.sample(750).x,j.sample(750).y],[75,0]);
 const n=roomNavigation('type');assert.equal(n.canWalk(n.nodes.lowerLanding,n.nodes.upperEntry),false);
});
test('room direct visibility recognizes the open aisle and rejects the sofa/table footprint',()=>{
 const n=roomNavigation('type');assert.equal(typeof n.canWalk,'function');
 assert.equal(n.canWalk({x:1030,y:600,floor:1},{x:1100,y:720,floor:1}),true);
 assert.equal(n.canWalk({x:650,y:650,floor:1},{x:1000,y:720,floor:1}),false);
 assert.equal(n.canWalk({x:580,y:650,floor:2},{x:400,y:650,floor:2}),false);
});
