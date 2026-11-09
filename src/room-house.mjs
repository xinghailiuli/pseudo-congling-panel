import { drawStorageWorkbenchScenery, drawStorageWorkbenchItem, drawLibraryReadingScenery, drawLibraryReadingItem, drawGreenhouseTerraceScenery, drawGreenhouseTerraceItem, drawComputerWorkspaceItem, drawLivingLoungeScenery, drawLivingLoungeItem, drawBedroomSleepScenery, createBedroomBlanketDrawer, drawBedroomSleepItem } from './areas/area-registry.mjs';

// 模块 A（方块屋壳体）：负责双层木屋的基础建筑壳体、楼板、横梁、公共楼梯与未归类自定义物品兜底，各功能区域家具与布景由 src/areas/* 模块提供。
export function createRoomHouse(room, doc, { onLamp, onCurtain } = {}) {
  const el = (tag, attrs = {}, text) => {
    const n = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const svg = el('svg', { viewBox: '0 660 1100 710', class: 'room-scene block-room', role: 'group', 'aria-label': '琉璃的小鲸鱼双层小屋，一楼起居与生产，二楼休息与魔法', 'data-room-size': '14x10', 'data-room-floors': '2' });
  svg.append(el('title', {}, '琉璃的小鲸鱼双层小屋 · 橡木与白桦木'));
  const point = (x, y, z = 0) => [450 + (x - y) * 38, 157 + (x + y) * 15 - z * 32];
  const polygon = (g, ps, fill, attrs = {}) => {
    const n = el('polygon', { points: ps.map(p => point(...p).join(',')).join(' '), fill, ...attrs });
    g.append(n);
    return n;
  };
  const line = (g, a, b, color = '#785027', width = 1, attrs = {}) => {
    const p = point(...a), q = point(...b);
    g.append(el('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], stroke: color, 'stroke-width': width, ...attrs }));
  };
  const box = (g, x, y, z, w, d, h, c) => {
    const edge = { stroke: '#51371d', 'stroke-opacity': '.27', 'stroke-width': '.65', 'stroke-linejoin': 'round' };
    polygon(g, [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]], c[1], edge);
    polygon(g, [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]], c[2], edge);
    polygon(g, [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]], c[0], edge);
  };
  const top = (g, x, y, z, w, d, c, attrs = {}) => polygon(g, [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]], c, attrs);
  const face = (g, x, y, z, w, h, c, attrs = {}) => polygon(g, [[x, y, z], [x + w, y, z], [x + w, y, z + h], [x, y, z + h]], c, attrs);
  const side = (g, x, y, z, d, h, c, attrs = {}) => polygon(g, [[x, y, z], [x, y + d, z], [x, y + d, z + h], [x, y, z + h]], c, attrs);
  const wood = ['#c58b48', '#a76b33', '#7a4b26'], dark = ['#9b652e', '#70451f', '#50321b'], cream = ['#f4e8ce', '#ddc9a8', '#bfaa8b'], blue = ['#a0bde8', '#7896c6', '#556f9b'], ink = ['#48526a', '#2a3246', '#1b2434'];
  const items = Array.isArray(room.items) ? room.items : [], has = n => items.some(i => i.name === n), drawings = [], staticKeyboard = [];
  const floors = {};
  const lantern = (g, x, y, z = 1.4) => {
    const [cx, cy] = point(x + .18, y + .18, z + .38);
    g.append(el('circle', { cx, cy, r: 32, fill: '#ffc85e', opacity: '.09' }), el('circle', { cx, cy, r: 17, fill: '#ffdf85', opacity: '.15' }));
    box(g, x, y, z, .37, .37, .12, dark);
    box(g, x + .04, y + .04, z + .12, .29, .29, .52, ['#fff5b6', '#ffe395', '#efb84f']);
    box(g, x, y, z + .64, .37, .37, .12, dark);
    for (const dx of [0, .31]) for (const dy of [0, .31]) box(g, x + dx, y + dy, z + .12, .055, .055, .52, wood);
    box(g, x + .13, y + .13, z + .76, .1, .1, .16, dark);
  };
  const plant = (g, x, y, z = 0, s = 1) => {
    box(g, x, y, z, .65 * s, .65 * s, .55 * s, ['#ede2cc', '#d4bda1', '#a98f70']);
    box(g, x - .03 * s, y - .03 * s, z + .46 * s, .71 * s, .71 * s, .13 * s, cream);
    top(g, x + .08 * s, y + .08 * s, z + .6 * s, .49 * s, .49 * s, '#574531');
    line(g, [x + .3 * s, y + .3 * s, z + .5 * s], [x + .3 * s, y + .3 * s, z + 1.55 * s], '#618052', 3);
    for (let j = 0; j < 7; j++) {
      const a = j * 2.4, dx = Math.cos(a) * .39 * s, dy = Math.sin(a) * .39 * s, dz = (.82 + j * .1) * s, p = point(x + .3 * s + dx, y + .3 * s + dy, z + dz);
      g.append(el('ellipse', { cx: p[0], cy: p[1], rx: 10 * s, ry: 4.8 * s, fill: ['#688e49', '#89a859', '#527942'][j % 3], transform: `rotate(${a * 45},${p[0]},${p[1]})` }));
    }
  };
  const rug = (g, x, y, w, d) => {
    top(g, x, y, .04, w, d, '#7d96b7');
    top(g, x + .12, y + .12, .055, w - .24, d - .24, '#b7c7db');
    for (let u = .16; u < w - .2; u += .6) {
      for (let v = .16; v < d - .2; v += .6) {
        top(g, x + u, y + v, .06, Math.min(.58, w - u - .15), Math.min(.58, d - v - .15), ['#b3c6e0', '#d2dbdf', '#8da9cd'][(Math.floor(u / .6) + Math.floor(v / .6)) % 3]);
      }
    }
  };
  const beams = g => {
    for (const [x, y] of [[0, 0], [13.55, 0], [0, 9.55], [13.55, 9.55]]) {
      const h = x === 13.55 && y === 9.55 ? 1.45 : 4.35;
      box(g, x, y, 0, .45, .45, h, dark);
      box(g, x - .07, y - .07, h, .59, .59, .32, wood);
      for (let z = .3; z < h; z += .72) {
        face(g, x + .09, y + .46, z, .25, .035, '#94612f');
        side(g, x + .46, y + .07, z, .27, .035, '#62431f');
      }
    }
  };
  const makeFloor = (level, offset) => {
    const g = el('g', { 'data-house-floor': level, transform: `translate(0,${offset})` });
    svg.append(g);
    floors[level] = g;
    polygon(g, [[-.2, -.2, -.52], [14.5, -.2, -.52], [14.5, 10.5, -.52], [-.2, 10.5, -.52]], '#526079', { opacity: '.09' });
    box(g, 0, 0, -.46, 14, 10, .46, wood);
    for (let y = 0; y < 10; y += .5) {
      for (let x = 0; x < 14; x += 1) {
        const xx = x, shade = ['#edcf99', '#f1d7a5', '#f5ddb0', '#e9c890'][(x * 7 + Math.round(y * 2) * 3) % 4];
        top(g, xx + .015, y + .012, .012, .97, .476, shade);
        top(g, xx + .08, y + .15, .019, .64, .012, '#d8b57c');
        top(g, xx + .34, y + .32, .02, .48, .009, '#e3bd84');
      }
    }
    const wall = el('g');
    g.append(wall);
    for (let z = .12; z < 4; z += .45) {
      for (let x = .3; x < 13.7; x += 1.1) box(wall, x, 0, z, 1.09, .24, .43, [wood[0], ['#b87938', '#bd8341', '#b77c3a'][Math.round(x + z) % 3], wood[2]]);
      for (let y = .3; y < 9.7; y += 1.1) box(wall, 0, y, z, .24, 1.09, .43, [wood[0], wood[1], ['#98612e', '#a16a31', '#a97135'][Math.round(y + z) % 3]]);
    }
    box(wall, 0, 0, 4.05, 14, .4, .25, wood);
    box(wall, 0, .4, 4.05, .4, 9.6, .25, wood);
    beams(wall);
    for (const p of [[.6, .6, 2.7], [6.2, .5, 2.9], [13, .6, 2.7], [.5, 9.1, 1.2], [12.9, 9.3, .9]]) lantern(g, ...p);
    const label = el('g', { 'pointer-events': 'none' });
    label.append(
      el('rect', { x: 42, y: 44, width: 210, height: 56, rx: 12, fill: '#f8f4e9', stroke: '#e0d7bf' }),
      el('text', { x: 59, y: 68, fill: '#224162', 'font-size': 18, 'font-weight': 700 }, level === 1 ? '一楼 · 起居与生产' : '二楼 · 休息与魔法'),
      el('text', { x: 59, y: 87, fill: '#8d7f67', 'font-size': 10, 'letter-spacing': 1.7 }, level === 1 ? 'LIVING / WORKSHOP' : 'REST / ENCHANTMENT'),
    );
    g.append(label);
    return g;
  };
  const upstairs = makeFloor(2, 0), downstairs = makeFloor(1, 660);
  const control = (g, kind, label, fn) => {
    for (const [k, v] of Object.entries({ 'data-room-control': kind, role: 'button', tabindex: 0, 'aria-label': label, class: 'block-object block-control' })) g.setAttribute(k, v);
    g.addEventListener('click', () => fn?.());
    g.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fn?.();
      }
    });
  };
  const draw = (item, level, depth, fn) => {
    const g = el('g', { 'data-room-item': item.id, class: 'block-object', 'data-object-floor': level });
    g.append(el('title', {}, `${item.name}${item.state ? ' · ' + item.state : ''}`));
    drawings.push({ g, level, depth, fn, itemName: item.name });
  };
  const foreground = [];
  const scenery = (level, name, fn) => {
    const g = el('g', { 'data-house-feature': name });
    g.append(el('title', {}, name));
    if (name === '附魔区') foreground.push({ level, g });
    else floors[level].append(g);
    fn(g);
    return g;
  };
  const stairs = (g, upper = false) => {
    if (upper) {
      const clip = el('clipPath', { id: 'room-stair-opening' });
      top(clip, 11.65, 5.2, .04, 1.85, 4.2, '#fff');
      svg.append(clip);
      const steps = el('g', { 'clip-path': 'url(#room-stair-opening)' });
      g.append(steps);
      top(steps, 11.65, 5.2, .04, 1.85, 4.2, '#5a3b25');
      for (let j = 0; j < 9; j++) {
        const y = 8.9 - j * .46, z = -2.52 + j * .28;
        box(steps, 11.65, y, -2.8, 1.85, .48, z + 2.8, wood);
        top(steps, 11.67, y + .015, z + .01, 1.8, .42, '#cfac77');
      }
      for (let y = 5.15; y < 9.5; y += .84) box(g, 11.43, y, 0, .16, .16, 1, wood);
      box(g, 11.4, 5.1, 1, .23, 4.45, .16, wood);
      box(g, 11.4, 5.1, 0, 2.35, .18, 1, dark);
      box(g, 11.4, 5.1, 1, 2.35, .24, .16, wood);
    } else {
      for (let j = 0; j < 9; j++) {
        const y = 8.9 - j * .46, z = j * .28;
        box(g, 11.65, y, 0, 1.85, .48, z + .28, wood);
        top(g, 11.67, y + .015, z + .29, 1.8, .42, '#f0d19c');
      }
      for (let j = 0; j < 5; j++) {
        const y = 9.05 - j * .94;
        box(g, 13.65, y, 0, .18, .18, 1 + j * .56, dark);
      }
      for (let j = 0; j < 8; j++) line(g, [13.75, 9 - j * .46, 1.1 + j * .28], [13.75, 8.54 - j * .46, 1.38 + j * .28], '#a8753e', 7);
    }
  };

  const ctx = {
    room, el, point, polygon, line, box, top, face, side,
    wood, dark, cream, blue, ink, has, rug, plant, lantern,
    control, draw, scenery, staticKeyboard, onLamp, onCurtain,
  };

  // 由 6 大功能区域模块绘制各自区域的固定布景 + 公共楼梯布景
  drawStorageWorkbenchScenery(ctx);
  drawLibraryReadingScenery(ctx);
  drawGreenhouseTerraceScenery(ctx);
  scenery(1, '通往二楼的橡木楼梯', g => stairs(g));
  scenery(2, '楼梯口与护栏', g => stairs(g, true));
  drawLivingLoungeScenery(ctx);
  drawBedroomSleepScenery(ctx);

  const blanket = createBedroomBlanketDrawer(ctx);
  let custom = 0;
  for (const item of items) {
    const handled =
      drawBedroomSleepItem(item, ctx, blanket) ||
      drawLibraryReadingItem(item, ctx) ||
      drawGreenhouseTerraceItem(item, ctx) ||
      drawComputerWorkspaceItem(item, ctx) ||
      drawStorageWorkbenchItem(item, ctx) ||
      drawLivingLoungeItem(item, ctx);
    if (!handled) {
      const i = custom++;
      draw(item, 1, 18 + i * .01, g => {
        const x = 5.5 + (i % 3) * .66, y = 8.8 + Math.floor((i % 6) / 3) * .6, z = Math.floor(i / 6) * .4;
        box(g, x, y, z, .57, .5, .35, wood);
        face(g, x + .22, y + .51, z + .1, .1, .13, '#e8d5a4');
      });
    }
  }
  drawings.sort((a, b) => a.depth - b.depth);
  for (const d of drawings) {
    d.fn(d.g);
    floors[d.level].append(d.g);
  }
  for (const feature of foreground) floors[feature.level].append(feature.g);
  // Low foreground beams leave both floors readable and expose the front door.
  for (const g of [upstairs, downstairs]) {
    box(g, 0, 9.85, 0, 6.5, .22, .3, wood);
    box(g, 9.3, 9.85, 0, 4.7, .22, .3, wood);
    box(g, 13.8, .3, 0, .2, 9.4, .3, wood);
    for (const x of [6.35, 9.3]) {
      box(g, x, 9.7, 0, .35, .35, .8, dark);
      box(g, x - .03, 9.67, .8, .41, .41, .15, wood);
    }
    top(g, 6.7, 9.4, .03, 2.4, .55, '#a6b4be');
  }
  return { svg, el, point, floors, drawings, staticKeyboard, blanket, anchors: { work: [8.85, 2.55, 1.51], sofa: [7.95, 7.7, .96], bed: [2.42, 6.65, 1.15] } };
}
