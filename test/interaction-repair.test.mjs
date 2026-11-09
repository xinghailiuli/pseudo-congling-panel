import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createDocument} from './helpers/workspace-dom.mjs';
const panel=await readFile(new URL('../panel.js',import.meta.url),'utf8');
function island(){
 const document=createDocument(),listeners=[],requests=[],timers=new Map();let id=0;
 const parent={postMessage:m=>requests.push(m)};
 const ctx={document,parent,currentViewMode:'room',hasWebGL:true,content:document.createElement('div'),console,
  window:{addEventListener:(_,fn)=>listeners.push(fn)},safeStorage:{setItem(){}},viewModeKey:'fixture',roomView:{},
  clearTimeout:i=>timers.delete(i),setTimeout:(fn)=>{timers.set(++id,fn);return id},
  div:(cls,...children)=>{const n=document.createElement('div');n.className=cls;n.append(...children);return n},
  node:(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n},button:(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.addEventListener('click',fn);return b},
  panelDisposed:false,render:()=>{},syncVersionSwitcher:()=>{},roomDispose:()=>{},cachedRoomShell:null,cachedRoomResult:null,show:()=>{},
 };
 ctx.listen=(target,...args)=>target.addEventListener(...args);ctx.schedulePanel=ctx.setTimeout;ctx.cancelPanel=ctx.clearTimeout;
 vm.createContext(ctx);vm.runInContext(panel.slice(panel.indexOf(' let activeIslandInstance='),panel.indexOf(' let openRoomFurniture=')),ctx);
 return {ctx,requests,timers,run:s=>vm.runInContext(s,ctx),send:(d,source=parent)=>listeners.forEach(fn=>fn({source,data:{channel:'liuli-companion',...d}}))};
}
test('island loads only on demand and return cancels an outstanding mount',()=>{
 const f=island();assert.equal(f.requests.length,0);
 f.run('currentViewMode="island";pendingIslandMount=()=>{throw Error("late mount")};requestIslandMap()');
 assert.equal(f.requests.length,1);assert.equal(f.timers.size,1);
 f.run('switchViewMode("room")');assert.equal(f.timers.size,0);assert.equal(f.run('pendingIslandMount'),null);
 f.ctx.window.mountWhaleIsland=()=>{};
 f.send({type:'island-map-assets',assets:{code:'already loaded'}});assert.equal(f.ctx.currentViewMode,'room');
});

test('versioned island entry loads its code and CSS together and ignores a late module after return',async()=>{
 const f=island(),calls=[];let deliver;
 f.ctx.ROOM_MODULE_MANIFEST={island:{}};f.ctx.loadRoomFeature=id=>{calls.push(id);return new Promise(resolve=>deliver=resolve);};
 f.run('currentViewMode="island";pendingIslandMount=()=>{throw Error("late mount")};requestIslandMap()');
 assert.deepEqual(calls,['island']);assert.equal(f.requests.length,0,'versioned entry cannot bypass its CSS payload');
 f.run('switchViewMode("room")');deliver({mountWhaleIsland(){throw Error('must not mount');}});await Promise.resolve();await Promise.resolve();
 assert.equal(f.ctx.currentViewMode,'room');assert.equal(f.ctx.window.mountWhaleIsland,undefined);
});
test('island failure gives retry and return, and foreign frames cannot signal a failure',()=>{
 const f=island();f.run('currentViewMode="island";requestIslandMap()');
 f.send({type:'island-map-error'},{});assert.equal(f.timers.size,1);assert.equal(f.ctx.content.children.length,0);
 f.send({type:'island-map-error'});assert.equal(f.timers.size,0);
 assert.match(f.ctx.content.textContent,/暂时无法打开/);assert.match(f.ctx.content.textContent,/重试/);assert.match(f.ctx.content.textContent,/回到小屋/);
});
test('island stylesheet is scoped; engine and style are required build inputs',async()=>{
 const css=await readFile(new URL('../assets/island-map/island.css',import.meta.url),'utf8');
 const selectors=[...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{/g)].map(m=>m[1].trim()).filter(s=>!s.startsWith('@')).flatMap(s=>s.split(','));
 assert.ok(selectors.every(s=>s.trim().startsWith('body.')&&s.includes('island-mode')),'map CSS cannot style cabin buttons or HUD');
 assert.match(css,/\.island-map-surface\.photo \.hud/,'photo class belongs to mount container');
 const build=await readFile(new URL('../build.mjs',import.meta.url),'utf8');assert.doesNotMatch(build,/try\s*\{[^\n]*island/);
 const code=await readFile(new URL('../assets/island-map/island-bundle.min.js',import.meta.url),'utf8');assert.ok(code.includes('mountWhaleIsland'));
});
test('energy click opens status rather than reminders; cabin drawer has no island shortcut',()=>{
 const status=panel.slice(panel.indexOf('const onStatusClick ='),panel.indexOf("statusPillEl.addEventListener('click'"));
 let target;const trigger={};vm.runInNewContext(status+';onStatusClick()',{activeHudDelegates:{toggleBottomPopover:(kind,btn)=>{target={kind,btn}}},statusPillEl:trigger});
 assert.equal(target.kind,'energy');assert.equal(target.btn,trigger);
 const cabin=panel.slice(panel.indexOf("if (tab === 'cabin')"),panel.indexOf("} else if (tab === 'wardrobe')"));assert.doesNotMatch(cabin,/cardIsland|switchViewMode/);
});
