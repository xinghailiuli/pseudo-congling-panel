import { roomActivity, roomWalkPoint } from './room-life.mjs';
import { createRoomJourney } from './room-journey.mjs';
import { roomNavigation, chooseRoomWander } from './room-navigation.mjs';
import { createRoomChoreography } from './room-choreography.mjs';
import { createRoomLifeDefinitions } from './room-life-sequences.mjs';
import { createRoomLifeArt, validateRoomLifeAssets, createRoomQuilt } from './room-life-art.mjs';
import { createRoomWardrobe } from './room-wardrobe.mjs';
import { createRoomIdleEvents } from './room-idle-events.mjs';
import { transitionWindow } from './room-pose-transition.mjs';
import { createRoomDiagnostics, createRoomFrameGuard, roomResourceDeadline } from './room-diagnostics.mjs';
import {
  ROOM_REQUIRED_FURNITURE_NAMES,
  ROOM_UPPER_FLOOR_ITEMS,
  ROOM_UPSTAIRS_ACTIONS,
  ROOM_UPSTAIRS_HOTSPOT_DEFS,
  getRoomFeatureTargets,
  ROOM_AREA_OCCLUDERS,
  normalizeRoomActionId,
  createLibraryReadingEffects,
  createGreenhouseTerraceArt,
  createComputerWorkspaceArt,
  createBedroomSleepArt,
  createMirrorWardrobeArt,
  roomSleepVariation,
} from './areas/area-registry.mjs';
import {
  ROOM_FLOOR_OFFSETS,
  installRoomCosmicDefs,
  createRoomCosmicBackdrop,
  createRoomFloorLayers,
  createRoomEnvironmentControls,
} from './room-environment.mjs';
import {
  computeRoomTargetViewBox,
  stepRoomCamera,
  shiftCameraAcrossPortal,
  renderRoomStairPortal,
  syncRoomFloorVisibility,
} from './room-viewport.mjs';

let roomArtSerial = 0;
const roomDecodedLifeUrls = new Map(), roomDecodingLifeUrls = new Map();

function decodeRoomLifeUrl(url, ImageClass = globalThis.Image) {
  if (roomDecodedLifeUrls.has(url)) return Promise.resolve(url);
  if (roomDecodingLifeUrls.has(url)) return roomDecodingLifeUrls.get(url);
  const p = (async () => {
    if (!ImageClass) throw Error('No image decoder');
    const img = new ImageClass();
    if (typeof img.decode === 'function') {
      img.src = url;
      await img.decode();
    } else {
      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(Error('Image load failed'));
        img.src = url;
      });
    }
    roomDecodedLifeUrls.set(url, img);
    return url;
  })().finally(() => roomDecodingLifeUrls.delete(url));
  roomDecodingLifeUrls.set(url, p);
  return p;
}

export async function prewarmRoomLifeAssets(assets, ImageClass = globalThis.Image) {
  if (!assets || !ImageClass || !validateRoomLifeAssets(assets)) return;
  const urls = Object.values({
    ...assets.atlases,
    greenhouse: assets.greenhouse,
    ...Object.fromEntries(['bedding', 'mattress', 'foldedQuilt', 'chairCleanplate'].filter(k => assets[k]).map(k => [k, assets[k]])),
    ...(assets.quilt ? { quilt: assets.quilt.url } : {}),
  });
  for (let i = 0; i < urls.length; i += 3) {
    await Promise.all(urls.slice(i, i + 3).map(u => decodeRoomLifeUrl(u, ImageClass).catch(() => {})));
    await new Promise(r => typeof setTimeout === 'function' ? setTimeout(r, 8) : r());
  }
}

// 模块 A / D / F 协调器：装配房屋环境、6 大功能区域图层、角色生活调度、换装渲染与状态快照恢复。
export function createArtBlockRoom(room, { document: doc, petAssets = {}, actionAssets = {}, animation = {}, night = {}, jobs = [], preview = 'auto', onActivity, onFloor, onLamp, onCurtain, onFurniture, onHotspotAction, onDiagnostic } = {}) {
  const house = actionAssets.house, names = ROOM_REQUIRED_FURNITURE_NAMES;
  if (!house || room.items?.length !== names.length || !names.every(name => room.items.some(item => item.name === name))) return null;
  const instance = 'room-view-' + (++roomArtSerial) + '-';
  const el = (tag, attrs = {}, text) => {
    const n = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      n.setAttribute(k, k === 'id' ? instance + v : typeof v === 'string' ? v.replace(/url\(#([^\)]+)\)/g, (_, id) => 'url(#' + instance + id + ')') : v);
    }
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const svg = el('svg', { viewBox: '0 1080 1536 1024', class: 'room-scene block-room room-art', role: 'group', 'aria-label': '琉璃的小鲸鱼双层小屋，精细橡木与白桦木房间', 'data-room-art': 'reference-v4', 'data-room-size': '14x10', 'data-room-floors': '2' });
  const diagnostics = createRoomDiagnostics({ onEvent: onDiagnostic });
  let renderFailed = false, lastGoodRuntime = null, lastPose = '', drawFailures = 0, snapshotDirty = true;
  const guard = createRoomFrameGuard({
    root: svg,
    onError: error => {
      renderFailed = true;
      drawFailures++;
      svg.setAttribute('data-room-render-error', error.message || String(error));
      diagnostics.record('draw-error', { mode: currentMode, pose: lifeSample?.pose, outfit: svg.getAttribute?.('data-room-outfit') || 'original', error: error.message || String(error), stack: error.stack });
    },
  });
  svg.getRoomDiagnostics = () => diagnostics.snapshot();
  svg.recordRoomDiagnostic = (kind, data) => diagnostics.record(kind, data);
  svg.append(el('title', {}, '琉璃的小鲸鱼双层小屋 · 一楼起居与生产，二楼休息与魔法'));
  const defs = el('defs');
  svg.append(defs);
  installRoomCosmicDefs(el, defs);

  const offsets = ROOM_FLOOR_OFFSETS, poses = {}, frames = {};
  const hitPoints = { walk: [970, 450], ...Object.fromEntries(Object.entries(house.actions).map(([k, v]) => [k, v.head])) };
  const image = (url, attrs = {}) => {
    const isBrowser = Boolean(doc.defaultView), href = (isBrowser && typeof url === 'string' && url.startsWith('/plugins/')) ? undefined : url;
    const picture = el('image', { x: 0, y: 0, width: house.width, height: house.height, ...(href ? { href } : {}), preserveAspectRatio: 'none', ...attrs });
    if (isBrowser && url && !href) picture.setAttribute('data-fallback-href', url);
    picture.addEventListener('error', () => diagnostics.record('asset-error', { asset: 'scene-image', stage: 'svg-load' }));
    return picture;
  };
  const clip = (id, rect) => {
    const c = el('clipPath', { id, clipPathUnits: 'userSpaceOnUse' });
    c.append(typeof rect === 'string' ? el('polygon', { points: rect }) : el('rect', { x: rect[0], y: rect[1], width: rect[2], height: rect[3] }));
    defs.append(c);
    return `url(#${id})`;
  };

  svg.append(createRoomCosmicBackdrop(el, instance));
  const { floors, artPictures, ambientWindows, createPortal } = createRoomFloorLayers({ doc, svg, defs, el, clip, image, instance, house, offsets, animation });
  const mirrorArt = createMirrorWardrobeArt({ el, clip, image, floor2: floors[2], house });

  // Saved identities remain inspectable; the artwork is only their presentation.
  for (const item of room.items) {
    const level = ROOM_UPPER_FLOOR_ITEMS.has(item.name) ? 2 : 1;
    const g = el('g', { 'data-room-item': item.id, 'data-object-floor': level });
    g.append(el('title', {}, `${item.name}${item.state ? ' · ' + item.state : ''}`));
    floors[level].append(g);
  }

  const extraActions = ROOM_UPSTAIRS_ACTIONS;
  const vector = (value, length) => Array.isArray(value) && value.length === length && value.every(Number.isFinite);
  const upstairs = extraActions.every(([mode]) => {
    const a = house.actions[mode];
    return a?.floor === 2 && Array.isArray(a.frames) && a.frames.length > 0 && a.frames.every(url => typeof url === 'string' && url.length > 0) && vector(a.clip, 4) && a.clip[2] > 0 && a.clip[3] > 0 && vector(a.head, 2) && vector(a.feet, 2);
  });
  const failedActions = new Set(), hotspots = {};
  svg.roomActions = upstairs ? extraActions : [];
  const activityAt = time => {
    const a = roomActivity(room, visual.night, visual.jobs, visual.preview, time, { upstairs });
    return failedActions.has(a.mode) ? roomActivity(room, visual.night, visual.jobs, 'auto', time) : a;
  };
  const leisureDwell = { walk: 60000, lounge: 150000, garden: 120000, type: 150000, write: 150000, read: 100000, enchant: 80000, rest: 120000, sleep: 180000 };
  let visual = { night, jobs, preview }, elapsed = 0, frameAt = null, motionTime = 0, floor = '1', detail = false, currentMode = null, lastSource = null, patUntil = 0, patStarted = 0, pausedWalk = false, journey = null, travelling = false, lastNotice = '', residentLevel = '1', follow = true, departure = null, lifeClock = 0, lastPaint = 0, route = null, camera = null, previousPortal = null, wanderUntil = 0;
  const requestFrame = animation.requestFrame || globalThis.requestAnimationFrame?.bind(globalThis);
  const reduced = animation.reducedMotion ?? globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let sleepStarted = 0, quiltCover = 0, sleepSeed = animation.sleepSeed ?? Math.floor(Math.random() * 1000000);
  const idleEvents = createRoomIdleEvents(animation.random || Math.random);
  let idleSample = null;
  let life = null, lifeArt = null, lifeMode = null, lifeExit = false, lifeNeedsEntry = false, lifeChairEntry = false, lifeSample = null, lifeLoad = 0, lifeAssets = null, lifeLoading = false;

  const lifeScenery = el('g', { 'data-life-scenery': 10, display: 'none' });
  floors[2].append(lifeScenery);
  const computerArt = createComputerWorkspaceArt({ el, defs, image, floor1: floors[1] });
  const { portal, portalFloors } = createPortal();
  const resident = el('g', { 'data-room-resident': 'dafeiyu', class: 'room-resident' });
  svg.append(resident);

  for (const [mode, asset] of Object.entries(house.actions)) {
    if (extraActions.some(([m]) => m === mode) && !upstairs) continue;
    const g = el('g', { 'data-room-pose': mode, 'data-resident-floor': asset.floor, 'data-contact': asset.contact, transform: `translate(${asset.offset?.[0] || 0},${offsets[asset.floor] + (asset.offset?.[1] || 0)})` });
    if (mode === 'read') g.append(el('ellipse', { cx: 736, cy: 544, rx: 22, ry: 5, fill: '#493824', opacity: '.16' }));
    const region = el('g', { 'clip-path': clip('room-art-' + mode, asset.shape || asset.clip) }), base = image(asset.frames[0]);
    region.append(base);
    if (mode === 'garden') artPictures.push([base, 'garden']);
    g.append(region);
    resident.append(g);
    poses[mode] = g;
    if (extraActions.some(([m]) => m === mode)) {
      base.addEventListener('error', () => {
        failedActions.add(mode);
        svg.roomActions = extraActions.filter(([m]) => !failedActions.has(m));
        if (mode !== 'enchant' || !onFurniture) {
          hotspots[mode]?.setAttribute('aria-disabled', 'true');
          hotspots[mode]?.setAttribute('tabindex', '-1');
        }
        if (visual.preview === mode) visual.preview = 'auto';
        lastNotice = '';
        paint(elapsed);
      });
    }
    if (asset.frames.length > 1) {
      const handRect = mode === 'type' ? [832, 365, 48, 31] : [830, 369, 48, 39];
      const hand = el('g', { 'clip-path': clip('room-art-' + mode + '-hands', handRect), opacity: 0, 'data-contact-animation': mode }), alternate = image(undefined);
      hand.append(alternate);
      g.append(hand);
      frames[mode] = { hand, alternate, asset };
    }
  }

  const walkPose = el('g', { 'data-room-pose': 'walk', 'data-resident-floor': 1 });
  resident.append(walkPose);
  poses.walk = walkPose;
  walkPose.append(el('ellipse', { cx: 0, cy: 1, rx: 23, ry: 6, fill: '#493824', opacity: '.22' }));
  const walkAsset = actionAssets.walk, isBrowser = Boolean(doc.defaultView), walkHref = (isBrowser && typeof walkAsset.url === 'string' && walkAsset.url.startsWith('/plugins/')) ? undefined : walkAsset.url;
  const walkSheet = el('svg', { x: -107.8, y: -186.1, width: 184, height: 189.8, viewBox: walkAsset.frames[0].join(' '), overflow: 'hidden', 'data-complete-action': 'walk' });
  const walkPic = el('image', { ...(walkHref ? { href: walkHref } : {}), x: 0, y: 0, width: walkAsset.width, height: walkAsset.height });
  if (isBrowser && walkAsset.url && !walkHref) walkPic.setAttribute('data-fallback-href', walkAsset.url);
  walkSheet.append(walkPic);
  walkPose.append(walkSheet);
  let standingFailed = false;
  const standing = el('image', { x: -285 * 219.5 / 412, y: -285 * 344 / 412 + 9.7, width: 285, height: 285 * 344 / 412, preserveAspectRatio: 'xMidYMax meet', 'data-walk-pose': 'standing' });
  standing.addEventListener?.('error', () => {
    standingFailed = true;
    standing.setAttribute('display', 'none');
    walkSheet.setAttribute('display', 'inline');
    walkSheet.setAttribute('viewBox', walkAsset.frames[1].join(' '));
  });
  walkPose.append(standing);
  const lifeRoot = el('g', { 'data-life-actor': true });
  resident.append(lifeRoot);
  const wardrobe = createRoomWardrobe({ document: doc, root: resident });

  const occluders = [];
  const foreground = (name, level, polygons, when, url, mountOnSvg = false, contactPolygons) => {
    const c = el('clipPath', { id: 'room-front-' + name, clipPathUnits: 'userSpaceOnUse' });
    for (const points of polygons) c.append(el('polygon', { points }));
    defs.append(c);
    if (contactPolygons) {
      const contact = el('clipPath', { id: 'room-front-' + name + '-contact', clipPathUnits: 'userSpaceOnUse' });
      for (const points of contactPolygons) contact.append(el('polygon', { points }));
      defs.append(contact);
    }
    const g = el('g', { 'data-room-foreground': name, 'clip-path': `url(#room-front-${name})`, transform: `translate(0,${offsets[level]})`, 'pointer-events': 'none', display: 'none' });
    const picture = image(url || house.floors[level]);
    g.append(picture);
    (mountOnSvg ? svg : resident).append(g);
    if (url && url === house.repairs?.[level]?.url) artPictures.push([picture, level === 1 ? 'floor-one' : 'floor-two']);
    occluders.push({ g, level, when, name, picture, fullClip: `url(#${instance}room-front-${name})`, contactClip: contactPolygons ? `url(#${instance}room-front-${name}-contact)` : null });
  };
  for (const spec of ROOM_AREA_OCCLUDERS) {
    foreground(spec.name, spec.level, spec.polygons, spec.when, spec.useRepair ? house.repairs?.[spec.level]?.url : undefined, Boolean(spec.mountOnSvg), spec.contactPolygons);
  }

  const quiltLayer = occluders.find(o => o.name === 'wardrobe-quilt');
  const bedroomArt = createBedroomSleepArt({ doc, el, defs, clip, image, floor2: floors[2], instance, quiltLayer, house, createRoomQuilt });

  const upstairsControls = el('g', { 'data-upstairs-controls': true });
  svg.append(upstairsControls);
  const hotspotDefs = ROOM_UPSTAIRS_HOTSPOT_DEFS;
  const hotspotIcon = (kind,mark) => {
    const paths={
      comms:'M3 4h18v13H9l-5 4v-4H3Z M7 9h10M7 13h7',
      computer:'M3 4h18v13H3Z M8 21h8M12 17v4',
      workbench:'M4 8h16v13H4Z M9 8V4h6v4M4 12h16M10 12v3h4v-3',
      read:'M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-3-1-7-2-10 1ZM12 5v15',
      enchant:'M12 2l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
      bed:'M3 9v12M21 9v12M3 16h18M3 9h18v7M6 9V5h12v4',
      mirror:'M12 2a7 8 0 1 0 0 16 7 8 0 1 0 0-16M12 18v4M7 22h10',
      garden:'M12 22V12C4 13 2 8 3 3c7 0 10 4 9 9 0-7 4-10 9-10 1 7-3 11-9 10',
      rest:'M3 14h18M5 14V8h14v6M5 14v7M19 14v7M8 8V4h8v4',
    };
    return el('path',{d:paths[kind]||paths.read,transform:'translate('+(mark[0]-10)+','+(mark[1]-10)+') scale(.8333)',fill:'none',stroke:'#c3faff','stroke-width':1.8,'stroke-linecap':'round','stroke-linejoin':'round','pointer-events':'none',class:'room-hotspot-icon'});
  };
  if (upstairs) {
    for (const [i, [mode, label]] of extraActions.entries()) {
      const def = mode === 'enchant' && onFurniture ? { ...hotspotDefs[mode], label: hotspotDefs[mode].furnitureLabel } : hotspotDefs[mode];
      const g = el('g', { 'data-room-hotspot': mode, role: 'button', tabindex: 0, 'aria-label': def.label, class: 'room-upstairs-hotspot' });
      g.append(
        el('title', {}, def.label),
        el('rect', { x: def.rect[0], y: def.rect[1], width: def.rect[2], height: def.rect[3], rx: 12, class: 'room-hotspot-zone', fill: 'transparent' }),
        el('circle', { cx: def.mark[0], cy: def.mark[1], r: 17, class: 'room-hotspot-dot' }),
        hotspotIcon(mode,def.mark),
      );
      const caption = el('g', { class: 'room-hotspot-caption', 'pointer-events': 'none' });
      caption.append(
        el('rect', { x: def.mark[0] - 61, y: def.mark[1] - 59, width: 122, height: 31, rx: 9 }),
        el('text', { x: def.mark[0], y: def.mark[1] - 37, 'text-anchor': 'middle', 'font-size': 16 }, mode === 'enchant' && onFurniture ? hotspotDefs[mode].furnitureShort : label),
      );
      g.append(caption);
      if (mode === 'enchant' && onFurniture) g.setAttribute('data-room-furniture', 'enchant');
      hotspots[mode] = g;
      const select = () => {
        if (mode === 'read' && onFurniture) { onFurniture('bookshelf'); return; }
        if (mode === 'enchant' && onFurniture) { onFurniture('enchant'); return; }
        if (!failedActions.has(mode)) {
          if (typeof onHotspotAction === 'function') onHotspotAction(mode);
          else svg.setRoomActivity({ preview: mode });
        }
      };
      g.addEventListener('click', select);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
      upstairsControls.append(g);
    }
  }

  const effects = el('g', { 'data-upstairs-effects': true, 'pointer-events': 'none' });
  resident.append(effects);
  const libraryEffects = createLibraryReadingEffects({ el, effects });
  const greenhouseArt = createGreenhouseTerraceArt({ el, clip, image, lifeScenery, effects });
  const { controls, setRoomEnvironment } = createRoomEnvironmentControls({ svg, room, el, onLamp, onCurtain });
  svg.setRoomEnvironment = setRoomEnvironment;

  const featureLayers = {};
  if (onFurniture) {
    for (const level of [1, 2]) {
      const g = el('g', { 'data-furniture-floor': level, transform: 'translate(0,' + offsets[level] + ')' });
      svg.append(g);
      featureLayers[level] = g;
    }
    for (const t of getRoomFeatureTargets({ upstairs })) {
      const g = el('g', { 'data-room-furniture': t.id, role: 'button', tabindex: 0, 'aria-label': t.label, class: 'room-upstairs-hotspot' });
      g.append(
        el('title', {}, t.label),
        el('rect', { x: t.rect[0], y: t.rect[1], width: t.rect[2], height: t.rect[3], rx: 12, class: 'room-hotspot-zone', fill: 'transparent' }),
        el('circle', { cx: t.mark[0], cy: t.mark[1], r: 17, class: 'room-hotspot-dot' }),
        hotspotIcon(t.id,t.mark),
      );
      const caption = el('g', { class: 'room-hotspot-caption', 'pointer-events': 'none' });
      caption.append(
        el('rect', { x: t.mark[0] - 74, y: t.mark[1] - 55, width: 148, height: 30, rx: 8 }),
        el('text', { x: t.mark[0], y: t.mark[1] - 35, 'text-anchor': 'middle', 'font-size': 14 }, t.short || t.label),
      );
      g.append(caption);
      const select = () => onFurniture(t.id);
      g.addEventListener('click', select);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); } });
      featureLayers[t.level].append(g);
    }
  }

  let suspended = false, disposed = false, framePending = false;
  const requestTick = () => {
    if (framePending || !requestFrame || reduced || disposed || suspended || doc.hidden) return;
    framePending = true;
    requestFrame(tick);
  };
  svg.disposeRoomAmbient = () => {
    disposed = true;
    guard.dispose();
    ambientWindows.forEach(w => w.destroy());
    doc.removeEventListener?.('visibilitychange', resetFrameClock);
  };
  svg.setRoomPaused = value => {
    const was = suspended;
    suspended = Boolean(value);
    frameAt = null;
    ambientWindows.forEach(w => suspended ? w.pause?.() : w.resume?.());
    if (was && !suspended && !disposed && resident.isConnected && requestFrame && !reduced) {
      doc.removeEventListener?.('visibilitychange', resetFrameClock);
      doc.addEventListener?.('visibilitychange', resetFrameClock);
      requestTick();
    }
  };
  svg.setRoomArtAssets = a => {
    for (const [picture, key] of artPictures) {
      if (a[key]) {
        picture.setAttribute('href', a[key]);
        if (picture.getAttribute?.('display') === 'none') picture.setAttribute('display', 'inline');
      }
    }
    mirrorArt.applyArtAssets(a);
  };

  const interaction = el('g', { role: 'button', tabindex: 0, 'aria-label': '摸摸小鲸鱼', class: 'room-resident room-art-pat' });
  const hit = el('ellipse', { rx: 62, ry: 54, fill: 'transparent' });
  const heart = el('text', { 'font-size': 27, fill: '#ffa8be', 'text-anchor': 'middle', opacity: 0, 'pointer-events': 'none' }, '♥');
  const sparkle = el('text', { 'font-size': 19, fill: '#ffd1dc', 'text-anchor': 'middle', opacity: 0, 'pointer-events': 'none' }, '✧');
  const blushLeft = el('ellipse', { rx: 7, ry: 4.5, fill: '#ff8fa3', opacity: 0, 'pointer-events': 'none' });
  const blushRight = el('ellipse', { rx: 7, ry: 4.5, fill: '#ff8fa3', opacity: 0, 'pointer-events': 'none' });
  interaction.append(hit, blushLeft, blushRight, heart, sparkle);
  svg.append(interaction);

  const setAttr = (n, k, v) => {
    const val = String(v);
    const cur = typeof n.getAttribute === 'function' ? n.getAttribute(k) : n.attributes?.[k];
    if (cur !== val) n.setAttribute(k, val);
  };
  const syncVisibility = () => syncRoomFloorVisibility({
    floor, detail, route, follow, camera, offsets,
    floors, featureLayers, resident, interaction, controls, upstairsControls,
    residentLevel, bedroomArt, lifeAssets, lifeSample, quiltCover, setAttr,
  });
  const updateView = (dt = 1000, force = false) => {
    const target = computeRoomTargetViewBox({ floor, detail, offsets, travelling, route, currentMode, residentLevel });
    camera = stepRoomCamera(camera, target, dt, force);
    setAttr(svg, 'viewBox', camera.join(' '));
    setAttr(svg, 'data-room-detail', String(detail));
  };
  const setFloor = (value, preserveDetail = false) => {
    if (!['all', '1', '2'].includes(String(value))) return;
    floor = String(value);
    follow = false;
    if (!preserveDetail || floor === 'all') detail = false;
    updateView(1000, true);
    setAttr(svg, 'data-room-floor', floor);
    syncVisibility();
    onFloor?.(floor, { detail });
  };

  const paint = time => {
    if (renderFailed) return false;
    const ok = guard.draw(() => paintFrame(time));
    if (ok) {
      drawFailures = 0;
      const key = [currentMode, lifeSample?.pose, lifeSample?.phase].join('/');
      if (key !== lastPose) {
        lastPose = key;
        snapshotDirty = true;
        diagnostics.record('pose', { mode: currentMode, pose: lifeSample?.pose, phase: lifeSample?.phase });
      }
      if (lifeAssets && journey) {
        if (snapshotDirty || !lastGoodRuntime) {
          lastGoodRuntime = svg.getRoomRuntime();
          snapshotDirty = false;
        } else {
          lastGoodRuntime.savedAt = Date.now();
          lastGoodRuntime.preview = visual.preview;
          lastGoodRuntime.quiltCover = quiltCover;
          lastGoodRuntime.idle = idleEvents.snapshot();
          Object.assign(lastGoodRuntime.state, {
            elapsed, motionTime, floor, detail, currentMode, lastSource, travelling, residentLevel, follow,
            departure: departure ? { ...departure } : null, lifeClock, lastPaint,
            route: route ? { ...route, transition: route.transition ? { ...route.transition } : null } : null,
            camera: camera ? [...camera] : null, previousPortal, wanderUntil, sleepStarted, sleepSeed,
            lifeMode, lifeExit, lifeNeedsEntry, lifeChairEntry,
          });
        }
      }
    }
    return ok;
  };

  const recoverFrame = () => {
    if (!renderFailed) return;
    renderFailed = false;
    svg.removeAttribute?.('data-room-render-error');
    if (lastGoodRuntime && drawFailures <= 2) {
      svg.restoreRoomRuntime?.({ ...lastGoodRuntime, savedAt: Date.now() });
      diagnostics.record('draw-retry');
    } else {
      if (life) { life.reset(); lifeMode = null; }
      currentMode = 'walk';
      visual.preview = 'walk';
      departure = null;
      travelling = false;
      lifeNeedsEntry = false;
      lifeChairEntry = false;
      lifeExit = false;
      residentLevel = '1';
      floor = residentLevel;
      journey = createRoomJourney(roomNavigation('walk'));
      journey.go('walk', motionTime);
      drawFailures = 0;
    }
  };

  const paintFrame = time => {
    const dt = Math.max(0, time - lastPaint), held = pausedWalk ? Math.max(0, Math.min(time, patUntil) - lastPaint) : 0;
    motionTime += idleSample ? 0 : dt - held;
    lastPaint = time;
    const greeting = pausedWalk && time < patUntil;
    if (!travelling || currentMode === 'walk') {
      const baseDwell = leisureDwell[currentMode] || 60000;
      const variance = 1 + (((lifeClock / 20000) | 0) % 4) * 0.05;
      const dwell = Math.min(180000, Math.max(60000, Math.round(baseDwell * variance)));
      lifeClock += (dt - held) * (20000 / dwell);
    }
    const desired = activityAt(lifeClock);
    let mode = desired.mode, skipDeparture = false;
    idleSample = !reduced && lifeAssets?.geometry.idleChair
      ? idleEvents.sample({ time, safe: mode === 'walk' && currentMode === 'walk' && route?.arrived && route.kind === 'idle' && !route.transition && !departure && !greeting, point: [route?.x || 0, route?.y || 0], goal: mode })
      : null;
    if (idleSample && desired.mode === 'walk') mode = currentMode;
    const occupied = lifeMode ? life?.sample(motionTime) : null;
    if (!reduced && visual.preview === 'auto' && currentMode === 'sleep' && mode !== 'sleep' && occupied?.phase === 'perform' && lifeAssets?.geometry.sleepMotion && roomSleepVariation(motionTime - sleepStarted, sleepSeed)) {
      mode = 'sleep';
    }
    const sameChair = !travelling && ['type', 'write'].includes(currentMode) && ['type', 'write'].includes(mode) && (!occupied || occupied.support === 'hips');
    if (life && lifeMode && !travelling && !reduced && (lifeExit || mode !== currentMode && (!sameChair || occupied?.prop))) {
      if (!lifeExit) lifeExit = sameChair ? 'seated' : 'standing';
      else if (!sameChair) lifeExit = 'standing';
      life.requestExit(motionTime, { seated: lifeExit === 'seated' });
      snapshotDirty = true;
      if (life.sample(motionTime).ready) {
        lifeChairEntry = life.sample(motionTime).support === 'hips';
        lifeNeedsEntry = !lifeChairEntry;
        life.reset();
        lifeMode = null;
        lifeExit = false;
        skipDeparture = true;
        snapshotDirty = true;
      } else mode = currentMode;
    }
    const activity = mode === desired.mode ? desired : { ...desired, mode }, isUpper = extraActions.some(([m]) => m === mode), changed = mode !== currentMode;
    setAttr(svg, 'data-life-target', desired.mode);
    if (changed) {
      snapshotDirty = true;
      if (life) {
        life.reset();
        lifeMode = null;
        lifeNeedsEntry = currentMode !== null && !sameChair;
        lifeChairEntry = sameChair;
      }
      if (!journey) {
        journey = createRoomJourney(roomNavigation(mode));
        journey.go(mode, motionTime);
      } else if (!reduced) {
        const wasContact = !travelling && currentMode !== 'walk' && !sameChair && !skipDeparture;
        departure = departure && motionTime < departure.until ? departure : wasContact ? { mode: currentMode, at: motionTime, until: motionTime + 240 } : null;
        journey.go(mode, departure?.until || motionTime);
      }
      if (reduced) {
        journey = createRoomJourney(roomNavigation(mode));
        journey.go(mode, motionTime);
      }
      currentMode = mode;
      wanderUntil = 0;
    }
    lastSource = activity.source;
    route = journey.sample(motionTime);
    if (mode === 'walk' && !reduced && route.arrived && !idleSample) {
      if (!wanderUntil) wanderUntil = motionTime + 650 + (animation.random || Math.random)() * 2350;
      if (motionTime >= wanderUntil) {
        journey.go(chooseRoomWander(route.target, animation.random || Math.random), motionTime);
        route = journey.sample(motionTime);
        wanderUntil = 0;
        snapshotDirty = true;
      }
    }
    travelling = !reduced && (!route.arrived || Boolean(departure && motionTime < departure.until));
    lifeSample = null;
    if (idleSample) {
      const g = lifeAssets.geometry.idleChair;
      const pose = cell => {
        const f = g.frames[cell];
        return { atlas: 'idleChair', cell, at: idleSample.position, pivot: f.anchor, head: f.head, scale: 188 / g.referenceHeight, support: 'feet', prop: null, articulated: true };
      };
      lifeSample = {
        mode: 'walk', pose: 'idle-' + idleSample.cell, phase: 'perform', support: 'feet', prop: null, move: false,
        position: idleSample.position, frame: pose(idleSample.cell), nextFrame: pose(idleSample.nextCell),
        progress: idleSample.progress, duration: idleSample.duration,
        variation: idleSample.returning ? '站稳，继续走向原来的目的地' : '停一小会儿，看看周围',
      };
    }
    if (life && !travelling && mode !== 'walk' && life.has(mode)) {
      if (lifeMode !== mode) {
        sleepStarted = motionTime;
        life.start(mode, motionTime, { settled: !lifeNeedsEntry, seated: lifeChairEntry });
        lifeMode = mode;
        lifeNeedsEntry = false;
        lifeChairEntry = false;
        snapshotDirty = true;
      }
      lifeSample = reduced ? life.still(mode) : life.sample(motionTime);
    }
    lifeSample = bedroomArt.applySleepVariation({ lifeSample, lifeAssets, motionTime, sleepStarted, sleepSeed, reduced, svg });
    svg.setAttribute('data-life-mode', lifeSample?.mode || '');
    svg.setAttribute('data-life-phase', lifeSample?.phase || '');
    svg.setAttribute('data-life-pose', lifeSample?.pose || '');
    svg.setAttribute('data-life-support', lifeSample?.support || '');
    svg.setAttribute('data-life-moving', String(Boolean(lifeSample?.move)));

    const visibleFrame = lifeSample && transitionWindow(lifeSample) >= .5 ? lifeSample.nextFrame : lifeSample?.frame;
    const wholeChair = computerArt.updateProps(lifeSample, visibleFrame, lifeAssets);
    greenhouseArt.updateProps(lifeSample);

    shiftCameraAcrossPortal(camera, previousPortal, route.transition, detail, offsets);
    previousPortal = detail && follow ? route.transition : null;
    residentLevel = String(route.transition?.from.floor || route.floor);
    if ((follow || changed && reduced) && floor !== 'all' && floor !== residentLevel) {
      floor = residentLevel;
      onFloor?.(floor, { detail });
    }
    setAttr(svg, 'data-room-floor', floor);
    setAttr(svg, 'data-room-activity', mode);
    setAttr(svg, 'data-room-source', activity.source);
    setAttr(svg, 'data-resident-travel', String(travelling));
    setAttr(svg, 'data-resident-level', residentLevel);
    setAttr(svg, 'data-travel-kind', route.kind);
    setAttr(svg, 'data-travel-arrives', route.arrivesAt);

    const transition = route.transition;
    renderRoomStairPortal({ svg, portal, portalFloors, transition, detail, follow, offsets, setAttr });

    const departing = departure && motionTime < departure.until;
    const displayed = departing && motionTime < departure.at + 120 ? departure.mode : travelling ? 'walk' : mode;
    for (const [k, g] of Object.entries(poses)) g.setAttribute('display', k === displayed && !lifeSample ? 'inline' : 'none');
    if (!lifeSample) lifeArt?.hide();
    let opacity = 1;
    if (departing) opacity = motionTime < departure.at + 120 ? 1 - (motionTime - departure.at) / 120 : (motionTime - departure.at - 120) / 120;
    else if (!lifeSample && !travelling && mode !== 'walk' && motionTime - route.arrivesAt < 220 && route.arrivesAt > 0) opacity = Math.max(0, (motionTime - route.arrivesAt) / 220);
    resident.setAttribute('opacity', opacity);
    setAttr(svg, 'data-resident-phase', greeting ? 'greeting' : departing ? 'departing' : travelling ? 'travelling' : 'contact');
    const movementLabel = transition
      ? (transition.to.floor > transition.from.floor ? '沿楼梯上到二楼…' : '沿楼梯回到一楼…')
      : route.kind === 'stairs'
        ? (route.ascending ? '一步一步上台阶…' : '一步一步下台阶…')
        : '正在走向' + ({ sleep: '床边', type: '电竞椅', write: '书桌', lounge: '沙发', read: '书架', enchant: '附魔台', garden: '温室', rest: '露台', walk: '过道' }[mode]) + '…';
    const notice = [mode, activity.source, visual.preview, travelling, greeting, route.kind, residentLevel, lifeSample?.phase, lifeSample?.variation].join(':');
    if (notice !== lastNotice) {
      lastNotice = notice;
      onActivity?.({
        ...activity,
        preview: visual.preview,
        availableActions: svg.roomActions.map(([m]) => m),
        moving: travelling && !greeting,
        target: desired.mode,
        label: greeting ? '停下来，蹭蹭你的手…' : lifeExit ? '收好东西，准备起身…' : travelling ? movementLabel : lifeSample?.variation || activity.label,
      });
    }
    syncVisibility();
    updateView(dt, reduced);
    const visible = Boolean(transition && follow) || floor === 'all' || floor === residentLevel;
    if (!visible) return;
    const position = transition ? { ...transition.from, moving: false, frame: null, facing: 1 } : route;
    let head = hitPoints[mode] || [position.x, position.y - 150], offset = offsets[residentLevel], propPoint = null;
    const depthPoint = lifeSample ? { x: lifeSample.position[0], y: lifeSample.position[1] } : position;
    quiltCover = bedroomArt.updateQuilt({ lifeSample, lifeAssets, quiltCover, transition, floor });
    for (const mask of occluders) {
      if (mask.name === 'chair' && wholeChair) { mask.g.setAttribute('display', 'none'); continue; }
      const name = mask.name;
      if (name === 'wardrobe-quilt' && lifeAssets?.mattress) {
        mask.g.setAttribute('display', !transition && !lifeSample?.frame?.compositeQuilt && !(lifeAssets.foldedQuilt && quiltCover === 0) && (floor === 'all' || floor === '2') ? 'inline' : 'none');
        continue;
      }
      const contactMask = name === 'wardrobe-quilt' && Boolean(lifeAssets?.mattress) || name === 'wardrobe-quilt' && displayed === 'sleep' && !travelling && (lifeSample ? lifeSample.support === 'bed' || lifeSample.cover > 0 : wardrobe.active) || lifeSample && ((name === 'chair' && ['type', 'write'].includes(mode) && depthPoint.x < 995 && depthPoint.y < 521) || (name === 'life-garden' && mode === 'garden' && depthPoint.y < 535) || (name === 'sofa' && mode === 'lounge' && depthPoint.x > 620 && depthPoint.x < 965 && depthPoint.y < 750));
      const walking = displayed === 'walk' || lifeSample?.move;
      if (mask.contactClip) setAttr(mask.g, 'clip-path', contactMask ? mask.contactClip : mask.fullClip);
      mask.g.setAttribute('display', mask.level === Number(residentLevel) && (contactMask || walking && !transition && name !== 'life-garden' && !(name === 'greenhouse-rail' && lifeSample?.mode === 'garden') && mask.when(depthPoint)) ? 'inline' : 'none');
    }
    if (lifeSample) {
      const result = lifeArt.render(lifeSample, offset);
      head = result.head;
      propPoint = result.prop;
      svg.setAttribute('data-resident-feet', lifeSample.position.join(','));
    }
    if (displayed === 'walk' && !lifeSample) {
      const stepping = position.kind === 'stairs', moving = position.moving && !departing && !greeting;
      walkPose.setAttribute('data-resident-floor', residentLevel);
      const facing = stepping ? (position.ascending ? -1 : 1) : position.facing;
      walkPose.setAttribute('transform', 'translate(' + position.x + ',' + (position.y + offset) + ') scale(' + (moving ? facing : 1) + ',1)');
      walkSheet.setAttribute('display', (moving || standingFailed) ? 'inline' : 'none');
      standing.setAttribute('display', (!moving && !standingFailed) ? 'inline' : 'none');
      if (moving) walkSheet.setAttribute('viewBox', walkAsset.frames[position.frame].join(' '));
      else if (standingFailed) walkSheet.setAttribute('viewBox', walkAsset.frames[1].join(' '));
      else {
        const isPat = time < patUntil, idle = isPat ? (petAssets.head_pat || petAssets.idle) : petAssets.idle, clipTime = isPat ? time - patStarted : time;
        if (idle?.frames?.length) standing.setAttribute('href', idle.frames[reduced ? 0 : Math.floor(clipTime / idle.frameMs) % idle.frames.length]);
        else {
          walkSheet.setAttribute('display', 'inline');
          walkSheet.setAttribute('viewBox', walkAsset.frames[1].join(' '));
        }
      }
      svg.setAttribute('data-walk-moving', String(moving));
      svg.setAttribute('data-walk-frame', moving ? position.frame : 'standing');
      svg.setAttribute('data-resident-feet', position.x + ',' + position.y);
      head = [position.x, position.y - 153];
    }
    const loop = !lifeSample && !wardrobe.active ? frames[displayed] : null;
    if (loop) {
      const phase = reduced ? 0 : Math.floor(time / loop.asset.frameMs) % 2;
      loop.alternate.setAttribute('href', loop.asset.frames[1]);
      loop.hand.setAttribute('opacity', phase);
      loop.hand.setAttribute('data-animation-phase', phase);
    }
    if (wardrobe.active) {
      for (const g of Object.values(poses)) g.setAttribute('display', 'none');
      lifeArt?.hide();
      const moving = displayed === 'walk' && position.moving && !departing && !greeting;
      const point = lifeSample?.position || (displayed === 'walk' ? [position.x, position.y] : house.actions[displayed]?.feet || [position.x, position.y]);
      const flip = displayed === 'walk' ? (position.kind === 'stairs' ? (position.ascending ? 1 : -1) : -(position.facing || 1)) : (lifeSample?.frame?.flip || 1) * (lifeSample?.move && lifeSample.frame.atlas === 'walk' ? -1 : 1);
      const result = wardrobe.render({ mode: displayed, moving, frame: lifeSample?.move ? lifeSample.frame.cell : position.frame, gait: lifeSample?.move ? lifeSample.frame.cell : position.gaitPhase, time: motionTime, reduced, life: lifeSample, position: [point[0], point[1] + offset], flip });
      if (result) {
        head = [result.head[0], result.head[1] - offset];
        propPoint = [result.prop[0], result.prop[1] - offset];
      }
    }
    const showEffects = isUpper && !travelling;
    setAttr(effects, 'display', showEffects ? 'inline' : 'none');
    if (showEffects) {
      const phase = reduced ? 0 : time / 1000;
      libraryEffects.update({ mode, lifeSample, propPoint, phase, reduced, readOffset: house.actions.read?.offset, setAttr });
      greenhouseArt.updateEffects({ mode, lifeSample, propPoint, phase, reduced, setAttr });
    }
    const isPatting = time < patUntil;
    setAttr(hit, 'cx', head[0]);
    setAttr(hit, 'cy', head[1] + offset);
    if (isPatting) {
      const patProgress = patUntil > patStarted ? Math.max(0, Math.min(1, (time - patStarted) / (patUntil - patStarted))) : 1;
      const patAlpha = Math.sin(patProgress * Math.PI);
      heart.setAttribute('x', head[0]);
      heart.setAttribute('y', head[1] + offset - 64 - patProgress * 14);
      setAttr(heart, 'opacity', Math.round(patAlpha * 100) / 100);
      sparkle.setAttribute('x', head[0] + 26);
      sparkle.setAttribute('y', head[1] + offset - 48 - patProgress * 8);
      setAttr(sparkle, 'opacity', Math.round(patAlpha * .85 * 100) / 100);
      blushLeft.setAttribute('cx', head[0] - 15);
      blushLeft.setAttribute('cy', head[1] + offset - 22);
      setAttr(blushLeft, 'opacity', Math.round(patAlpha * .55 * 100) / 100);
      blushRight.setAttribute('cx', head[0] + 15);
      blushRight.setAttribute('cy', head[1] + offset - 22);
      setAttr(blushRight, 'opacity', Math.round(patAlpha * .55 * 100) / 100);
    } else {
      setAttr(heart, 'opacity', 0);
      setAttr(sparkle, 'opacity', 0);
      setAttr(blushLeft, 'opacity', 0);
      setAttr(blushRight, 'opacity', 0);
    }
    setAttr(resident, 'data-pet-state', isPatting ? 'head_pat' : 'idle');
  };

  svg.setRoomFloor = setFloor;
  svg.setRoomDetail = value => {
    detail = Boolean(value);
    follow = true;
    floor = residentLevel;
    updateView(1000, true);
    svg.setAttribute('data-room-floor', floor);
    syncVisibility();
    onFloor?.(floor, { detail });
    return detail;
  };
  svg.setRoomActivity = patch => {
    snapshotDirty = true;
    if (Object.hasOwn(patch, 'preview')) {
      const normalizedPreview = typeof normalizeRoomActionId === 'function' ? normalizeRoomActionId(patch.preview) : patch.preview;
      patch = { ...patch, preview: normalizedPreview };
      if (patch.preview === 'auto' && visual.preview !== 'auto') {
        const slice = Math.floor(Math.max(0, lifeClock) / 20000);
        lifeClock = slice * 20000;
      }
      if (renderFailed) {
        renderFailed = false;
        svg.removeAttribute?.('data-room-render-error');
        drawFailures = 0;
        if (life) { life.reset(); lifeMode = null; }
        currentMode = null;
        departure = null;
        travelling = false;
        lifeNeedsEntry = false;
        lifeChairEntry = false;
        lifeExit = false;
      }
      diagnostics.record('action', { mode: patch.preview });
    }
    visual = { ...visual, ...patch };
    if (patch.teleport && patch.preview) {
      const nav = roomNavigation(patch.preview), targetNode = nav.targets[patch.preview] || 'aisle', targetFloor = nav.nodes[targetNode]?.floor || 1;
      journey = createRoomJourney(nav);
      journey.go(patch.preview, motionTime);
      departure = null;
      travelling = false;
      lifeNeedsEntry = false;
      lifeChairEntry = false;
      lifeExit = false;
      if (life) { life.reset(); lifeMode = null; }
      currentMode = null;
      residentLevel = String(targetFloor);
      floor = residentLevel;
    }
    if (Object.hasOwn(patch, 'preview')) {
      follow = true;
      if (floor !== 'all' && floor !== residentLevel) {
        floor = residentLevel;
        onFloor?.(floor, { detail });
      }
    }
    paint(elapsed);
  };
  svg.setRoomOutfit = asset => {
    if (!wardrobe.set(asset)) return false;
    recoverFrame();
    svg.setAttribute('data-room-outfit', asset?.id || 'original');
    paint(elapsed);
    return true;
  };

  const pat = () => {
    patStarted = elapsed;
    patUntil = elapsed + 900;
    pausedWalk = Boolean(lifeSample?.move) || (currentMode === 'walk' && route?.arrived) || (route?.kind === 'walk' && !(departure && motionTime < departure.until));
    paint(elapsed);
  };
  svg.petRoomResident = pat;
  interaction.addEventListener('click', pat);
  interaction.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pat(); } });

  const resetFrameClock = () => {
    frameAt = null;
    if (!doc.hidden && !suspended && !disposed && resident.isConnected && requestFrame && !reduced) {
      requestTick();
    }
    if (!resident.isConnected) doc.removeEventListener?.('visibilitychange', resetFrameClock);
  };
  const tick = time => {
    framePending = false;
    if (disposed || !resident.isConnected) {
      doc.removeEventListener?.('visibilitychange', resetFrameClock);
      return;
    }
    const dt = frameAt === null ? 0 : Math.max(0, time - frameAt);
    frameAt = time;
    if (!doc.hidden && !suspended && !renderFailed) {
      elapsed += dt;
      paint(elapsed);
    }
    if (!disposed && resident.isConnected) requestTick();
  };

  svg.setRoomLifeAssets = assets => {
    if (lifeAssets && lifeAssets.version === assets?.version && lifeAssets.revision === assets?.revision || lifeLoading) return svg.roomLifeReady;
    if (!validateRoomLifeAssets(assets)) {
      diagnostics.record('asset-error', { stage: 'validate', revision: assets?.revision });
      return Promise.resolve(false);
    }
    lifeLoading = true;
    const token = ++lifeLoad, load = animation.loadRoomImage || (url => decodeRoomLifeUrl(url, doc.defaultView?.Image || globalThis.Image));
    diagnostics.record('load-start', { revision: assets.revision });
    const sources = {
      ...assets.atlases,
      greenhouse: assets.greenhouse,
      ...Object.fromEntries(['bedding', 'mattress', 'foldedQuilt', 'chairCleanplate'].filter(k => assets[k]).map(k => [k, assets[k]])),
      ...(assets.quilt ? { quilt: assets.quilt.url } : {}),
    };
    svg.roomLifeReady = Promise.all(Object.entries(sources).map(async ([asset, url]) => {
      const started = Date.now();
      try {
        await roomResourceDeadline(load(url), animation.decodeTimeoutMs ?? 15000);
        diagnostics.record('decoded', { asset, duration: Date.now() - started });
      } catch (error) {
        diagnostics.record('asset-error', { asset, stage: 'decode', error: error?.message || 'Image load failed' });
        throw error;
      }
    })).then(() => {
      if (token !== lifeLoad) return false;
      const next = createRoomChoreography(createRoomLifeDefinitions(assets.geometry));
      computerArt.applyAssets(assets);
      const walkAtlas = assets.geometry.walk;
      if (assets.atlases.walk && !walkPic.getAttribute?.('href') && walkAtlas?.width === walkAsset.width && walkAtlas?.height === walkAsset.height) {
        walkPic.setAttribute('href', assets.atlases.walk);
      }
      lifeArt?.hide();
      lifeArt = createRoomLifeArt({ document: doc, root: lifeRoot, assets });
      life = next;
      lifeAssets = assets;
      lifeMode = null;
      lifeExit = false;
      snapshotDirty = true;
      bedroomArt.applyAssets(assets);
      greenhouseArt.applyAssets(assets, occluders);
      lifeScenery.setAttribute('display', 'inline');
      svg.setAttribute('data-life-version', String(assets.version));
      paint(elapsed);
      diagnostics.record('load-ready', { revision: assets.revision });
      return true;
    }).catch(error => {
      diagnostics.record('asset-error', { stage: 'activate', error: error?.message || String(error) });
      return false;
    }).finally(() => {
      if (token === lifeLoad) lifeLoading = false;
    });
    return svg.roomLifeReady;
  };

  const roomIdentity = JSON.stringify(room.items.map(({ id, name }) => [id, name]));
  svg.getRoomRuntime = () => renderFailed
    ? (lastGoodRuntime ? structuredClone({ ...lastGoodRuntime, savedAt: Date.now() }) : null)
    : lifeAssets && journey
      ? {
          version: 1,
          revision: lifeAssets.revision,
          identity: roomIdentity,
          savedAt: Date.now(),
          preview: visual.preview,
          quiltCover,
          state: {
            elapsed, motionTime, floor, detail, currentMode, lastSource, travelling, residentLevel, follow,
            departure, lifeClock, lastPaint, route, camera, previousPortal, wanderUntil, sleepStarted, sleepSeed,
            lifeMode, lifeExit, lifeNeedsEntry, lifeChairEntry,
          },
          idle: idleEvents.snapshot(),
          journey: journey.snapshot(),
          life: life?.snapshot(),
        }
      : null;

  svg.restoreRoomRuntime = value => {
    try {
      const migrating = [17, 19].includes(value?.revision) && lifeAssets?.revision === 20;
      const compatibleRevision = value?.revision === lifeAssets?.revision || value?.revision === 17 && lifeAssets?.revision === 19 || migrating;
      if (value?.version !== 1 || value.identity !== roomIdentity || !compatibleRevision || !Number.isFinite(value.savedAt)) return false;
      const s = value.state;
      if (!s || ![s.elapsed, s.motionTime, s.lifeClock, s.lastPaint, s.sleepStarted, s.sleepSeed, s.wanderUntil].every(Number.isFinite) || !['all', '1', '2'].includes(s.floor) || !['1', '2'].includes(s.residentLevel) || !['auto', 'walk', 'sleep', 'type', 'write', 'lounge', 'read', 'enchant', 'garden', 'rest'].includes(value.preview)) return false;
      const nextJourney = createRoomJourney(roomNavigation(s.currentMode));
      nextJourney.restore(value.journey);
      const nextLife = createRoomChoreography(createRoomLifeDefinitions(lifeAssets.geometry));
      if (migrating && value.life?.mode === 'sleep') nextLife.start('sleep', s.motionTime, { settled: true });
      else nextLife.restore(value.life);
      ({ elapsed, motionTime, floor, detail, currentMode, lastSource, travelling, residentLevel, follow, departure, lifeClock, lastPaint, route, camera, previousPortal, wanderUntil, sleepStarted, sleepSeed, lifeMode, lifeExit, lifeNeedsEntry, lifeChairEntry } = s);
      quiltCover = Number.isFinite(value.quiltCover) ? Math.max(0, Math.min(1, value.quiltCover)) : 0;
      journey = nextJourney;
      life = nextLife;
      idleEvents.restore(value.idle);
      idleSample = null;
      visual.preview = value.preview;
      frameAt = null;
      pausedWalk = false;
      patUntil = 0;
      if (migrating && value.life?.mode === 'sleep') {
        lifeExit = false;
        lifeNeedsEntry = false;
        quiltCover = 1;
      }
      lastNotice = '';
      snapshotDirty = true;
      elapsed += Math.min(86400000, Math.max(0, Date.now() - value.savedAt));
      paint(elapsed);
      updateView(1000, true);
      onFloor?.(floor, { detail });
      return true;
    } catch {
      return false;
    }
  };

  paint(0);
  updateView(1000, true);
  if (requestFrame && !reduced) {
    doc.addEventListener?.('visibilitychange', resetFrameClock);
    requestTick();
  }
  if (actionAssets.lifeV10) svg.setRoomLifeAssets(actionAssets.lifeV10);
  return svg;
}
