import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRoomLifeDefinitions} from '../src/room-life-sequences.mjs';
import {createRoomChoreography} from '../src/room-choreography.mjs';
import {createRoomLifeArt} from '../src/room-life-art.mjs';

const geometry=JSON.parse(await readFile(new URL('../assets/room-life-v11/geometry.json',import.meta.url)));

test('sofa stays seated before reclining and holds each resting posture for at least twenty seconds',()=>{
 const c=createRoomChoreography(createRoomLifeDefinitions(geometry));c.start('lounge',0,{settled:true});
 for(let t=0;t<=20000;t+=1000)assert.equal(c.sample(t).support,'hips','must settle on the sofa before lying down');
 const longest={cushion:0,elbows:0};let support=null,start=0;
 for(let t=0;t<=180000;t+=100){const next=c.sample(t).support;if(next!==support){if(support in longest)longest[support]=Math.max(longest[support],t-start);support=next;start=t;}}
 assert(longest.cushion>=20000,'side rest should be sustained');assert(longest.elbows>=20000,'prone rest should be sustained');
});

test('daily activities keep meaningful pauses between page turns, stretches, cups and sleep turns',()=>{
 const defs=createRoomLifeDefinitions(geometry);
 const cases=[['read','u3',12000],['type','d20',30000],['write','d20',30000],['rest','u13',20000],['sleep','b13',40000],['enchant','u8',10000]];
 for(const [mode,pose,minWait]of cases){const c=createRoomChoreography(defs);c.start(mode,0,{settled:true});let first=-1;for(let t=0;t<180000;t+=100)if(c.sample(t).pose===pose){first=t;break;}assert(first>=minWait,mode+' action began too early: '+first);assert(first>=0,mode+' action must still occur');}
});

test('slower leisure never delays a manual safe exit until the long hold ends',()=>{
 const defs=createRoomLifeDefinitions(geometry);
 for(const mode of ['lounge','sleep','read','rest','type','write']){const c=createRoomChoreography(defs);c.start(mode,0,{settled:true});const before=c.sample(10000);c.requestExit(10000);assert.equal(c.sample(10000).pose,before.pose);assert(c.sample(18000).ready,mode+' must leave promptly on request');}
});

test('garden pours into the bed for several seconds while carrying steps retain a normal gait',()=>{
 const c=createRoomChoreography(createRoomLifeDefinitions(geometry));c.start('garden',0,{settled:true});let firstPour=-1,walkFrames=new Set();
 for(let t=0;t<30000;t+=50){const s=c.sample(t);if(s.move)walkFrames.add(s.frame.cell);if(s.pose==='far-can-9'){firstPour=t;break;}}
 assert(firstPour>=0);assert.equal(c.sample(firstPour+6000).pose,'far-can-9','watering needs a sustained pour');assert(walkFrames.size>=6,'do not slow or freeze the walking cycle');
});

test('calibrated sprite rotation keeps the furniture pivot fixed and moves the head hit point with the body',()=>{
 class Node{constructor(){this.attributes={};this.children=[];}setAttribute(k,v){this.attributes[k]=String(v);}append(...n){this.children.push(...n);}}
 const document={createElementNS(){return new Node();}},root=new Node(),frame={crop:[0,0,10,10],outline:[[0,0],[10,0],[10,10]]};
 const art=createRoomLifeArt({document,root,assets:{geometry:{one:{width:10,height:10,frames:[frame]}},atlases:{one:'data:image/png;base64,AAAA'}}});
 const rendered=art.render({frame:{atlas:'one',cell:0,pivot:[0,0],scale:2,rotation:90,head:[3,4]},position:[10,20],support:'elbows'});
 assert.deepEqual(rendered.support,[10,20]);assert(Math.abs(rendered.head[0]-2)<1e-8);assert(Math.abs(rendered.head[1]-26)<1e-8);
});
