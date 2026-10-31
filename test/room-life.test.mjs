import test from 'node:test';
import assert from 'node:assert/strict';
const life=await import('../src/room-life.mjs').catch(()=>({}));
const room={items:['床','书桌','椅子','电脑','日记本','沙发'].map(name=>({name}))};

test('upstairs modes are opt-in and automatic life visits them without overriding sleep or diary',()=>{
 const furnished={items:[...room.items,{name:'书架'},{name:'盆栽'}]},extra={upstairs:true};
 for(const mode of ['read','enchant','garden','rest']){
  assert.equal(life.roomActivity(furnished,{},[],mode,0,extra).mode,mode);
  assert.notEqual(life.roomActivity(furnished,{},[],mode,0).mode,mode,'vector renderer does not support upper contacts');
 }
 const modes=new Set(Array.from({length:480},(_,s)=>life.roomActivity(furnished,{},[],'auto',s*1000,extra).mode));
 for(const mode of ['read','enchant','garden','rest'])assert.ok(modes.has(mode));
 assert.equal(life.roomActivity(furnished,{sleeping:true},[],'auto',160000,extra).mode,'sleep');
 assert.equal(life.roomActivity(furnished,{},[{kind:'diary',status:'running'}],'auto',160000,extra).mode,'write');
 assert.equal(life.roomActivity(room,{},[],'read',0,extra).mode,'walk','no reading against a removed bookshelf');
});
test('actual sleep and running diary drive automatic activity; queued jobs do not pretend to be writing',()=>{
 assert.equal(typeof life.roomActivity,'function');
 assert.equal(life.roomActivity(room,{sleeping:true},[{kind:'diary',status:'running'}],'auto',0).mode,'sleep');
 assert.equal(life.roomActivity(room,{sleeping:false},[{kind:'diary',status:'running'}],'auto',0).source,'diary');
 assert.notEqual(life.roomActivity(room,{},[{kind:'diary',status:'queued'}],'auto',0).source,'diary');
});
test('removed chair and computer are respected by desk activities',()=>{
 for(const [missing,mode]of[['椅子','write'],['电脑','type'],['日记本','write']])assert.equal(life.roomActivity({items:room.items.filter(i=>i.name!==missing)}, {},[],mode).mode,'walk');
});
test('visual previews never mutate service state and missing furniture falls back safely',()=>{
 assert.equal(typeof life.roomActivity,'function');
 const night={sleeping:false},before=structuredClone(room);
 assert.equal(life.roomActivity(room,night,[],'sleep',0).source,'preview');
 assert.equal(night.sleeping,false);assert.deepEqual(room,before);
 assert.equal(life.roomActivity({items:[]},night,[],'sleep',0).mode,'walk');
 assert.equal(life.roomActivity({items:[]},night,[],'write',0).mode,'walk');
});
test('leisure visits all activities and walk route is continuous and stays in the clear central aisle',()=>{
 assert.equal(typeof life.roomWalkPoint,'function');
 const modes=new Set(Array.from({length:240},(_,s)=>life.roomActivity(room,{},[],'auto',s*1000).mode));
 for(const mode of ['walk','lounge','write','type'])assert.ok(modes.has(mode),mode);
 let prior=life.roomWalkPoint(0);
 for(let t=100;t<120000;t+=100){const p=life.roomWalkPoint(t);assert.ok(p.x>=4.8&&p.x<=10.6);assert.ok(p.y>=4.2&&p.y<=8.2);assert.ok(Math.hypot(p.x-prior.x,p.y-prior.y)<.16);prior=p;}
});
test('walking has grounded corner pauses and a distance-based step phase',()=>{
 const start=life.roomWalkPoint(0),pause=life.roomWalkPoint(300);
 assert.equal(start.moving,false);assert.deepEqual([pause.x,pause.y],[start.x,start.y]);
 const moving=life.roomWalkPoint(1300);assert.equal(moving.moving,true);assert.ok(moving.distance>0);assert.ok(Number.isFinite(moving.step));
 assert.equal(life.roomWalkPoint(400).step,start.step,'no stepping while planted at a corner');
});
test('walking reaches all eight lift/contact phases and parks in a neutral pose without drifting',()=>{
 const phases=new Set();let previous=life.roomWalkPoint(0),paused=0;
 for(let t=0;t<65000;t+=20){
  const p=life.roomWalkPoint(t);
  if(p.moving){assert.ok(Number.isInteger(p.frame)&&p.frame>=0&&p.frame<8);phases.add(p.frame);}
  else {assert.equal(p.frame,null,'pauses use the original standing pose');if(!previous.moving){assert.deepEqual([p.x,p.y],[previous.x,previous.y]);paused++;}}
  assert.ok(Math.hypot(p.x-previous.x,p.y-previous.y)<.04,'no teleport at corners or cycle wrap');
  // Hand-checked furniture footprints from the user reference: sofa and stairs.
  assert.ok(!(p.x>=7.2&&p.x<=9.1&&p.y>=6&&p.y<=9.4),'must not walk through sofa');
  assert.ok(p.x<11.6,'stay out of the stair volume during a ground-floor stroll');
  previous=p;
 }
 assert.equal(phases.size,8);assert.ok(paused>20);
});
