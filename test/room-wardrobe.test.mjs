import test from 'node:test';
import assert from 'node:assert/strict';
import {validateWardrobe,wardrobePose,wardrobePlacement,wardrobeMotionPoint} from '../src/room-wardrobe.mjs';
const geometry={width:400,height:400,frames:Array.from({length:16},(_,i)=>({crop:[i%4*100,Math.floor(i/4)*100,90,90],outline:[[0,0],[1,0],[1,1]]}))};
const asset={version:1,id:'navy-gala',url:'data:image/png;base64,AAAA',geometry};
test('walking alternates the lifted foot, keeps the other sole down and does not move the head',()=>{
 const left0=wardrobeMotionPoint(.2,1,{moving:true,gait:0}),right0=wardrobeMotionPoint(.6,1,{moving:true,gait:0});
 const left4=wardrobeMotionPoint(.2,1,{moving:true,gait:4}),right4=wardrobeMotionPoint(.6,1,{moving:true,gait:4});
 assert.ok(left0[1]<1);assert.equal(right0[1],1);assert.equal(left4[1],1);assert.ok(right4[1]<1);
 assert.deepEqual(wardrobeMotionPoint(.3,.2,{moving:true,gait:2}),[.3,.2]);
 for(let gait=0;gait<8;gait+=.1)for(const x of [.2,.6]){const p=wardrobeMotionPoint(x,1,{moving:true,gait});assert.ok(p[1]>=.97&&p[1]<=1);assert.ok(p[0]>=0&&p[0]<=1);}
});
test('desk fingers move locally, with reduced motion and body support respected',()=>{
 for(const cell of [8,9]){const a=wardrobeMotionPoint(.24,.67,{cell,time:0}),b=wardrobeMotionPoint(.24,.67,{cell,time:400});assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])>.002);const hip=wardrobeMotionPoint(.5,.92,{cell,time:400});assert.ok(Math.hypot(hip[0]-.5,hip[1]-.92)<.002);assert.deepEqual(wardrobeMotionPoint(.24,.67,{cell,time:400,reduced:true}),[.24,.67]);}
});
test('reject incomplete, foreign and oversized wardrobe assets',()=>{
 assert.equal(validateWardrobe(asset),true);
 for(const bad of [{...asset,id:'../x'},{...asset,url:'https://other'},{...asset,geometry:{...geometry,frames:[]}},{...asset,geometry:{...geometry,width:0}}])assert.equal(validateWardrobe(bad),false);
 const bad=structuredClone(asset);bad.geometry.frames[0].crop=[399,0,90,90];assert.equal(validateWardrobe(bad),false);
});
test('walking uses one four-frame cycle per stride and desk actions use actual seated poses',()=>{
 assert.equal(wardrobePose({moving:true,frame:3}).cell,5);
 assert.equal(wardrobePose({moving:true,frame:7}).cell,7);
 assert.equal(wardrobePose({life:{mode:'write',support:'hips',prop:'pen',frame:{}}}).cell,8);
 assert.equal(wardrobePose({life:{mode:'write',support:'hips',prop:null,frame:{}}}).cell,8);
 assert.equal(wardrobePose({life:{mode:'type',support:'hips',frame:{}}}).cell,9);
 assert.equal(wardrobePose({life:{mode:'sleep',support:'bed',frame:{}}}).cell,12);
 assert.equal(wardrobePose({life:{mode:'lounge',support:'elbows',frame:{}}}).cell,13);
});

test('sofa and terrace never substitute a laptop pose for relaxing; bed rests at the pillow',()=>{
 assert.equal(wardrobePose({life:{mode:'lounge',support:'hips',prop:null}}).cell,11);
 assert.equal(wardrobePose({life:{mode:'rest',support:'hips',prop:null}}).cell,10);
 const p=wardrobePlacement([19,970,329,192],{cell:12,support:'bed'},[362,617],1,308);
 const face=[p.x+p.width*.33,p.y+p.height*.70];
 assert.ok(face[0]>310&&face[0]<345&&face[1]>595&&face[1]<625,'sleeping face stays on the pillow above the quilt edge');
});
test('placement keeps support anchored independently of atlas crop position',()=>{
 const a=wardrobePlacement([10,20,100,200],{cell:0,support:'feet'},[700,500],1);
 const b=wardrobePlacement([110,420,100,200],{cell:0,support:'feet'},[700,500],1);
 assert.deepEqual(a,b);assert.equal(a.y+a.height,500);assert.equal(a.x+a.width/2,700);
 const seated=wardrobePlacement([0,0,100,120],{cell:9,support:'hips'},[700,500],1,200);
 assert.equal(seated.width,a.width,'sitting must not enlarge the character');
});
