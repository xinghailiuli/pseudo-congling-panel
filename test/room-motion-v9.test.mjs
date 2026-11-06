import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRoomJourney} from '../src/room-journey.mjs';
import {createBlockRoom} from '../src/room-scene.mjs';

test('redirecting along a corridor keeps the current stride instead of resetting the feet',()=>{
 const j=createRoomJourney({nodes:{a:[0,0],b:[100,0],c:[100,100],d:[200,0]},edges:[['a','b'],['b','c'],['b','d']],targets:{read:'c',garden:'d'},start:'a',speed:100,stride:40});
 j.go('read',0);const before=j.sample(350);j.go('garden',350);const after=j.sample(350);
 assert.deepEqual([after.x,after.y,after.frame],[35,0,7]);
 assert.equal(after.frame,before.frame);assert.equal(j.sample(400).frame,0);
 assert.equal(j.sample(2000).arrived,true);
});

test('redirecting on half a stair tread preserves its remaining half-step timing',()=>{
 const j=createRoomJourney({nodes:{a:[0,120],b:[0,80],c:[0,40],d:[60,40]},edges:[['a','b',{kind:'stairs',duration:480}],['b','c',{kind:'stairs',duration:480}],['c','d']],targets:{up:'c',across:'d',home:'a'},start:'a'});
 j.go('up',0);const before=j.sample(240);j.go('across',240);
 assert.deepEqual([j.sample(240).x,j.sample(240).y,j.sample(240).frame],[0,100,2]);
 assert.equal(j.sample(240).frame,before.frame);
 assert.equal(j.sample(360).frame,3);assert.equal(j.sample(480).frame,4);
 j.go('home',600);const position=j.sample(600);assert.equal(position.frame,5);
 assert.equal(j.sample(3000).arrived,true);assert.equal(j.sample(3000).y,120);
});

test('repeated redirection and reversal retain the original step rate on partial edges',()=>{
 const stairs=createRoomJourney({nodes:{a:[0,120],b:[0,80],c:[0,40],d:[60,40]},edges:[['a','b',{kind:'stairs',duration:480}],['b','c',{kind:'stairs',duration:480}],['c','d']],targets:{up:'c',across:'d',home:'a'},start:'a'});
 stairs.go('up',0);stairs.go('across',240);stairs.go('home',360);
 assert.deepEqual([stairs.sample(480).y,stairs.sample(480).frame],[100,4]);
 assert.deepEqual([stairs.sample(600).y,stairs.sample(600).frame],[110,5]);
 const flat=createRoomJourney({nodes:{a:[0,0],b:[100,0],c:[100,100],d:[200,0]},edges:[['a','b'],['b','c'],['b','d']],targets:{read:'c',garden:'d',home:'a'},start:'a',speed:100,stride:40});
 flat.go('read',0);flat.go('garden',350);flat.go('home',600);
 assert.deepEqual([flat.sample(650).x,flat.sample(650).frame],[55,5]);
 assert.equal(flat.sample(1200).arrived,true);
});

const assets=JSON.parse(await readFile(new URL('../assets/room-actions/manifest.json',import.meta.url)));
const names=['床','书桌','台灯','窗','沙发','冰箱','电视','绿萝','旧相册','日记本','记事本','床头柜','书架','椅子','电脑','茶几','挂画','挂钟','盆栽'];
class Element{constructor(tag){this.tagName=tag;this.attributes={};this.children=[];this.events={};}setAttribute(k,v){this.attributes[k]=String(v);}append(...n){this.children.push(...n);}addEventListener(k,fn){this.events[k]=fn;}}
const descendants=n=>[n,...n.children.flatMap(descendants)];
function scene(preview='walk'){
 let frame;const listeners=new Map(),doc={hidden:false,createElementNS:(_,tag)=>new Element(tag),addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);}};
 const room={items:names.map((name,id)=>({id,name}))};const before=structuredClone(room);
 const svg=createBlockRoom(room,{document:doc,actionAssets:assets,preview,petAssets:{idle:{frames:['idle0','idle1'],frameMs:40},head_pat:{frames:['pat0','pat1'],frameMs:40}},animation:{reducedMotion:false,random:()=>0,requestFrame:fn=>{frame=fn;}}});
 const all=descendants(svg),resident=all.find(n=>n.attributes['data-room-resident']);resident.isConnected=true;frame(0);
 return {svg,resident,room,before,node:(key,value)=>all.find(n=>n.attributes[key]===value),tick:t=>frame(t),pat:()=>all.find(n=>['摸摸小鲸鱼','摸摸大肥鱼'].includes(n.attributes['aria-label'])).events.click(),visibility:hidden=>{doc.hidden=hidden;listeners.get('visibilitychange')?.();},listeners};
}
const feet=s=>s.svg.attributes['data-resident-feet'].split(',').map(Number);

test('writing and typing share the chair without an empty or standing frame',()=>{
 const s=scene('type');s.svg.setRoomActivity({preview:'write'});
 for(const t of [0,80,180,300]){s.tick(t);assert.equal(s.svg.attributes['data-resident-travel'],'false');assert.equal(s.resident.attributes.opacity,'1');assert.equal(s.node('data-room-pose','write').attributes.display,'inline');assert.equal(s.node('data-room-pose','walk').attributes.display,'none');}
 s.svg.setRoomActivity({preview:'type'});assert.equal(s.svg.attributes['data-resident-travel'],'false');assert.deepEqual(s.room,s.before);
});

test('a walking greeting holds the feet, starts the pat clip, then resumes without a catch-up jump',()=>{
 const s=scene();s.tick(650);s.tick(1000);const before=feet(s);s.pat();
 assert.equal(s.node('data-walk-pose','standing').attributes.href,'pat0');
 s.tick(1400);assert.deepEqual(feet(s),before);assert.equal(s.svg.attributes['data-walk-moving'],'false');
 s.tick(1850);assert.deepEqual(feet(s),before);s.tick(2000);
 const after=feet(s);assert.ok(Math.hypot(after[0]-before[0],after[1]-before[1])<=12.001);assert.equal(s.svg.attributes['data-walk-moving'],'true');assert.deepEqual(s.room,s.before);
});

test('changing destination during a greeting keeps the pause and uses the new destination afterwards',()=>{
 const s=scene();s.tick(650);s.tick(1000);const before=feet(s);s.pat();s.tick(1200);s.svg.setRoomActivity({preview:'read'});s.tick(1600);assert.deepEqual(feet(s),before);
 s.tick(40000);assert.equal(s.svg.attributes['data-resident-level'],'2');assert.equal(s.node('data-room-pose','read').attributes.display,'inline');
});

test('a stair greeting retains the walking pose and a sleeping greeting retains the duvet contact',()=>{
 const s=scene('type');s.svg.setRoomActivity({preview:'read'});s.tick(5000);assert.equal(s.svg.attributes['data-travel-kind'],'stairs');const before=feet(s);s.pat();s.tick(5100);
 assert.equal(s.svg.attributes['data-walk-moving'],'true');assert.notDeepEqual(feet(s),before);
 const sleeping=scene('sleep');sleeping.pat();sleeping.tick(300);assert.equal(sleeping.node('data-room-pose','sleep').attributes.display,'inline');assert.equal(sleeping.node('data-room-pose','walk').attributes.display,'none');
});

test('hidden-room time does not advance the route and the first visible frame retains position',()=>{
 const s=scene();s.tick(650);s.tick(1000);const before=feet(s);s.visibility(true);s.tick(10000);assert.deepEqual(feet(s),before);
 s.visibility(false);s.tick(10016);assert.deepEqual(feet(s),before);s.tick(10032);assert.ok(Math.hypot(...feet(s).map((n,i)=>n-before[i]))<2);
 s.visibility(true);s.visibility(false);s.tick(50000);assert.ok(Math.hypot(...feet(s).map((n,i)=>n-before[i]))<2);
});

test('a removed room releases its visibility subscription',()=>{
 const s=scene();assert.equal(s.listeners.has('visibilitychange'),true);s.resident.isConnected=false;s.tick(20);assert.equal(s.listeners.has('visibilitychange'),false);
});
