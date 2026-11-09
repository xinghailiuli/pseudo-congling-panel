import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {validateRoomEnergySnapshot} from '../src/hud-energy.mjs';

async function host(load,alterPayload=value=>value,location) {
  const catalog = JSON.parse(await readFile(new URL('../assets/wardrobe-v1/catalog.json', import.meta.url)));
  const imageManifest=JSON.parse(await readFile(new URL('../lib/room-asset-manifest.json',import.meta.url),'utf8'));
  let source = await readFile(new URL('../client.template.js', import.meta.url), 'utf8');
  for (const [token, value] of Object.entries({
    __ROOM_ENERGY_VALIDATOR__:'('+validateRoomEnergySnapshot.toString()+')',
    __ROOM_PHOTO_ENCODER__:'async()=>({})',__ROOM_ASSET_MANIFEST__:JSON.stringify(imageManifest.modules), __ROOM_MODULE_MANIFEST__:'{}', __PANEL_HTML__: '"test"', __WARDROBE_IDS__: JSON.stringify(catalog.map(row => row.id)), __ALLOWED_ACTIONS__: '[]',
    __FRAME_BRIDGE__: 'const attachFrameBridge=()=>()=>{};',
    __BOOK_STORAGE__: 'const createRoomBookStorage=()=>async()=>({});',
    __HUD_SAFE_AREA__: 'const attachHudSafeArea=()=>()=>{};',
  })) source = source.replace(token, value);
  const effects = [], listeners = new Set(), delivered = [], requests = [], refs = [{ current: null }, { current: null }], saved = new Map();
  let nextRef = 0, plugin, panel;
  const React = { createElement: (type, props, ...children) => ({ type, props, children }), useRef: () => refs[nextRef++], useEffect: fn => effects.push(fn) };
  const require = () => React;
  require.async = spec => { requests.push(spec); return load(spec); };
  const window = { location,addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn), __ModuleLoader__: { load: def => { plugin = def.factory(require); } } };
  vm.runInNewContext(source, { URL,fetch:async url=>{ requests.push(url);const record=Object.values(imageManifest.modules).find(r=>url.includes(r.chunk));const assets=await load(url);return {ok:true,text:async()=>JSON.stringify(alterPayload({id:record.id,revision:record.revision,assets}))};}, window, localStorage: { getItem: k => saved.get(k), setItem: (k, v) => saved.set(k, v) }, console: { warn() {}, error() {}, log() {} } });
  plugin.apply({ slots: { inject: (_, fn) => fn(), register: (options, component) => { if (options.key === 'whale-status') panel = component; } } });
  panel();
  const target = { postMessage: message => delivered.push(message) };
  refs[0].current = { contentWindow: target };
  const dispose = effects.map(fn => fn());
  const send = data => Promise.all([...listeners].map(fn => fn({ source: target, data: { channel: 'liuli-companion', ...data } })));
  return { get requests(){return requests.filter(url=>url.includes('client.wardrobe-'));}, metadataRequests:requests, delivered, send, dispose: () => dispose.forEach(fn => fn?.()) };
}

test('mounting starts first-view metadata before the iframe requests it, and shares pending reads',async t=>{
 let deliver;const gate=new Promise(resolve=>deliver=resolve),h=await host(()=>gate);t.after(h.dispose);
 assert.equal(h.metadataRequests.length,2,'art and life metadata should already be in flight at mount');
 const first=h.send({type:'room-assets-request',requestId:'art-early'});
 const life=h.send({type:'room-life-request',requestId:'life-early'});
 assert.equal(h.metadataRequests.length,2,'child requests must share the early metadata reads');
 deliver({});await Promise.all([first,life]);assert.equal(h.delivered.filter(m=>m.type==='room-assets').length,1);assert.equal(h.delivered.filter(m=>m.type==='room-life-assets').length,1);
});

test('host outfit cache evicts older settled payloads while retaining selected outfit', async t => {
  const h = await host(async spec => ({ id: spec, marker: {} })); t.after(h.dispose);
  let requestId = 0;
  const request = id => h.send({ type: 'wardrobe-request', id, requestId: String(++requestId) });
  await request('navy-gala');
  const selected = h.delivered.at(-1).assets;
  await h.send({ type: 'wardrobe-selected', id: 'navy-gala' });
  for (const id of ['red-server', 'voxel-whale', 'whale-hood', 'snow-earmuffs', 'cream-hoodie', 'white-beret']) await request(id);
  await request('navy-gala');
  assert.equal(h.delivered.at(-1).assets, selected, 'selected outfit remains available after six other outfits');
  assert.equal(h.requests.length, 7);
  await request('red-server');
  assert.equal(h.requests.length, 8, 'oldest inactive payload was released rather than retained indefinitely');
});

test('host cache shares pending outfit load across requests and delivers each request receipt', async t => {
  let resolve;
  const loading = new Promise(done => { resolve = done; });
  const h = await host(() => loading); t.after(h.dispose);
  const first = h.send({ type: 'wardrobe-request', id: 'navy-gala', requestId: 'one' });
  const second = h.send({ type: 'wardrobe-request', id: 'navy-gala', requestId: 'two' });
  assert.equal(h.requests.length, 1);
  resolve({ id: 'navy-gala' }); await Promise.all([first, second]);
  assert.deepEqual(h.delivered.filter(message=>message.type==='wardrobe-assets').map(message => message.requestId), ['one', 'two']);
});

test('stale image metadata is rejected before delivery and can retry with the current version',async t=>{
 let stale=true;const h=await host(async()=>({id:'navy-gala'}),p=>stale?{...p,revision:'stale'}:p);t.after(h.dispose);
 await h.send({type:'wardrobe-request',id:'navy-gala',requestId:'old'});assert.equal(h.delivered.at(-1).type,'wardrobe-error');
 stale=false;await h.send({type:'wardrobe-request',id:'navy-gala',requestId:'retry'});assert.equal(h.delivered.at(-1).type,'wardrobe-assets');assert.equal(h.requests.length,2);
});

test('desktop image delivery keeps application URLs and loopback web delivery uses its actual origin',async t=>{
 const url='dsh-app://app/plugins/dsh-whale-status/assets/'+'a'.repeat(64)+'/outfit.png';
 for(const [location,expected]of [[{protocol:'dsh-app:',hostname:'app',origin:'dsh-app://app'},url],[{protocol:'http:',hostname:'127.0.0.1',origin:'http://127.0.0.1:19387'},url.replace('dsh-app://app','http://127.0.0.1:19387')]]){
  const h=await host(async()=>({url,desk:{url},geometry:{width:1}}),p=>p,location);t.after(h.dispose);await h.send({type:'wardrobe-request',id:'navy-gala',requestId:'origin'});assert.equal(h.delivered.at(-1).assets.url,expected);assert.equal(h.delivered.at(-1).assets.desk.url,expected);
 }
});
