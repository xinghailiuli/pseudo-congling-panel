import test from 'node:test';import assert from 'node:assert/strict';
import * as art from '../src/room-life-art.mjs';
import {readFileSync} from 'node:fs';
import {createRoomLifeDefinitions} from '../src/room-life-sequences.mjs';
import {createRoomChoreography} from '../src/room-choreography.mjs';
const g=JSON.parse(readFileSync(new URL('../assets/room-life-v11/geometry.json',import.meta.url)));
g.bedBody=JSON.parse(readFileSync(new URL('../assets/room-motion-v20/bed-geometry.json',import.meta.url))).original;
test('bed entry and exit retain limb poses and fixed support while cloth unfolds',()=>{
 const d=createRoomLifeDefinitions(g).sleep,c=createRoomChoreography({sleep:d});c.start('sleep',0);let at=0;
 for(const step of d.entry){const p=d.poses[step.pose];if(p.atlas==='bedBody'){const a=c.sample(at+step.duration*.2),b=c.sample(at+step.duration*.8);assert.deepEqual(a.position,b.position);assert.equal(a.move,false);}at+=step.duration;}
 for(const cell of [0,1,2,3,4,5,6,7,8])assert(d.entry.some(s=>d.poses[s.pose].bedBodyCell===cell));
 const end=c.requestExit(at+100);assert.equal(c.sample(end).support,'feet');assert.equal(c.sample(end).prop,null);
});
test('folded and unfolded quilt remains on mattress without reflection or inversion',()=>{
 for(let cover=0;cover<=1;cover+=.05)for(let x=330;x<=548;x+=20){let previous=-Infinity;for(let y=618;y<=754;y+=4){const p=art.roomQuiltPoint(x,y,cover);assert(p[1]>previous);assert(p[0]>=320&&p[0]<580);assert(p[1]>=618&&p[1]<=754);previous=p[1];}}
});
test('hand articulation keeps face torso and support unchanged',()=>{
 for(const t of [0,90,300,900,2000])for(const p of [[.5,.2],[.5,.5],[.5,.85]])assert.deepEqual(art.roomDeskHandPoint(...p,t),p);
 const p=art.roomDeskHandPoint(.1,.625,1000);assert.ok(Math.hypot(p[0]-.1,p[1]-.625)>.003);
});
