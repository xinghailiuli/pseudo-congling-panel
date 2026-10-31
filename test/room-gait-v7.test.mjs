import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRoomJourney} from '../src/room-journey.mjs';
import {roomNavigation} from '../src/room-navigation.mjs';
import {createBlockRoom} from '../src/room-scene.mjs';

const stairJourney=()=>createRoomJourney({nodes:{a:[0,120],b:[0,80],c:[0,40],d:[0,0]},edges:[['a','b',{kind:'stairs',duration:480}],['b','c',{kind:'stairs',duration:480}],['c','d',{kind:'stairs',duration:480}]],targets:{up:'d',down:'a'},start:'a'});

test('stair travel keeps forward momentum through each tread instead of stopping and hopping',()=>{
 const j=stairJourney();j.go('up',0);const distances=[];
 for(let t=20;t<1440;t+=20){const a=j.sample(t-20),b=j.sample(t);distances.push(Math.hypot(b.x-a.x,b.y-a.y));}
 assert.ok(Math.max(...distances)/Math.min(...distances)<1.2,'repeated per-tread braking is visible as a hop');
});

test('each successive tread uses the opposite half of the ordinary eight-phase walking cycle',()=>{
 const j=stairJourney();j.go('up',0);
 const first=[60,180,300,420].map(t=>j.sample(t).frame),second=[540,660,780,900].map(t=>j.sample(t).frame);
 assert.deepEqual(first,[0,1,2,3]);assert.deepEqual(second,[4,5,6,7]);
 j.go('down',2000);assert.deepEqual([2060,2180,2300,2420,2540,2660,2780,2900].map(t=>j.sample(t).frame),[0,1,2,3,4,5,6,7]);
});

test('terrace travel reaches the full stair landing before turning, in both directions',()=>{
 for(const [from,to]of [['rest','type'],['type','rest']]){
  const j=createRoomJourney(roomNavigation(from));j.go(to,0);let crossed=false;
  for(let t=0;t<40000&&!j.sample(t).arrived;t+=10){const p=j.sample(t);if(p.floor!==2||p.transition)continue;
   // Body/feet clearance at the join: the top landing is above the lower
   // stair-side support. A diagonal from the bottom tread crossed that support.
   if(p.x>1250&&p.x<1310){crossed=true;assert.ok(p.y<671,`${from} -> ${to} cuts the lower stair side at ${p.x},${p.y}`);}
  }
  assert.ok(crossed);assert.ok(j.sample(40000).arrived);
 }
});

test('upstairs routes leave body-width clearance around the pots and stair-side support',()=>{
 // Footprints traced from the new terrace artwork; expand by the resident's
 // 28 px stance and 16 px ground depth, rather than checking only a point.
 const solids=[[981,510,1020,553],[1308,499,1364,544],[1239,675,1300,769]];
 const modes=['type','rest','garden','read','sleep','enchant'];
 for(const from of modes)for(const to of modes){const j=createRoomJourney(roomNavigation(from));j.go(to,0);
  for(let t=0;t<40000&&!j.sample(t).arrived;t+=20){const p=j.sample(t);if(p.floor!==2||p.transition)continue;
   for(const[l,top,r,b]of solids)assert.ok(!(p.x+14>l&&p.x-14<r&&p.y+8>top&&p.y-8<b),`${from} -> ${to} lacks body clearance at ${p.x},${p.y}`);
  }
 }
});

class Element{constructor(tag){this.tagName=tag;this.attributes={};this.children=[];this.events={};}setAttribute(k,v){this.attributes[k]=String(v);}append(...n){this.children.push(...n);}addEventListener(k,fn){this.events[k]=fn;}}
const nodes=n=>[n,...n.children.flatMap(nodes)],document={createElementNS:(_,tag)=>new Element(tag)};
test('a walk frame never exposes a neighboring row or column of the sprite sheet',async()=>{
 const {walk}=JSON.parse(await readFile(new URL('../assets/room-actions/manifest.json',import.meta.url)));
 walk.frames.forEach(([x,y,w,h],i)=>{const row=Math.floor(i/4),col=i%4;assert.ok(x>=col*walk.width/4&&x+w<=(col+1)*walk.width/4);assert.ok(y>=row*walk.height/2&&y+h<=(row+1)*walk.height/2,'neighboring shoe pixels appeared above the head');});
});
test('stairs display the normal walk with a stable direction through the bend, not the rejected high-knee sheet',async()=>{
 const assets=JSON.parse(await readFile(new URL('../assets/room-actions/manifest.json',import.meta.url)));
 const names=['床','书桌','台灯','窗','沙发','冰箱','电视','绿萝','旧相册','日记本','记事本','床头柜','书架','椅子','电脑','茶几','挂画','挂钟','盆栽'];
 let tick;const svg=createBlockRoom({items:names.map((name,id)=>({id,name}))},{document,actionAssets:assets,preview:'type',animation:{reducedMotion:false,requestFrame(fn){tick=fn;}}});
 nodes(svg).find(n=>n.attributes['data-room-resident']).isConnected=true;tick(0);svg.setRoomActivity({preview:'read'});let count=0;
 for(let t=0;t<20000;t+=40){tick(t);if(svg.attributes['data-travel-kind']!=='stairs')continue;count++;
  const walk=nodes(svg).find(n=>n.attributes['data-complete-action']==='walk');assert.equal(walk.attributes.display,'inline');
  assert.equal(nodes(svg).some(n=>n.attributes['data-complete-action']==='stairs'&&n.attributes.display!=='none'),false);
  assert.match(nodes(svg).find(n=>n.attributes['data-room-pose']==='walk').attributes.transform,/scale\(-1,1\)/);
 }
 assert.ok(count>50);
});
