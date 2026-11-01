import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBlockRoom} from '../src/room-scene.mjs';
const assets=JSON.parse(await readFile(new URL('../assets/room-actions/manifest.json',import.meta.url),'utf8'));
const names=['床','书桌','台灯','窗','沙发','冰箱','电视','绿萝','旧相册','日记本','记事本','床头柜','书架','椅子','电脑','茶几','挂画','挂钟','盆栽'];
const room=()=>({lamp:true,curtain:true,items:names.map((name,i)=>({id:String(i),name,state:'保留'}))});
class Element{constructor(tag){this.tagName=tag;this.attributes={};this.children=[];this.events={};}setAttribute(k,v){this.attributes[k]=String(v);}append(...n){this.children.push(...n);}addEventListener(k,fn){this.events[k]=fn;}}
const document={createElementNS(_,tag){return new Element(tag);}},nodes=n=>[n,...n.children.flatMap(nodes)];
const make=(data=room(),extra={})=>createBlockRoom(data,{document,actionAssets:assets,petAssets:{idle:{frames:['idle0','idle1'],frameMs:40},head_pat:{frames:['pat0','pat1'],frameMs:40}},animation:{reducedMotion:true},...extra});
test('reopening an upstairs room restores resident and advances sleep instead of resetting to ground floor',async()=>{
 const geometry=JSON.parse(await readFile(new URL('../assets/room-life-v11/geometry.json',import.meta.url),'utf8'));
 const lifeAssets={version:11,revision:17,geometry,atlases:Object.fromEntries(Object.keys(geometry).map(k=>[k,'data:image/png;base64,AAAA'])),greenhouse:'data:image/png;base64,AAAA'};
 const setup=async preview=>{let tick;const svg=make(room(),{preview,animation:{reducedMotion:false,random:()=>0,loadRoomImage:async()=>true,requestFrame:f=>tick=f}});nodes(svg).find(n=>n.attributes['data-room-resident']).isConnected=true;await svg.setRoomLifeAssets(lifeAssets);tick(0);return {svg,tick};};
 const a=await setup('sleep');a.tick(8000);const saved=a.svg.getRoomRuntime();assert.equal(saved.state.residentLevel,'2');
 const b=await setup('type');saved.savedAt-=60000;assert.equal(b.svg.restoreRoomRuntime(JSON.parse(JSON.stringify(saved))),true);
 const after=b.svg.getRoomRuntime();assert.equal(after.state.residentLevel,'2');assert.equal(after.state.currentMode,'sleep');assert(after.state.motionTime>=saved.state.motionTime+60000);
 assert.equal(b.svg.restoreRoomRuntime({...saved,identity:'different room'}),false);
 assert.equal(b.svg.restoreRoomRuntime({...saved,revision:-1}),false);
});
test('chair foreground leaves the gap between armrest and back transparent',()=>{
 const all=nodes(make()),mask=all.find(n=>n.attributes['data-room-foreground']==='chair'),id=mask.attributes['clip-path'].slice(5,-1),clip=all.find(n=>n.attributes.id===id);
 const contains=([x,y],points)=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const [a,b]=points[i],[c,d]=points[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;}return inside;};
 const covered=p=>clip.children.some(n=>contains(p,n.attributes.points.split(' ').map(v=>v.split(',').map(Number))));
 assert.equal(covered([878,418]),false,'empty air must not repaint floor pixels over her body');
 assert.equal(covered([930,430]),true,'chair back still occludes the seated torso');
});

test('two simultaneous room views never share SVG mask identities',()=>{
 const a=make(),b=make(),ids=nodes(a).map(n=>n.attributes.id).filter(Boolean);
 assert.equal(nodes(b).some(n=>ids.includes(n.attributes.id)),false);
});

test('furniture feature hotspots navigate on click or keyboard without changing resident activity',()=>{
 const selected=[],r=room(),before=structuredClone(r),svg=make(r,{preview:'type',onFurniture:id=>selected.push(id)});
 for(const [id,level]of [['computer','1'],['bed','2'],['mirror','2'],['enchant','2']]){
  svg.setRoomFloor(level);const hotspot=nodes(svg).find(n=>n.attributes['data-room-furniture']===id);assert.ok(hotspot,id);assert.equal(hotspot.attributes.role,'button');
  if(id==='computer')hotspot.events.click();else hotspot.events.keydown({key:'Enter',preventDefault(){}});
  assert.equal(selected.at(-1),id);assert.equal(svg.attributes['data-room-activity'],'type');
 }
 svg.setRoomFloor('1');assert.equal(nodes(svg).find(n=>n.attributes['data-furniture-floor']==='2').attributes.display,'none');
 svg.setRoomFloor('2');assert.equal(nodes(svg).find(n=>n.attributes['data-furniture-floor']==='1').attributes.display,'none');
 assert.deepEqual(r,before);
});

test('mirror and late house artwork update in place, preserving the current walk and floor',()=>{
 let tick;const svg=make(room(),{onFurniture(){},animation:{reducedMotion:false,random:()=>0,requestFrame(fn){tick=fn;}}});
 const resident=nodes(svg).find(n=>n.attributes['data-room-resident']);resident.isConnected=true;tick(0);svg.setRoomActivity({preview:'garden'});tick(3500);svg.setRoomFloor('2');
 const before=svg.attributes['data-resident-feet'];assert.equal(typeof svg.setRoomArtAssets,'function');
 svg.setRoomArtAssets({'floor-one':'new-one','floor-two':'new-two',garden:'new-garden',mirror:'new-mirror'});
 assert.equal(svg.attributes['data-resident-feet'],before);assert.equal(svg.attributes['data-room-floor'],'2');
 const patch=nodes(svg).find(n=>n.attributes['data-room-mirror']);assert.ok(patch);assert.equal(nodes(patch).find(n=>n.tagName==='image').attributes.href,'new-mirror');
 assert.ok(nodes(svg).some(n=>n.tagName==='image'&&n.attributes.href==='new-two'));
});

test('missing contact artwork does not remove the diary feature hotspot',()=>{
 const broken=structuredClone(assets);broken.house.actions.enchant.frames=[];let selected;
 const svg=make(room(),{actionAssets:broken,onFurniture:id=>selected=id});
 const hotspot=nodes(svg).find(n=>n.attributes['data-room-furniture']==='enchant');assert.ok(hotspot);hotspot.events.click();assert.equal(selected,'enchant');
});

test('wardrobe switches one actor without resetting journey and can restore original',()=>{
 const svg=make(),before=svg.attributes['data-resident-feet'];
 assert.equal(typeof svg.setRoomOutfit,'function');
 const outfit={version:1,id:'navy-gala',url:'data:image/png;base64,AAAA',geometry:{width:400,height:400,frames:Array.from({length:16},(_,i)=>({crop:[i%4*100,Math.floor(i/4)*100,90,90],outline:[[0,0],[1,0],[1,1]]}))}};
 assert.equal(svg.setRoomOutfit(outfit),true);assert.equal(svg.attributes['data-resident-feet'],before);
 assert.equal(nodes(svg).filter(n=>n.attributes['data-room-pose']&&n.attributes.display==='inline').length,0);
 assert.equal(nodes(svg).find(n=>n.attributes['data-wardrobe-actor']==='navy-gala').attributes.display,'inline');
 svg.setRoomActivity({preview:'sleep'});
 assert.equal(nodes(svg).find(n=>n.attributes['data-room-foreground']==='wardrobe-quilt').attributes.display,'inline');
 assert.equal(svg.setRoomOutfit({...outfit,id:'bad'}),false);
 assert.equal(svg.setRoomOutfit(null),true);
 assert.equal(nodes(svg).find(n=>n.attributes['data-room-foreground']==='wardrobe-quilt').attributes.display,'none');
 assert.equal(nodes(svg).filter(n=>n.attributes['data-room-pose']&&n.attributes.display==='inline').length,1);
});

test('incomplete upstairs art keeps the legacy resident visible and does not advertise unsupported actions',()=>{
 const broken=structuredClone(assets);broken.house.actions.read.frames=[];
 const svg=make(room(),{actionAssets:broken,preview:'read'});
 assert.deepEqual(svg.roomActions,[]);
 assert.equal(nodes(svg).filter(n=>n.attributes['data-room-hotspot']).length,0);
 const visible=nodes(svg).filter(n=>n.attributes['data-room-pose']&&n.attributes.display==='inline');
 assert.equal(visible.length,1);assert.notEqual(visible[0].attributes['data-room-pose'],'read');
});

test('failed upstairs image disables its contact and retains a visible resident and other activities',()=>{
 let activity;const svg=make(room(),{preview:'read',onActivity:a=>{activity=a;}});
 const pose=nodes(svg).find(n=>n.attributes['data-room-pose']==='read');
 const picture=nodes(pose).find(n=>n.tagName==='image');
 assert.equal(typeof picture.events.error,'function');picture.events.error();
 assert.equal(svg.roomActions.some(([mode])=>mode==='read'),false);
 assert.equal(svg.roomActions.some(([mode])=>mode==='garden'),true);
 assert.equal(pose.attributes.display,'none');assert.equal(activity.preview,'auto');
 assert.equal(nodes(svg).filter(n=>n.attributes['data-room-pose']&&n.attributes.display==='inline').length,1);
 const hotspot=nodes(svg).find(n=>n.attributes['data-room-hotspot']==='read');
 assert.equal(hotspot.attributes['aria-disabled'],'true');hotspot.events.click();
 assert.notEqual(svg.attributes['data-room-activity'],'read');
 svg.setRoomActivity({preview:'garden'});assert.equal(svg.attributes['data-room-activity'],'garden');
});

test('upstairs furniture clicks and keyboard actions select one resident pose without saved writes',()=>{
 const r=room(),before=structuredClone(r);let selected;
 const svg=make(r,{onActivity:a=>{selected=a;}});
 assert.ok(Array.isArray(svg.roomActions));
 for(const mode of ['read','enchant','garden','rest']){
  const hotspot=nodes(svg).find(n=>n.attributes['data-room-hotspot']===mode);assert.ok(hotspot,mode);assert.equal(hotspot.attributes.role,'button');
  if(mode==='read')hotspot.events.click();else hotspot.events.keydown({key:'Enter',preventDefault(){}});
  assert.equal(svg.attributes['data-room-floor'],'2');assert.equal(selected.preview,mode);assert.equal(selected.mode,mode);
  assert.equal(nodes(svg).filter(n=>n.attributes['data-room-pose']&&n.attributes.display==='inline').length,1);
  assert.equal(nodes(svg).find(n=>n.attributes['data-room-pose']===mode).attributes.display,'inline');
 }
 assert.deepEqual(r,before);
 svg.setRoomFloor('1');assert.equal(nodes(svg).find(n=>n.attributes['data-upstairs-controls']).attributes.display,'none');assert.equal(nodes(svg).find(n=>n.attributes['data-room-resident']).attributes.display,'none');
});
test('upstairs action travels before contact, repeated polling preserves travel, hidden floors stay hidden',()=>{
 let tick;const svg=make(room(),{preview:'type',animation:{reducedMotion:false,random:()=>0,requestFrame(fn){tick=fn;}}});const resident=nodes(svg).find(n=>n.attributes['data-room-resident']);resident.isConnected=true;tick(0);
 svg.setRoomActivity({preview:'read'});assert.equal(svg.attributes['data-resident-travel'],'true');assert.equal(svg.attributes['data-room-floor'],'1');
 assert.equal(nodes(svg).find(n=>n.attributes['data-room-pose']==='read').attributes.display,'none');
 tick(1000);const walking=nodes(svg).find(n=>n.attributes['data-room-pose']==='walk'),before=walking.attributes.transform;
 svg.setRoomActivity({jobs:[],night:{}});assert.equal(walking.attributes.transform,before);
 svg.setRoomFloor('2');tick(1200);assert.equal(resident.attributes.display,'none');
 svg.setRoomFloor('2');tick(40000);assert.equal(svg.attributes['data-resident-travel'],'false');assert.equal(nodes(svg).find(n=>n.attributes['data-room-pose']==='read').attributes.display,'inline');
 svg.setRoomActivity({preview:'read'});assert.equal(svg.attributes['data-resident-travel'],'false');
});
test('detailed room uses calibrated contact layers, switching actions without a second resident or saved writes',()=>{
 const r=room(),before=structuredClone(r),svg=make(r,{preview:'type'});
 assert.equal(svg.attributes['data-room-art'],'reference-v4');
 assert.equal(nodes(svg).filter(n=>n.attributes['data-room-resident']).length,1);
 const pose=mode=>nodes(svg).find(n=>n.attributes['data-room-pose']===mode);
 assert.match(nodes(pose('type')).find(n=>n.tagName==='image').attributes.href,/desk-type-a-v4/);
 svg.setRoomActivity({preview:'sleep'});assert.equal(pose('type').attributes.display,'none');assert.equal(pose('sleep').attributes.display,'inline');
 assert.match(nodes(pose('sleep')).find(n=>n.tagName==='image').attributes.href,/bed-sleep-v4/);
 assert.deepEqual(r,before);assert.deepEqual(nodes(svg).filter(n=>n.attributes['data-room-item']).map(n=>n.attributes['data-room-item']).sort(),r.items.map(i=>i.id).sort());
});
test('manual floor choice hides the resident on the other floor, while selecting an action refocuses it',()=>{
 const svg=make(room(),{preview:'type'}),resident=nodes(svg).find(n=>n.attributes['data-room-resident']);
 svg.setRoomFloor('2');assert.equal(resident.attributes.display,'none');
 svg.setRoomActivity({night:{sleeping:false},jobs:[]});assert.equal(resident.attributes.display,'none');
 svg.setRoomActivity({preview:'type'});assert.equal(svg.attributes['data-room-floor'],'1');assert.equal(resident.attributes.display,'inline');
 svg.setRoomActivity({preview:'sleep'});svg.setRoomFloor('1');assert.equal(resident.attributes.display,'none');
 svg.setRoomFloor('all');assert.equal(resident.attributes.display,'inline');
});
test('only visible contact animations advance and removed room stops requesting frames',()=>{
 let tick,queued=0;const svg=make(room(),{preview:'type',animation:{reducedMotion:false,random:()=>0,requestFrame(fn){tick=fn;queued++;}}});
 const resident=nodes(svg).find(n=>n.attributes['data-room-resident']);resident.isConnected=true;
 const animation=mode=>nodes(svg).find(n=>n.attributes['data-contact-animation']===mode),picture=mode=>nodes(animation(mode)).find(n=>n.tagName==='image');
 tick(0);const before=picture('write').attributes.href;tick(400);assert.match(picture('type').attributes.href,/desk-type-b-v4/);assert.equal(animation('type').attributes.opacity,'1');assert.equal(picture('write').attributes.href,before);
 svg.setRoomFloor('2');const hidden=animation('type').attributes.opacity;tick(800);assert.equal(animation('type').attributes.opacity,hidden);
 resident.isConnected=false;const count=queued;tick(900);assert.equal(queued,count);
});
test('changed inventory falls back to individual objects rather than leaving removed items baked in',()=>{
 const r=room();r.items=r.items.filter(x=>x.name!=='床');const svg=make(r);
 assert.notEqual(svg.attributes['data-room-art'],'reference-v4');assert.equal(nodes(svg).filter(n=>n.attributes['data-room-item']==='0').length,0);
});
test('artwork retains keyboard accessible light and curtain controls with saved states',()=>{
 let lamp=0,curtain=0;const svg=make({...room(),lamp:false,curtain:false},{onLamp(){lamp++;},onCurtain(){curtain++;}});
 const a=nodes(svg).find(n=>n.attributes['data-room-control']==='lamp'),b=nodes(svg).find(n=>n.attributes['data-room-control']==='curtain');
 assert.equal(a.attributes['aria-label'],'打开台灯');assert.equal(b.attributes['aria-label'],'拉开窗帘');a.events.click();b.events.keydown({key:'Enter',preventDefault(){}});assert.equal(lamp,1);assert.equal(curtain,1);
 assert.equal(nodes(svg).find(n=>n.attributes['data-curtain-overlay']).attributes.display,'inline');
});
test('resident close-up frames the occupied furniture and follows actions across floors',()=>{
 const svg=make(room(),{preview:'type'}),fit=svg.attributes.viewBox;
 assert.equal(typeof svg.setRoomDetail,'function');svg.setRoomDetail(true);
 const type=svg.attributes.viewBox.split(' ').map(Number);assert.ok(type[2]<1000);assert.ok(type[0]<900&&type[0]+type[2]>900);assert.ok(type[1]<1470&&type[1]+type[3]>1470);
 svg.setRoomActivity({preview:'sleep'});assert.equal(svg.attributes['data-room-floor'],'2');const bed=svg.attributes.viewBox.split(' ').map(Number);assert.ok(bed[2]<1000);assert.ok(bed[1]<610&&bed[1]+bed[3]>610);
 svg.setRoomFloor('1');assert.equal(svg.attributes.viewBox,fit,'manual floor choice returns to whole-floor framing');
});
test('art walking remains in the clear aisle, covers eight phases and does not teleport',()=>{
 let tick;const svg=make(room(),{preview:'walk',animation:{reducedMotion:false,random:()=>0,requestFrame(fn){tick=fn;}}});nodes(svg).find(n=>n.attributes['data-room-resident']).isConnected=true;
 const pose=nodes(svg).find(n=>n.attributes['data-room-pose']==='walk'),phases=new Set();let previous=null;
 for(let t=0;t<30000;t+=40){tick(t);const[x,y]=pose.attributes.transform.match(/translate\(([^,]+),([^)]+)\)/).slice(1).map(Number);assert.ok(x>=1030&&x<=1050);assert.ok(y>=1655&&y<=1865);if(previous)assert.ok(Math.hypot(x-previous[0],y-previous[1])<5);previous=[x,y];if(svg.attributes['data-walk-frame']!=='standing')phases.add(svg.attributes['data-walk-frame']);}
 assert.equal(phases.size,8);
});
