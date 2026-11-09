import {createRoomSession} from '../src/runtime/room-session.mjs';
import {mountRoomUi as mountRoomReaderPanel} from '../src/ui/room-reader-panel.mjs';
import {createRoomUiContext} from '../src/ui/room-context.mjs';
import {mountRoomUi as mountRoomHud} from '../src/ui/room-hud.mjs';
import {mountRoomUi as mountRoomActionTray} from '../src/ui/room-action-tray.mjs';
import {mountRoomUi as mountRoomDressingPanel} from '../src/ui/room-dressing-panel.mjs';
import {mountRoomUi as mountRoomFurniturePanel} from '../src/ui/room-furniture-panel.mjs';
import {createRoomDressing} from '../src/room-dressing.mjs';
const createDressingAssetClient=()=>({load:async()=>({assets:{},favorites:[]}),setFavorites(){}});
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { attachFrameBridge } from '../src/frame-bridge.mjs';
import { createBlockRoom } from '../src/room-scene.mjs';
import { decodeBaseWardrobeAsset, decodeWardrobeSupplements, revokeWardrobeBlobUrls } from '../src/room-wardrobe.mjs';
import { createRoomWorkspace } from '../src/room-workspace.mjs';
import { createRoomBookReader } from '../src/room-book-reader.mjs';
import { createRoomBookStorage } from '../src/room-book-storage.mjs';
import { createRoomDaylight } from '../src/room-daylight.mjs';
import { createRoomRestoreGate as restoreGate } from '../src/room-diagnostics.mjs';
import { CompanionService } from '../src/service.mjs';
import { initialState } from '../src/store.mjs';
import { createDocument, Element, descendants, settle } from './helpers/workspace-dom.mjs';

test('frame bridge queues bursts beyond 8 concurrent requests instead of dropping them', async () => {
  let listener;
  const output = [], resolvers = [];
  let inFlight = 0, maxInFlight = 0;
  const child = { postMessage(v) { output.push(v); } };
  const win = { addEventListener(_, fn) { listener = fn; }, removeEventListener() {} };
  const dispose = attachFrameBridge(win, () => child, new Set(['/overview']), () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    return new Promise(resolve => {
      resolvers.push(() => {
        inFlight--;
        resolve(new Response('{"data":{"ok":true},"revision":1}'));
      });
    });
  });
  for (let i = 0; i < 14; i++) {
    void listener({ source: child, data: { channel: 'liuli-companion', type: 'request', id: `req-burst-${String(i).padStart(4, '0')}`, action: '/overview', body: {} } });
  }
  await settle();
  assert.equal(maxInFlight, 8, 'concurrency cap of 8 must be respected');
  while (resolvers.length) {
    const batch = resolvers.splice(0, resolvers.length);
    for (const r of batch) r();
    await settle();
  }
  assert.equal(output.length, 14, 'all 14 requests must resolve without any dropped request');
  dispose();
});

test('setRoomEnvironment updates SVG lamp and curtain overlays and aria labels in place', async () => {
  const assets = JSON.parse(await readFile(new URL('../assets/room-actions/manifest.json', import.meta.url), 'utf8'));
  const names = ['床','书桌','台灯','窗','沙发','冰箱','电视','绿萝','旧相册','日记本','记事本','床头柜','书架','椅子','电脑','茶几','挂画','挂钟','盆栽'];
  class SvgEl {
    constructor(tag) { this.tagName = tag; this.attributes = {}; this.children = []; this.events = {}; this.textContent = ''; }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k]; }
    append(...n) { this.children.push(...n); }
    addEventListener(k, fn) { this.events[k] = fn; }
  }
  const doc = { createElementNS: (_, tag) => new SvgEl(tag) };
  const nodes = n => [n, ...n.children.flatMap(nodes)];
  const r = { lamp: true, curtain: true, items: names.map((name, i) => ({ id: String(i), name, state: '' })) };
  const svg = createBlockRoom(r, { document: doc, actionAssets: assets, petAssets: { idle: { frames: ['i0'], frameMs: 40 } }, animation: { reducedMotion: true } });
  const curtainOverlay = nodes(svg).find(n => n.attributes['data-curtain-overlay']);
  const lampOverlay = nodes(svg).find(n => n.attributes['data-lamp-overlay']);
  const curtainBtn = nodes(svg).find(n => n.attributes['data-room-control'] === 'curtain');
  const lampBtn = nodes(svg).find(n => n.attributes['data-room-control'] === 'lamp');

  assert.equal(curtainOverlay.attributes.display, 'none');
  assert.equal(lampOverlay.attributes.display, 'none');
  svg.setRoomEnvironment({ lamp: false, curtain: false });
  assert.equal(curtainOverlay.attributes.display, 'inline');
  assert.equal(lampOverlay.attributes.display, 'inline');
  assert.equal(curtainBtn.attributes['aria-label'], '拉开窗帘');
  assert.equal(lampBtn.attributes['aria-label'], '打开台灯');
  svg.setRoomEnvironment({ lamp: true, curtain: true });
  assert.equal(curtainOverlay.attributes.display, 'none');
  assert.equal(lampOverlay.attributes.display, 'none');
  assert.equal(curtainBtn.attributes['aria-label'], '合上窗帘');
  assert.equal(lampBtn.attributes['aria-label'], '关闭台灯');
});

test('cached room shell toggles lamp and curtain back and forth and Escape exits immersive view', async () => {
  const document = createDocument();
  const docListeners = {};
  document.addEventListener = (t, fn) => { (docListeners[t] ??= []).push(fn); };
  document.removeEventListener = (t, fn) => { docListeners[t] = (docListeners[t] || []).filter(x => x !== fn); };
  document.querySelector = () => null;
  const requests = [], responded = new Set(), listeners = [];
  const roomState = { lamp: true, curtain: true, description: '原房间', items: [{ id: 'bed', name: '床' }], interactions: [] };
  const data = {
    '/overview': { night: { sleeping: false, stage: 'awake', energy: 80, mood: 70 }, settings: { allowSleep: false }, counts: {}, connections: { bridge: { ok: true } }, room: roomState, events: [] },
    '/night/state': { sleeping: false, stage: 'awake', energy: 80, mood: 60, unread: {}, timeline: [] },
    '/jobs': { items: [] }
  };
  let envState = null, sceneOpts = null;
  const parent = { postMessage: r => requests.push(r) };
  vm.runInNewContext(await readFile(new URL('../panel.js', import.meta.url), 'utf8'), {
    createRoomSession,mountRoomReaderPanel,createRoomUiContext,mountRoomHud,mountRoomActionTray,mountRoomDressingPanel,mountRoomFurniturePanel,createRoomDressing, createDressingAssetClient, document, parent, Node: Element, crypto: webcrypto, structuredClone,
    DAFEIYU_CLIPS: {}, ROOM_ACTIONS: { house: { repairs: { 1: {}, 2: {} }, actions: { garden: { frames: [] } } } },
    WARDROBE_CATALOG: [], createRoomWorkspace, createRoomBookReader,
    createRoomRestoreGate: o => restoreGate({ ...o, schedule: () => 0, cancel: () => {} }),
    window: { addEventListener(t, fn) { if (t === 'message') listeners.push(fn); } },
    setTimeout: () => 1, clearTimeout: () => {},
    createBlockRoom(r, options) {
      sceneOpts = options;
      const scene = document.createElement('svg');
      scene.roomActions = [];
      scene.setRoomOutfit = () => true;
      scene.setRoomEnvironment = env => { envState = env; };
      scene.setRoomFloor = f => options.onFloor(f, { detail: false });
      scene.setRoomActivity = p => options.onActivity({ preview: p.preview ?? 'auto', label: '活动', source: 'preview' });
      return scene;
    }
  });
  let rev = 10;
  const drain = async () => {
    for (let i = 0; i < 12; i++) {
      for (const r of requests.filter(r => r.type === 'request' && !responded.has(r.id))) {
        responded.add(r.id);
        if (r.action === '/room/save') Object.assign(roomState, r.body.patch);
        const val = r.action === '/room' || r.action === '/room/save' ? structuredClone(roomState) : data[r.action];
        listeners.forEach(fn => fn({ source: parent, data: { channel: 'liuli-companion', type: 'response', id: r.id, payload: { data: val, revision: ++rev } } }));
      }
      await settle();
    }
  };
  await drain();

  // First click on in-SVG lamp turns it off (true -> false)
  const pLamp1 = sceneOpts.onLamp();
  await drain();
  await pLamp1;
  assert.equal(roomState.lamp, false);
  assert.deepEqual({ ...envState }, { lamp: false, curtain: true });

  // Second click on in-SVG lamp turns it back on (false -> true) — verifies stale closure is fixed!
  const pLamp2 = sceneOpts.onLamp();
  await drain();
  await pLamp2;
  assert.equal(roomState.lamp, true);
  assert.deepEqual({ ...envState }, { lamp: true, curtain: true });

  // Immersive toggle + Escape exit
  const all = () => descendants(document.body);
  const expandBtn = all().find(e => e.tagName === 'BUTTON' && e.textContent === '放大看');
  await expandBtn.fire('click');
  assert.equal(expandBtn.textContent, '收回小屋');
  for (const fn of docListeners.keydown || []) fn({ key: 'Escape', preventDefault() {} });
  assert.equal(expandBtn.textContent, '放大看');
});

test('decodeWardrobeSupplements decodes priority keys first without re-decoding base and revokes blob URLs cleanly', async () => {
  const geometry = { width: 400, height: 400, referenceHeight: 300, frames: Array.from({ length: 16 }, (_, i) => ({ crop: [0, 0, 90, 90], anchor: [45, 85], hip: [45, 70], head: [45, 20], outline: [[0, 0], [1, 0], [1, 1]] })) };
  const outfit = {
    version: 1, id: 'navy-gala', url: 'data:image/png;base64,BASE', geometry,
    desk: { url: 'data:image/png;base64,DESK', geometry: { ...geometry, frames: geometry.frames.slice(0, 4) } },
    walk: { url: 'data:image/png;base64,WALK', geometry: { ...geometry, frames: geometry.frames.slice(0, 8) } },
    sofaBody: { url: 'data:image/png;base64,SOFA', geometry }
  };
  const order = [];
  class CustomImage {
    async decode() { order.push(this.src); this.naturalWidth = 400; this.naturalHeight = 400; }
  }
  await decodeBaseWardrobeAsset(outfit, CustomImage);
  await decodeWardrobeSupplements(outfit, { priorityKeys: ['sofaBody'], ImageClass: CustomImage, yieldFrame: fn => fn() });
  assert.equal(order[0], outfit.url);
  assert.equal(order[1], outfit.sofaBody.url, 'priority supplement must decode first');
  assert.equal(order.filter(u => u === outfit.url).length, 1, 'base atlas must never be decoded twice');
  assert.equal(order.length, 4);

  outfit.blobUrl = 'blob:test-base';
  outfit.walk.blobUrl = 'blob:test-walk';
  revokeWardrobeBlobUrls(outfit);
  assert.equal(outfit.blobUrl, undefined);
  assert.equal(outfit.walk.blobUrl, undefined);
});

test('book reader Escape stops propagation without double restoreFocus and room poll survives tab switches', async () => {
  const document = createDocument();
  const docListeners = {};
  document.addEventListener = (t, fn) => { (docListeners[t] ??= []).push(fn); };
  document.removeEventListener = (t, fn) => { docListeners[t] = (docListeners[t] || []).filter(x => x !== fn); };
  document.querySelector = () => null;
  const requests = [], responded = new Set(), listeners = [], timers = [];
  const roomState = { lamp: true, curtain: true, description: '原房间', items: [{ id: 'bed', name: '床', state: '整洁' }], interactions: [] };
  const nightState = { sleeping: false, stage: 'awake', energy: 80, mood: 60, unread: {}, timeline: [] };
  const data = {
    '/overview': { night: { sleeping: false, stage: 'awake', energy: 80, mood: 70 }, settings: { allowSleep: false }, counts: {}, connections: { bridge: { ok: true } }, room: roomState, events: [] },
    '/night/state': nightState,
    '/jobs': { items: [] }
  };
  let nightUpdates = [];
  const parent = { postMessage: r => requests.push(r) };
  vm.runInNewContext(await readFile(new URL('../panel.js', import.meta.url), 'utf8'), {
    createRoomSession,mountRoomReaderPanel,createRoomUiContext,mountRoomHud,mountRoomActionTray,mountRoomDressingPanel,mountRoomFurniturePanel,createRoomDressing, createDressingAssetClient, document, parent, Node: Element, crypto: webcrypto, structuredClone,
    DAFEIYU_CLIPS: {}, ROOM_ACTIONS: { house: { repairs: { 1: {}, 2: {} }, actions: { garden: { frames: [] } } } },
    WARDROBE_CATALOG: [{ id: 'sailor', name: '蓝白水手服' }],
    validateWardrobe: () => true,
    decodeBaseWardrobeAsset: async () => {},
    createRoomWorkspace, createRoomBookReader,
    createRoomRestoreGate: o => restoreGate({ ...o, schedule: () => 0, cancel: () => {} }),
    window: { addEventListener(t, fn) { if (t === 'message') listeners.push(fn); } },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    createBlockRoom() {
      const scene = document.createElement('svg');
      scene.roomActions = [];
      scene.setRoomOutfit = () => true;
      scene.setRoomEnvironment = () => {};
      scene.setRoomActivity = p => { if (p.night) nightUpdates.push(p.night.sleeping); };
      return scene;
    }
  });
  let rev = 1;
  const drain = async () => {
    for (let i = 0; i < 12; i++) {
      for (const r of requests.filter(r => r.type === 'request' && !responded.has(r.id))) {
        responded.add(r.id);
        const val = r.action === '/room' ? structuredClone(roomState) : structuredClone(data[r.action]);
        listeners.forEach(fn => fn({ source: parent, data: { channel: 'liuli-companion', type: 'response', id: r.id, payload: { data: val, revision: ++rev } } }));
      }
      await settle();
    }
  };
  await drain();
  const all = () => descendants(document.body);
  const commsBtn = all().find(e => e.tagName === 'BUTTON' && e.textContent === '通讯屏 · 近况与QQ');
  const p1 = commsBtn.fire('click'); await drain(); await p1;
  const closeBtn = all().find(e => e.tagName === 'BUTTON' && e.textContent === '回到小屋');
  const p2 = closeBtn.fire('click'); await drain(); await p2;
  const p3 = document.getElementById('refresh').fire('click'); await drain(); await p3;

  // Trigger the 5000ms room poll after renderVersion has incremented multiple times!
  nightState.sleeping = true;
  const pollTimer = timers.find(t => t.ms === 5000);
  assert.ok(pollTimer, '5s room poll timer must exist');
  const pPoll = pollTimer.fn();
  await drain();
  await pPoll;
  assert.equal(nightUpdates.at(-1), true, 'room poll must stay alive across furniture consoles and HUD refreshes');

  // Late __restore__ must NOT overwrite explicit user selection of original
  const restoreReq = requests.find(r => r.type === 'wardrobe-request' && !r.id);
  await all().find(e=>e.getAttribute('aria-label')==='装扮衣橱').fire('click');await settle();
  const origBtn = all().find(e => e.tagName === 'BUTTON' && e.dataset.outfitId === 'original');
  await origBtn.fire('click');
  for (const fn of listeners) {
    await fn({ source: parent, data: { channel: 'liuli-companion', type: 'wardrobe-assets', id: 'sailor', requestId: restoreReq.requestId, assets: { id: 'sailor' } } });
  }
  assert.equal(origBtn.getAttribute('aria-pressed'), 'true', 'late __restore__ must not overwrite explicit original selection');

  // Book reader Escape sets defaultPrevented and stops propagation, keeping room-immersive active
  const expandBtn = all().find(e => e.tagName === 'BUTTON' && e.textContent === '放大看');
  await expandBtn.fire('click');
  assert.equal(expandBtn.textContent, '收回小屋');
  let focusCalls = 0;
  const trigger = { focus() { focusCalls++; } };
  document.activeElement = trigger;
  const reader = createRoomBookReader({ document, request: async () => ({ books: [], marks: [] }) });
  await reader.open();
  const dialog = all().find(e => e.tagName === 'DIALOG' && e.className === 'room-book-reader');
  let propagated = true, prevented = false;
  dialog.fire('keydown', { key: 'Escape', preventDefault() { prevented = true; }, stopPropagation() { propagated = false; } });
  assert.equal(prevented, true);
  assert.equal(propagated, false);
  for (const fn of docListeners.keydown || []) fn({ key: 'Escape', defaultPrevented: true, preventDefault() {} });
  assert.equal(expandBtn.textContent, '收回小屋', 'Escape handled by book reader must not exit immersive mode');
  const focusAfterClose = focusCalls;
  reader.destroy();
  assert.equal(focusCalls, focusAfterClose, 'destroy after close must not re-focus trigger a second time');
});

test('room daylight survives cached-room detachment and unhides window picture when room-assets arrive', async () => {
  const document = createDocument();
  document.createElementNS = (_, tag) => document.createElement(tag);
  document.defaultView = { setTimeout: () => 1, clearTimeout: () => {} };
  const timers = new Map();
  let nextId = 1, clock = new Date(2026, 5, 1, 10, 0, 0).getTime();
  const owner = document.createElement('svg');
  document.body.append(owner);
  const defs = document.createElement('defs'), parent = document.createElement('g');
  owner.append(defs, parent);
  const daylight = createRoomDaylight({
    document, defs, parent, owner,
    source: '/plugins/dsh-whale-status/assets/floor-one.png',
    now: () => clock,
    schedule: fn => { const id = nextId++; timers.set(id, fn); return id; },
    cancel: id => timers.delete(id)
  });
  assert.equal(daylight.picture.getAttribute('display'), 'none', 'browser path starts hidden before base64 chunk');
  assert.equal(daylight.element.getAttribute('data-daylight-phase'), 'day');

  // Simulate switching away from room for >30s (owner detached)
  owner.remove();
  const [firstTimerId, firstTimerFn] = [...timers.entries()][0];
  timers.delete(firstTimerId);
  firstTimerFn();
  assert.equal(timers.size, 0, 'detached room must not keep rescheduling 30s timers');

  // Re-attach cached room at night and call resume()
  clock = new Date(2026, 5, 1, 23, 0, 0).getTime();
  document.body.append(owner);
  daylight.resume();
  assert.equal(daylight.element.getAttribute('data-daylight-phase'), 'night', 'resumed daylight must update to night instead of freezing');
  assert.equal(timers.size, 1, 'resumed daylight must restart 30s timer');
  daylight.destroy();
  assert.equal(timers.size, 0);

  // Also verify setRoomArtAssets unhides daylight.picture in createArtBlockRoom
  const assets = JSON.parse(await readFile(new URL('../assets/room-actions/manifest.json', import.meta.url), 'utf8'));
  const names = ['床','书桌','台灯','窗','沙发','冰箱','电视','绿萝','旧相册','日记本','记事本','床头柜','书架','椅子','电脑','茶几','挂画','挂钟','盆栽'];
  const roomDoc = createDocument();
  roomDoc.createElementNS = (_, tag) => roomDoc.createElement(tag);
  roomDoc.defaultView = { setTimeout: () => 1, clearTimeout: () => {} };
  const artSvg = createBlockRoom(
    { lamp: true, curtain: true, items: names.map((name, i) => ({ id: String(i), name, state: '' })) },
    {
      document: roomDoc,
      petAssets: { idle: { frameMs: 100, frames: ['data:image/png;base64,AA=='] } },
      actionAssets: assets,
      animation: { reducedMotion: true }
    }
  );
  const winGroup = descendants(artSvg).find(e => e.getAttribute?.('data-room-daylight') === 'local');
  const winPic = descendants(winGroup).find(e => e.tagName === 'IMAGE' || e.tagName === 'image');
  assert.equal(winPic.getAttribute('display'), 'none');
  artSvg.setRoomArtAssets({
    'floor-one': 'data:image/png;base64,AAAA',
    'floor-two': 'data:image/png;base64,BBBB',
    garden: 'data:image/png;base64,CCCC',
    mirror: 'data:image/png;base64,DDDD'
  });
  assert.equal(winPic.getAttribute('display'), 'inline', 'setRoomArtAssets must unhide window daylight picture');
  artSvg.disposeRoomAmbient?.();
});

test('procedural fallback room supports setRoomPaused resume and book storage recovers from onblocked', async () => {
  const document = createDocument();
  document.createElementNS = (_, tag) => document.createElement(tag);
  const frames = [];
  const svg = createBlockRoom(
    { lamp: true, curtain: true, items: [{ id: 'custom-1', name: '小海螺', state: '桌上' }] },
    {
      document,
      petAssets: { idle: { frameMs: 100, frames: ['data:image/png;base64,AA==', 'data:image/png;base64,BB=='] } },
      actionAssets: {},
      animation: { reducedMotion: false, requestFrame: fn => { frames.push(fn); return frames.length; } }
    }
  );
  document.body.append(svg);
  assert.equal(typeof svg.setRoomPaused, 'function');
  assert.equal(frames.length, 1);
  frames.shift()(100);
  assert.equal(frames.length, 1, 'connected procedural room schedules next frame');

  svg.setRoomPaused(true);
  frames.shift()(200);
  assert.equal(frames.length, 0, 'paused procedural room stops scheduling frames');

  svg.setRoomPaused(false);
  assert.equal(frames.length, 1, 'unpausing connected procedural room resumes animation loop');

  // IndexedDB onblocked recovery
  let attempts = 0;
  const storage = createRoomBookStorage({
    open() {
      attempts++;
      const req = {};
      queueMicrotask(() => {
        if (attempts === 1) req.onblocked?.();
        else {
          req.result = {
            onversionchange: null,
            close() {},
            transaction() {
              const tx = {
                objectStore() {
                  return { getAll() { const r = {}; queueMicrotask(() => { r.onsuccess?.({ target: { result: [] } }); tx.oncomplete?.(); }); return r; } };
                }
              };
              return tx;
            }
          };
          req.onsuccess?.();
        }
      });
      return req;
    }
  });
  await assert.rejects(() => storage('load'), /占用/);
  const loaded = await storage('load');
  assert.deepEqual(loaded, { books: [], marks: [] }, 'subsequent open must succeed after onblocked resets opening promise');
});

test('CompanionService deduplicates full-state reads per endpoint and uses lightweight revision()', async () => {
  const base = initialState(1000);
  base.revision = 7;
  base.memories.push({ id: 'm1', scope: 'private:1', subject: '1', level: 2, status: 'active', content: '喜欢海豚' });
  let reads = 0, revisions = 0;
  const store = {
    revision() { revisions++; return base.revision; },
    read() { reads++; return structuredClone(base); },
    async update(_, fn) { await fn(base); base.revision++; return structuredClone(base); }
  };
  const service = new CompanionService({ store });
  const levels = await service.dispatch('/memory/levels', {});
  assert.equal(levels.revision, 7);
  assert.equal(levels.data.levels[2].count, 1);
  assert.equal(reads, 1, '/memory/levels must clone state only once instead of 14 times');
  assert.equal(revisions, 1, 'dispatch read path must use store.revision()');

  reads = 0;
  const m3 = await service.dispatch('/memory/m3/overview', {});
  assert.equal(m3.data.counts.active, 1);
  assert.equal(reads, 1, '/memory/m3/overview must clone state only once instead of 8 times');
});
