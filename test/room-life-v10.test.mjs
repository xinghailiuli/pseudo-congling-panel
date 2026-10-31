import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRoomLifeDefinitions} from '../src/room-life-sequences.mjs';
import {createRoomChoreography} from '../src/room-choreography.mjs';
import {roomNavigation} from '../src/room-navigation.mjs';

const geometry=JSON.parse(await readFile(new URL('../assets/room-life-v11/geometry.json',import.meta.url)));
test('all eight contact activities use authentic full-character frames and bounded supported exits',()=>{
 const defs=createRoomLifeDefinitions(geometry),modes=Object.keys(defs);
 assert.deepEqual(modes.sort(),['enchant','garden','lounge','read','rest','sleep','type','write']);
 for(const mode of modes){const c=createRoomChoreography(defs);c.start(mode,0);const seen=new Set();for(let time=0;time<60000;time+=37){const s=c.sample(time);seen.add(s.pose);assert(s.frame.at.every(Number.isFinite));assert(geometry[s.frame.atlas]?.frames[s.frame.cell]);}assert(seen.size>=6,mode+' needs whole-body variation');
  for(let time=0;time<25000;time+=317){const motion=createRoomChoreography(defs);motion.start(mode,0);const before=motion.sample(time);motion.requestExit(time);assert.deepEqual(motion.sample(time).position,before.position,mode+' interrupted position');const end=motion.sample(time+20000);assert(end.ready,mode+' exit is finite');assert.equal(end.support,'feet');assert.equal(end.prop,null);}
 }
});
test('garden travel uses only the open gate and aisle, including safe returns from every sampled step',()=>{
 const defs=createRoomLifeDefinitions(geometry),c=createRoomChoreography(defs);c.start('garden',0);
 const inCorridor=([x,y])=>y>=540?(x>=1010&&x<=1155):(x>=1034+(y-380)*.32&&x<=1100+(y-380)*.46&&y>=380);
 for(let t=0;t<30000;t+=25){const s=c.sample(t);assert(inCorridor(s.position),'garden point outside gate/aisle at '+t+': '+s.position);}
 for(let t=0;t<18000;t+=521){const motion=createRoomChoreography(defs);motion.start('garden',0);motion.requestExit(t);let previous=motion.sample(t);for(let dt=20;dt<=10000;dt+=20){const next=motion.sample(t+dt);assert(inCorridor(next.position),'exit left aisle');assert(Math.hypot(...next.position.map((x,i)=>x-previous.position[i]))<10,'garden return teleported '+Math.hypot(...next.position.map((x,i)=>x-previous.position[i])));previous=next;}}
});
test('desk typing and writing share their supported seat and sofa poses remain inside calibrated support zones',()=>{
 const defs=createRoomLifeDefinitions(geometry);assert.deepEqual(defs.type.poses[defs.type.still].at,defs.write.poses[defs.write.still].at);
 for(const pose of Object.values(defs.lounge.poses)){if(['hips','cushion','elbows'].includes(pose.support)){assert(pose.at[0]>=730&&pose.at[0]<=825);assert(pose.at[1]>=630&&pose.at[1]<=710);}}
 for(const mode of ['sleep','type','write','lounge','rest']){const defsMode=defs[mode];for(const pose of Object.values(defsMode.poses)){assert(Array.isArray(pose.pivot));assert(pose.scale>0&&pose.scale<1.5);}}
});

test('each contact exits at the exact global walking endpoint with empty hands',()=>{
 const defs=createRoomLifeDefinitions(geometry);
 for(const [mode,def]of Object.entries(defs)){const nav=roomNavigation(mode),end=nav.nodes[nav.targets[mode]];for(const [id,steps]of Object.entries(def.exits)){const pose=def.poses[steps.at(-1)?.pose||id];assert.deepEqual(pose.at,[end.x,end.y],mode+' contact/walk handoff');assert.equal(pose.prop,null);}}
});
