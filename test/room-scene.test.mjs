import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const actionAssets=JSON.parse(await readFile(new URL('../assets/room-actions/manifest.json',import.meta.url),'utf8'));
const renderer = await import('../src/room-scene.mjs').catch(() => null);
class Element {
  constructor(tag) { this.tagName = tag; this.attributes = {}; this.children = []; this.events = {}; this.textContent = ''; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  append(...children) { this.children.push(...children); }
  addEventListener(type, fn) { this.events[type] = fn; }
}
const document = { createElementNS(_ns, tag) { return new Element(tag); } };
const nodes = root => [root, ...root.children.flatMap(nodes)];
test('room life has a blanket bed pose, seated desk props and live visual-only activity switching',()=>{
 const room={items:['床','书桌','椅子','电脑','日记本','沙发'].map(name=>({id:name,name})),lamp:false,curtain:true};
 const svg=renderer.createBlockRoom(room,{document,actionAssets,petAssets:{idle:{frames:['idle'],frameMs:40},head_pat:{frames:['pat'],frameMs:40}},animation:{reducedMotion:true},night:{sleeping:true}});
 assert.equal(typeof svg.setRoomActivity,'function');
 assert.equal(svg.attributes['data-room-activity'],'sleep');
 assert.ok(nodes(svg).some(n=>n.attributes['data-room-prop']==='quilt'));
 svg.setRoomActivity({preview:'write'});assert.equal(svg.attributes['data-room-activity'],'write');
 assert.ok(nodes(svg).some(n=>n.attributes['data-room-prop']==='pen'));
 svg.setRoomActivity({preview:'type'});assert.equal(svg.attributes['data-room-activity'],'type');
 assert.ok(nodes(svg).some(n=>n.attributes['data-room-prop']==='keyboard'));
 assert.equal(svg.attributes['data-room-size'],'14x10');
});
test('hidden poses do not stream animation frames',()=>{
 let tick;const svg=renderer.createBlockRoom({items:[]},{document,petAssets:{idle:{frames:['i0','i1'],frameMs:40},working:{frames:['w0','w1'],frameMs:40}},animation:{requestFrame(fn){tick=fn;},reducedMotion:false}});
 const resident=nodes(svg).find(n=>n.attributes['data-room-resident']);resident.isConnected=true;
 const hidden=nodes(svg).find(n=>n.attributes['data-room-pose']==='type'),picture=nodes(hidden).find(n=>n.tagName==='image'),before=picture.attributes.href;
 tick(0);tick(45);assert.equal(picture.attributes.href,before);
});
test('typing keeps the original hands and keyboard together, including during petting',()=>{
 const clips={idle:{frames:['idle'],frameMs:40},head_pat:{frames:['pat'],frameMs:40},working:{frames:Array.from({length:241},(_,i)=>`working-${i+1}`),frameMs:40}};
 const room={items:['书桌','椅子','电脑'].map(name=>({name}))};let tick;
 const svg=renderer.createBlockRoom(room,{document,petAssets:clips,actionAssets,preview:'type',animation:{requestFrame(fn){tick=fn;},reducedMotion:false}});
 const resident=nodes(svg).find(n=>n.attributes['data-room-resident']);resident.isConnected=true;
 const pose=nodes(svg).find(n=>n.attributes['data-room-pose']==='type'),images=nodes(pose).filter(n=>n.tagName==='image');
 assert.equal(images.length,1,'one original frame carries the body, hands and keyboard');
 assert.equal(images[0].attributes.href,'working-80');
 assert.equal(nodes(pose).filter(n=>n.tagName==='path').length,0,'no detached replacement arms');
 tick(0);resident.events.click();assert.equal(images[0].attributes.href,'working-80');
 for(let t=40;t<12000;t+=40){tick(t);const frame=Number(images[0].attributes.href.replace('working-',''));assert.ok(frame>=80&&frame<=171,'standing intro and outro must never enter the desk action');}
});
test('walking alternates complete step frames and holds its feet during a corner pause',()=>{
 let tick;const svg=renderer.createBlockRoom({items:[]},{document,actionAssets,petAssets:{idle:{frames:['idle'],frameMs:40}},animation:{requestFrame(fn){tick=fn;},reducedMotion:false},preview:'walk'});
 nodes(svg).find(n=>n.attributes['data-room-resident']).isConnected=true;
 const pose=nodes(svg).find(n=>n.attributes['data-room-pose']==='walk'),sheet=nodes(pose).find(n=>n.attributes['data-complete-action']==='walk');
 tick(0);const planted=sheet.attributes.viewBox,position=pose.attributes.transform;
 tick(300);assert.equal(sheet.attributes.viewBox,planted);assert.equal(pose.attributes.transform,position);
 tick(1300);assert.notEqual(sheet.attributes.viewBox,planted);assert.notEqual(pose.attributes.transform,position);
});
test('resident uses the original sprite, reacts to petting and stops animation when the room is removed', () => {
  const clips={idle:{frames:['idle-0','idle-1'],frameMs:40},head_pat:{frames:['pat-0','pat-1','pat-2'],frameMs:40}};
  let frame,queued=0;
  const svg=renderer.createBlockRoom({lamp:false,curtain:true,items:[]},{document,petAssets:clips,animation:{requestFrame(fn){frame=fn;queued++;},reducedMotion:false}});
  const pet=nodes(svg).find(n=>n.attributes['data-room-resident']==='dafeiyu');
  assert.ok(pet,'the resident must appear even without furniture');
  pet.isConnected=true;
  const picture=nodes(pet).find(n=>n.tagName==='image');
  assert.equal(picture.attributes.href,'idle-0');
  frame(0);frame(45);assert.equal(picture.attributes.href,'idle-1');
  pet.events.click();assert.equal(picture.attributes.href,'pat-0');
  assert.equal(pet.attributes['data-pet-state'],'head_pat');
  frame(50);frame(95);assert.equal(picture.attributes.href,'pat-1');
  frame(180);assert.equal(pet.attributes['data-pet-state'],'idle');
  pet.isConnected=false;const previous=queued;frame(220);assert.equal(queued,previous,'detached room must not keep scheduling animation');
});
test('block room controls reflect saved switches and support mouse and keyboard without mutating room data', () => {
  assert.ok(renderer, 'block room renderer must exist');
  const room = { lamp: false, curtain: true, items: [{ id: 'lamp', name: '台灯', state: '' }, { id: 'window', name: '窗', state: '' }] };
  const original = structuredClone(room); let lights = 0, curtains = 0;
  const svg = renderer.createBlockRoom(room, { document, onLamp() { lights++; }, onCurtain() { curtains++; } });
  const lamp = nodes(svg).find(n => n.attributes['data-room-control'] === 'lamp');
  const curtain = nodes(svg).find(n => n.attributes['data-room-control'] === 'curtain');
  assert.equal(lamp.attributes['aria-label'], '打开台灯');
  assert.equal(curtain.attributes['aria-label'], '合上窗帘');
  lamp.events.click(); curtain.events.keydown({ key: 'Enter', preventDefault() {} });
  assert.equal(lights, 1); assert.equal(curtains, 1); assert.deepEqual(room, original);
  const changed = renderer.createBlockRoom({ ...room, lamp: true, curtain: false }, { document });
  assert.equal(nodes(changed).find(n => n.attributes['data-room-control'] === 'lamp').attributes['aria-label'], '关闭台灯');
  assert.equal(nodes(changed).find(n => n.attributes['data-room-control'] === 'curtain').attributes['aria-label'], '拉开窗帘');
});
test('block room represents the saved inventory including custom names, and removes absent items', () => {
  assert.ok(renderer, 'block room renderer must exist');
  const names = ['床', '书桌', '台灯', '窗', '沙发', '冰箱', '电视', '绿萝', '旧相册', '日记本', '记事本', '<img onerror=alert(1)>'];
  const items = names.map((name, i) => ({ id: String(i), name, state: '保存的描述' }));
  const svg = renderer.createBlockRoom({ lamp: true, curtain: false, items }, { document });
  const represented = nodes(svg).filter(n => n.attributes['data-room-item']).map(n => n.attributes['data-room-item']);
  assert.deepEqual(represented.sort(), items.map(i => i.id).sort());
  assert.ok(nodes(svg).some(n => n.tagName === 'title' && n.textContent.includes('<img onerror=alert(1)>')));
  assert.ok(!nodes(svg).some(n => n.tagName === 'img'));
  const empty = renderer.createBlockRoom({ lamp: false, curtain: true, items: [] }, { document });
  assert.equal(nodes(empty).filter(n => n.attributes['data-room-item']).length, 0);
});
test('floor focus follows the resident to bed and back without losing objects or changing saved data',()=>{
 const room={items:['床','书桌','椅子','电脑','日记本','沙发','书架'].map(name=>({id:name,name}))},before=structuredClone(room);
 const svg=renderer.createBlockRoom(room,{document,actionAssets,petAssets:{idle:{frames:['idle'],frameMs:40}},animation:{reducedMotion:true},preview:'walk'});
 assert.equal(typeof svg.setRoomFloor,'function');
 svg.setRoomFloor('2');const upstairs=svg.attributes.viewBox;
 assert.equal(nodes(svg).find(n=>n.attributes['data-house-floor']==='1').attributes.display,'none','the other floor must not leak into the focused viewport');
 svg.setRoomFloor('1');assert.notEqual(svg.attributes.viewBox,upstairs);
 svg.setRoomActivity({preview:'sleep'});assert.equal(svg.attributes.viewBox,upstairs,'close-up follows the resident upstairs');
 svg.setRoomFloor('all');const whole=svg.attributes.viewBox;
 for(const floor of nodes(svg).filter(n=>n.attributes['data-house-floor']))assert.equal(floor.attributes.display,'inline');
 svg.setRoomActivity({preview:'type'});assert.equal(svg.attributes.viewBox,whole,'overview remains overview');
 const itemNodes=nodes(svg).filter(n=>n.attributes['data-room-item']);
 assert.deepEqual(itemNodes.map(n=>n.attributes['data-room-item']).sort(),room.items.map(i=>i.id).sort());
 assert.equal(nodes(svg).find(n=>n.attributes['data-room-pose']==='sleep').attributes['data-resident-floor'],'2');
 assert.deepEqual(room,before);
});
test('reselecting the same action brings the resident into view while passive polling respects floor choice',()=>{
 const room={items:[{id:'bed',name:'床'}]};
 const svg=renderer.createBlockRoom(room,{document,petAssets:{idle:{frames:['idle'],frameMs:40}},animation:{reducedMotion:true}});
 svg.setRoomFloor('2');svg.setRoomActivity({night:{sleeping:false},jobs:[]});assert.equal(svg.attributes['data-room-floor'],'2','polling must not steal the selected view');
 svg.setRoomActivity({preview:'walk'});assert.equal(svg.attributes['data-room-floor'],'1','reselected walk must be visible');
 svg.setRoomActivity({preview:'sleep'});svg.setRoomFloor('1');svg.setRoomActivity({preview:'sleep'});assert.equal(svg.attributes['data-room-floor'],'2','reselected sleep must be visible');
 svg.setRoomFloor('all');svg.setRoomActivity({preview:'sleep'});assert.equal(svg.attributes['data-room-floor'],'all');
});
