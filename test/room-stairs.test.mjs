import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomJourney} from '../src/room-journey.mjs';
import {createBlockRoom} from '../src/room-scene.mjs';
import {roomNavigation} from '../src/room-navigation.mjs';
import {readFile} from 'node:fs/promises';
const assets=JSON.parse(await readFile(new URL('../assets/room-actions/manifest.json',import.meta.url)));
const names=['床','书桌','台灯','窗','沙发','冰箱','电视','绿萝','旧相册','日记本','记事本','床头柜','书架','椅子','电脑','茶几','挂画','挂钟','盆栽'];
class Element{constructor(tag){this.tagName=tag;this.attributes={};this.children=[];this.events={};}setAttribute(k,v){this.attributes[k]=String(v);}append(...n){this.children.push(...n);}addEventListener(k,fn){this.events[k]=fn;}}
const document={createElementNS(_,tag){return new Element(tag);}},nodes=n=>[n,...n.children.flatMap(nodes)];
test('selecting an upstairs activity does not teleport the downstairs resident or camera',()=>{
 let tick;const svg=createBlockRoom({lamp:true,curtain:true,items:names.map((name,id)=>({id:String(id),name}))},{document,actionAssets:assets,preview:'type',animation:{reducedMotion:false,requestFrame(fn){tick=fn;}}});
 nodes(svg).find(n=>n.attributes['data-room-resident']).isConnected=true;tick(0);svg.setRoomActivity({preview:'read'});
 assert.equal(svg.attributes['data-room-floor'],'1');
 tick(500);assert.equal(svg.attributes['data-room-floor'],'1');
 assert.equal(nodes(svg).find(n=>n.attributes['data-room-pose']==='read').attributes.display,'none');
});
const route=()=>createRoomJourney({nodes:{a:{x:0,y:100,floor:1},b:{x:100,y:100,floor:1},c:{x:100,y:50,floor:1},d:{x:200,y:200,floor:2},e:{x:300,y:200,floor:2}},edges:[['a','b'],['b','c',{kind:'stairs',duration:1000}],['c','d',{kind:'landing',duration:1200}],['d','e']],targets:{home:'a',away:'e'},start:'a',speed:100});
test('cross-floor travel samples steps and a bounded landing handoff in both directions',()=>{
 const j=route();j.go('away',0);assert.equal(j.sample(0).floor,1);
 const steps=[],handoffs=[];let last;
 for(let t=0;t<=5000;t+=20){const p=j.sample(t);if(p.kind==='stairs')steps.push(p);if(p.transition)handoffs.push(p);if(last&&!p.transition&&!last.transition&&p.floor===last.floor)assert.ok(Math.hypot(p.x-last.x,p.y-last.y)<4);last=p;}
 assert.ok(steps.length>20);assert.ok(handoffs.length>20);assert.ok(handoffs.every(p=>p.transition.from.floor===1&&p.transition.to.floor===2));assert.equal(j.sample(5000).arrived,true);assert.equal(j.sample(5000).floor,2);
 j.go('home',5000);assert.equal(j.sample(6500).transition.to.floor,1);assert.equal(j.sample(10000).floor,1);assert.equal(j.sample(10000).arrived,true);
});
test('redirection stays on the current edge instead of taking a nearest-node shortcut',()=>{
 const j=createRoomJourney({nodes:{a:[0,0],b:[100,0],c:[100,100],d:[0,100]},edges:[['a','b'],['b','c'],['c','d']],targets:{far:'d',home:'a'},start:'a',speed:100});
 j.go('far',0);const before=j.sample(1500);j.go('home',1500);const after=j.sample(1500);assert.equal(after.x,before.x);assert.equal(after.y,before.y);
 for(let t=1500;t<3500;t+=20){const p=j.sample(t);assert.ok(p.x===100||p.y===0,'must use the L-shaped corridor');}
});
test('destination changes during a floor handoff finish the handoff without jumping back',()=>{
 const j=route();j.go('away',0);const before=j.sample(2500);assert.ok(before.transition);j.go('home',2500);const after=j.sample(2500);assert.equal(after.transition.progress,before.transition.progress);assert.equal(after.floor,before.floor);assert.equal(j.sample(10000).floor,1);assert.equal(j.sample(10000).arrived,true);
});
test('every downstairs and upstairs pair uses the stairs and stays outside furniture footprints',()=>{
 const modes=['type','write','lounge','walk','sleep','read','enchant','garden','rest'];
 // Ground footprints independently traced from the background art. The upper
 // book cabinet was the old route's obstruction; chair/sofa catch corner cuts.
 const solid=[{floor:1,box:[850,490,966,541]},{floor:1,box:[684,615,918,790]},{floor:2,box:[753,590,886,723]},{floor:2,box:[283,660,545,735]},{floor:2,box:[965,365,1280,510]}];
 for(const from of modes)for(const to of modes){const config=roomNavigation(from),j=createRoomJourney(config);j.go(to,0);let stepCount=0,landingCount=0;
  for(let t=0;t<40000&&!j.sample(t).arrived;t+=25){const p=j.sample(t);if(p.kind==='stairs')stepCount++;if(p.transition){landingCount++;continue;}assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));for(const {floor,box:[l,top,r,b]}of solid)if(p.floor===floor)assert.ok(!(p.x>l&&p.x<r&&p.y>top&&p.y<b),from+' → '+to+' intersects '+[l,top,r,b]);}
  assert.equal(j.sample(40000).arrived,true,from+' → '+to);if(config.nodes[config.targets[from]].floor!==config.nodes[config.targets[to]].floor){assert.ok(stepCount>50);assert.ok(landingCount>30);}else assert.equal(landingCount,0);
 }
});
test('a nearby node across a wall is not a legal shortcut while redirecting',()=>{
 const j=createRoomJourney({nodes:{a:[0,0],b:[100,0],c:[100,10],d:[50,10],e:[0,10]},edges:[['a','b'],['b','c'],['c','d'],['d','e']],targets:{far:'e',home:'a'},start:'a',speed:100});j.go('far',0);j.go('home',500);
 for(let t=500;t<1000;t+=10){const p=j.sample(t);assert.equal(p.y,0);}
});
test('foreground masks contain furniture silhouettes and never a rectangle of floor pixels',()=>{
 const svg=createBlockRoom({items:names.map((name,id)=>({id,name}))},{document,actionAssets:assets,preview:'read',animation:{reducedMotion:true}});
 const clips=nodes(svg).filter(n=>String(n.attributes.id||'').includes('room-front-'));assert.ok(clips.length>=6);for(const clip of clips)assert.ok(clip.children.every(n=>n.tagName==='polygon'));
});
const animated=extra=>{let tick;const svg=createBlockRoom({items:names.map((name,id)=>({id,name}))},{document,actionAssets:assets,preview:'type',animation:{reducedMotion:false,requestFrame(fn){tick=fn;}},...extra});const resident=nodes(svg).find(n=>n.attributes['data-room-resident']);resident.isConnected=true;tick(0);return {svg,resident,tick:t=>tick(t)};};
test('rapid destination changes preserve the active departure fade and only change its destination',()=>{
 const {svg,resident,tick}=animated();svg.setRoomActivity({preview:'read'});tick(50);const before=resident.attributes.opacity;svg.setRoomActivity({preview:'sleep'});assert.equal(resident.attributes.opacity,before);assert.equal(nodes(svg).find(n=>n.attributes['data-room-pose']==='type').attributes.display,'inline');tick(180);const next=resident.attributes.opacity;svg.setRoomActivity({preview:'read'});assert.equal(resident.attributes.opacity,next);tick(40000);assert.equal(svg.attributes['data-resident-level'],'2');assert.equal(nodes(svg).find(n=>n.attributes['data-room-pose']==='read').attributes.display,'inline');
});
test('refocusing an action notifies the floor controls of the actual selected floor',()=>{
 let selected;const {svg}=animated({onFloor:value=>selected=value});svg.setRoomFloor('2');assert.equal(selected,'2');svg.setRoomActivity({preview:'type'});assert.equal(selected,'1');assert.equal(svg.attributes['data-room-floor'],'1');
});
test('a manual upstairs view stays upstairs throughout a hidden downstairs handoff',()=>{
 const {svg,resident,tick}=animated();svg.setRoomActivity({preview:'read'});svg.setRoomFloor('2');const view=svg.attributes.viewBox;tick(7500);assert.equal(svg.attributes['data-travel-kind'],'landing');assert.equal(resident.attributes.display,'none');assert.equal(svg.attributes.viewBox,view);assert.equal(nodes(svg).find(n=>n.attributes['data-stair-handoff']).attributes.display,'none');tick(9500);assert.equal(svg.attributes.viewBox,view);assert.equal(resident.attributes.display,'inline');
});
