import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

test('wardrobe lazy loading is scoped, cached, recoverable and persists only selection',async()=>{
 const effects=[],listeners=new Set(),sent=[],requests=[],ref={current:null},saved=new Map();let panel,plugin;
 const React={createElement:(type,props)=>({type,props}),useRef:()=>ref,useEffect:fn=>effects.push(fn)};
 const require=()=>React;require.async=async spec=>{requests.push(spec);return {version:1,id:'navy-gala'};};
 const window={addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn),__ModuleLoader__:{load:d=>{plugin=d.factory(require);}}};
 const localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
 vm.runInNewContext(await readFile(new URL('./lib/client.js',import.meta.url),'utf8'),{window,localStorage,AbortController,fetch:()=>{throw Error('Wardrobe must stay local');}});
 plugin.apply({slots:{inject:(_,fn)=>fn(),register:(o,c)=>{if(o.key==='whale-status')panel=c;}}});panel();
 const target={postMessage:m=>sent.push(m)};ref.current={contentWindow:target};const dispose=effects.map(fn=>fn());
 const send=(source,data)=>Promise.all([...listeners].map(fn=>fn({source,data:{channel:'liuli-companion',...data}})));
 await send({}, {type:'wardrobe-request',requestId:'a',id:'navy-gala'});assert.equal(requests.length,0);
 await send(target,{type:'wardrobe-request',requestId:'a',id:'../bad'});assert.equal(requests.length,0);
 await send(target,{type:'wardrobe-request',requestId:'a',id:'navy-gala'});assert.equal(requests[0],'./client.wardrobe-navy-gala-v19.js');assert.equal(sent.at(-1).requestId,'a');
 await send(target,{type:'wardrobe-request',requestId:'b',id:'navy-gala'});assert.equal(requests.length,1);
 assert.equal(saved.size,0,'loading alone must not overwrite choice');
 await send(target,{type:'wardrobe-selected',id:'navy-gala'});assert.equal(saved.get('liuli-companion:wardrobe:v1'),'navy-gala');
 await send(target,{type:'wardrobe-request',requestId:'c'});assert.equal(sent.at(-1).id,'navy-gala');
 await send(target,{type:'wardrobe-request',requestId:'d',id:'original'});assert.equal(sent.at(-1).assets,null);assert.equal(requests.length,1);
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
  const React = { createElement: (type, props) => ({ type, props }), useRef: () => ({current:null}), useEffect: () => {} };
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
  const frame = panel.component();
  assert.equal(frame.type, 'iframe');
  assert.equal(frame.props.sandbox, 'allow-scripts');
  assert.equal(frame.props.src, undefined, 'panel must not depend on a preview server');
  assert.match(frame.props.srcDoc, /琉璃陪伴中心/);
  assert.doesNotMatch(frame.props.srcDoc, /SAMPLE_DATA/);
  assert.match(frame.props.srcDoc, /connect-src 'none'/);
  assert.equal(frame.props.srcDoc, (await readFile(new URL('./lib/panel-built.html', import.meta.url), 'utf8')).replaceAll('__LIULI_ASSET_ORIGIN__','dsh-app://app'));
  frame.props.ref.current={contentWindow:{postMessage:(message,origin)=>sent.push({message,origin})}};
  await frame.props.onLoad();
  assert.equal(chunkRequests.join(','),'./client.room-art-v12.js');
  assert.equal(sent[0].message.type,'room-runtime');
  assert.equal(sent.find(x=>x.message.type==='room-assets').message.assets.stairs,'verified-fixture-data');
  frame.props.ref.current=null;await frame.props.onLoad();assert.equal(sent.length,2,'Unmounted iframe must not receive assets');
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

test('life artwork loads only on a request from the current iframe and stops delivery on unmount',async()=>{
 const effects=[],listeners=new Set(),sent=[],requests=[],ref={current:null};let panel,plugin,resolveAssets;
 const React={createElement:(type,props)=>({type,props}),useRef:()=>ref,useEffect:fn=>effects.push(fn)};
 const require=name=>React;require.async=spec=>{requests.push(spec);return new Promise(resolve=>{resolveAssets=resolve;});};
 const window={addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn),__ModuleLoader__:{load:d=>{plugin=d.factory(require);}}};
 vm.runInNewContext(await readFile(new URL('./lib/client.js',import.meta.url),'utf8'),{window,Set,AbortController,fetch:()=>{throw Error('Artwork must not request backend services');}});
 plugin.apply({slots:{inject:(_,fn)=>fn(),register:(options,component)=>{if(options.key==='whale-status')panel=component;}}});panel();
 const target={postMessage:message=>sent.push(message)};ref.current={contentWindow:target};const dispose=effects.map(fn=>fn());
 const send=source=>Promise.all([...listeners].map(fn=>fn({source,data:{channel:'liuli-companion',type:'room-life-request'}})));
 await send({});assert.equal(requests.length,0,'external source cannot load artwork');
 const pending=send(target);assert.equal(requests.join(','),'./client.room-life-v19.js');resolveAssets({version:10});await pending;assert.equal(sent[0].type,'room-life-assets');
 const late=send(target);for(const fn of dispose)fn?.();await late;assert.equal(sent.length,1);assert.equal(listeners.size,0);
});

test('room runtime is stored by host and returned after remount; unrelated windows cannot replace it',async()=>{
 const stored=new Map(),localStorage={getItem:k=>stored.get(k),setItem:(k,v)=>stored.set(k,v)};
 const effects=[],listeners=new Set(),sent=[],ref={current:null};let panel,plugin;
 const React={createElement:(type,props)=>({type,props}),useRef:()=>ref,useEffect:fn=>effects.push(fn)};
 const require=()=>React;require.async=async()=>({});
 const window={addEventListener:(_,fn)=>listeners.add(fn),removeEventListener:(_,fn)=>listeners.delete(fn),__ModuleLoader__:{load:d=>plugin=d.factory(require)}};
 vm.runInNewContext(await readFile(new URL('./lib/client.js',import.meta.url),'utf8'),{window,localStorage,Set,AbortController,fetch:()=>{throw Error("No network expected");}});
 plugin.apply({slots:{inject:(_,fn)=>fn(),register:(o,c)=>{if(o.key==='whale-status')panel=c;}}});panel();
 const first={postMessage:m=>sent.push(m)};ref.current={contentWindow:first};let dispose=effects.splice(0).map(fn=>fn());
 const send=(source,type,value)=>Promise.all([...listeners].map(fn=>fn({source,data:{channel:'liuli-companion',type,value}})));
 const value={version:1,savedAt:123,state:{residentLevel:'2',currentMode:'sleep'}};
 await send({},'room-runtime-save',value);assert.equal(stored.size,0);
 await send(first,'room-runtime-save',value);assert.equal(JSON.parse(stored.get('liuli-companion:room-runtime:v1')).state.residentLevel,'2');
 dispose.forEach(fn=>fn?.());panel();const second={postMessage:m=>sent.push(m)};ref.current={contentWindow:second};dispose=effects.splice(0).map(fn=>fn());
 await send(second,'room-runtime-request');assert.equal(sent.at(-1).value.state.currentMode,'sleep');dispose.forEach(fn=>fn?.());
});

test('life lazy chunk preserves every original atlas byte and valid bounded metadata',async()=>{
 const {validateRoomLifeAssets}=await import('./src/room-life-art.mjs');let definition;
 vm.runInNewContext(await readFile(new URL('./lib/client.room-life-v11.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>definition=d}}});
 assert.equal(definition.chunk,'client.room-life-v11.js');const payload=definition.factory();assert(validateRoomLifeAssets(payload));
 const hash=b=>createHash('sha256').update(b).digest('hex');
 for(const[name,url]of Object.entries(payload.atlases))assert.equal(hash(Buffer.from(url.split(',')[1],'base64')),hash(await readFile(new URL(name==='walk'?'./assets/room-actions/walk-v3.png':'./assets/'+(name==='sofa-rest'?'room-life-v11/':'room-life-v10/')+name+'.png',import.meta.url))));
});



test('iframe image policy follows the actual host instead of the author local port',async()=>{
 const source=await readFile(new URL('./lib/client.js',import.meta.url),'utf8');
 for(const href of ['dsh-app://app/index.html','http://127.0.0.1:27361/','https://harness.example.invalid/']){
  let plugin,panel;const React={createElement:(type,props)=>({type,props}),useRef:()=>({current:null}),useEffect:()=>{}};
  vm.runInNewContext(source,{URL,window:{location:{href},__ModuleLoader__:{load(d){plugin=d.factory(()=>React);}}}});
  plugin.apply({slots:{inject:(_name,mount)=>mount(),register:(options,component)=>{if(options.name==='main')panel=component;return()=>{};}}});
  const html=panel().props.srcDoc,host=new URL(href);
  assert.ok(html.includes(`${host.protocol}//${host.host}/plugins/dsh-whale-status/`),'own assets must be allowed at this host');
  const policy=html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.ok(!policy.includes('19387'));assert.ok(!policy.includes('dsh-dafeiyu'));assert.ok(!policy.includes('__LIULI_ASSET_ORIGIN__'));
 }
});
