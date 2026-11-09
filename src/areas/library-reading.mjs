// 模块 B-2：二楼图书阅读与附魔区（Library & Reading Area）
// 职责：拥有二楼书架（read / bookshelf）与附魔台（enchant / 日记工作台）的热区配置、相机焦点、翻书与晶簇特效、姿态序列及方块屋绘制。

export const LIBRARY_READING_HOTSPOTS = {
  read: {
    id: 'read',
    level: 2,
    actionLabel: '书架翻书',
    label: '书架：翻书',
    rect: [575, 283, 108, 190],
    mark: [641, 289],
  },
  enchant: {
    id: 'enchant',
    level: 2,
    actionLabel: '附魔练习',
    label: '附魔台：附魔练习',
    furnitureLabel: '附魔台：日记',
    furnitureShort: '附魔台 · 日记',
    rect: [359, 350, 186, 153],
    mark: [391, 432],
    symbol: '记',
    pages: ['diary'],
    aliases: ['enchanting'],
  },
};

export const LIBRARY_READING_CAMERA_CENTERS = {
  read: [730, 470],
  enchant: [495, 420],
};

export const LIBRARY_READING_WORKSPACE_GROUPS = {
  enchant: { title: '附魔台：日记工作台', pages: ['diary'], aliases: ['enchanting'] },
};

export function drawLibraryReadingScenery(ctx) {
  const { scenery, rug, box, point, el, polygon } = ctx;
  scenery(2, '附魔区', g => {
    rug(g, 1.1, 1.3, 4.4, 3.1);
    box(g, 2.55, 2.2, .05, 1.5, 1.5, .65, ['#254154', '#132739', '#0e2434']);
    box(g, 2.55, 2.2, .7, 1.5, 1.5, .16, ['#bc305b', '#8d2646', '#601e38']);
    for (const [x, y] of [[2.55, 2.2], [3.72, 2.2], [2.55, 3.37], [3.72, 3.37]]) {
      box(g, x, y, .45, .33, .33, .38, ['#7adcf3', '#2babc4', '#14728e']);
    }
    const [cx, cy] = point(3.3, 2.95, 1.4);
    g.append(el('ellipse', { cx, cy: cy + 22, rx: 37, ry: 13, fill: '#a877ff', opacity: '.11' }));
    polygon(g, [[2.65, 2.6, 1.45], [3.25, 2.65, 1.28], [3.25, 3.4, 1.28], [2.65, 3.35, 1.45]], '#fff3c9');
    polygon(g, [[3.25, 2.65, 1.28], [3.85, 2.6, 1.45], [3.85, 3.35, 1.45], [3.25, 3.4, 1.28]], '#efdfb3');
    for (let i = 0; i < 6; i++) {
      const [p, q] = point(2.3 + (i % 3) * .9, 2.4 + Math.floor(i / 3) * 1.1, 1.7 + (i % 2) * .35);
      g.append(el('text', { x: p, y: q, fill: '#ccacff', 'font-family': 'monospace', 'font-size': 13, opacity: '.8' }, ['✦', '⋆', '+'][i % 3]));
    }
  });
}

export function drawLibraryReadingItem(item, ctx) {
  const { draw, box, face, side, plant, wood, dark } = ctx;
  const bookshelf = (g, x, y, w = 4.5) => {
    box(g, x, y, 0, w, .75, 2.9, dark);
    for (let z = .12; z < 2.7; z += .85) {
      box(g, x + .06, y + .04, z, w - .12, .8, .12, wood);
      for (let i = .18; i < w - .15; i += .25) {
        const color = ['#3d7794', '#a93e59', '#80a34c', '#d2a449', '#8761a0'][Math.round(i * 19 + z * 5) % 5];
        box(g, x + i, y + .29, z + .12, .19, .43, .5 + (Math.round(i * 10) % 3) * .07, [color, color, '#4d4351']);
        face(g, x + i + .02, y + .73, z + .26, .15, .035, '#d5b970');
      }
    }
  };
  if (item.name === '书架') {
    draw(item, 2, 1, g => {
      bookshelf(g, .85, .55, 4.8);
      for (const [x, depth] of [[.85, 2.4], [5.15, 1.65]]) {
        box(g, x, 1.25, 0, .7, depth, 2.9, dark);
        for (let z = .12; z < 2.7; z += .85) {
          box(g, x, 1.25, z, .76, depth, .12, wood);
          for (let y = 1.4; y < 1.25 + depth - .1; y += .25) {
            const color = ['#487f9a', '#b04d69', '#8fa34d', '#d2a449'][Math.round(y * 20 + z * 5) % 4];
            box(g, x + .22, y, z + .12, .48, .19, .55, [color, color, color]);
            side(g, x + .71, y + .02, z + .28, .15, .035, '#d7b669');
          }
        }
      }
    });
    return true;
  }
  if (item.name === '绿萝') {
    draw(item, 1, 17, g => plant(g, 10.5, 8.7, 0, 1));
    return true;
  }
  return false;
}

export function createLibraryReadingEffects({ el, effects }) {
  const sparkles = [];
  for (let i = 0; i < 6; i++) {
    const star = el('path', { d: 'M-4,0 H4 M0,-4 V4', stroke: '#dcacff', 'stroke-width': 2, fill: 'none' });
    effects.append(star);
    sparkles.push(star);
  }
  const page = el('path', { fill: '#fff9da', stroke: '#c6a879', 'stroke-width': .7 });
  effects.append(page);
  return {
    sparkles,
    page,
    update({ mode, lifeSample, propPoint, phase, reduced, readOffset, setAttr }) {
      sparkles.forEach((star, i) => {
        const show = mode === 'enchant' && (!lifeSample || lifeSample.prop === 'crystal');
        setAttr(star, 'display', show ? 'inline' : 'none');
        if (show) {
          star.setAttribute('transform', 'translate(' + ((propPoint?.[0] ?? 450) - 28 + i * 10) + ',' + ((propPoint?.[1] ?? 345) + (i % 3) * 7 - Math.sin(phase * 2 + i) * 8) + ')');
          star.setAttribute('opacity', .4 + .5 * Math.abs(Math.sin(phase + i)));
        }
      });
      const showPage = mode === 'read' && !lifeSample;
      setAttr(page, 'display', showPage ? 'inline' : 'none');
      if (showPage) {
        page.setAttribute('transform', 'translate(' + (readOffset || [0, 0]).join(',') + ')');
        page.setAttribute('d', 'M701,455 Q' + (710 + Math.sin(phase) * 8) + ',442 727,465 L726,471 Q711,453 701,455');
        page.setAttribute('opacity', reduced ? 0 : .2 + .45 * Math.max(0, Math.sin(phase * .7)));
      }
    },
  };
}

export function installLibraryReadingSequences({ make, step, sequence }) {
  for (const mode of ['read', 'enchant']) {
    const { def, add } = make(mode, 'upper');
    const base = mode === 'read' ? [704, 535] : [548, 510];
    add('stand', 6, base);
    add('lower', 23, base, 'feet', [.48, .98]);
    if (mode === 'read') {
      for (let i = 0; i < 6; i++) add('u' + i, i, base, 'feet', [.48, .98], { prop: 'book' });
      def.still = 'u2';
      def.entry = sequence(['stand', 'u0', 'u1'], 450);
      def.variations = [{
        name: '读完这一页，再慢慢翻过去',
        frames: [step('u2', 14000), step('u3', 800), step('u4', 18000), step('u2', 16000), step('u3', 800), step('u4', 18000)],
      }];
      for (const id of Object.keys(def.poses)) {
        def.exits[id] = id === 'stand' ? [] : sequence(['u5', 'stand'], 220);
      }
    } else {
      for (let i = 6; i < 12; i++) add('u' + i, i, base, 'feet', [.48, .98], { prop: i >= 8 && i <= 10 ? 'crystal' : null });
      def.still = 'u7';
      def.entry = sequence(['stand', 'u7'], 450);
      def.variations = [{
        name: '看一会书，再试一次小魔法',
        frames: [step('u7', 14000), step('u8', 1500), step('u9', 5500), step('u10', 1500), step('u11', 16000)],
      }];
      for (const [id, pose] of Object.entries(def.poses)) {
        def.exits[id] = id === 'stand' ? [] : sequence(pose.prop ? ['u10', 'u11', 'stand'] : ['u11', 'stand'], 200);
      }
    }
  }
}

export const LIBRARY_READING_AREA = {
  id: 'library-reading',
  floor: 2,
  title: '图书阅读区',
  hotspots: LIBRARY_READING_HOTSPOTS,
  cameraCenters: LIBRARY_READING_CAMERA_CENTERS,
  workspaceGroups: LIBRARY_READING_WORKSPACE_GROUPS,
  drawScenery: drawLibraryReadingScenery,
  drawItem: drawLibraryReadingItem,
  createEffects: createLibraryReadingEffects,
  installSequences: installLibraryReadingSequences,
};
