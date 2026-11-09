import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  ROOM_AREAS,
  ROOM_REQUIRED_FURNITURE_NAMES,
  ROOM_UPPER_FLOOR_ITEMS,
  ROOM_UPSTAIRS_ACTIONS,
  ROOM_FEATURE_TARGETS,
  ROOM_UPSTAIRS_HOTSPOT_DEFS,
  ROOM_CAMERA_CENTERS,
  ROOM_AREA_OCCLUDERS,
  ROOM_WORKSPACE_GROUPS,
  normalizeRoomFurnitureId,
  normalizeRoomActionId,
  getRoomFeatureTargets,
  roomSleepVariation,
  ROOM_ACTION_CATALOG,
  ROOM_INTERNAL_SEQUENCES,
  getRoomActionGroups,
  getRoomQuickCompanionActions,
  getRoomPreviewActions,
  checkRoomActionAvailability,
} from '../src/areas/area-registry.mjs';
import { createRoomHouse } from '../src/room-house.mjs';
import { createRoomLifeDefinitions } from '../src/room-life-sequences.mjs';
import {
  ROOM_FLOOR_OFFSETS,
  installRoomCosmicDefs,
  createRoomCosmicBackdrop,
  createRoomFloorLayers,
  createRoomEnvironmentControls,
} from '../src/room-environment.mjs';
import {
  computeRoomTargetViewBox,
  stepRoomCamera,
  shiftCameraAcrossPortal,
  renderRoomStairPortal,
  syncRoomFloorVisibility,
} from '../src/room-viewport.mjs';
import { createRoomWardrobeController } from '../src/room-wardrobe-controller.mjs';
import {
  OBSERVER_FLOOR_KEY,
  VIEW_MODE_STORAGE_KEY,
  ROOM_PANEL_FURNITURE_GROUPS,
  ROOM_PANEL_PAGE_TARGETS,
  createRoomObserverController,
  createRoomRuntimePersistence,
  positionFloatingMenu,
  createRoomActionDispatcher,
} from '../src/room-panel-controller.mjs';
import { createDocument } from './helpers/workspace-dom.mjs';

test('area registry registers all 6 functional areas plus holographic mirror adapter with exact coordinate and furniture contracts', () => {
  assert.equal(ROOM_AREAS.length, 7);
  assert.deepEqual(ROOM_AREAS.map(a => a.id), [
    'storage-workbench',
    'computer-workspace',
    'living-lounge',
    'bedroom-sleep',
    'library-reading',
    'greenhouse-terrace',
    'mirror-wardrobe',
  ]);

  const byId = Object.fromEntries(ROOM_AREAS.map(a => [a.id, a]));
  assert.equal(byId['storage-workbench'].floor, 1);
  assert.equal(byId['computer-workspace'].floor, 1);
  assert.equal(byId['living-lounge'].floor, 1);
  assert.equal(byId['bedroom-sleep'].floor, 2);
  assert.equal(byId['library-reading'].floor, 2);
  assert.equal(byId['greenhouse-terrace'].floor, 2);
  assert.equal(byId['mirror-wardrobe'].floor, 2);

  // Verify feature targets across all areas
  assert.deepEqual(ROOM_FEATURE_TARGETS.map(f => f.id).sort(), [
    'bed', 'comms', 'computer', 'mirror', 'workbench',
  ]);
  assert.deepEqual(getRoomFeatureTargets({ upstairs: false }).map(f => f.id).sort(), [
    'bed', 'comms', 'computer', 'enchant', 'mirror', 'workbench',
  ]);
  assert.equal(ROOM_UPSTAIRS_HOTSPOT_DEFS.read.actionLabel, '书架翻书');

  // Verify upstairs hotspots
  assert.deepEqual(Object.keys(ROOM_UPSTAIRS_HOTSPOT_DEFS).sort(), [
    'enchant', 'garden', 'read', 'rest',
  ]);
  assert.equal(ROOM_UPSTAIRS_ACTIONS.length, 4);

  // Verify occluders
  assert.equal(ROOM_AREA_OCCLUDERS.length, 8);
  const occByName = Object.fromEntries(ROOM_AREA_OCCLUDERS.map(o => [o.name, o]));
  assert.equal(occByName.chair.polygons.length, 3, 'computer chair has 3 occlusion polygons');
  assert.ok(occByName.sofa.polygons.length > 0);
  assert.ok(occByName['lower-rail'].polygons.length > 0);
  assert.ok(occByName['entry-lantern'].polygons.length > 0);
  assert.ok(occByName['greenhouse-rail'].polygons.length > 0);
  assert.ok(occByName['upper-gate-post'].polygons.length > 0);
  assert.ok(occByName['life-garden'].polygons.length > 0);
  assert.ok(occByName['wardrobe-quilt'].polygons.length > 0);

  // Verify workspace groups & furniture id normalization
  assert.deepEqual(Object.keys(ROOM_WORKSPACE_GROUPS).sort(), ['bed', 'comms', 'computer', 'enchant', 'workbench']);
  assert.equal(normalizeRoomFurnitureId('enchanting'), 'enchant');
  assert.equal(normalizeRoomFurnitureId('enchant'), 'enchant');
  assert.equal(normalizeRoomFurnitureId('workbench'), 'workbench');
  assert.equal(ROOM_REQUIRED_FURNITURE_NAMES.length, 19);
  assert.equal(ROOM_UPPER_FLOOR_ITEMS.has('床'), true);
  assert.ok(ROOM_CAMERA_CENTERS.type);
});

test('all 19 named furniture items and floor scenery render through area-registry modules via createRoomHouse', () => {
  const doc = createDocument();
  doc.createElementNS = (_, tag) => doc.createElement(tag);
  const items = ROOM_REQUIRED_FURNITURE_NAMES.map((name, i) => ({ id: `id-${i}`, name, state: '正常' }));
  const house = createRoomHouse({ lamp: true, curtain: true, items }, doc);
  assert.ok(house.svg);
  assert.ok(house.floors[1]);
  assert.ok(house.floors[2]);
  assert.equal(house.drawings.length, 19, 'All 19 required furniture items rendered by area modules');
});

test('createRoomLifeDefinitions installs all 6 areas sequences and transitions via area-registry', async () => {
  const geometry = JSON.parse(await readFile(new URL('../assets/room-life-v11/geometry.json', import.meta.url), 'utf8'));
  Object.assign(geometry, JSON.parse(await readFile(new URL('../assets/room-life-v16/geometry.json', import.meta.url), 'utf8')));
  const defs = createRoomLifeDefinitions(geometry);
  for (const key of ['lounge', 'type', 'write', 'sleep', 'read', 'enchant', 'garden', 'rest']) {
    assert.ok(defs[key], `Life sequence definition ${key} must be installed by area modules`);
    assert.ok(Object.keys(defs[key].poses).length > 0, `Life sequence ${key} must have calibrated poses`);
  }
  assert.equal(roomSleepVariation(12000), null);
  const sleepVar = roomSleepVariation(61000, 1);
  assert.ok(sleepVar === null || typeof sleepVar.kind === 'string');
});

test('room-environment and room-viewport controllers manage SVG environment and viewBox smoothing cleanly', () => {
  const doc = createDocument();
  doc.createElementNS = (_, tag) => doc.createElement(tag);
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const defs = doc.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const el = (tag, attrs = {}, text = '') => {
    const node = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) node.setAttribute(k, String(v));
    if (text) node.textContent = text;
    return node;
  };
  svg.append(defs);

  assert.deepEqual(ROOM_FLOOR_OFFSETS, { 1: 1080, 2: 0 });
  installRoomCosmicDefs(el, defs);
  assert.equal(defs.children.length, 5, 'Cosmic sky gradients and glow filters installed');

  const backdrop = createRoomCosmicBackdrop(el, 'test-');
  assert.equal(backdrop.children.length, 2, '2F and 1F cosmic backdrops created');

  const env = createRoomFloorLayers({
    doc,
    svg,
    defs,
    el,
    clip: id => `url(#${id})`,
    image: (href, extra = {}) => el('image', { href, ...extra }),
    instance: 'test-',
    house: {
      width: 1536,
      height: 1024,
      floors: { 1: 'data:image/png;base64,AA==', 2: 'data:image/png;base64,BB==' },
      repairs: {},
    },
    offsets: ROOM_FLOOR_OFFSETS,
    animation: { wallClock: () => 1000, scheduleWallClock: () => 1, cancelWallClock: () => {} },
  });
  assert.ok(env.floors[1]);
  assert.ok(env.floors[2]);
  const portalInfo = env.createPortal();
  assert.equal(portalInfo.portal.getAttribute('data-stair-handoff'), 'true');

  const controls = createRoomEnvironmentControls({
    svg,
    room: { lamp: true, curtain: true },
    el,
    onLamp: () => {},
    onCurtain: () => {},
  });
  controls.setRoomEnvironment({ lamp: false, curtain: false });
  const lampOverlay = controls.controls.children.find(c => c.getAttribute?.('data-lamp-overlay'));
  const curtainOverlay = controls.controls.children.find(c => c.getAttribute?.('data-curtain-overlay'));
  assert.equal(lampOverlay.getAttribute('display'), 'inline');
  assert.equal(curtainOverlay.getAttribute('display'), 'inline');

  assert.deepEqual(computeRoomTargetViewBox({ floor: '1', detail: false, offsets: ROOM_FLOOR_OFFSETS, travelling: false, route: {}, currentMode: 'walk', residentLevel: '1' }), [0, 1080, 1536, 1024]);
  assert.deepEqual(computeRoomTargetViewBox({ floor: '2', detail: false, offsets: ROOM_FLOOR_OFFSETS, travelling: false, route: {}, currentMode: 'walk', residentLevel: '2' }), [0, 0, 1536, 1024]);
  assert.deepEqual(computeRoomTargetViewBox({ floor: 'all', detail: false, offsets: ROOM_FLOOR_OFFSETS, travelling: false, route: {}, currentMode: 'walk', residentLevel: '1' }), [0, 0, 1536, 2104]);
  const detailBox = computeRoomTargetViewBox({ floor: '1', detail: true, offsets: ROOM_FLOOR_OFFSETS, travelling: false, route: {}, currentMode: 'type', residentLevel: '1' });
  assert.equal(detailBox[2], 650);
  assert.equal(detailBox[3], 433);
  const smoothed = stepRoomCamera([0, 1080, 1536, 1024], [0, 0, 1536, 1024], 90, false);
  assert.ok(smoothed[1] > 0 && smoothed[1] < 1080, 'Camera smoothly interpolates across floors');
});

test('room-wardrobe-controller protects async outfit selection against stale out-of-order responses and preserves active outfit in LRU cache', async () => {
  const prevImage = globalThis.Image;
  globalThis.Image = class {
    async decode() {
      this.naturalWidth = 400;
      this.naturalHeight = 400;
    }
  };
  try {
    const realIds = ['navy-gala', 'red-server', 'voxel-whale', 'whale-hood', 'snow-earmuffs', 'cream-hoodie', 'white-beret', 'whale-maid'];
  const catalog = realIds.map((id, i) => ({ id, name: `服装${i + 1}` }));
  const posted = [];
  let messageHandler = null;
  let mainEquipped = null;
  let fittingEquipped = null;
  const mainScene = {
    getAttribute: () => 'type',
    setRoomOutfit(asset) { mainEquipped = asset; return true; },
  };
  const fittingScene = {
    setRoomOutfit(asset) { fittingEquipped = asset; return true; },
  };
  let reqSeq = 0;
  const geometry = {
    width: 400,
    height: 400,
    referenceHeight: 300,
    frames: Array.from({ length: 16 }, () => ({
      crop: [0, 0, 90, 90],
      anchor: [45, 85],
      hip: [45, 70],
      head: [45, 20],
      outline: [[0, 0], [1, 0], [1, 1]],
    })),
  };

  const parentObj = { postMessage(msg) { posted.push(msg); } };
  const ctrl = createRoomWardrobeController({
    catalog,
    parent: parentObj,
    window: { addEventListener(type, fn) { if (type === 'message') messageHandler = fn; } },
    setTimeout: () => 1,
    clearTimeout: () => {},
    uid: () => `req-${++reqSeq}`,
    getActiveRoomScene: () => mainScene,
    getFittingScene: () => fittingScene,
  });

  // Rapidly switch A (navy-gala) -> B (red-server) -> C (voxel-whale)
  ctrl.requestOutfit('navy-gala');
  const req1 = posted.at(-1).requestId;
  ctrl.requestOutfit('red-server');
  const req2 = posted.at(-1).requestId;
  ctrl.requestOutfit('voxel-whale');
  const req3 = posted.at(-1).requestId;

  const makeAsset = id => ({ version: 1, id, url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', geometry });

  // C resolves first
  await messageHandler({
    source: parentObj,
    data: { channel: 'liuli-companion', type: 'wardrobe-assets', id: 'voxel-whale', requestId: req3, assets: makeAsset('voxel-whale') },
  });
  assert.equal(ctrl.getState().outfitId, 'voxel-whale');
  assert.equal(mainEquipped?.id, 'voxel-whale');
  assert.equal(fittingEquipped?.id, 'voxel-whale');

  // Stale A and B resolve AFTER C — must be cached but MUST NOT overwrite active voxel-whale!
  await messageHandler({
    source: parentObj,
    data: { channel: 'liuli-companion', type: 'wardrobe-assets', id: 'navy-gala', requestId: req1, assets: makeAsset('navy-gala') },
  });
  await messageHandler({
    source: parentObj,
    data: { channel: 'liuli-companion', type: 'wardrobe-assets', id: 'red-server', requestId: req2, assets: makeAsset('red-server') },
  });
  assert.equal(ctrl.getState().outfitId, 'voxel-whale', 'Stale outfit responses must never overwrite newer selection');
  assert.equal(mainEquipped?.id, 'voxel-whale');
  assert.equal(ctrl.outfitAssetCache.has('navy-gala'), true, 'Stale valid outfit is still stored in LRU cache');

  // Fill LRU cache beyond MAX_OUTFIT_CACHE (6) while voxel-whale is equipped
  for (let i = 3; i < realIds.length; i++) {
    const id = realIds[i];
    await messageHandler({
      source: parentObj,
      data: { channel: 'liuli-companion', type: 'wardrobe-assets', id, requestId: `pre-${i}`, assets: makeAsset(id) },
    });
  }
    assert.equal(ctrl.outfitAssetCache.size, 6, 'LRU cache size capped at 6');
    assert.equal(ctrl.outfitAssetCache.has('voxel-whale'), true, 'Currently equipped outfit must never be evicted from LRU cache');
  } finally {
    globalThis.Image = prevImage;
  }
});

test('room-panel-controller separates observer floor from resident floor and persists runtime snapshots cleanly', () => {
  const store = new Map([
    [OBSERVER_FLOOR_KEY, '2'],
    [VIEW_MODE_STORAGE_KEY, 'room'],
  ]);
  const storage = {
    getItem: k => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
  };
  let appliedFloor = null;
  const scene = {
    setRoomFloor(f) { appliedFloor = f; },
  };
  const posted = [];
  const parentObj = { postMessage(msg) { posted.push(msg); } };
  const observer = createRoomObserverController({
    parent: parentObj,
    storage,
  });

  assert.equal(observer.roomView.floor, '2', 'Restores saved observer floor on initialization');
  observer.setObserverFloor('all', scene);
  assert.equal(appliedFloor, 'all');
  assert.equal(store.get(OBSERVER_FLOOR_KEY), 'all');
  assert.equal(ROOM_PANEL_FURNITURE_GROUPS.enchant.pages[0], 'diary');
  assert.deepEqual(ROOM_PANEL_PAGE_TARGETS.diary, ['enchant', 'read']);

  const runtime = createRoomRuntimePersistence({
    parent: parentObj,
    window: { addEventListener() {} },
    setTimeout: () => 1,
    getActiveRoomScene: () => ({
      getRoomRuntime: () => ({ revision: 1, preview: 'auto', state: { floor: '1', residentLevel: '1', currentMode: 'type', travelling: false } }),
    }),
  });

  assert.ok(posted.some(m => m.type === 'room-runtime-request'));
  runtime.saveRoomRuntime(true);
  const saveMsg = posted.find(m => m.type === 'room-runtime-save');
  assert.ok(saveMsg);
  assert.equal(saveMsg.value.state.residentLevel, '1', 'Resident floor is 1');
  assert.equal(observer.roomView.floor, 'all', 'Observer floor is all (independent from resident floor)');
});

test('ROOM_ACTION_CATALOG registers all 11 full life actions with clear availability reasons and separates internal sequences', () => {
  assert.equal(ROOM_ACTION_CATALOG.length, 11);
  const ids = ROOM_ACTION_CATALOG.map(a => a.id);
  assert.deepEqual(ids, ['auto', 'pat', 'lounge', 'sleep', 'write', 'type', 'walk', 'read', 'enchant', 'garden', 'rest']);

  const quick = getRoomQuickCompanionActions();
  assert.equal(quick.length, 4);
  assert.deepEqual(quick.map(a => a.id), ['auto', 'pat', 'lounge', 'sleep']);

  const previews = getRoomPreviewActions();
  assert.ok(previews.length >= 8);
  assert.ok(previews.every(p => p.length === 2));

  const groups = getRoomActionGroups();
  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map(g => g.id), ['special', 'floor1', 'floor2']);

  // Missing furniture check
  const emptyRoom = { items: [] };
  const checkSleepEmpty = checkRoomActionAvailability('sleep', { room: emptyRoom, hasScene: true });
  assert.equal(checkSleepEmpty.available, false);
  assert.ok(checkSleepEmpty.reason.includes('暂时没有「床」'));

  const fullRoom = { items: [{ name: '床' }, { name: '沙发' }, { name: '书架' }, { name: '书桌' }, { name: '椅子' }, { name: '电脑' }, { name: '日记本' }, { name: '盆栽' }] };
  const checkSleepFull = checkRoomActionAvailability('sleep', { room: fullRoom, hasScene: true });
  assert.equal(checkSleepFull.available, true);

  // Upstairs action permission check
  const checkReadNoPerm = checkRoomActionAvailability('read', { room: fullRoom, availableActions: ['enchant'], hasScene: true });
  assert.equal(checkReadNoPerm.available, false);
  assert.ok(checkReadNoPerm.reason.includes('二楼动作素材未就绪或暂不可用'));

  const checkReadWithPerm = checkRoomActionAvailability('read', { room: fullRoom, availableActions: ['read', 'enchant'], hasScene: true });
  assert.equal(checkReadWithPerm.available, true);

  // Internal sequences definition
  assert.equal(ROOM_INTERNAL_SEQUENCES.length, 10);
  assert.ok(ROOM_INTERNAL_SEQUENCES.some(s => s.id === 'sofa-rest'));
  assert.ok(ROOM_INTERNAL_SEQUENCES.some(s => s.id === 'walkUp'));
  assert.ok(ROOM_INTERNAL_SEQUENCES.some(s => s.id === 'bed-entry'));
});

test('positionFloatingMenu calculates viewport-anchored coordinates without camera drift and clamps to screen bounds', () => {
  const container = {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 1920, bottom: 1080, width: 1920, height: 1080 }),
  };
  const leftAnchor = {
    getBoundingClientRect: () => ({ left: 18, top: 200, right: 66, bottom: 248, width: 48, height: 48 }),
  };
  const menuEl = {
    style: {},
    getBoundingClientRect: () => ({ width: 260, height: 320 }),
  };

  const posRight = positionFloatingMenu(menuEl, leftAnchor, container, { placement: 'right', gap: 12 });
  assert.equal(posRight.placement, 'right');
  assert.equal(posRight.left, 78);
  assert.equal(menuEl.style.left, '78px');
  assert.ok(posRight.top >= 12);
  assert.equal(menuEl.style.transform, 'none');

  const bottomAnchor = {
    getBoundingClientRect: () => ({ left: 930, top: 1010, right: 978, bottom: 1058, width: 48, height: 48 }),
  };
  const popoverEl = {
    style: {},
    getBoundingClientRect: () => ({ width: 340, height: 280 }),
  };

  const posTop = positionFloatingMenu(popoverEl, bottomAnchor, container, { placement: 'top', gap: 12 });
  assert.equal(posTop.placement, 'top');
  assert.equal(posTop.bottom, 82);
  assert.equal(popoverEl.style.bottom, '82px');
  assert.ok(posTop.left > 0);

  // Flip down when anchor is near the top
  const topAnchor = {
    getBoundingClientRect: () => ({ left: 930, top: 20, right: 978, bottom: 68, width: 48, height: 48 }),
  };
  const posFlip = positionFloatingMenu(popoverEl, topAnchor, container, { placement: 'top', gap: 12 });
  assert.equal(posFlip.placement, 'bottom');
  assert.equal(posFlip.top, 80);
  assert.equal(popoverEl.style.top, '80px');
});

test('createRoomActionDispatcher validates actions and transitions across stages (rejected -> moving -> executing)', () => {
  let feedback = '';
  let feedbackErr = false;
  const show = (msg, isErr = false) => { feedback = msg; feedbackErr = isErr; };
  const storageMap = new Map();
  const storage = {
    getItem: k => storageMap.get(k) ?? null,
    setItem: (k, v) => storageMap.set(k, String(v)),
  };

  let residentTraveling = true;
  let activeMode = 'idle';
  const scene = {
    petRoomResident() {},
    setRoomActivity(patch) {
      if (patch.preview) activeMode = patch.preview;
    },
    getRoomRuntime() {
      return {
        state: {
          travelling: residentTraveling,
          currentMode: activeMode,
        },
      };
    },
    getAttribute(attr) {
      if (attr === 'data-resident-travel') return residentTraveling ? 'true' : 'false';
      return null;
    },
  };

  const dispatcher = createRoomActionDispatcher({
    getActiveRoomScene: () => scene,
    getCurrentRoomData: () => ({ items: [{ name: '沙发' }, { name: '床' }] }),
    getAvailableActions: () => ['lounge', 'sleep'],
    show,
    storage,
  });

  // 1. Pat execution
  const patRes = dispatcher.triggerAction('pat');
  assert.equal(patRes.ok, true);
  assert.equal(patRes.stage, 'executing');
  assert.ok(feedback.includes('摸了摸琉璃的小脑袋'));
  assert.equal(storage.getItem('liuli-cottage-dev:intimacy'), '101');

  // 2. Unregistered / missing furniture action rejection
  const writeRes = dispatcher.triggerAction('write');
  assert.equal(writeRes.ok, false);
  assert.equal(writeRes.stage, 'rejected');
  assert.equal(feedbackErr, true);
  assert.ok(feedback.includes('暂时没有'));

  // 3. Multi-stage action (lounge while traveling)
  residentTraveling = true;
  const loungeRes = dispatcher.triggerAction('lounge');
  assert.equal(loungeRes.ok, true);
  assert.equal(loungeRes.stage, 'moving');
  assert.ok(feedback.includes('已接收「沙发休息」指令 · 琉璃正前往一楼沙发…'));

  // 4. Moving update notification
  const moveUpdate = dispatcher.handleActivityUpdate({ mode: 'walk', moving: true, label: '正在下楼梯…' });
  assert.equal(moveUpdate?.stage, 'moving');
  assert.equal(moveUpdate?.message, '正在下楼梯…');

  // 5. Arrival and execution
  residentTraveling = false;
  dispatcher.handleActivityUpdate({ mode: 'lounge', moving: false, label: '在沙发上品茶休息' });
  assert.ok(feedback.includes('已到达并开始「沙发休息」'));
  assert.equal(dispatcher.getPendingOrder(), null, 'Pending order cleared on arrival');

  // 6. Action aliases (drink -> rest) and manual takeover
  assert.equal(normalizeRoomActionId('drink'), 'rest');
  assert.equal(normalizeRoomActionId('tea'), 'rest');
  const drinkAvail = checkRoomActionAvailability('drink', { room: { items: [] }, availableActions: ['rest'], hasScene: true });
  assert.equal(drinkAvail.available, true);
  assert.equal(drinkAvail.normalizedId, 'rest');

  // 7. Synchronous onActivity callback during pat-greeting while still travelling must not throw or clear pendingOrder
  residentTraveling = true;
  scene.setRoomActivity = (patch) => {
    if (patch.preview) activeMode = patch.preview;
    // Simulate greeting-paused synchronous callback where moving=false but data-resident-travel='true'
    dispatcher.handleActivityUpdate({ mode: activeMode, moving: false, label: '停下来，蹭蹭你的手…' });
  };
  const sleepAfterPat = dispatcher.triggerAction('sleep');
  assert.equal(sleepAfterPat.ok, true);
  assert.equal(sleepAfterPat.stage, 'moving');
  assert.equal(dispatcher.getPendingOrder()?.mode, 'sleep');
});

test('V5.1 Scheme C locked 2560x1440 Star-Echo HUD assets match SHA-256 and 1.60:1 / 1.125x stage specifications', async () => {
  const spec = JSON.parse(await readFile(new URL('../assets/star-echo/hud_stage_spec_2560x1440.json', import.meta.url), 'utf8'));
  assert.equal(spec.status, 'LOCKED_SCHEME_C_BASELINE');
  assert.equal(spec.canvas.width, 2560);
  assert.equal(spec.canvas.height, 1440);
  assert.equal(spec.stageOpening.width, 1800);
  assert.equal(spec.stageOpening.height, 1125);
  assert.equal(spec.stageOpening.aspectRatio, 1.6);
  assert.equal(spec.cottagePlacement.scale, 1.125);
  assert.equal(spec.cottagePlacement.scaledSize.width, 1728);
  assert.equal(spec.cottagePlacement.scaledSize.height, 1152);
  assert.equal(spec.overviewAllMode.stageBorderBehavior, 'FIXED_1_60_TO_1_NO_DYNAMIC_NARROWING');

  for (const filename of ['hud_frame_2560x1440_clean.png', 'starsea_background_2560x1440.png', 'hud_frame_2560x1440.svg']) {
    const buf = await readFile(new URL('../assets/star-echo/' + filename, import.meta.url));
    const sha = createHash('sha256').update(buf).digest('hex');
    assert.equal(sha, spec.assets[filename].sha256, `Locked HUD asset ${filename} SHA-256 must match baseline`);
  }
});
