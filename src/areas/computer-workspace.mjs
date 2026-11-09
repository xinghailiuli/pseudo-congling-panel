// 模块 B-4：一楼电脑工作区（Computer Workspace Area）
// 职责：拥有一楼电脑（computer）、电竞椅、书桌、台灯、日记本、记事本的区域配置、电竞椅擦除蒙版与三多边形前景遮挡、写字纸页道具、打字/写字姿态序列及方块屋绘制。

export const COMPUTER_WORKSPACE_FEATURES = [
  {
    id: 'computer',
    level: 1,
    label: '电脑：记忆 · 人格 · 关系',
    short: '电脑 · 记忆与关系',
    title: '琉璃的电脑',
    rect: [784, 268, 268, 142],
    mark: [1020, 314],
    symbol: '忆',
    pages: ['memory', 'persona', 'relations'],
  },
];

export const COMPUTER_WORKSPACE_CAMERA_CENTERS = {
  type: [900, 390],
  write: [900, 390],
};

export const COMPUTER_WORKSPACE_WORKSPACE_GROUPS = {
  computer: { title: '琉璃的电脑', pages: ['memory', 'persona', 'relations'] },
};

export const COMPUTER_WORKSPACE_OCCLUDERS = [
  {
    name: 'chair',
    level: 1,
    polygons: [
      '888,377 948,369 972,400 975,473 956,495 913,489 882,468 881,427',
      '847,426 864,420 881,432 880,443 864,440 866,476 855,474 851,444',
      '913,489 936,489 959,527 944,535 925,510 902,539 886,536 891,516',
    ],
    when: p => p.x > 790 && p.x < 995 && p.y < 521,
    useRepair: false,
  },
];

export function drawComputerWorkspaceItem(item, ctx) {
  const { draw, control, room, onLamp, box, face, top, line, point, el, has, staticKeyboard, ink, cream, blue, dark } = ctx;
  const desk = g => {
    box(g, 7, .85, 0, .75, 1.9, 1.25, ink);
    box(g, 10.6, .85, 0, .7, 1.9, 1.25, ink);
    for (const x of [7.1, 10.7]) {
      for (const z of [.3, .67, 1.04]) {
        face(g, x, 2.76, z, .5, .26, '#4f5867');
        face(g, x + .17, 2.77, z + .14, .18, .025, '#a8a9a8');
      }
    }
    box(g, 6.85, .7, 1.25, 4.7, 2.2, .2, ['#bbab99', '#827d7b', '#62656a']);
    top(g, 7.2, 1.65, 1.46, 3.8, 1.05, '#2e4655');
  };
  const keyboard = g => {
    const z = has('书桌') ? 1.48 : 0;
    const k = el('g', { 'data-room-prop': 'keyboard' });
    g.append(k);
    staticKeyboard.push(k);
    box(k, 8, 2.07, z, 1.65, .54, .07, ['#e0dfe5', '#acb0c0', '#8a91a5']);
    for (let x = 8.09; x < 9.6; x += .15) {
      for (let y = 2.15; y < 2.55; y += .13) {
        top(k, x, y, z + .08, .11, .08, '#737e99');
      }
    }
  };
  const computer = g => {
    const z = has('书桌') ? 1.48 : 0;
    for (let n = 0; n < 2; n++) {
      const x = 7.25 + n * 1.7;
      box(g, x + .45, 1.22, z, .7, .5, .08, ink);
      box(g, x + .73, 1.3, z + .08, .1, .15, .35, ink);
      box(g, x, .91, z + .4, 1.58, .12, 1.03, ink);
      face(g, x + .08, 1.04, z + .49, 1.42, .84, '#092c36');
      face(g, x + .1, 1.05, z + 1.2, 1.38, .07, '#1b5860');
      for (let j = 0; j < 6; j++) {
        face(g, x + .15, 1.06, z + .56 + j * .09, .18 + ((j * 7 + n) % 5) * .19, .025, ['#66e3ce', '#3da2be', '#b5eac7'][j % 3]);
      }
      if (n) {
        for (let j = 0; j < 4; j++) {
          line(g, [x + .3 + j * .29, 1.07, z + .7 + (j % 2) * .22], [x + .59 + j * .22, 1.07, z + .91 - (j % 2) * .16], '#67c9e4', 1);
        }
      }
    }
    box(g, 10.75, .91, z, .65, 1.25, 1.47, ['#d9e1f1', '#4d6599', '#23375f']);
    face(g, 10.85, 2.17, z + .15, .43, 1.18, '#0f2459');
    for (const zz of [.4, .8, 1.2]) {
      const [cx, cy] = point(11.06, 2.18, z + zz);
      g.append(el('ellipse', { cx, cy, rx: 7.5, ry: 10, fill: '#4c71e4', stroke: '#92dfff', 'stroke-width': 3 }), el('circle', { cx, cy, r: 2, fill: '#e2f3ff' }));
    }
    keyboard(g);
    box(g, 9.96, 2.12, z, .23, .37, .12, cream);
    for (const x of [6.88, 10.25]) {
      box(g, x, 1.36, z, .3, .4, .65, ink);
      const [cx, cy] = point(x + .15, 1.77, z + .3);
      g.append(el('ellipse', { cx, cy, rx: 4, ry: 6, fill: '#6d7b8b' }));
    }
  };
  const chair = g => {
    box(g, 8.3, 3.15, .1, 1.1, .13, .1, ink);
    box(g, 8.78, 2.7, .1, .13, 1.1, .1, ink);
    box(g, 8.78, 3.14, .15, .13, .13, .6, ink);
    box(g, 8.25, 2.68, .73, 1.25, 1.15, .22, blue);
    box(g, 8.25, 3.7, .85, 1.25, .18, 1.35, ink);
    face(g, 8.4, 3.89, 1.05, .96, .91, '#6f86ad');
    for (const x of [8.18, 9.43]) box(g, x, 2.97, 1, .15, .65, .12, ink);
  };
  switch (item.name) {
    case '书桌': draw(item, 1, 6, desk); return true;
    case '椅子': draw(item, 1, 7, chair); return true;
    case '电脑': draw(item, 1, 6.1, computer); return true;
    case '日记本':
      draw(item, 1, 6.2, g => {
        const z = has('书桌') ? 1.48 : 0;
        box(g, 7.18, 2.1, z, .68, .57, .055, dark);
        top(g, 7.2, 2.12, z + .06, .29, .53, '#fff0d2');
        top(g, 7.53, 2.12, z + .06, .29, .53, '#eaddbd');
      });
      return true;
    case '记事本':
      draw(item, 1, 6.3, g => {
        const z = has('书桌') ? 1.48 : 0;
        box(g, 10.23, 2.24, z, .35, .42, .06, blue);
        top(g, 10.29, 2.31, z + .07, .22, .12, '#efead4');
      });
      return true;
    case '台灯':
      draw(item, 1, 6.4, g => {
        control(g, 'lamp', room.lamp ? '关闭台灯' : '打开台灯', onLamp);
        const z = has('书桌') ? 1.48 : 0;
        box(g, 6.92, 2.1, z, .4, .4, .09, ink);
        line(g, [7.12, 2.3, z + .1], [7.12, 2.3, z + .7], '#48546a', 3);
        box(g, 6.85, 2.03, z + .7, .55, .55, .3, room.lamp ? ['#fff1b8', '#f6cf7d', '#c09b55'] : cream);
        if (room.lamp) {
          const [cx, cy] = point(7.12, 2.3, z + .65);
          g.append(el('circle', { cx, cy, r: 36, fill: '#ffe2a2', opacity: '.13' }));
        }
      });
      return true;
    default:
      return false;
  }
}

export function createComputerWorkspaceArt({ el, defs, image, floor1 }) {
  const chairFeather = el('filter', { id: 'chair-feather', x: '-10%', y: '-10%', width: '120%', height: '120%' });
  chairFeather.append(el('feGaussianBlur', { stdDeviation: 3 }));
  defs.append(chairFeather);

  const chairMask = el('mask', { id: 'chair-mask', maskUnits: 'userSpaceOnUse', x: 825, y: 338, width: 172, height: 219 });
  chairMask.append(el('rect', { x: 835, y: 348, width: 152, height: 199, fill: 'white', filter: 'url(#chair-feather)' }));
  defs.append(chairMask);

  const chairErase = el('g', { 'data-chair-surface': 'v20', display: 'none', mask: 'url(#chair-mask)' });
  const chairEraseImage = image();
  chairErase.append(chairEraseImage);
  floor1.append(chairErase);

  const writingPaper = el('g', { 'data-life-paper': true, display: 'none' });
  writingPaper.append(el('polygon', { points: '848,377 889,371 906,390 864,397', fill: '#fff6df', stroke: '#d6c29a', 'stroke-width': 1 }));
  floor1.append(writingPaper);
  for (let i = 0; i < 3; i++) {
    writingPaper.append(el('path', { d: `M${858 + i * 3},${381 + i * 3} l24,-3`, stroke: '#99a4af', 'stroke-width': .6 }));
  }

  return {
    chairErase,
    chairEraseImage,
    writingPaper,
    updateProps(lifeSample, visibleFrame, lifeAssets) {
      writingPaper.setAttribute('display', lifeSample?.mode === 'write' ? 'inline' : 'none');
      const wholeChair = Boolean(visibleFrame?.chair && lifeAssets?.chairCleanplate);
      chairErase.setAttribute('display', wholeChair ? 'inline' : 'none');
      return wholeChair;
    },
    applyAssets(assets) {
      if (assets.chairCleanplate) chairEraseImage.setAttribute('href', assets.chairCleanplate);
    },
  };
}

export function installComputerWorkspaceSequences({ make, step, sequence, route }) {
  for (const mode of ['type', 'write']) {
    const { def, add } = make(mode, 'desk');
    add('stand', 23, [1008, 531], 'feet', [.48, .98]);
    add('closer', 0, [972, 496], 'feet', [.48, .98]);
    add('lower', 1, [925, 475], 'feet', [.4, .98]);
    const chairApproach = route(add, 'chair-approach', [[1008, 531], [982, 510], [972, 496]]);
    for (let i = 2; i <= 21; i++) add('d' + i, i, [912, 421], 'hips', [.48, .84], { prop: mode === 'write' && i >= 13 && i <= 17 ? 'pen' : null });
    add('rise', 22, [925, 475], 'feet', [.48, .98]);
    def.still = mode === 'type' ? 'd5' : 'd13';
    def.entry = [step('stand', 180), ...chairApproach.steps, step('closer', 180), step('lower', 180), step('d2', 180), step(def.still, 180)];
    def.seatedEntry = sequence(mode === 'write' ? ['d12', 'd13'] : ['d3', 'd4', 'd5'], 160);
    def.seatedExits = {};
    for (const [id, pose] of Object.entries(def.poses)) {
      if (pose.support === 'hips') def.seatedExits[id] = sequence([mode === 'write' ? 'd12' : 'd18'], 180);
    }
    const typing = () => [step('d5', 1800), ...sequence(['d6', 'd7', 'd8'], 650), step('d9', 850), step('d11', 1800)];
    const writing = () => [step('d13', 2300), step('d14', 1200), step('d17', 1500)];
    def.variations = mode === 'type'
      ? [
          { name: '坐稳敲键盘，偶尔停下来看看屏幕', frames: [...Array.from({ length: 5 }, typing).flat(), step('d10', 6000), ...Array.from({ length: 3 }, typing).flat()] },
          { name: '歇一下，放松肩膀', frames: [step('d18', 3500), step('d19', 900), step('d20', 3000), step('d21', 900), step('d5', 4000)] },
        ]
      : [
          { name: '压住纸页，慢慢写完这一段', frames: [...Array.from({ length: 6 }, writing).flat(), step('d15', 8000), step('d16', 2000), ...Array.from({ length: 4 }, writing).flat()] },
          { name: '放下笔休息片刻', frames: [step('d12', 1500), step('d18', 6000), step('d20', 2500), step('d21', 900), step('d13', 2000)] },
        ];
    const chairBack = chairApproach.backSteps(chairApproach.positions.length - 1);
    for (const [id, pose] of Object.entries(def.poses)) {
      def.exits[id] = id === 'stand'
        ? []
        : pose.route
          ? [...chairApproach.backSteps(pose.routeIndex), step('stand', 120)]
          : [...(id === 'closer' ? [] : id === 'lower' || id === 'rise' ? sequence(['closer']) : sequence([...(pose.prop === 'pen' ? ['d12'] : []), 'd18', 'rise', 'closer'], 180)), ...chairBack, step('stand', 120)];
    }
  }
}

export function installComputerDeskTransitions(defs, geometry, { walkTo, step }) {
  for (const mode of ['type', 'write']) {
    const d = defs[mode], approach = walkTo(d, d.poses.stand.at, [950, 490], 'desk-contact-'), lower = [];
    for (let i = 0; i < 8; i++) {
      const cell = [0, 0, 1, 1, 2, 3, 4, 5][i], f = geometry.desk.frames[cell], id = 'desk-settle-' + i;
      d.poses[id] = {
        atlas: 'desk',
        cell,
        deskCell: i,
        at: [950 - 38 * i / 7, 464 - 43 * i / 7],
        support: i < 5 ? 'feet' : 'hips',
        prop: null,
        pivot: [f.crop[0] + f.crop[2] * .48, f.crop[1] + f.crop[3] * .84],
        head: [f.crop[0] + f.crop[2] * .5, f.crop[1] + f.crop[3] * .22],
        scale: 190 / geometry.desk.frames[0].crop[3],
        articulated: true,
      };
      lower.push(step(id, 125));
    }
    d.entry = [...approach, ...lower, step(d.still, 200)];
    const getUp = [...lower.slice().reverse(), ...approach.slice().reverse(), step('stand', 120)];
    for (const [id, p] of Object.entries(d.poses)) {
      if (id === 'stand') d.exits[id] = [];
      else {
        const i = d.entry.findIndex(s => s.pose === id);
        d.exits[id] = i >= 0 ? [...d.entry.slice(0, i).reverse(), step('stand', 120)] : [...(p.prop === 'pen' ? [step('d12', 160)] : []), ...getUp];
      }
    }
  }
}

export const COMPUTER_WORKSPACE_AREA = {
  id: 'computer-workspace',
  floor: 1,
  title: '电脑工作区',
  features: COMPUTER_WORKSPACE_FEATURES,
  cameraCenters: COMPUTER_WORKSPACE_CAMERA_CENTERS,
  workspaceGroups: COMPUTER_WORKSPACE_WORKSPACE_GROUPS,
  occluders: COMPUTER_WORKSPACE_OCCLUDERS,
  drawItem: drawComputerWorkspaceItem,
  createArt: createComputerWorkspaceArt,
  installSequences: installComputerWorkspaceSequences,
  installDeskTransitions: installComputerDeskTransitions,
};
