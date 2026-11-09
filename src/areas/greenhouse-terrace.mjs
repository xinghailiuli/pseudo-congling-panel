// 模块 B-3：二楼温室种植与露台区（Greenhouse & Terrace Area）
// 职责：拥有二楼小麦温室（garden）与露台长椅（rest）的热区配置、前景遮挡、温室表面与茶杯道具、水滴与落叶特效、姿态序列及方块屋绘制。

export const GREENHOUSE_TERRACE_HOTSPOTS = {
  garden: {
    id: 'garden',
    level: 2,
    actionLabel: '照料小麦',
    label: '小麦温室：照料小麦',
    rect: [894, 311, 415, 215],
    mark: [1253, 363],
  },
  rest: {
    id: 'rest',
    level: 2,
    actionLabel: '露台歇脚',
    label: '露台：坐下歇脚',
    rect: [967, 650, 305, 105],
    mark: [1211, 714],
  },
};

export const GREENHOUSE_TERRACE_CAMERA_CENTERS = {
  garden: [1090, 425],
  rest: [1090, 670],
};

export const GREENHOUSE_TERRACE_OCCLUDERS = [
  {
    name: 'greenhouse-rail',
    level: 2,
    polygons: [
      '955,495 1318,456 1324,503 958,549',
      '1066,485 1080,477 1092,486 1092,537 1077,542 1067,532',
      '1175,472 1188,464 1202,471 1202,521 1187,526 1176,518',
    ],
    when: p => p.x > 953 && p.x < 1310 && p.y < 543,
    useRepair: true,
  },
  {
    name: 'upper-gate-post',
    level: 2,
    polygons: ['772,477 787,467 803,474 805,515 792,523 776,512'],
    when: p => p.x > 765 && p.x < 910 && p.y < 558,
    useRepair: true,
  },
  {
    name: 'life-garden',
    level: 2,
    polygons: [
      '939,504 1085,484 1086,518 945,551',
      '1168,471 1321,452 1322,499 1168,520',
    ],
    when: p => p.y < 535,
    useRepair: false,
  },
];

export function drawGreenhouseTerraceScenery(ctx) {
  const { scenery, box, top, line, side, face, plant, wood, cream } = ctx;
  scenery(2, '小麦温室', g => {
    box(g, 7.2, .8, 0, 5.1, 4.3, .3, wood);
    top(g, 7.4, 1, .31, 4.7, 3.9, '#755434');
    top(g, 9.25, 2.3, .32, 1.05, 1.05, '#329acf');
    top(g, 9.38, 2.45, .33, .75, .12, '#8ce0ef');
    for (let x = 7.6; x < 12; x += .4) {
      for (let y = 1.2; y < 4.7; y += .4) {
        if (x >= 9.1 && x < 10.5 && y >= 2.1 && y < 3.5) continue;
        const h = .65 + ((Math.round(x * 10) + Math.round(y * 10)) % 3) * .12;
        line(g, [x, y, .32], [x, y, .32 + h], '#c8ac43', 2);
        for (let z = .55; z < h + .3; z += .18) {
          line(g, [x, y, z], [x - .1, y, z + .14], '#e8bd45', 3);
          line(g, [x, y, z + .05], [x + .1, y, z + .19], '#f2d267', 3);
        }
      }
    }
    for (const x of [7.25, 12.15]) for (const y of [.85, 4.95]) box(g, x, y, .3, .1, .1, 2.75, cream);
    for (let x = 7.25; x < 12.2; x += 1.23) {
      line(g, [x, .85, 3.05], [x, 4.95, 3.05], '#a9cad3', 2);
      line(g, [x, 4.95, .35], [x, 4.95, 3.05], '#a9cad3', 2);
    }
    for (let y = .85; y < 5; y += 1.025) {
      line(g, [7.25, y, 3.05], [12.25, y, 3.05], '#bed7dc', 2);
      line(g, [12.25, y, .35], [12.25, y, 3.05], '#acc8cc', 2);
    }
    top(g, 7.3, .9, 3, 4.9, 4, '#c8eafa', { opacity: '.12' });
    side(g, 12.2, .9, .35, 4, 2.7, '#c8eafa', { opacity: '.1' });
    face(g, 7.3, 4.95, .35, 4.9, 2.7, '#c8eafa', { opacity: '.08' });
    for (const [x, y] of [[8.1, 4.96], [10.5, 4.96]]) {
      line(g, [x, y, 1.8], [x + .55, y, 2.65], '#eaf9ff', 2, { opacity: '.65' });
    }
    plant(g, 6.4, 4.2, 0, .8);
  });
}

export function drawGreenhouseTerraceItem(item, ctx) {
  const { draw, control, room, onCurtain, box, face, cream, dark, blue } = ctx;
  if (item.name === '窗') {
    draw(item, 1, 0, g => {
      control(g, 'curtain', room.curtain ? '合上窗帘' : '拉开窗帘', onCurtain);
      box(g, 6.8, .25, 1.65, 4.8, .13, 2, dark);
      face(g, 6.95, .39, 1.8, 4.5, 1.68, room.curtain ? '#91c2d2' : '#7d98ba');
      if (room.curtain) {
        face(g, 6.95, .4, 1.8, 4.5, .5, '#83a67f');
        for (let x = 7.1; x < 11.3; x += .56) {
          face(g, x, .41, 1.9, .4, .45 + (Math.round(x * 10) % 3) * .16, ['#9fbc85', '#618c70', '#c2cf9b'][Math.round(x * 10) % 3]);
        }
        face(g, 9.4, .42, 2.9, .44, .44, '#f9ecc2');
      } else {
        for (let x = 6.95; x < 11.45; x += .28) face(g, x, .42, 1.8, .22, 1.68, '#9cb0ca');
      }
      for (const x of [8.45, 9.95]) box(g, x, .44, 1.8, .08, .09, 1.68, cream);
      box(g, 6.95, .44, 2.65, 4.5, .09, .08, cream);
      for (const x of [6.7, 11.4]) box(g, x, .45, 1.55, .3, .15, 2.2, blue);
    });
    return true;
  }
  return false;
}

export function createGreenhouseTerraceArt({ el, clip, image, lifeScenery, effects }) {
  const gardenPatch = el('g', { 'clip-path': clip('room-life-garden', '879,246 1266,202 1342,446 1322,551 927,584 879,489') });
  const gardenPicture = image();
  gardenPatch.append(gardenPicture);
  lifeScenery.append(gardenPatch);

  const bench = el('g', { 'data-life-bench': true });
  lifeScenery.append(bench);
  for (const [points, fill] of [
    ['1086,657 1160,644 1201,665 1127,680', '#c38c53'],
    ['1127,680 1201,665 1201,675 1127,691', '#87552e'],
    ['1086,657 1127,680 1127,691 1086,668', '#a66b36'],
    ['1096,668 1108,675 1108,711 1096,705', '#704522'],
    ['1180,675 1191,672 1191,707 1180,711', '#704522'],
  ]) {
    bench.append(el('polygon', { points, fill, stroke: '#704b2b', 'stroke-width': 1 }));
  }

  const cupRest = el('g', { 'data-life-cup': true });
  cupRest.append(
    el('ellipse', { cx: 1182, cy: 661, rx: 8, ry: 3, fill: '#634527', opacity: .25 }),
    el('path', { d: 'M1177,650 h10 l-1,10 q-4,3 -8,0 Z M1187,651 q8,-1 6,6 l-6,1', fill: '#609bc1', stroke: '#315d7d', 'stroke-width': 1.2 }),
    el('ellipse', { cx: 1182, cy: 650, rx: 5, ry: 2, fill: '#422e20' }),
  );
  lifeScenery.append(cupRest);
  cupRest.setAttribute('transform', 'translate(-94,4)');

  const droplets = [];
  for (let i = 0; i < 4; i++) {
    const drop = el('ellipse', { rx: 1.9, ry: 3.2, fill: '#b5f0ff' });
    effects.append(drop);
    droplets.push(drop);
  }
  const leaf = el('path', { d: 'M-7,0 Q0,-8 8,0 Q0,7 -7,0', fill: '#abd08b', opacity: .7 });
  effects.append(leaf);

  return {
    gardenPatch,
    gardenPicture,
    bench,
    cupRest,
    droplets,
    leaf,
    updateProps(lifeSample) {
      cupRest.setAttribute('display', lifeSample?.mode === 'rest' && lifeSample.prop === 'cup' ? 'none' : 'inline');
    },
    updateEffects({ mode, lifeSample, propPoint, phase, reduced, setAttr }) {
      const pouring = mode === 'garden' && (!lifeSample || lifeSample.frame.atlas === 'garden' && [8, 9].includes(lifeSample.frame.cell));
      droplets.forEach((drop, i) => {
        setAttr(drop, 'display', pouring ? 'inline' : 'none');
        if (pouring) {
          const d = (phase * 1.2 + i * .25) % 1;
          drop.setAttribute('cx', (propPoint?.[0] ?? 1036) - d * 18 * (lifeSample?.frame.flip || 1));
          drop.setAttribute('cy', (propPoint?.[1] ?? 389) + d * 24);
          drop.setAttribute('opacity', reduced ? .5 : 1 - d);
        }
      });
      setAttr(leaf, 'display', mode === 'rest' ? 'inline' : 'none');
      if (mode === 'rest') {
        leaf.setAttribute('transform', 'translate(' + (1200 + Math.sin(phase * .6) * 25) + ',' + (645 + Math.sin(phase) * 12) + ') rotate(' + phase * 9 + ')');
      }
    },
    applyAssets(assets, occluders) {
      gardenPicture.setAttribute('href', assets.greenhouse);
      const gardenMask = occluders.find(x => x.name === 'life-garden');
      if (gardenMask) gardenMask.picture.setAttribute('href', assets.greenhouse);
    },
  };
}

export function installGreenhouseTerraceSequences({ make, step, sequence, route }) {
  {
    const { def, add } = make('garden', 'garden');
    const home = [1120, 563], tool = [1045, 555], gate = [1124, 548], near = [1116, 510], far = [1074, 408];
    add('home', 23, home);
    add('tool-empty', 13, tool);
    const approach = route(add, 'approach', [home, tool]), paths = {};
    for (const prop of ['can', 'hoe', null]) {
      const key = prop || 'empty', r = route(add, key, [tool, gate, near, far], prop, Boolean(prop));
      paths[key] = r;
    }
    for (const [name, at] of [['tool', tool], ['far', far], ['near', near]]) {
      for (const cell of [0, 1, 2, 6, 7, 8, 9, 10, 11, 12]) add(name + '-can-' + cell, cell, at, 'feet', [.48, .98], { prop: 'can', flip: name === 'near' ? -1 : 1 });
      for (const cell of [14, 15, 16, 17]) add(name + '-hoe-' + cell, cell, at, 'feet', [.48, .98], { prop: 'hoe' });
      for (const cell of [18, 19, 20, 21, 22, 23]) add(name + '-weed-' + cell, cell, at, 'feet', [.48, .98], { prop: cell === 20 ? 'weed' : null });
    }
    const nearIndex = paths.can.positions.findIndex(p => p[0] === near[0] && p[1] === near[1]);
    const homeward = approach.backSteps(approach.positions.length - 1), back = r => r.backSteps(r.positions.length - 1);
    const putCan = [...sequence(['tool-can-12', 'tool-can-0', 'tool-empty'], 400)];
    const putHoe = sequence(['tool-hoe-16', 'tool-hoe-14', 'tool-empty'], 400);
    def.still = 'home';
    def.entry = [step('home', 180), ...approach.steps, step('tool-empty', 180)];
    def.variations = [
      { name: '提壶进入菜园，慢慢浇透土壤', frames: [...sequence(['tool-can-0', 'tool-can-1', 'tool-can-2'], 550), ...paths.can.steps, ...sequence(['far-can-6', 'far-can-7', 'far-can-8'], 650), step('far-can-9', 10000), ...sequence(['far-can-10', 'far-can-11'], 650), ...paths.can.backward.slice(nearIndex).reverse().map(id => step(id, 86, true)), ...sequence(['near-can-6', 'near-can-7', 'near-can-8'], 650), step('near-can-9', 8000), ...sequence(['near-can-10', 'near-can-11'], 650), ...paths.can.backSteps(nearIndex), ...putCan, step('tool-empty', 3500)] },
      { name: '扶稳小锄头，一下一下松土', frames: [...sequence(['tool-hoe-14', 'tool-hoe-15'], 600), ...paths.hoe.steps, step('far-hoe-14', 3500), ...sequence(['far-hoe-15', 'far-hoe-16', 'far-hoe-17'], 1200), step('far-hoe-14', 5000), ...sequence(['far-hoe-15', 'far-hoe-16', 'far-hoe-17'], 1200), step('far-hoe-14', 4000), ...back(paths.hoe), ...putHoe, step('tool-empty', 3500)] },
      { name: '蹲下来仔细拔掉杂草', frames: [...paths.empty.steps, step('far-weed-18', 900), ...sequence(['far-weed-19', 'far-weed-20', 'far-weed-21'], 1800), step('far-weed-19', 6000), ...sequence(['far-weed-20', 'far-weed-21'], 1800), step('far-weed-19', 5000), ...sequence(['far-weed-22', 'far-weed-23'], 700), ...back(paths.empty), step('tool-empty', 3500)] },
    ];
    const indexFor = (r, at) => r.positions.reduce((best, p, i) => Math.hypot(p[0] - at[0], p[1] - at[1]) < Math.hypot(r.positions[best][0] - at[0], r.positions[best][1] - at[1]) ? i : best, 0);
    for (const [id, pose] of Object.entries(def.poses)) {
      if (id === 'home') { def.exits[id] = []; continue; }
      if (pose.route === 'approach') { def.exits[id] = [...approach.backSteps(pose.routeIndex), step('home', 120)]; continue; }
      const prop = pose.prop, key = prop === 'can' ? 'can' : prop === 'hoe' ? 'hoe' : 'empty', r = paths[key], idx = indexFor(r, pose.at);
      const weed = id.includes('-weed-') && pose.cell < 23 ? [...(prop === 'weed' ? [step((pose.at[1] < 500 ? 'far' : 'near') + '-weed-21', 180)] : []), step((pose.at[1] < 500 ? 'far' : 'near') + '-weed-22', 180), step((pose.at[1] < 500 ? 'far' : 'near') + '-weed-23', 180)] : [];
      const place = pose.at[1] < 500 ? 'far' : pose.at[1] < 540 ? 'near' : 'tool';
      const lower = prop === 'can' && !pose.route && pose.cell >= 6 && pose.cell <= 9 ? sequence([place + '-can-10', place + '-can-11'], 180) : prop === 'hoe' && !pose.route ? sequence([place + '-hoe-14'], 180) : [];
      def.exits[id] = [...lower, ...weed, ...r.backSteps(idx), ...(prop === 'can' ? putCan : prop === 'hoe' ? putHoe : []), ...homeward, step('home', 120)];
    }
  }
  {
    const { def, add } = make('rest', 'upper');
    const base = [1102, 736];
    add('stand', 6, base);
    add('lower', 23, [1120, 740], 'feet', [.48, .98]);
    for (let i = 12; i <= 22; i++) add('u' + i, i, [1140, 661], 'hips', [.51, .77], { prop: i >= 13 && i <= 17 ? 'cup' : null });
    def.still = 'u12';
    def.entry = sequence(['stand', 'lower', 'u12'], 450);
    def.variations = [
      { name: '坐着看看风景，偶尔喝一口水', frames: [step('u12', 25000), step('u13', 800), step('u14', 1600), step('u15', 2200), step('u16', 900), step('u17', 900), step('u18', 20000)] },
      { name: '歇一会，轻轻动动脚', frames: [step('u19', 1500), step('u20', 1500), step('u18', 20000), step('u19', 1500), step('u20', 1500), step('u18', 16000), step('u21', 1600), step('u22', 3000)] },
    ];
    for (const [id, pose] of Object.entries(def.poses)) {
      def.exits[id] = id === 'stand' ? [] : sequence([...(pose.prop ? ['u16', 'u17'] : []), 'u18', 'lower', 'stand'], 220);
    }
  }
}

export const GREENHOUSE_TERRACE_AREA = {
  id: 'greenhouse-terrace',
  floor: 2,
  title: '温室种植区',
  hotspots: GREENHOUSE_TERRACE_HOTSPOTS,
  cameraCenters: GREENHOUSE_TERRACE_CAMERA_CENTERS,
  occluders: GREENHOUSE_TERRACE_OCCLUDERS,
  drawScenery: drawGreenhouseTerraceScenery,
  drawItem: drawGreenhouseTerraceItem,
  createArt: createGreenhouseTerraceArt,
  installSequences: installGreenhouseTerraceSequences,
};
