import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBlockRoom} from '../src/room-scene.mjs';
import {validateRoomLifeAssets} from '../src/room-life-art.mjs';
const geometry=JSON.parse(await readFile(new URL('../assets/room-life-v11/geometry.json',import.meta.url)));
const manifest=JSON.parse(await readFile(new URL('../assets/room-actions/manifest.json',import.meta.url)));
const url='data:image/png;base64,AAAA';
const payload=()=>({version:11,geometry,atlases:Object.fromEntries(Object.keys(geometry).map(k=>[k,url])),greenhouse:url});
class Element{constructor(tag){this.tagName=tag;this.attributes={};this.children=[];this.events={};this.isConnected=true;}setAttribute(k,v){this.attributes[k]=String(v);}append(...n){this.children.push(...n);}addEventListener(k,fn){this.events[k]=fn;}}
const nodes=n=>[n,...n.children.flatMap(nodes)];
async function make({art=true,loader=async()=>{},preview='lounge'}={}){
 const document={hidden:false,createElementNS(_,tag){return new Element(tag);},addEventListener(){},removeEventListener(){}};
 let tick;const room={lamp:true,curtain:true,items:['床','书桌','台灯','窗','沙发','冰箱','电视','绿萝','旧相册','日记本','记事本','床头柜','书架','椅子','电脑','茶几','挂画','挂钟','盆栽'].map((name,i)=>({id:String(i),name}))};
 const svg=createBlockRoom(room,{document,preview,actionAssets:{...manifest,...(art?{lifeV10:payload()}:{})},animation:{reducedMotion:false,random:()=>0,requestFrame(fn){tick=fn;},loadRoomImage:loader}});
 if(art)await svg.roomLifeReady;tick(0);return {svg,document,tick:time=>tick(time)};
}
test('art payload validates format, bounded geometry and PNG-only URLs before decoding',()=>{
 assert(validateRoomLifeAssets(payload()));
 for(const change of [p=>p.atlases.sofa='https://example.org/image.png',p=>p.geometry={...p.geometry,sofa:{...p.geometry.sofa,width:Infinity}},p=>p.version=12,p=>delete p.atlases.carry]){const p=structuredClone(payload());change(p);assert.equal(validateRoomLifeAssets(p),false);}
});
test('switching occupied sofa queues a safe exit and takes the latest destination',async()=>{
 const {svg,tick}=await make();tick(1600);assert.equal(svg.attributes['data-life-version'],'11');
 svg.setRoomActivity({preview:'garden'});assert.equal(svg.attributes['data-room-activity'],'lounge');assert.equal(svg.attributes['data-life-phase'],'exit');
 svg.setRoomActivity({preview:'read'});assert.equal(svg.attributes['data-room-activity'],'lounge');
 tick(4000);assert.equal(svg.attributes['data-room-activity'],'read');assert.equal(svg.attributes['data-resident-travel'],'true');
 tick(60000);assert.equal(svg.attributes['data-resident-travel'],'false');assert.equal(svg.attributes['data-life-mode'],'read');
});
test('late artwork preserves an in-progress walk and decode failure retains original contact',async()=>{
 const {svg,tick}=await make({art:false,preview:'type'});svg.setRoomActivity({preview:'garden'});tick(1500);
 const before=svg.attributes['data-resident-feet'],arrives=svg.attributes['data-travel-arrives'];
 await svg.setRoomLifeAssets(payload());assert.equal(svg.attributes['data-resident-feet'],before);assert.equal(svg.attributes['data-travel-arrives'],arrives);
 const bad=await make({loader:async()=>{throw Error('decode');}});assert.notEqual(bad.svg.attributes['data-life-version'],'11');assert.equal(nodes(bad.svg).find(n=>n.attributes['data-room-pose']==='lounge').attributes.display,'inline');
});
test('loaded chair switching stays seated and hidden animation time is paused',async()=>{
 const {svg,tick,document}=await make({preview:'type'});tick(1000);svg.setRoomActivity({preview:'write'});assert.equal(svg.attributes['data-resident-travel'],'false');assert.equal(svg.attributes['data-life-support'],'hips');
 const pose=svg.attributes['data-life-pose'];document.hidden=true;tick(100000);assert.equal(svg.attributes['data-life-pose'],pose);
});

test('fitting preview pause freezes movement without a resume jump',async()=>{
 const {svg,tick}=await make({preview:'walk'});tick(1000);svg.setRoomPaused(true);const before=svg.attributes['data-resident-feet'];tick(100000);assert.equal(svg.attributes['data-resident-feet'],before);svg.setRoomPaused(false);tick(101000);assert.equal(svg.attributes['data-resident-feet'],before);tick(101040);assert.notEqual(svg.attributes['data-resident-feet'],before);
});
test('garden internal walks use current foot depth and never reapply the old closed fence',async()=>{
 const {svg,tick}=await make({preview:'garden'});let moving=0,behind=0;
 for(let time=0;time<30000;time+=80){tick(time);const pose=svg.attributes['data-life-pose'];if(!/can-|hoe-|route/.test(pose))continue;moving++;const [,y]=svg.attributes['data-resident-feet'].split(',').map(Number);const masks=nodes(svg).filter(n=>n.attributes['data-room-foreground']&&n.attributes.display==='inline').map(n=>n.attributes['data-room-foreground']);assert.equal(masks.includes('greenhouse-rail'),false);if(y<535){behind++;assert.ok(masks.includes('life-garden'));}}
 assert.ok(moving>10&&behind>10);
});
test('selected sleep destination never paints a floating upstairs quilt during the downstairs walk',async()=>{
 const {svg,tick}=await make({preview:'type'}),g={width:400,height:400,frames:Array.from({length:16},(_,i)=>({crop:[i%4*100,Math.floor(i/4)*100,90,90],outline:[[0,0],[1,0],[1,1]]}))};
 svg.setRoomOutfit({version:1,id:'cream-hoodie',url,geometry:g});svg.setRoomActivity({preview:'sleep'});let travelling=0;
 for(let time=0;time<25000;time+=100){tick(time);if(svg.attributes['data-resident-travel']!=='true')continue;travelling++;assert.equal(nodes(svg).find(n=>n.attributes['data-room-foreground']==='wardrobe-quilt').attributes.display,'none');}assert.ok(travelling>20);
});

test('write to type releases the pen while seated, and a later destination can require standing',async()=>{
 const {svg,tick}=await make({preview:'write'});tick(1000);svg.setRoomActivity({preview:'type'});
 assert.equal(svg.attributes['data-room-activity'],'write');assert.equal(svg.attributes['data-life-phase'],'exit');
 tick(1150);assert.equal(svg.attributes['data-life-pose'],'d12');assert.equal(svg.attributes['data-life-support'],'hips');
 tick(1500);assert.equal(svg.attributes['data-room-activity'],'type');assert.equal(svg.attributes['data-resident-travel'],'false');
 svg.setRoomActivity({preview:'write'});tick(2000);svg.setRoomActivity({preview:'type'});tick(2130);svg.setRoomActivity({preview:'garden'});
 assert.equal(svg.attributes['data-room-activity'],'write','a seated release cannot directly become a walk');tick(4000);assert.equal(svg.attributes['data-room-activity'],'garden');assert.equal(svg.attributes['data-resident-travel'],'true');
});

test('structured-cloned repeat artwork preserves the reclining pose and a queued exit',async()=>{
 const {svg,tick}=await make();tick(50000);const pose=svg.attributes['data-life-pose'];assert.equal(svg.attributes['data-life-support'],'cushion');
 await svg.setRoomLifeAssets(structuredClone(payload()));assert.equal(svg.attributes['data-life-pose'],pose);
 svg.setRoomActivity({preview:'garden'});const phase=svg.attributes['data-life-phase'];await svg.setRoomLifeAssets(structuredClone(payload()));assert.equal(svg.attributes['data-life-phase'],phase);
 tick(55000);assert.equal(svg.attributes['data-room-activity'],'garden');
});

test('canceling a seated pen handoff returns to writing without standing',async()=>{
 const {svg,tick}=await make({preview:'write'});tick(1000);svg.setRoomActivity({preview:'type'});tick(1150);svg.setRoomActivity({preview:'write'});tick(1500);
 assert.equal(svg.attributes['data-room-activity'],'write');assert.equal(svg.attributes['data-life-support'],'hips');assert.equal(svg.attributes['data-resident-travel'],'false');
});

test('automatic life remains at the sofa long enough to enjoy its resting poses',async()=>{
 const {svg,tick}=await make({preview:'auto'});let arrived=0;
 for(let t=100;t<=80000;t+=100){tick(t);if(svg.attributes['data-room-activity']==='lounge'&&svg.attributes['data-resident-travel']==='false'){arrived=t;break;}}
 assert(arrived>0,'automatic stroll reaches the sofa');
 for(let t=arrived+100;t<arrived+90000;t+=100){tick(t);assert.equal(svg.attributes['data-room-activity'],'lounge','must not leave after one short loop');}
 svg.setRoomActivity({preview:'walk'});tick(arrived+100000);assert.equal(svg.attributes['data-room-activity'],'walk','manual choice remains responsive');
});
