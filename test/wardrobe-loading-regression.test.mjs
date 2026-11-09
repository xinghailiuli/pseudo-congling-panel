import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createRoomWardrobeController } from '../src/room-wardrobe-controller.mjs';
import { validateWardrobe, decodeBaseWardrobeAsset, decodeWardrobeSupplements, revokeWardrobeBlobUrls } from '../src/room-wardrobe.mjs';

const geometry = {
  width: 400, height: 400, referenceHeight: 300,
  frames: Array.from({ length: 16 }, () => ({ crop: [0, 0, 90, 90], anchor: [45, 85], hip: [45, 70], head: [45, 20], outline: [[0, 0], [1, 0], [1, 1]] })),
};
const asset = (id = 'navy-gala', supplements = false) => ({
  version: 1, id, url: 'data:image/png;base64,BASE', geometry,
  ...(supplements ? {
    desk: { url: 'data:image/png;base64,DESK', geometry: { ...geometry, frames: geometry.frames.slice(0, 4) } },
    walk: { url: 'data:image/png;base64,WALK', geometry: { ...geometry, frames: geometry.frames.slice(0, 8) } },
    sofaBody: { url: 'data:image/png;base64,SOFA', geometry },
  } : {}),
});
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function images(t, waitFor = () => undefined) {
  const original = globalThis.Image, decoded = [];
  globalThis.Image = class {
    async decode() { decoded.push(this.src); await waitFor(this.src); this.naturalWidth = 400; this.naturalHeight = 400; }
  };
  t.after(() => { globalThis.Image = original; });
  return decoded;
}
function controller(mode = 'type') {
  const posted = [], equipped = [], timers = new Map();
  let listener, serial = 0, timerId = 0;
  const parent = { postMessage: message => posted.push(message) };
  const scene = { getAttribute: () => mode, setRoomOutfit(value) { equipped.push(value?.id || 'original'); return true; } };
  const ctrl = createRoomWardrobeController({
    parent, window: { addEventListener(type, fn) { if (type === 'message') listener = fn; } },
    uid: () => `request-${++serial}`,
    setTimeout(fn, ms) { timers.set(++timerId, { fn, ms }); return timerId; },
    clearTimeout(id) { timers.delete(id); }, getActiveRoomScene: () => scene,
  });
  const requests = () => posted.filter(message => message.type === 'wardrobe-request');
  const deliver = (request, value) => listener({ source: parent, data: { channel: 'liuli-companion', type: 'wardrobe-assets', id: value.id, requestId: request.requestId, assets: value } });
  return { ctrl, posted, equipped, timers, requests, deliver, setMode(value) { mode = value; } };
}

test('concurrent native base decodes share one pending image and completed decode', async t => {
  const gate = deferred(), decoded = images(t, () => gate.promise), value = asset();
  const first = decodeBaseWardrobeAsset(value), second = decodeBaseWardrobeAsset(value);
  try { assert.equal(decoded.length, 1, 'one image decode while callers share pending atlas'); }
  finally { gate.resolve(); await Promise.all([first, second]); }
  await decodeBaseWardrobeAsset(value);
  assert.equal(decoded.length, 1);
});

test('priority-only wardrobe preparation does not wait for unrelated action atlases', async t => {
  const decoded = images(t), value = asset('navy-gala', true);
  await decodeWardrobeSupplements(value, { priorityKeys: ['desk'], priorityOnly: true });
  assert.deepEqual(decoded, [value.desk.url]);
});

test('cold selection prepares the base and current contact together while keeping the old outfit visible',async t=>{
 const base=deferred(),desk=deferred(),decoded=images(t,src=>src.endsWith('BASE')?base.promise:src.endsWith('DESK')?desk.promise:undefined),h=controller('type'),value=asset('navy-gala',true);t.after(()=>h.ctrl.dispose());
 h.ctrl.requestOutfit(value.id);const pending=h.deliver(h.requests()[0],value);
 try{await nextTurn();assert.ok(decoded.includes(value.url));assert.ok(decoded.includes(value.desk.url),'current contact decode should not wait behind the base');assert.deepEqual(h.equipped,[]);desk.resolve();await nextTurn();assert.deepEqual(h.equipped,[],'base is still required by fitting and future poses');}finally{base.resolve();desk.resolve();await pending;}
 assert.equal(h.ctrl.getState().outfitId,value.id);
});

test('hover prefetch promoted by click sends one wardrobe payload request', async t => {
  images(t);
  const h = controller();
  h.ctrl.prefetchOutfit('navy-gala');
  h.ctrl.requestOutfit('navy-gala');
  assert.equal(h.requests().length, 1, 'click joins existing fetch instead of cloning payload again');
  await h.deliver(h.requests()[0], asset());
  assert.equal(h.ctrl.getState().outfitId, 'navy-gala');
});

test('repeated click during decode joins the existing wardrobe request', async t => {
  const gate = deferred(); images(t, () => gate.promise);
  const h = controller(); h.ctrl.requestOutfit('navy-gala');
  const loading = h.deliver(h.requests()[0], asset());
  h.ctrl.requestOutfit('navy-gala');
  try { assert.equal(h.requests().length, 1); }
  finally { gate.resolve(); await loading; }
  assert.equal(h.ctrl.getState().outfitId, 'navy-gala');
});

test('original selection made during decoding cannot be replaced by its late result', async t => {
  const gate = deferred(); images(t, () => gate.promise);
  const h = controller(); h.ctrl.requestOutfit('navy-gala');
  const loading = h.deliver(h.requests()[0], asset());
  h.ctrl.requestOutfit('original'); gate.resolve(); await loading;
  assert.equal(h.ctrl.getState().outfitId, 'original');
  assert.deepEqual(h.equipped, ['original']);
  assert.equal(h.ctrl.outfitAssetCache.has('navy-gala'), true, 'late valid art is still reusable');
});

test('superseded selection starts no additional contact decoding after its pending preparation finishes',async t=>{
 const gate=deferred(),decoded=images(t,src=>src.endsWith('BASE')?gate.promise:undefined),h=controller('type'),value=asset('navy-gala',true);
 t.after(()=>h.ctrl.dispose());h.ctrl.requestOutfit(value.id);const pending=h.deliver(h.requests()[0],value);
 const started=decoded.slice();h.ctrl.requestOutfit('red-server');gate.resolve();await pending;
 assert.deepEqual(decoded,started,'stale request must not begin more contact or unrelated motion sheets');
 assert.equal(h.ctrl.getState().targetOutfitId,'red-server');
});

test('unselected hover prefetch does not warm every unrelated motion atlas',async t=>{
 const decoded=images(t),h=controller('type'),value=asset('navy-gala',true);t.after(()=>h.ctrl.dispose());
 h.ctrl.prefetchOutfit(value.id);await h.deliver(h.requests()[0],value);await new Promise(resolve=>setTimeout(resolve,50));
 assert.ok(decoded.includes(value.url));assert.ok(decoded.includes(value.desk.url));assert.ok(!decoded.includes(value.sofaBody.url));assert.ok(!decoded.includes(value.walk.url));
});

test('already superseded replies retain metadata without decoding, and decode on later selection',async t=>{
 const decoded=images(t),h=controller('type'),value=asset('navy-gala',true);t.after(()=>h.ctrl.dispose());
 h.ctrl.requestOutfit(value.id);const first=h.requests()[0];h.ctrl.requestOutfit('red-server');await h.deliver(first,value);
 assert.deepEqual(decoded,[]);assert.equal(h.ctrl.outfitAssetCache.has(value.id),true);
 h.ctrl.requestOutfit(value.id);for(let i=0;i<8&&h.ctrl.getState().outfitId!==value.id;i++)await nextTurn();
 assert.equal(h.ctrl.getState().outfitId,value.id);assert.ok(decoded.includes(value.url));assert.equal(h.requests().length,2,'reuses cached metadata');
});

test('disposing during a newly required contact decode cannot repopulate the outfit cache',async t=>{
  const desk=deferred(),sofa=deferred();
  const decoded=images(t,src=>src.endsWith('DESK')?desk.promise:src.endsWith('SOFA')?sofa.promise:undefined);
  const h=controller('type'),value=asset('navy-gala',true);h.ctrl.requestOutfit(value.id);
  const loading=h.deliver(h.requests()[0],value);
  try{
    for(let n=0;n<8&&!decoded.includes(value.desk.url);n++)await nextTurn();
    assert.ok(decoded.includes(value.desk.url));h.setMode('lounge');desk.resolve();
    for(let n=0;n<8&&!decoded.includes(value.sofaBody.url);n++)await nextTurn();
    assert.ok(decoded.includes(value.sofaBody.url));h.ctrl.dispose();sofa.resolve();await loading;
    assert.equal(h.ctrl.outfitAssetCache.size,0);assert.deepEqual(h.equipped,[]);
  }finally{desk.resolve();sofa.resolve();await loading;}
});

test('desk outfit becomes visible while unrelated walk decoding remains pending', async t => {
  const gate = deferred(); images(t, src => src.endsWith('WALK') ? gate.promise : undefined);
  const h = controller(), value = asset('navy-gala', true); h.ctrl.requestOutfit(value.id);
  const loading = h.deliver(h.requests()[0], value);
  try {
    for (let i = 0; i < 8; i++) await nextTurn();
    assert.equal(h.ctrl.getState().outfitId, 'navy-gala', 'only the current desk atlases block outfit reveal');
    assert.equal(h.ctrl.getState().outfitLoading, false);
  } finally { gate.resolve(); await loading; }
});

test('failed current-action decode retains the last visible outfit', async t => {
  images(t, src => { if (src.endsWith('DESK')) throw Error('invalid current-action image'); });
  const h = controller(), value = asset('navy-gala', true); h.ctrl.requestOutfit(value.id);
  await h.deliver(h.requests()[0], value);
  assert.equal(h.ctrl.getState().outfitId, 'original');
  assert.deepEqual(h.equipped, []);
  assert.equal(h.ctrl.getState().outfitLoading, false);
});

test('duplicate delivery does not reset the equipped scene', async t => {
  images(t); const h = controller(), value = asset(); h.ctrl.requestOutfit(value.id);
  const request = h.requests()[0];
  await h.deliver(request, value); await h.deliver(request, value);
  assert.deepEqual(h.equipped, ['navy-gala']);
});

test('clicking the already equipped outfit does not reset the scene again', async t => {
  images(t); const h = controller(), value = asset(); h.ctrl.requestOutfit(value.id);
  await h.deliver(h.requests()[0], value);
  h.ctrl.requestOutfit(value.id);
  assert.deepEqual(h.equipped, ['navy-gala']);
});

test('activity change during wardrobe decode waits for the new visible pose atlas', async t => {
  const desk = deferred(), sofa = deferred();
  images(t, src => src.endsWith('DESK') ? desk.promise : src.endsWith('SOFA') ? sofa.promise : undefined);
  const h = controller(), value = asset('navy-gala', true); h.ctrl.requestOutfit(value.id);
  const loading = h.deliver(h.requests()[0], value);
  await nextTurn(); h.setMode('lounge'); desk.resolve();
  try {
    for (let i = 0; i < 4; i++) await nextTurn();
    assert.equal(h.ctrl.getState().outfitId, 'original', 'retain old art until newly selected activity can draw');
  } finally { sofa.resolve(); await loading; }
  assert.equal(h.ctrl.getState().outfitId, value.id);
});

test('timed-out decode cannot equip late and explicit retry can reuse its valid artwork', async t => {
  const gate = deferred(); images(t, () => gate.promise);
  const h = controller(); h.ctrl.requestOutfit('navy-gala');
  const loading = h.deliver(h.requests()[0], asset());
  [...h.timers.values()].find(timer => timer.ms === 60000).fn();
  gate.resolve(); await loading;
  assert.equal(h.ctrl.getState().outfitId, 'original');
  h.ctrl.requestOutfit('navy-gala');
  assert.equal(h.ctrl.getState().outfitLoading, false, 'valid late artwork may satisfy a deliberate retry from cache');
  assert.equal(h.ctrl.getState().outfitId, 'navy-gala');
});

test('cached URL validation still rejects mutated source URLs and geometry', () => {
  const value = structuredClone(asset('navy-gala', true));
  assert.equal(validateWardrobe(value), true);
  value.desk.url = 'https://untrusted/image.png';
  assert.equal(validateWardrobe(value), false);
  value.desk.url = 'data:image/png;base64,DESK';
  assert.equal(validateWardrobe(value), true);
  value.desk.geometry.frames[0].crop = [399, 0, 90, 90];
  assert.equal(validateWardrobe(value), false);
});

test('completed prefetch may load again after eviction and active outfit remains cached', async t => {
  images(t); const h = controller();
  h.ctrl.prefetchOutfit('navy-gala');
  await h.deliver(h.requests()[0], asset());
  h.ctrl.requestOutfit('red-server');
  await h.deliver(h.requests().at(-1), asset('red-server'));
  for (const id of ['voxel-whale', 'whale-hood', 'snow-earmuffs', 'cream-hoodie', 'white-beret']) {
    h.ctrl.prefetchOutfit(id);
    await h.deliver(h.requests().at(-1), asset(id));
  }
  assert.equal(h.ctrl.outfitAssetCache.size, 6);
  assert.equal(h.ctrl.outfitAssetCache.has('red-server'), true);
  assert.equal(h.ctrl.outfitAssetCache.has('navy-gala'), false);
  const count = h.requests().length;
  h.ctrl.prefetchOutfit('navy-gala');
  assert.equal(h.requests().length, count + 1, 'eviction also permits future hover prefetch');
});

test('failed native image decoding clears its pending entry for a later retry', async t => {
  let fails = true;
  const decoded = images(t, () => { if (fails) throw Error('decode failed'); }), value = asset();
  await assert.rejects(decodeBaseWardrobeAsset(value), /decode failed/);
  fails = false; await decodeBaseWardrobeAsset(value);
  assert.equal(decoded.length, 2);
  assert.equal(value._decoded, true);
});

test('revocation during decoding cannot repopulate disposed decoded-image references', async t => {
  const gate = deferred(); images(t, () => gate.promise); const value = asset();
  const loading = decodeBaseWardrobeAsset(value);
  revokeWardrobeBlobUrls(value); gate.resolve(); await loading;
  assert.equal(value._decodedImage, undefined);
  assert.equal(value._decoded, undefined);
});
