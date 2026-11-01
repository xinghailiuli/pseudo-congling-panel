import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoomLifeDefinitions,roomSleepVariation} from '../src/room-life-sequences.mjs';
import {wardrobeVisual,validateWardrobe} from '../src/room-wardrobe.mjs';
import {createRoomChoreography} from '../src/room-choreography.mjs';
import {roomQuiltPoint} from '../src/room-life-art.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
test('all outfits select articulated transition cells instead of collapsing to one seated image',()=>{
 const geometries=read('../assets/room-transition-v17/geometry.json');
 for(const [id,g]of Object.entries(geometries))if(id!=='original'){
  const a={geometry:{frames:Array(16).fill({})},transition:{geometry:g,url:'transition'}};
  const frames=new Set();for(let transitionCell=0;transitionCell<24;transitionCell++){const v=wardrobeVisual(a,{life:{mode:'sleep',support:'hips',frame:{transitionCell}}});assert.equal(v.url,'transition');frames.add(v.frame);}
  assert.equal(frames.size,24,id);
 }
});
test('new bed entry articulates at least sixteen poses and fixes mattress support, not moving a sleeping cutout',()=>{
 const g=read('../assets/room-life-v11/geometry.json');g.transition=read('../assets/room-transition-v17/geometry.json').original;
 const d=createRoomLifeDefinitions(g).sleep,frames=d.entry.map(s=>d.poses[s.pose]).filter(p=>p.atlas==='transition');
 assert(new Set(frames.map(f=>f.cell)).size>=16);
 const lying=frames.filter(f=>f.cell>=8&&f.cell<=15);assert(lying.length>=8);for(const p of lying)assert.deepEqual(p.at,lying[0].at,'pelvis stays supported during recline');
});
test('sleep variation is deterministic, infrequent, includes chance of no event and kick',()=>{
 const events=new Set();for(let seed=0;seed<100;seed++){assert.equal(roomSleepVariation(10000,seed),null);const a=roomSleepVariation(61000,seed);assert.deepEqual(a,roomSleepVariation(61000,seed));events.add(a?.kind||'none');assert.equal(roomSleepVariation(80000,seed),null);}
 assert(events.has('kick'));assert(events.has('turn'));assert(events.has('none'));
});

test('every outfit validates all transition frames including the last row, sleep and desk supplements',()=>{
 const gs=read('../assets/room-transition-v17/geometry.json'),sp=read('../assets/room-transition-v17/supplement-geometry.json'),base=read('../assets/wardrobe-v1/geometry.json'),url='data:image/png;base64,AAAA';
 for(const id of Object.keys(base)){const a={version:1,id,url,geometry:base[id],transition:{url,geometry:gs[id]},sleepMotion:{url,geometry:sp.sleep[id]},deskTransition:{url,geometry:sp.desk[id]}};assert(validateWardrobe(a),id);const bad=structuredClone(a);bad.transition.geometry.frames[23].crop[2]=Infinity;assert(!validateWardrobe(bad));const missing=structuredClone(a);delete missing.sleepMotion.geometry.frames[15].head;assert(!validateWardrobe(missing));}
});

test('interruptions at every new bed and chair entry step return to a grounded pose',()=>{
 const g=read('../assets/room-life-v11/geometry.json');g.transition=read('../assets/room-transition-v17/geometry.json').original;const defs=createRoomLifeDefinitions(g);
 for(const mode of ['sleep','type','write','lounge','rest']){let elapsed=0;for(const step of defs[mode].entry){const c=createRoomChoreography(defs);c.start(mode,0);const at=elapsed+step.duration/2,before=c.sample(at);c.requestExit(at);assert.deepEqual(c.sample(at).position,before.position,mode+'/'+step.pose);assert(c.sample(at+16000).ready,mode+'/'+step.pose);elapsed+=step.duration;}}
});

test('cloth folds continuously without reversing mesh or moving the bed frame',()=>{
 for(let cover=0;cover<=1;cover+=.01){let previous=-Infinity;for(let y=618;y<=754;y+=2){const p=roomQuiltPoint(400,y,cover,8);assert(p.every(Number.isFinite));assert(p[1]>previous);previous=p[1];}}
 assert.deepEqual(roomQuiltPoint(400,754,1,0),[400,754]);assert.deepEqual(roomQuiltPoint(400,618,1,0),[400,618]);
});

test('getting out leaves quilt folded and pull-over has time for visible hand action',()=>{
 const g=read('../assets/room-life-v11/geometry.json');g.transition=read('../assets/room-transition-v17/geometry.json').original;const d=createRoomLifeDefinitions(g).sleep;
 const exit=d.exits[d.still];assert(exit.length>0);for(const s of exit.slice(-8))assert.equal(d.poses[s.pose].cover,0);
 assert(d.entry.filter(s=>['bed-joint-13','bed-joint-14','bed-joint-15'].includes(s.pose)).reduce((n,s)=>n+s.duration,0)>=1500);
});
