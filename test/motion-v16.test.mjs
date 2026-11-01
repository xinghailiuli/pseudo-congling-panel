import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoomLifeDefinitions} from '../src/room-life-sequences.mjs';
import {createRoomChoreography} from '../src/room-choreography.mjs';
import {wardrobeVisual,wardrobeMotionPoint} from '../src/room-wardrobe.mjs';
import {roomDeskHandPoint} from '../src/room-life-art.mjs';
test('typing mesh keeps the entire face band fixed, including the left cheek near the hands',()=>{
 for(let y=0;y<=.55;y+=.025)for(let x=0;x<1;x+=.05)for(const t of [100,400,900]){
  assert.deepEqual(roomDeskHandPoint(x,y,t),[x,y]);
  for(const cell of [8,9])assert.deepEqual(wardrobeMotionPoint(x,y,{cell,time:t}),[x,y]);
 }
});
const geometry=JSON.parse(readFileSync(new URL('../assets/room-life-v11/geometry.json',import.meta.url)));
Object.assign(geometry,JSON.parse(readFileSync(new URL('../assets/room-life-v16/geometry.json',import.meta.url))));
const head=s=>{const p=s.frame,r=(p.rotation||0)*Math.PI/180,x=((p.head?.[0]??0)-(p.pivot?.[0]??0))*(p.scale||1)*(p.flip||1),y=((p.head?.[1]??0)-(p.pivot?.[1]??0))*(p.scale||1);return [s.position[0]+x*Math.cos(r)-y*Math.sin(r),s.position[1]+x*Math.sin(r)+y*Math.cos(r)];};
test('sleep uses a bare character, never another baked pillow and blanket',()=>{
 const d=createRoomLifeDefinitions(geometry).sleep;
 for(const p of Object.values(d.poses).filter(p=>p.support==='bed'))assert.notEqual(p.atlas,'cover');
});
test('bed entry support travels continuously without teleporting at pose boundaries',()=>{
 const d=createRoomLifeDefinitions(geometry),c=createRoomChoreography(d);c.start('sleep',0);
 const end=d.sleep.entry.reduce((n,s)=>n+s.duration,0);let previous=c.sample(0);
 for(let t=16;t<end;t+=16){const next=c.sample(t);assert.ok(Math.hypot(...head(next).map((v,i)=>v-head(previous)[i]))<8,`jump at ${t}: ${previous.pose} -> ${next.pose}`);previous=next;}
});
test('typing holds the same registered body and desk motion never affects head or hip',()=>{
 const frames=Array.from({length:16},(_,i)=>({crop:[i,0,100,100]}));const asset={geometry:{frames},desk:{geometry:{frames:frames.slice(0,4)},url:'desk'}};
 const input={life:{mode:'type',support:'hips'},time:0};
 assert.equal(wardrobeVisual(asset,input).frame,wardrobeVisual(asset,{...input,time:700}).frame);
 for(const cell of [8,9])for(const t of [100,400,800,1200])for(const p of [[.5,.2],[.5,.7],[.5,.92]])assert.deepEqual(wardrobeMotionPoint(...p,{cell,time:t}),p);
});
