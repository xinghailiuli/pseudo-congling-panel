import {isRoomImageUrl} from '../src/room-image-source.mjs';
import {validateRoomEnergySnapshot} from '../src/hud-energy.mjs';
import {createRoomSession} from '../src/runtime/room-session.mjs';
import {mountRoomUi as mountRoomReaderPanel} from '../src/ui/room-reader-panel.mjs';
import {createRoomUiContext} from '../src/ui/room-context.mjs';
import {mountRoomUi as mountRoomHud} from '../src/ui/room-hud.mjs';
import {mountRoomUi as mountRoomActionTray} from '../src/ui/room-action-tray.mjs';
import {mountRoomUi as mountRoomDressingPanel} from '../src/ui/room-dressing-panel.mjs';
import {mountRoomUi as mountRoomFurniturePanel} from '../src/ui/room-furniture-panel.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createDocument, Element, descendants, settle } from './helpers/workspace-dom.mjs';
import { createRoomRestoreGate } from '../src/room-diagnostics.mjs';

function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
async function host(load) {
  const imageManifest=JSON.parse(await readFile(new URL('../lib/room-asset-manifest.json',import.meta.url),'utf8'));
  let source = await readFile(new URL('../client.template.js', import.meta.url), 'utf8');
  for (const [token, value] of Object.entries({
    __ROOM_ENERGY_VALIDATOR__:'('+validateRoomEnergySnapshot.toString()+')',
    __ROOM_PHOTO_ENCODER__:'async()=>({})',__ROOM_ASSET_MANIFEST__:JSON.stringify(imageManifest.modules), __ROOM_MODULE_MANIFEST__:'{}', __PANEL_HTML__: '"test"', __WARDROBE_IDS__: '[]', __ALLOWED_ACTIONS__: '[]',
    __FRAME_BRIDGE__: 'const attachFrameBridge=()=>()=>{};', __BOOK_STORAGE__: 'const createRoomBookStorage=()=>async()=>({});', __HUD_SAFE_AREA__: 'const attachHudSafeArea=()=>()=>{};',
  })) source = source.replace(token, value);
  const effects = [], listeners = new Set(), delivered = [], loads = [], refs = [{ current: null }, { current: null }];
  let nextRef = 0, plugin, panel;
  const React = { createElement: (type, props, ...children) => ({ type, props, children }), useRef: () => refs[nextRef++], useEffect: fn => effects.push(fn) };
  const require = () => React; require.async = spec => { loads.push(spec); return load(spec); };
  const window = { addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn), __ModuleLoader__: { load: def => { plugin = def.factory(require); } } };
  vm.runInNewContext(source, { fetch:async url=>{ loads.push(url);const record=Object.values(imageManifest.modules).find(r=>url.includes(r.chunk));const assets=await load(url);return {ok:true,text:async()=>JSON.stringify({id:record.id,revision:record.revision,assets})};}, window, localStorage: { getItem() {}, setItem() {} }, console: { warn() {}, error() {}, log() {} } });
  plugin.apply({ slots: { inject: (_, fn) => fn(), register: (o, c) => { if (o.key === 'whale-status') panel = c; } } });
  const tree = panel(), target = { postMessage: message => delivered.push(message) };
  refs[0].current = { contentWindow: target };
  let dispose = effects.map(fn => fn());
  return { loads, delivered, onLoad: tree.children[0].props.onLoad,
    send: data => Promise.all([...listeners].map(fn => fn({ source: target, data: { channel: 'liuli-companion', ...data } }))),
    dispose: () => dispose.forEach(fn => fn?.()), remount() { dispose.forEach(fn=>fn?.());dispose=effects.map(fn=>fn()); } };
}

test('load handshake and duplicate artwork requests cause one large delivery', async t => {
  const gate = deferred(), h = await host(() => gate.promise); t.after(h.dispose);
  const load = h.onLoad();
  const first = h.send({ type: 'room-assets-request', requestId: 'art-one' });
  const repeat = h.send({ type: 'room-assets-request', requestId: 'art-one' });
  gate.resolve({ art: true }); await Promise.all([load, first, repeat]); await nextTurn();
  assert.equal(h.delivered.filter(d => d.type === 'room-assets').length, 1);
  assert.ok(h.delivered.some(d => d.type === 'room-assets-ready'), 'onLoad tells a ready child to resend any lost startup request');
  assert.equal(h.loads.filter(url=>url.includes('assets-art')).length, 1);
});

test('duplicate life requests share their pending delivery, not only chunk fetch', async t => {
  const gate = deferred(), h = await host(() => gate.promise); t.after(h.dispose);
  const first = h.send({ type: 'room-life-request', requestId: 'life-one' });
  const repeat = h.send({ type: 'room-life-request', requestId: 'life-one' });
  gate.resolve({ version: 10 }); await Promise.all([first, repeat]);
  assert.equal(h.delivered.filter(d => d.type === 'room-life-assets').length, 1);
  assert.equal(h.loads.filter(url=>url.includes('assets-life')).length, 1);
});

test('onLoad after an early response does not clone artwork again; explicit retry does', async t => {
  const h = await host(async () => ({ art: true })); t.after(h.dispose);
  await h.send({ type: 'room-assets-request', requestId: 'document-a' }); await nextTurn();
  await h.onLoad();
  await h.send({ type: 'room-assets-request', requestId: 'document-a' }); await nextTurn();
  assert.equal(h.delivered.filter(d => d.type === 'room-assets').length, 1);
  await h.send({ type: 'room-assets-request', requestId: 'manual-retry' }); await nextTurn();
  assert.equal(h.delivered.filter(d => d.type === 'room-assets').length, 2);
  assert.equal(h.loads.filter(url=>url.includes('assets-art')).length, 1, 'retry can resend the cached valid chunk');
});

test('new document request on the same WindowProxy supersedes pending old document delivery', async t => {
  const gate = deferred(), h = await host(() => gate.promise); t.after(h.dispose);
  const old = h.send({ type: 'room-assets-request', requestId: 'old-document' });
  const load = h.onLoad();
  const current = h.send({ type: 'room-assets-request', requestId: 'new-document' });
  gate.resolve({ art: true }); await Promise.all([old, load, current]); await nextTurn();
  const assets = h.delivered.filter(d => d.type === 'room-assets');
  assert.deepEqual(assets.map(d => d.requestId), ['new-document']);
});

test('failed shared chunk clears its delivery so retry can fetch and unmount suppresses delivery', async t => {
  let fail = true; const gate = deferred();
  const h = await host(async () => { if (fail) throw Error('read failed'); return gate.promise; }); t.after(h.dispose);
  await h.send({ type: 'room-assets-request', requestId: 'one' }); await nextTurn();
  assert.equal(h.delivered.at(-1).type, 'room-assets-error');
  fail = false;
  const retry = h.send({ type: 'room-assets-request', requestId: 'retry' });
  h.dispose(); gate.resolve({ art: true }); await retry; await nextTurn();
  assert.equal(h.loads.filter(url=>url.includes('assets-art')).length, 2);
  assert.equal(h.delivered.some(d => d.type === 'room-assets'), false);
});

test('host listener mounting recovers startup requests even when iframe onLoad happened first', async t => {
  const h = await host(async () => ({ art: true })); t.after(h.dispose);
  assert.ok(h.delivered.some(d => d.type === 'room-assets-ready'), 'attaching the receiver announces readiness independently of onLoad');
});

test('effect cleanup and remount on the same frame do not swallow a retried pending request', async t => {
  const gate=deferred(),h=await host(()=>gate.promise);t.after(h.dispose);
  const old=h.send({type:'room-life-request',requestId:'same-document'});
  h.remount();
  const current=h.send({type:'room-life-request',requestId:'same-document'});
  gate.resolve({version:10});await Promise.all([old,current]);
  assert.equal(h.delivered.filter(d=>d.type==='room-life-assets').length,1);
});

test('isolated preview sender mirrors one-delivery handshake and explicit retry behavior', async () => {
  const source=await readFile(new URL('./hud-polish-preview-server.mjs',import.meta.url),'utf8');
  const start=source.indexOf('const roomChunkDeliveries=new WeakMap();'),end=source.indexOf("frame.addEventListener('load',notifyRoomFrame);",start);
  assert.ok(start>=0&&end>start);
  const delivered=[],gate=deferred(),target={postMessage:d=>delivered.push(d)};
  const context=vm.createContext({frame:{contentWindow:target},roomRuntime:null,useAssetMetadata:false,fetchChunk:()=>gate.promise});
  vm.runInContext(source.slice(start,end)+'\nglobalThis.sender={sendRoomChunk,notifyRoomFrame};',context);
  context.sender.notifyRoomFrame();
  const first=context.sender.sendRoomChunk('art','one'),repeat=context.sender.sendRoomChunk('art','one');
  gate.resolve({art:true});await Promise.all([first,repeat]);
  assert.equal(delivered.filter(d=>d.type==='room-assets').length,1);
  await context.sender.sendRoomChunk('art','retry');
  assert.equal(delivered.filter(d=>d.type==='room-assets').length,2);
});

async function panelFixture({disposeBeforePaint=false}={}) {
  const document = createDocument(), requests = [], listeners = [], timers = [], replied = new Set(), created = [];
  const createElement=document.createElement;document.createElement=tag=>{const element=createElement(tag);created.push(element);return element;};
  let lifeApplications = 0,sceneMounts=0;
  const frameWindow={addEventListener(type,fn){if(type==='message')listeners.push(fn);}};
  const room = { lamp: true, curtain: true, description: 'room', items: [], interactions: [] };
  const data = { '/room': room, '/night/state': { sleeping: false, energy: 80, mood: 60 }, '/jobs': { items: [] }, '/overview': { room, night: { energy: 80, mood: 60 }, settings: {}, counts: {}, connections: { bridge: {} }, events: [] } };
  const parent = { postMessage: message => requests.push(message) };
  vm.runInNewContext(await readFile(new URL('../panel.js', import.meta.url), 'utf8'), {
    isRoomImageUrl,createRoomSession,mountRoomReaderPanel,createRoomUiContext,mountRoomHud,mountRoomActionTray,mountRoomDressingPanel,mountRoomFurniturePanel,document, parent, Node: Element, crypto: webcrypto, structuredClone,
    DAFEIYU_CLIPS: {}, WARDROBE_CATALOG: [], ROOM_ACTIONS: { house: { floors: {}, repairs: { 1: {}, 2: {} }, actions: { garden: { frames: [] } } } },
    validateRoomLifeAssets: a => a?.version === 10,
    createRoomRestoreGate: options => createRoomRestoreGate({ ...options, schedule: () => 0, cancel() {} }),
    window:frameWindow,
    setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; }, clearTimeout(id) {if(timers[id-1])timers[id-1].cancelled=true;},
    createBlockRoom() {sceneMounts++; const scene = document.createElement('svg'); scene.roomActions = []; scene.setRoomOutfit = () => true; scene.setRoomLifeAssets = () => { lifeApplications++; return Promise.resolve(true); }; return scene; },
  });
  if(disposeBeforePaint){
    for(const request of requests.filter(r=>r.type==='request'&&Object.hasOwn(data,r.action)))for(const listener of listeners)listener({source:parent,data:{channel:'liuli-companion',type:'response',id:request.id,payload:{data:structuredClone(data[request.action]),revision:1}}});
    frameWindow.__disposeWhaleRoomUi();await settle();
    return {sceneMounts,timers:timers.filter(timer=>!timer.cancelled)};
  }
  const emit = value => Promise.all(listeners.map(fn => fn({ source: parent, data: { channel: 'liuli-companion', ...value } })));
  const drain = async () => { for (let i = 0; i < 12; i++) { for (const r of requests.filter(r => r.type === 'request' && !replied.has(r.id) && Object.hasOwn(data, r.action))) { replied.add(r.id); await emit({ type: 'response', id: r.id, payload: { data: structuredClone(data[r.action]), revision: 1 } }); } await settle(); } };
  await emit({ type: 'room-runtime', value: null }); await drain();
  return { document, created, requests, timers, emit, lifeApplications: () => lifeApplications };
}

test('panel scene mounting and deferred startup share one request per resource', async () => {
  const p = await panelFixture();
  for (const timer of p.timers.filter(t => t.ms === 0 || t.ms === 60)) timer.fn();
  assert.equal(p.requests.filter(d => d.type === 'room-assets-request').length, 1);
  assert.equal(p.requests.filter(d => d.type === 'room-life-request').length, 1);
  const ids = p.requests.filter(d => ['room-assets-request', 'room-life-request'].includes(d.type)).map(d => d.requestId);
  await p.emit({ type: 'room-assets-ready' });
  const resent = p.requests.filter(d => ['room-assets-request', 'room-life-request'].includes(d.type)).slice(-2).map(d => d.requestId);
  assert.deepEqual(resent, ids, 'load handshake recovers early lost requests without changing their delivery identity');
});

test('panel ignores repeated successful receipt and manual missing-art retry uses a fresh identity', async () => {
  const p = await panelFixture();
  const life = p.requests.find(d => d.type === 'room-life-request');
  await p.emit({ type: 'room-life-assets', requestId: life.requestId, assets: { version: 10 } });
  await p.emit({ type: 'room-life-assets', requestId: life.requestId, assets: { version: 10 } });
  assert.equal(p.lifeApplications(), 1);
  const initial = p.requests.find(d => d.type === 'room-assets-request');
  await p.emit({ type: 'room-assets-error', requestId: initial.requestId });
  const retry = p.created.find(e => e.tagName === 'BUTTON' && e.textContent === '重试动作素材');
  await retry.fire('click');
  const last = p.requests.filter(d => d.type === 'room-assets-request').at(-1);
  assert.notEqual(last.requestId, initial.requestId);
});

test('disposing after synchronous initial replies invalidates the queued room paint',async()=>{const fixture=await panelFixture({disposeBeforePaint:true});assert.equal(fixture.sceneMounts,0);assert.equal(fixture.timers.length,0);});
