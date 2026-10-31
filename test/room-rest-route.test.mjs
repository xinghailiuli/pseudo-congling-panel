import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomJourney} from '../src/room-journey.mjs';
import {roomNavigation} from '../src/room-navigation.mjs';

const trip=(from,to)=>{const j=createRoomJourney(roomNavigation(from));j.go(to,0);const samples=[];for(let t=0;t<=20000;t+=10){const p=j.sample(t);samples.push(p);if(p.arrived)break;}assert.ok(samples.at(-1).arrived);return samples;};

test('watering and terrace sitting use the open floor between them in both directions',()=>{
 for(const [from,to]of [['garden','rest'],['rest','garden']]){
  const points=trip(from,to);let length=0;
  for(let i=1;i<points.length;i++)length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
  assert.ok(length<160,`${from} -> ${to} walked ${length.toFixed(1)} px instead of the nearby clear approach`);
  assert.ok(points.every(p=>p.floor===2&&p.kind!=='stairs'&&p.x<1140));
 }
});

test('left-side upstairs activities approach the seat without visiting the right stair landing',()=>{
 for(const from of ['read','sleep','enchant']){
  const points=trip(from,'rest');assert.ok(points.every(p=>p.x<=1125),from+' detours to the right side before sitting');
  let approaching=false,previous=Infinity;
  for(const p of points){const distance=Math.hypot(p.x-1102,p.y-705);if(distance<155)approaching=true;if(approaching){assert.ok(distance<=previous+.001,from+' walks away after reaching the seat approach');previous=distance;}}
 }
});

test('switching to terrace rest while walking on the upper platform no longer loops around the stairs',()=>{
 const j=createRoomJourney(roomNavigation('read'));j.go('garden',0);let switchTime;
 for(let t=0;t<20000;t+=10){const p=j.sample(t);if(p.x>1040&&p.x<1080&&p.floor===2){switchTime=t;break;}}
 assert.ok(Number.isFinite(switchTime));const before=j.sample(switchTime);j.go('rest',switchTime);const after=j.sample(switchTime);assert.equal(after.x,before.x);assert.equal(after.y,before.y);
 for(let t=switchTime;t<switchTime+10000;t+=10){const p=j.sample(t);assert.ok(p.x<=1125,'a nearby seat must not force a visit to the right staircase');if(p.arrived)break;}
 assert.equal(j.sample(switchTime+10000).arrived,true);
});
