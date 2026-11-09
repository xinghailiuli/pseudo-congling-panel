import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const imageModules=JSON.parse(await readFile(new URL('./lib/room-asset-manifest.json',import.meta.url),'utf8')).modules;

// Model separate React refs; bridge-only tests leave the host surface unmounted.
function bridgeReact(effects,frameRef){let index=0;return {createElement:(type,props,...children)=>({type,props,children}),useRef:()=>index++%2===0?frameRef:{current:null},useEffect:fn=>effects.push(fn)};}

// DSH ClientModules.chunkRequest accepts only its exact ?rev=<entry rev> URL.
// Exercise the built parent bridge against that contract, rather than a permissive fixture route.
async function nativeChunkBridge({staleBoot=false}={}){
 const effects=[],listeners=new Set(),sent=[],requests=[],ref={current:null};let panel,plugin;
 const React=bridgeReact(effects,ref),require=()=>React;
 const modules={manifest:{modules:[{id:'dsh-whale-status',rev:'native-test-revision'}]}};
 const window={location:{protocol:'dsh-app:',origin:'dsh-app://app'},__DSH_BOOT__:{entries:[{id:'dsh-whale-status',rev:staleBoot?'old-boot-revision':'native-test-revision'}]},addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn),__ModuleLoader__:{load:d=>plugin=d.factory(require)}};
 const fetch=async input=>{requests.push(input);const url=new URL(input,'dsh-app://app');if(url.search!=='?rev='+modules.manifest.modules[0].rev)return {ok:false,status:404};const file=url.pathname.split('/').at(-1);const body=await readFile(new URL('./lib/'+file,import.meta.url),'utf8')+'\n;\n//# sourceMappingURL='+file+'.map?rev='+modules.manifest.modules[0].rev+'\n';return {ok:true,text:async()=>body,json:async()=>JSON.parse(body)};};
 vm.runInNewContext(await readFile(new URL('./lib/client.js',import.meta.url),'utf8'),{window,URL,AbortController,fetch});
 plugin.apply({modules,slots:{inject:(_,fn)=>fn(),register:(o,c)=>{if(o.key==='whale-status')panel=c;}}});panel();
 const target={postMessage:m=>sent.push(m)};ref.current={contentWindow:target};const dispose=effects.map(fn=>fn());
 return {sent,requests,advance:()=>{modules.manifest.modules[0].rev='new-live-revision';},send:data=>Promise.all([...listeners].map(fn=>fn({source:target,data:{channel:'liuli-companion',...data}}))),close:()=>dispose.forEach(fn=>fn?.())};
}

test('native hot updates use the current module revision after the boot graph becomes stale',async()=>{
 const bridge=await nativeChunkBridge({staleBoot:true}),ui=JSON.parse(await readFile(new URL('./lib/room-module-manifest.json',import.meta.url),'utf8'));
 try{
  await bridge.send({type:'room-assets-request',requestId:'live-art'});
  assert.ok(bridge.sent.some(m=>m.type==='room-assets'&&m.requestId==='live-art'),'a replacement factory must not use the stale startup revision');
  bridge.advance();
  await bridge.send({type:'wardrobe-request',requestId:'live-outfit',id:'navy-gala'});
  await bridge.send({type:'room-module-request',requestId:'live-reader',id:'reader',revision:ui.reader.revision});
  assert.ok(bridge.sent.some(m=>m.type==='wardrobe-assets'&&m.requestId==='live-outfit'));
  assert.ok(bridge.sent.some(m=>m.type==='room-module-assets'&&m.requestId==='live-reader'));
  assert.ok(bridge.requests.slice(-2).every(url=>url.endsWith('?rev=new-live-revision')));
 }finally{bridge.close();}
});

test('native DSH exact chunk URLs deliver room, life, dressing and outfit metadata',async()=>{
 const bridge=await nativeChunkBridge();
 try{
  for(const [type,response,extra]of [['room-assets-request','room-assets',{}],['room-life-request','room-life-assets',{}],['dressing-request','dressing-assets',{}],['wardrobe-request','wardrobe-assets',{id:'navy-gala'}]]){
   const requestId='native-'+type;await bridge.send({type,requestId,...extra});
   assert.ok(bridge.sent.some(m=>m.type===response&&m.requestId===requestId),type+' must load through the native exact-revision route');
  }
 }finally{bridge.close();}
});

test('native DSH exact chunk URLs deliver every optional UI module',async()=>{
 const manifest=JSON.parse(await readFile(new URL('./lib/room-module-manifest.json',import.meta.url),'utf8')),bridge=await nativeChunkBridge();
 try{
  for(const [id,record]of Object.entries(manifest)){
   const requestId='native-ui-'+id;await bridge.send({type:'room-module-request',id,revision:record.revision,requestId});
   assert.ok(bridge.sent.some(m=>m.type==='room-module-assets'&&m.requestId===requestId),id+' must load through the native exact-revision route');
  }
 }finally{bridge.close();}
});

test('wardrobe lazy loading is scoped, cached, recoverable and persists only selection',async()=>{
 const effects=[],listeners=new Set(),sent=[],requests=[],ref={current:null},saved=new Map();let panel,plugin;
 const React=bridgeReact(effects,ref);
 const require=()=>React;require.async=async spec=>{requests.push(spec);return {version:1,id:'navy-gala'};};
 const window={addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn),__ModuleLoader__:{load:d=>{plugin=d.factory(require);}}};
 const localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 vm.runInNewContext(await readFile(new URL('./lib/client.js',import.meta.url),'utf8'),{window,localStorage,AbortController,fetch:async url=>{assert.ok(url.startsWith('/plugins/dsh-whale-status/'),'only plugin-local metadata');requests.push(url);const record=imageModules['wardrobe:navy-gala'];return {ok:true,text:async()=>JSON.stringify({id:record.id,revision:record.revision,assets:{version:1,id:'navy-gala'}})};}});
 plugin.apply({slots:{inject:(_,fn)=>fn(),register:(o,c)=>{if(o.key==='whale-status')panel=c;}}});panel();
 const target={postMessage:m=>sent.push(m)};ref.current={contentWindow:target};const dispose=effects.map(fn=>fn());
 const send=(source,data)=>Promise.all([...listeners].map(fn=>fn({source,data:{channel:'liuli-companion',...data}})));
 const wardrobeRequests=()=>requests.filter(url=>url.includes('client.wardrobe-'));
 const deliveredAssets=()=>sent.filter(m=>['wardrobe-assets','room-art-assets','room-life-assets'].includes(m.type));
 assert.equal(requests.length,2,'mount primes only scene and life metadata');assert.equal(deliveredAssets().length,0,'preloading never delivers unsolicited assets');
 await send({}, {type:'wardrobe-request',requestId:'a',id:'navy-gala'});assert.equal(requests.length,2);assert.equal(deliveredAssets().length,0);
 await send(target,{type:'wardrobe-request',requestId:'a',id:'../bad'});assert.equal(requests.length,2);
 await send(target,{type:'wardrobe-request',requestId:'a',id:'navy-gala'});assert.ok(wardrobeRequests()[0].startsWith('/plugins/dsh-whale-status/client.wardrobe-navy-gala-v21.js?'));assert.equal(sent.at(-1).requestId,'a');
 await send(target,{type:'wardrobe-request',requestId:'b',id:'navy-gala'});assert.equal(wardrobeRequests().length,1);
 assert.equal(saved.size,0,'loading alone must not overwrite choice');
 await send(target,{type:'wardrobe-selected',id:'navy-gala'});assert.equal(saved.get('liuli-companion:wardrobe:v1'),'navy-gala');
 await send(target,{type:'wardrobe-request',requestId:'c'});assert.equal(sent.at(-1).id,'navy-gala');
 await send(target,{type:'wardrobe-request',requestId:'d',id:'original'});assert.equal(sent.at(-1).assets,null);assert.equal(wardrobeRequests().length,1);
 for(const fn of dispose)fn?.();assert.equal(listeners.size,0);
});

test('all 13 wardrobe chunks retain original PNGs and valid geometry',async()=>{
 const {validateWardrobe}=await import('./src/room-wardrobe.mjs'),catalog=JSON.parse(await readFile(new URL('./assets/wardrobe-v1/catalog.json',import.meta.url)));
 assert.equal(catalog.length,13);assert.equal(new Set(catalog.map(o=>o.id)).size,13);
 for(const {id} of catalog){let chunk;vm.runInNewContext(await readFile(new URL('./lib/client.wardrobe-'+id+'-v1.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>chunk=d}}});const a=chunk.factory();assert(validateWardrobe(a),id);assert.equal(a.id,id);assert.deepEqual(Buffer.from(a.url.split(',')[1],'base64'),await readFile(new URL('./assets/wardrobe-v1/'+id+'.png',import.meta.url)));}
});

test('DSH sidebar opens a sandboxed, self-contained status page', async () => {
  const source = await readFile(new URL('./lib/client.js', import.meta.url), 'utf8');
  assert.ok(Buffer.byteLength(source) < 1024 * 1024, 'UI entry must stay small; animation frames should load from local asset routes');
  const registrations = [];
  let plugin;
  const React = { createElement: (type, props, ...children) => ({ type, props, children }), useRef: () => ({current:null}), useEffect: () => {} };
  const chunkRequests=[],sent=[];
  const require=name=>{assert.equal(name,'react');return React;};
  require.async=async spec=>{chunkRequests.push(spec);return {stairs:'verified-fixture-data'};};
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(definition) {
      assert.equal(definition.id, 'dsh-whale-status');
      plugin = definition.factory(require);
    } } },
  });
  plugin.apply({ slots: {
    inject: (_name, mount) => mount(),
    register: (options, component) => { registrations.push({ options, component }); return () => {}; },
  } });
  const entry = registrations.find(row => row.options.name === 'sidebar.panellist');
  const panel = registrations.find(row => row.options.name === 'main');
  assert.equal(entry.options.label, '琉璃陪伴中心');
  assert.equal(entry.options.id, panel.options.key);
  const surface = panel.component();
  assert.equal(surface.type, 'div');
  assert.equal(surface.props.style.position, 'relative');
  const frame = surface.children[0];
  assert.equal(frame.type, 'iframe');
  assert.equal(frame.props.sandbox, 'allow-scripts');
  assert.equal(frame.props.src, undefined, 'panel must not depend on a preview server');
  assert.match(frame.props.srcDoc, /琉璃陪伴中心/);
  assert.doesNotMatch(frame.props.srcDoc, /SAMPLE_DATA/);
  assert.match(frame.props.srcDoc, /connect-src 'none'/);
  assert.equal(frame.props.srcDoc, await readFile(new URL('./lib/panel-built.html', import.meta.url), 'utf8'));
  frame.props.ref.current={contentWindow:{postMessage:(message,origin)=>sent.push({message,origin})}};
  await frame.props.onLoad();
  assert.equal(chunkRequests.length,0,'onLoad sends a small handshake; the ready child requests artwork once');
  assert.equal(sent[0].message.type,'room-runtime');
  assert.equal(sent[1].message.type,'room-energy');assert.equal(sent[2].message.type,'room-assets-ready');
  frame.props.ref.current=null;await frame.props.onLoad();assert.equal(sent.length,3,'Unmounted iframe must not receive assets');
});

test('v12 artwork chunk contains the approved wall mirror while retaining v7 floors',async()=>{
 let definition;vm.runInNewContext(await readFile(new URL('./lib/client.room-art-v12.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>definition=d}}});
 assert.equal(definition.chunk,'client.room-art-v12.js');const assets=definition.factory();
 const hash=b=>createHash('sha256').update(b).digest('hex');
 for(const[name,file]of Object.entries({'floor-one':'floor-one-v6.png','floor-two':'floor-two-v7.png',garden:'upstairs-garden-v7.png',mirror:'floor-two-mirror-v12.png'}))assert.equal(hash(Buffer.from(assets[name].split(',')[1],'base64')),hash(await readFile(new URL('./assets/room-house/'+file,import.meta.url))));
});

test('native lazy chunk contains exact PNG bytes without growing the startup entry',async()=>{
 let definition;vm.runInNewContext(await readFile(new URL('./lib/client.room-art-v7.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>definition=d}}});
 assert.equal(definition.id,'dsh-whale-status');assert.equal(definition.chunk,'client.room-art-v7.js');const assets=definition.factory();
 const hash=b=>createHash('sha256').update(b).digest('hex');
 for(const [name,file] of Object.entries({'floor-one':'floor-one-v6.png','floor-two':'floor-two-v7.png',garden:'upstairs-garden-v7.png'})){assert.match(assets[name],/^data:image\/png;base64,/);assert.equal(hash(Buffer.from(assets[name].split(',')[1],'base64')),hash(await readFile(new URL('./assets/room-house/'+file,import.meta.url))));}
});

test('primed life artwork is delivered only to the current iframe and stops on unmount',async()=>{
 const effects=[],listeners=new Set(),sent=[],requests=[],ref={current:null};let panel,plugin,resolveAssets;
 const React=bridgeReact(effects,ref);
 const require=name=>React;require.async=spec=>{requests.push(spec);return new Promise(resolve=>{resolveAssets=resolve;});};
 const window={addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn),__ModuleLoader__:{load:d=>{plugin=d.factory(require);}}};
 vm.runInNewContext(await readFile(new URL('./lib/client.js',import.meta.url),'utf8'),{window,Set,AbortController,fetch:async url=>{assert.ok(url.startsWith('/plugins/dsh-whale-status/'),'only plugin-local metadata');requests.push(url);const assets=await new Promise(resolve=>{resolveAssets=resolve;});return {ok:true,text:async()=>JSON.stringify({id:'life',revision:imageModules.life.revision,assets})};}});
 plugin.apply({slots:{inject:(_,fn)=>fn(),register:(options,component)=>{if(options.key==='whale-status')panel=component;}}});panel();
 const target={postMessage:message=>sent.push(message)};ref.current={contentWindow:target};const dispose=effects.map(fn=>fn());
 const send=source=>Promise.all([...listeners].map(fn=>fn({source,data:{channel:'liuli-companion',type:'room-life-request'}})));
 assert.equal(requests.length,2,'mount primes only the two scene metadata files');
 await send({});assert.equal(requests.length,2,'external source cannot trigger more loads');assert.equal(sent.filter(m=>m.type==='room-life-assets').length,0,'external source cannot receive artwork');
 const pending=send(target);assert.ok(requests.some(url=>url.startsWith('/plugins/dsh-whale-status/client.room-assets-life-v21.js?')));assert.equal(requests.length,2,'current iframe joins the primed load');resolveAssets({version:10});await pending;assert.equal(sent.filter(m=>m.type==='room-life-assets').length,1);
 const late=send(target);for(const fn of dispose)fn?.();await late;assert.equal(sent.filter(m=>m.type==='room-life-assets').length,1);assert.equal(listeners.size,0);
});

test('room runtime is stored by host and returned after remount; unrelated windows cannot replace it',async()=>{
 const stored=new Map(),localStorage={getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)};
 const effects=[],listeners=new Set(),sent=[],ref={current:null};let panel,plugin;
 const React=bridgeReact(effects,ref);
 const require=()=>React;require.async=async()=>({});
 const window={addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn),__ModuleLoader__:{load:d=>plugin=d.factory(require)}};
 vm.runInNewContext(await readFile(new URL('./lib/client.js',import.meta.url),'utf8'),{window,localStorage,Set,AbortController,fetch:()=>{throw Error("No network expected");}});
 plugin.apply({slots:{inject:(_,fn)=>fn(),register:(o,c)=>{if(o.key==='whale-status')panel=c;}}});panel();
 const first={postMessage:m=>sent.push(m)};ref.current={contentWindow:first};let dispose=effects.splice(0).map(fn=>fn());
 const send=(source,type,value)=>Promise.all([...listeners].map(fn=>fn({source,data:{channel:'liuli-companion',type,value}})));
 const value={version:1,savedAt:123,state:{residentLevel:'2',currentMode:'sleep'}};
 await send({},'room-runtime-save',value);assert.equal(stored.size,0);
 await send(first,'room-runtime-save',value);assert.equal(JSON.parse(stored.get('liuli-companion:room-runtime:v1')).state.residentLevel,'2');
 const energy={version:1,energy:0,updatedAt:123};await send({},'room-energy-save',{...energy,energy:99});assert.equal(stored.has('liuli-companion:room-energy:v1'),false);
 await send(first,'room-energy-save',{...energy,energy:101});assert.equal(stored.has('liuli-companion:room-energy:v1'),false);
 await send(first,'room-energy-save',energy);assert.equal(JSON.parse(stored.get('liuli-companion:room-energy:v1')).energy,0);
 dispose.forEach(fn=>fn?.());panel();const second={postMessage:m=>sent.push(m)};ref.current={contentWindow:second};dispose=effects.splice(0).map(fn=>fn());
 await send(second,'room-runtime-request');assert.equal(sent.at(-1).value.state.currentMode,'sleep');await send(second,'room-energy-request');assert.equal(sent.at(-1).type,'room-energy');assert.equal(sent.at(-1).value.energy,0);dispose.forEach(fn=>fn?.());
});

test('life lazy chunk preserves every original atlas byte and valid bounded metadata',async()=>{
 const {validateRoomLifeAssets}=await import('./src/room-life-art.mjs');let definition;
 vm.runInNewContext(await readFile(new URL('./lib/client.room-life-v11.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>definition=d}}});
 assert.equal(definition.chunk,'client.room-life-v11.js');const payload=definition.factory();assert(validateRoomLifeAssets(payload));
 const hash=b=>createHash('sha256').update(b).digest('hex');
 for(const[name,url]of Object.entries(payload.atlases))assert.equal(hash(Buffer.from(url.split(',')[1],'base64')),hash(await readFile(new URL(name==='walk'?'./assets/room-actions/walk-v3.png':'./assets/'+(name==='sofa-rest'?'room-life-v11/':'room-life-v10/')+name+'.png',import.meta.url))));
});


