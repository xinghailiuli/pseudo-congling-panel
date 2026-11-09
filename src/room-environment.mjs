import { createRoomDaylight } from './room-daylight.mjs';

// 模块 A-1：房屋环境、楼层画布与天光灯帘控制（Room Environment & Floor Layers）
// 职责：拥有一楼（offset 1080）与二楼（offset 0）1536×1024 局部画布挂载、星海夜空背景、底图与修补蒙版、窗口天光集成、跨层门户图层以及台灯/窗帘开关控制。

export const ROOM_FLOOR_OFFSETS = { 1: 1080, 2: 0 };

export function installRoomCosmicDefs(el, defs) {
  const skyGrad1 = el('linearGradient', { id: 'cosmic-sky-grad-1', x1: '0', y1: '0', x2: '0', y2: '1' });
  skyGrad1.append(
    el('stop', { offset: '0%', 'stop-color': '#091c38' }),
    el('stop', { offset: '45%', 'stop-color': '#051124' }),
    el('stop', { offset: '100%', 'stop-color': '#020610' }),
  );
  const skyGrad2 = el('linearGradient', { id: 'cosmic-sky-grad-2', x1: '0', y1: '0', x2: '0', y2: '1' });
  skyGrad2.append(
    el('stop', { offset: '0%', 'stop-color': '#0a1d3a' }),
    el('stop', { offset: '45%', 'stop-color': '#051125' }),
    el('stop', { offset: '100%', 'stop-color': '#020610' }),
  );
  const doorGlow = el('radialGradient', { id: 'doorstep-glow', cx: '50%', cy: '20%', r: '70%' });
  doorGlow.append(
    el('stop', { offset: '0%', 'stop-color': '#fde68a', 'stop-opacity': '0.85' }),
    el('stop', { offset: '40%', 'stop-color': '#f59e0b', 'stop-opacity': '0.5' }),
    el('stop', { offset: '100%', 'stop-color': '#f59e0b', 'stop-opacity': '0' }),
  );
  const glowFilter = el('filter', { id: 'cabin-warm-glow', x: '-15%', y: '-15%', width: '130%', height: '130%' });
  glowFilter.append(
    el('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: 4, result: 'blur1' }),
    el('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: 8, result: 'blur2' }),
    el('feFlood', { 'flood-color': '#f59e0b', 'flood-opacity': '0.5', result: 'color1' }),
    el('feFlood', { 'flood-color': '#fbbf24', 'flood-opacity': '0.25', result: 'color2' }),
    el('feComposite', { in: 'color1', in2: 'blur1', operator: 'in', result: 'glow1' }),
    el('feComposite', { in: 'color2', in2: 'blur2', operator: 'in', result: 'glow2' }),
  );
  const glowMerge = el('feMerge');
  glowMerge.append(el('feMergeNode', { in: 'glow2' }), el('feMergeNode', { in: 'glow1' }), el('feMergeNode', { in: 'SourceGraphic' }));
  glowFilter.append(glowMerge);
  const moonGlow = el('filter', { id: 'moon-glow', x: '-50%', y: '-50%', width: '200%', height: '200%' });
  moonGlow.append(el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 6, result: 'blur' }));
  const moonMerge = el('feMerge');
  moonMerge.append(el('feMergeNode', { in: 'blur' }), el('feMergeNode', { in: 'SourceGraphic' }));
  moonGlow.append(moonMerge);
  defs.append(skyGrad1, skyGrad2, doorGlow, glowFilter, moonGlow);
}

export function createRoomCosmicBackdrop(el, instance) {
  const cosmicBackdrop = el('g', { class: 'room-cosmic-backdrop', 'pointer-events': 'none' });
  const f1Backdrop = el('g', { 'data-backdrop-floor': 1 });
  f1Backdrop.append(el('rect', { x: 0, y: 1080, width: 1536, height: 1024, fill: 'url(#' + instance + 'cosmic-sky-grad-1)' }));
  f1Backdrop.append(el('path', { d: 'M 180,1214 A 16,16 0 0,0 194,1242 A 13.5,13.5 0 0,1 180,1214 Z', fill: '#e0f2fe', filter: 'url(#' + instance + 'moon-glow)', opacity: '.95' }));
  f1Backdrop.append(el('circle', { cx: 1370, cy: 1610, r: 5.5, fill: '#93c5fd', opacity: '.85' }));
  f1Backdrop.append(el('ellipse', { cx: 1370, cy: 1610, rx: 15, ry: 4.5, transform: 'rotate(-22 1370 1610)', fill: 'none', stroke: '#60a5fa', 'stroke-width': 1.2, opacity: '.75' }));
  f1Backdrop.append(el('circle', { cx: 140, cy: 1700, r: 2.5, fill: '#7dd3fc', opacity: '.6' }));
  f1Backdrop.append(el('polygon', { points: '895,1835 1005,1835 1025,1858 875,1858', fill: 'url(#' + instance + 'doorstep-glow)', opacity: '.6' }));
  const starCoordsF1 = [[80, 1150, 1.2], [130, 1380, 1.5], [240, 1140, 1], [310, 1260, 1.4], [420, 1120, 1], [600, 1130, 1.2], [780, 1115, 1.6], [920, 1135, 1], [1150, 1120, 1.4], [1300, 1180, 1.2], [1420, 1150, 1.8], [1480, 1260, 1], [1450, 1420, 1.5], [1420, 1680, 1.2], [1460, 1850, 1.5], [1380, 1980, 1.3], [1200, 2020, 1.1], [80, 1820, 1.4], [120, 1950, 1.2], [220, 2040, 1.5], [330, 1980, 1], [80, 1560, 1.6], [65, 1310, 1.2], [1490, 1540, 1.4], [1350, 1800, 1.2], [1250, 1940, 1.5], [180, 1870, 1.1], [270, 1920, 1.3], [1410, 1340, 1.6], [100, 1640, 1.2]];
  for (const [x, y, r] of starCoordsF1) f1Backdrop.append(el('circle', { cx: x, cy: y, r, fill: '#e0f2fe', opacity: (0.4 + (x % 5) * 0.12).toFixed(2), class: 'room-star' }));
  for (const [x, y] of [[110, 1280], [1440, 1290], [75, 1720], [1420, 1780], [340, 2030]]) f1Backdrop.append(el('path', { d: `M ${x - 6},${y} L ${x + 6},${y} M ${x},${y - 6} L ${x},${y + 6}`, stroke: '#bae6fd', 'stroke-width': 1.4, class: 'room-star-sparkle' }));
  const f2Backdrop = el('g', { 'data-backdrop-floor': 2 });
  f2Backdrop.append(el('rect', { x: 0, y: 0, width: 1536, height: 1024, fill: 'url(#' + instance + 'cosmic-sky-grad-2)' }));
  f2Backdrop.append(el('path', { d: 'M 1370,144 A 16,16 0 0,0 1384,172 A 13.5,13.5 0 0,1 1370,144 Z', fill: '#e0f2fe', filter: 'url(#' + instance + 'moon-glow)', opacity: '.95' }));
  f2Backdrop.append(el('circle', { cx: 140, cy: 620, r: 5, fill: '#93c5fd', opacity: '.85' }));
  f2Backdrop.append(el('ellipse', { cx: 140, cy: 620, rx: 13, ry: 4, transform: 'rotate(-22 140 620)', fill: 'none', stroke: '#60a5fa', 'stroke-width': 1.2, opacity: '.75' }));
  f2Backdrop.append(el('circle', { cx: 140, cy: 220, r: 2.2, fill: '#bae6fd', opacity: '.7' }));
  f2Backdrop.append(el('circle', { cx: 105, cy: 310, r: 1.8, fill: '#7dd3fc', opacity: '.5' }));
  const starCoordsF2 = [[80, 70, 1.2], [130, 300, 1.5], [240, 60, 1], [310, 180, 1.4], [420, 40, 1], [600, 50, 1.2], [780, 35, 1.6], [920, 55, 1], [1150, 40, 1.4], [1300, 100, 1.2], [1420, 70, 1.8], [1480, 180, 1], [1450, 340, 1.5], [1420, 600, 1.2], [1460, 770, 1.5], [1380, 900, 1.3], [1200, 940, 1.1], [80, 740, 1.4], [120, 870, 1.2], [220, 960, 1.5], [330, 900, 1], [80, 480, 1.6], [65, 230, 1.2], [1490, 460, 1.4], [1350, 720, 1.2], [1250, 860, 1.5], [180, 790, 1.1], [270, 840, 1.3], [1410, 260, 1.6], [100, 560, 1.2]];
  for (const [x, y, r] of starCoordsF2) f2Backdrop.append(el('circle', { cx: x, cy: y, r, fill: '#e0f2fe', opacity: (0.4 + (x % 5) * 0.12).toFixed(2), class: 'room-star' }));
  for (const [x, y] of [[110, 200], [1440, 210], [75, 640], [1420, 700], [340, 950]]) f2Backdrop.append(el('path', { d: `M ${x - 6},${y} L ${x + 6},${y} M ${x},${y - 6} L ${x},${y + 6}`, stroke: '#bae6fd', 'stroke-width': 1.4, class: 'room-star-sparkle' }));
  cosmicBackdrop.append(f2Backdrop, f1Backdrop);
  return cosmicBackdrop;
}

export function createRoomFloorLayers({ doc, svg, defs, el, clip, image, instance, house, offsets, animation }) {
  const floors = {}, artPictures = [], ambientWindows = [];
  const floorArt = (g, level) => {
    const basePic = image(house.floors[level], { filter: 'url(#' + instance + 'cabin-warm-glow)' });
    g.append(basePic);
    artPictures.push([basePic, level === 1 ? 'floor-one' : 'floor-two']);
    const repair = house.repairs?.[level];
    if (repair) {
      const id = 'room-repair-alpha-' + level + '-' + defs.children.length;
      const mask = el('mask', { id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: house.width, height: house.height, style: 'mask-type:alpha' });
      const maskPic = image(house.floors[level]);
      mask.append(maskPic);
      artPictures.push([maskPic, level === 1 ? 'floor-one' : 'floor-two']);
      defs.append(mask);
      const patch = el('g', { 'clip-path': clip('room-repair-' + level + '-' + defs.children.length, repair.clip), mask: 'url(#' + id + ')' });
      const picture = image(repair.url);
      patch.append(picture);
      artPictures.push([picture, level === 1 ? 'floor-one' : 'floor-two']);
      g.append(patch);
    }
    if (level === 1) {
      const daylight = createRoomDaylight({
        document: doc,
        defs,
        parent: g,
        owner: svg,
        source: house.repairs?.[1]?.url || house.floors[1],
        now: animation.wallClock,
        schedule: animation.scheduleWallClock,
        cancel: animation.cancelWallClock,
      });
      ambientWindows.push(daylight);
      artPictures.push([daylight.picture, 'floor-one']);
    }
  };
  for (const level of [2, 1]) {
    const g = el('g', { 'data-house-floor': level, transform: `translate(0,${offsets[level]})` });
    floorArt(g, level);
    svg.append(g);
    floors[level] = g;
  }
  const createPortal = () => {
    const portal = el('g', { 'data-stair-handoff': true, display: 'none', 'pointer-events': 'none' });
    const portalFloors = {};
    for (const level of [1, 2]) {
      const g = el('g');
      floorArt(g, level);
      portal.append(g);
      portalFloors[level] = g;
    }
    svg.append(portal);
    return { portal, portalFloors };
  };
  return { floors, artPictures, ambientWindows, createPortal };
}

let curtainClipSerial = 0;
export function createRoomEnvironmentControls({ svg, room, el, onLamp, onCurtain }) {
  const controls = el('g', { 'data-house-controls': true, transform: 'translate(0,1080)' });
  svg.append(controls);
  // The curtain ends at the sill, behind the monitor. Clip folds as well as cloth.
  const curtainPoints = '723,206 997,167 997,235 723,274';
  const curtainClipId = 'room-curtain-window-' + (++curtainClipSerial);
  const curtainDefs = el('defs'), curtainClip = el('clipPath', { id: curtainClipId, clipPathUnits: 'userSpaceOnUse' });
  curtainClip.append(el('polygon', { points: curtainPoints }));
  curtainDefs.append(curtainClip);controls.append(curtainDefs);
  const curtain = el('g', { 'data-curtain-overlay': true, 'clip-path': `url(#${curtainClipId})`, 'pointer-events': 'none', display: room.curtain ? 'none' : 'inline' });
  controls.append(curtain);
  curtain.append(el('polygon', { points: curtainPoints, fill: '#778eae', stroke: '#57728f', 'stroke-width': 2 }));
  for (let x = 730; x < 1000; x += 15) {
    curtain.append(el('path', { d: `M${x},${206 - (x - 723) * .142} v95`, fill: 'none', stroke: x % 2 ? '#9aafc8' : '#617d9d', 'stroke-width': 4, opacity: '.65' }));
  }
  const lampState = el('g', { 'data-lamp-overlay': true, display: room.lamp ? 'none' : 'inline' });
  lampState.append(el('polygon', { points: '737,335 757,331 764,362 740,371', fill: '#b89458', opacity: '.85' }));
  controls.append(lampState);
  const control = (kind, label, rect, fn) => {
    const g = el('g', { 'data-room-control': kind, role: 'button', tabindex: 0, 'aria-label': label, class: 'room-art-control' });
    const t = el('title', {}, label);
    g.append(t, el('rect', { x: rect[0], y: rect[1], width: rect[2], height: rect[3], fill: 'transparent', rx: 5 }));
    g.addEventListener('click', () => fn?.());
    g.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fn?.();
      }
    });
    controls.append(g);
    return { g, t };
  };
  const curtainControl = control('curtain', room.curtain ? '合上窗帘' : '拉开窗帘', [692, 164, 344, 150], onCurtain);
  const lampControl = control('lamp', room.lamp ? '关闭台灯' : '打开台灯', [730, 320, 42, 57], onLamp);
  return {
    controls,
    setRoomEnvironment({ lamp, curtain: open } = {}) {
      if (open !== undefined) {
        const v = Boolean(open), l = v ? '合上窗帘' : '拉开窗帘';
        curtain.setAttribute('display', v ? 'none' : 'inline');
        curtainControl.g.setAttribute('aria-label', l);
        curtainControl.t.textContent = l;
      }
      if (lamp !== undefined) {
        const v = Boolean(lamp), l = v ? '关闭台灯' : '打开台灯';
        lampState.setAttribute('display', v ? 'none' : 'inline');
        lampControl.g.setAttribute('aria-label', l);
        lampControl.t.textContent = l;
      }
    },
  };
}
