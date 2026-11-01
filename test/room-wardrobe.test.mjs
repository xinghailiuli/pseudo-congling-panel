import test from 'node:test';
import assert from 'node:assert/strict';
import {validateWardrobe,wardrobePose,wardrobePlacement,wardrobeMotionPoint,wardrobeVisual,decodeWardrobeAssets} from '../src/room-wardrobe.mjs';
const geometry={width:400,height:400,frames:Array.from({length:16},(_,i)=>({crop:[i%4*100,Math.floor(i/4)*100,90,90],outline:[[0,0],[1,0],[1,1]]}))};
const asset={version:1,id:'navy-gala',url:'data:image/png;base64,AAAA',geometry};
test('outfit acceptance waits for both atlases to decode with matching dimensions',async()=>{
 const dressed={...asset,desk:{url:'data:image/png;base64,BBBB',geometry:{...geometry,frames:geometry.frames.slice(0,4)}}};
 let badDecode=true,badSize=false;const seen=[];
 class ImageFixture{async decode(){seen.push(this.src);if(this.src===dressed.desk.url&&badDecode)throw Error('decode failed');this.naturalWidth=this.src===dressed.desk.url&&badSize?401:400;this.naturalHeight=400;}}
 await assert.rejects(decodeWardrobeAssets(dressed,ImageFixture),/decode failed/);
 badDecode=false;badSize=true;await assert.rejects(decodeWardrobeAssets(dressed,ImageFixture),/size/);
 badSize=false;await decodeWardrobeAssets(dressed,ImageFixture);assert.ok(seen.includes(dressed.url)&&seen.includes(dressed.desk.url));
 await decodeWardrobeAssets(asset,ImageFixture);
});
test('desk supplement is validated and only replaces supported seated desk actions',()=>{
 const desk={url:'data:image/png;base64,BBBB',geometry:{...geometry,frames:geometry.frames.slice(0,4)}};
 const dressed={...asset,desk};
 assert.equal(validateWardrobe(dressed),true);
 assert.equal(validateWardrobe({...asset,desk:{...desk,url:'https://untrusted'}}),false);
 assert.equal(validateWardrobe({...asset,desk:{...desk,geometry:{...desk.geometry,frames:[]}}}),false);
 const type={life:{mode:'type',support:'hips',frame:{}},time:0};
 assert.equal(wardrobeVisual(dressed,type).url,desk.url);
 assert.equal(wardrobeVisual(dressed,{...type,time:700}).frame,desk.geometry.frames[0]);
 assert.equal(wardrobeVisual(dressed,{life:{mode:'write',support:'hips',frame:{}}}).frame,desk.geometry.frames[2]);
 assert.equal(wardrobeVisual(dressed,{life:{mode:'sleep',support:'hips',frame:{}}}).frame,desk.geometry.frames[3],'sitting on the bed must not conjure a reading book');
 assert.equal(wardrobeVisual(dressed,{...type,moving:true}).url,asset.url);
 assert.equal(wardrobeVisual(dressed,{life:{mode:'type',support:'feet',move:true}}).url,asset.url);
 assert.equal(wardrobeVisual(asset,type).url,asset.url,'older assets remain loadable');
});
test('every walking mesh triangle keeps its orientation through the entire stride',()=>{
 const columns=[0,.18,.38,.58,.8,1];
 const area=([a,b,c])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 for(let gait=0;gait<8;gait+=.025)for(let row=0;row<8;row++)for(let col=0;col<5;col++){
  const a=[columns[col],row/8],b=[columns[col+1],row/8],c=[columns[col],(row+1)/8],d=[columns[col+1],(row+1)/8];
  for(const triangle of [[a,b,c],[b,d,c]]){
   const ratio=area(triangle.map(([x,y])=>wardrobeMotionPoint(x,y,{moving:true,gait})))/area(triangle);
   assert.ok(ratio>.65&&ratio<1.35,`fold or excessive strain at gait ${gait}, row ${row}, column ${col}: ${ratio}`);
  }
 }
});
test('walking alternates the lifted foot, keeps the other sole down and does not move the head',()=>{
 const left0=wardrobeMotionPoint(.2,1,{moving:true,gait:0}),right0=wardrobeMotionPoint(.6,1,{moving:true,gait:0});
 const left4=wardrobeMotionPoint(.2,1,{moving:true,gait:4}),right4=wardrobeMotionPoint(.6,1,{moving:true,gait:4});
 assert.ok(left0[1]<1);assert.equal(right0[1],1);assert.equal(left4[1],1);assert.ok(right4[1]<1);
 assert.deepEqual(wardrobeMotionPoint(.3,.2,{moving:true,gait:2}),[.3,.2]);
 for(let gait=0;gait<8;gait+=.1)for(const x of [.2,.6]){const p=wardrobeMotionPoint(x,1,{moving:true,gait});assert.ok(p[1]>=.97&&p[1]<=1);assert.ok(p[0]>=0&&p[0]<=1);}
});
test('desk fingers move locally, with reduced motion and body support respected',()=>{
 for(const cell of [8,9]){const a=wardrobeMotionPoint(.16,.625,{cell,time:0}),b=wardrobeMotionPoint(.16,.625,{cell,time:400});assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])>.002);const hip=wardrobeMotionPoint(.5,.92,{cell,time:400});assert.ok(Math.hypot(hip[0]-.5,hip[1]-.92)<.002);assert.deepEqual(wardrobeMotionPoint(.16,.625,{cell,time:400,reduced:true}),[.16,.625]);}
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
 const angle=0,dx=p.x+p.width*.25-362,dy=p.y+p.height*.60-617;
 const face=[362+dx*Math.cos(angle)-dy*Math.sin(angle),617+dx*Math.sin(angle)+dy*Math.cos(angle)];
 assert.deepEqual(face,[362,617],'sleeping head remains anchored at the pillow');
});
test('placement keeps support anchored independently of atlas crop position',()=>{
 const a=wardrobePlacement([10,20,100,200],{cell:0,support:'feet'},[700,500],1);
 const b=wardrobePlacement([110,420,100,200],{cell:0,support:'feet'},[700,500],1);
 assert.deepEqual(a,b);assert.equal(a.y+a.height,500);assert.equal(a.x+a.width/2,700);
 const seated=wardrobePlacement([0,0,100,120],{cell:9,support:'hips'},[700,500],1,200);
 assert.equal(seated.width,a.width,'sitting must not enlarge the character');
});
