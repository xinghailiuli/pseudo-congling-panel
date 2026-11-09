import test from 'node:test';import assert from 'node:assert/strict';
const mod=await import('../src/hud-safe-area.mjs').catch(()=>null);
const overlaps=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
test('HUD fits around native bottom-right character without moving the blocker',()=>{
 assert.ok(mod?.fitHudViewport);const outer={x:281,y:40,width:1000,height:782},block={x:1110,y:645,width:170,height:160};const copy=structuredClone(block);
 const r=mod.fitHudViewport(outer,[block]);assert.ok(!overlaps(r,block));assert.equal(r.width/r.height,16/9);assert.deepEqual(block,copy);assert.ok(r.width>=900,'use existing letterbox space first');
});
test('no blocker keeps the same centered 16:9 composition at both resolutions',()=>{
 assert.ok(mod?.fitHudViewport);for(const k of [1,.75])assert.deepEqual(mod.fitHudViewport({x:0,y:0,width:2560*k,height:1440*k},[]),{x:0,y:0,width:2560*k,height:1440*k});
});
test('left and right floating cards are excluded without touching their state',()=>{
 assert.ok(mod?.fitHudViewport);const bounds={x:0,y:0,width:1920,height:1080},blocks=[{x:0,y:900,width:130,height:180},{x:1720,y:850,width:200,height:230}];const r=mod.fitHudViewport(bounds,blocks);assert.ok(blocks.every(b=>!overlaps(r,b)));assert.ok(r.width>1400);assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=1920&&r.y+r.height<=1080);
});

test('a speech bubble outside the character bounds is also excluded without moving it',()=>{
 const events={addEventListener(){},removeEventListener(){}},bounds={x:280,y:40,width:1000,height:782};
 const character={getBoundingClientRect:()=>({x:8,y:634,width:170,height:170})};
 const bubbleBounds={x:120,y:570,width:320,height:75},bubble={style:{left:'-4px'},getBoundingClientRect:()=>bubbleBounds};
 const doc={...events,hidden:false,querySelectorAll:selector=>selector.includes('.wg-bubble')?[character,bubble]:[character]};
 const win={...events,document:doc,getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'}),setInterval:()=>1,clearInterval(){}};
 const frame={...events,style:{},contentWindow:{}},surface={isConnected:true,dataset:{},getBoundingClientRect:()=>bounds};
 const stop=mod.attachHudSafeArea({surface,frame,win});
 const actual={x:bounds.x+parseFloat(frame.style.left),y:bounds.y+parseFloat(frame.style.top),width:parseFloat(frame.style.width),height:parseFloat(frame.style.height)};
 assert.ok(!overlaps(actual,bubbleBounds),'the visible bubble can extend into the HUD beyond its parent character');
 assert.deepEqual(bubble.style,{left:'-4px'},'only the HUD may move');stop();
});

test('the installed web UI pet is excluded when a larger viewport brings it into the HUD',()=>{
 const events={addEventListener(){},removeEventListener(){}},bounds={x:280,y:40,width:1640,height:1040};
 const petBounds={x:332,y:912,width:148,height:160},pet={style:{right:'1440px',bottom:'8px'},getBoundingClientRect:()=>petBounds};
 const doc={...events,hidden:false,querySelectorAll:selector=>selector.includes('[class$="_float"]')?[pet]:[]};
 const win={...events,document:doc,getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1'}),setInterval:()=>1,clearInterval(){}};
 const frame={...events,style:{},contentWindow:{}},surface={isConnected:true,dataset:{},getBoundingClientRect:()=>bounds};
 const stop=mod.attachHudSafeArea({surface,frame,win});
 const actual={x:bounds.x+parseFloat(frame.style.left),y:bounds.y+parseFloat(frame.style.top),width:parseFloat(frame.style.width),height:parseFloat(frame.style.height)};
 assert.ok(!overlaps(actual,petBounds),'the pet must not cover HUD controls at 1080p or 2K');assert.deepEqual(pet.style,{right:'1440px',bottom:'8px'});stop();
});

test('iframe load preserves explicit island mode and cleanup removes every observer',()=>{
 const listeners=new Map(),frameListeners=new Map(),docListeners=new Map();let intervals=0,disconnected=false;
 const events=map=>({addEventListener:(k,f)=>map.set(k,f),removeEventListener:k=>map.delete(k)});
 const doc={...events(docListeners),hidden:false,querySelectorAll:()=>[]};
 const win={...events(listeners),document:doc,setInterval:()=>{intervals++;return 1},clearInterval:()=>intervals--,ResizeObserver:class{observe(){}disconnect(){disconnected=true}}};
 const frame={...events(frameListeners),style:{},contentWindow:{}};
 const surface={isConnected:true,dataset:{},getBoundingClientRect:()=>({x:0,y:0,width:1000,height:800})};
 const stop=mod.attachHudSafeArea({surface,frame,win});
 const notify=source=>listeners.get('message')({source,data:{channel:'liuli-companion',type:'hud-safe-area',enabled:false}});
 notify({});assert.equal(frame.style.width,'1000px','unrelated sender is ignored');
 notify(frame.contentWindow);frameListeners.get('load')();
 assert.equal(frame.style.width,'100%');assert.equal(frame.style.height,'100%','load cannot undo island exemption');
 stop();assert.equal(intervals,0);assert.ok(disconnected);assert.equal(listeners.size+frameListeners.size+docListeners.size,0);
});
