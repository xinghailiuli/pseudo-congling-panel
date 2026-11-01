import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomJourney} from '../src/room-journey.mjs';
import {roomNavigation,chooseRoomWander} from '../src/room-navigation.mjs';
import {createRoomChoreography} from '../src/room-choreography.mjs';
import {createRoomLifeDefinitions} from '../src/room-life-sequences.mjs';
import {readFileSync} from 'node:fs';
test('random walks reach safe destinations on both floors and never repeat the current destination',()=>{
 const nav=roomNavigation('walk'),destinations=new Set();
 for(let i=0;i<100;i++){const target=chooseRoomWander('roam-front',()=>i/100);assert.notEqual(target,'roam-front');destinations.add(target);const j=createRoomJourney(nav);j.go(target,0);assert.equal(j.sample(100000).arrived,true);assert.equal(j.sample(100000).target,target);}
 assert(destinations.size>=7);assert(new Set([...destinations].map(t=>nav.nodes[nav.targets[t]].floor)).size===2);
});
test('room journey survives JSON round trip during floor travel',()=>{
 const a=createRoomJourney(roomNavigation('type'));a.go('sleep',0);
 const b=createRoomJourney(roomNavigation('type'));b.restore(JSON.parse(JSON.stringify(a.snapshot())));
 for(const t of [0,700,4000,12000,60000])assert.deepEqual(b.sample(t),a.sample(t));
});
test('bed entry and safe exit retain exact choreography after reopen',()=>{
 const g=JSON.parse(readFileSync(new URL('../assets/room-life-v11/geometry.json',import.meta.url)));const defs=createRoomLifeDefinitions(g);
 for(const exit of [false,true]){const a=createRoomChoreography(defs);a.start('sleep',100);if(exit)a.requestExit(800);const b=createRoomChoreography(defs);b.restore(JSON.parse(JSON.stringify(a.snapshot())));for(const t of [800,900,1500,9000])assert.deepEqual(b.sample(t),a.sample(t));}
});
