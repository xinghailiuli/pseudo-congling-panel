// 模块 B-5：一楼客厅休息区（Living Room Rest Area）
// 职责：拥有一楼沙发（lounge）、茶几、马克杯、电视、旧相册、挂钟、客厅地毯的区域配置、前景遮挡（sofa / lower-rail / entry-lantern）、休息/吃零食/侧躺姿态序列及方块屋绘制。

export const LIVING_LOUNGE_CAMERA_CENTERS = {
  lounge: [750, 650],
  walk: [1020, 610],
};

export const LIVING_LOUNGE_OCCLUDERS = [
  {
    name: 'sofa',
    level: 1,
    polygons: ['680,578 746,554 789,543 823,541 884,653 929,720 925,768 787,807 735,756 680,626'],
    // A resident on the cushions is in front of the backrest. Only the near
    // arm belongs above contact poses; the full silhouette is for walking behind.
    contactPolygons: ['766,734 907,710 929,720 925,768 787,807 766,798'],
    when: p => p.x > 620 && p.x < 965 && p.y < 640,
    useRepair: false,
  },
  {
    name: 'lower-rail',
    level: 1,
    polygons: ['1128,446 1155,437 1230,526 1229,578 1201,586 1127,512'],
    when: p => p.x > 1165 && p.y < 650,
    useRepair: true,
  },
  {
    name: 'entry-lantern',
    level: 1,
    polygons: ['1118,763 1145,749 1168,769 1167,835 1143,850 1119,832'],
    when: p => p.x > 1085 && p.y < 812,
    useRepair: true,
  },
];

export function drawLivingLoungeScenery(ctx) {
  const { scenery, rug } = ctx;
  scenery(1, '客厅地毯', g => rug(g, 2.7, 6.2, 6.3, 3.1));
}

export function drawLivingLoungeItem(item, ctx) {
  const { draw, box, side, top, face, point, el, has, wood, dark, cream, blue, ink } = ctx;
  const mug = (g, x, y, z) => {
    const [cx, cy] = point(x, y, z);
    const m = el('g', { 'data-room-prop': 'mug', 'data-room-support': 'coffee-table' });
    g.append(m);
    m.append(
      el('ellipse', { cx, cy: cy + 2, rx: 10, ry: 4, fill: '#765c3f', opacity: '.3' }),
      el('path', { d: `M ${cx + 5} ${cy - 11} q 9 0 6 7 q -1 3 -6 1`, fill: 'none', stroke: '#d7e6e7', 'stroke-width': 2 }),
      el('rect', { x: cx - 6, y: cy - 12, width: 12, height: 12, rx: 2, fill: '#9cb9c5' }),
      el('ellipse', { cx, cy: cy - 12, rx: 6, ry: 2.4, fill: '#edf0e5' }),
      el('ellipse', { cx, cy: cy - 12, rx: 4, ry: 1.6, fill: '#75604b' }),
    );
  };
  switch (item.name) {
    case '电视':
      draw(item, 1, 8, g => {
        box(g, .4, 6.5, 0, .7, 2.6, .58, wood);
        box(g, .68, 6.6, .7, .15, 2.45, 1.75, ink);
        side(g, .84, 6.7, .8, 2.24, 1.55, '#194e78');
        side(g, .85, 6.7, .8, 2.24, .35, '#68a2ad');
        side(g, .86, 7, .95, .6, .62, '#427c8d');
        side(g, .87, 7.7, .93, .56, .94, '#91bdc5');
        side(g, .88, 8.4, .98, .35, .54, '#366d91');
      });
      return true;
    case '沙发':
      draw(item, 1, 14, g => {
        box(g, 7.3, 6.15, .2, 1.7, 3.15, .48, ['#bbbccc', '#979bac', '#777f93']);
        box(g, 8.65, 6.15, .65, .35, 3.15, 1.1, ['#c9c8d3', '#a8a9bb', '#858c9f']);
        for (let y = 6.45; y < 9; y += .86) box(g, 7.35, y, .68, 1.25, .78, .24, ['#d1d1dc', '#b4b8ca', '#969eb4']);
        for (const y of [6.15, 9.05]) box(g, 7.3, y, .65, 1.7, .25, .6, ['#c9c8d3', '#a8a9bb', '#858c9f']);
        box(g, 8.1, 6.55, .93, .5, .7, .4, blue);
        box(g, 8, 8.55, .93, .55, .45, .3, cream);
      });
      return true;
    case '茶几':
      draw(item, 1, 13, g => {
        for (const x of [4.1, 5.8]) for (const y of [7.2, 8.55]) box(g, x, y, 0, .17, .17, .5, dark);
        box(g, 3.95, 7.1, .48, 2.2, 1.65, .22, wood);
        top(g, 4.2, 7.35, .71, 1.55, 1.04, '#b1834e');
        mug(g, 5.5, 7.65, .72);
        box(g, 4.5, 8, .72, .6, .4, .06, cream);
      });
      return true;
    case '旧相册':
      draw(item, 1, 13.1, g => {
        const z = has('茶几') ? .72 : 0;
        box(g, 4.15, 7.4, z, .7, .55, .08, ['#a67f63', '#81614e', '#594334']);
        top(g, 4.25, 7.51, z + .09, .46, .3, '#dbcaa7');
      });
      return true;
    case '挂钟':
      draw(item, 1, 0, g => {
        box(g, 5.6, .25, 2.65, .8, .15, .8, dark);
        face(g, 5.68, .41, 2.73, .64, .64, '#f2e5c6');
        face(g, 5.99, .42, 3.04, .024, .23, '#424957');
        face(g, 5.99, .42, 3.04, .21, .024, '#424957');
      });
      return true;
    default:
      return false;
  }
}

export function installLivingLoungeSequences({ make, step, sequence, geometry }) {
  const { def, add } = make('lounge', 'sofa');
  add('stand', 0, [676, 722]);
  add('lower', 1, [684, 722], 'feet', [.48, .97]);
  for (const i of [2, 4, 5, 6, 7, 8, 9, 11, 12]) add('s' + i, i, [755, 674], 'hips', [.51, .76], { prop: i >= 4 && i <= 9 ? 'snack' : null });
  add('s3', 3, [750, 675], 'hips', [.75, .72]);
  add('s10', 10, [750, 675], 'hips', [.75, .72], { prop: 'snack' });
  add('s13', 13, [764, 674], 'hips', [.52, .75]);
  add('s14', 14, [780, 674], 'cushion', [.58, .78]);
  for (const i of [15, 16, 17]) add('s' + i, i, [790, 675], 'cushion', [.62, .72]);
  add('s18', 18, [776, 671], 'cushion', [.58, .74]);
  add('s19', 19, [764, 669], 'elbows', [.42, .76]);
  for (const i of [20, 21, 22, 23]) add('s' + i, i, [755, 670], 'elbows', [.27, .81]);
  // The corrected sheet follows the sofa's far-left to near-right long axis.
  // Rotate around its supported hip/elbow anchor; never rotate around the head.
  if (geometry['sofa-rest']) {
    for (const [id, cell] of Object.entries({ s14: 8, s15: 0, s16: 1, s17: 2, s18: 10, s19: 11, s20: 4, s21: 6, s22: 7, s23: 5 })) {
      const support = Number(id.slice(1)) >= 18 ? 'elbows' : 'cushion';
      add(id, cell, [767, 662], support, [.60, .66], { atlas: 'sofa-rest', scale: .46, rotation: 25 });
      const p = def.poses[id], crop = geometry['sofa-rest'].frames[cell].crop;
      p.head = [crop[0] + crop[2] * .25, crop[1] + crop[3] * .34];
    }
  }
  def.still = 's2';
  def.entry = sequence(['stand', 'lower', 's2'], 380);
  def.variations = [
    { name: '坐稳歇一会，偶尔吃一口零食', frames: [step('s2', 15000), step('s4', 2200), ...sequence(['s5', 's6', 's7'], 800), step('s8', 1400), step('s9', 5500), ...sequence(['s6', 's7'], 900), step('s8', 1500), step('s9', 5500), step('s4', 1400), step('s11', 6500)] },
    { name: '沿着沙发侧躺休息', frames: [...sequence(['s12', 's13', 's14', 's15'], 650), step('s16', 20000), step('s17', 6500), step('s16', 18000)] },
    { name: '沿着坐垫趴一会，偶尔动动脚', frames: [...sequence(['s18', 's20'], 700), step('s23', 12000), step('s21', 1000), step('s23', 10000), step('s22', 1000), step('s23', 14000), ...sequence(['s20', 's19', 's15', 's14', 's13', 's12'], 450)] },
  ];
  const seated = ['lower', 'stand'], up = ['s14', 's13', 's12', ...seated];
  for (const id of Object.keys(def.poses)) {
    const i = Number(id.slice(1));
    const exit = id === 'stand' ? [] : id === 'lower' ? ['stand'] : id === 's3' ? ['s2', ...seated] : id === 's10' ? ['s11', ...seated] : i >= 4 && i <= 9 ? ['s8', 's9', 's4', 's11', ...seated] : i >= 18 ? ['s20', 's19', 's18', 's15', ...up] : i >= 15 ? up : i === 14 ? ['s13', 's12', ...seated] : i === 13 ? ['s12', ...seated] : seated;
    def.exits[id] = sequence(exit, 360);
  }
}

export const LIVING_LOUNGE_AREA = {
  id: 'living-lounge',
  floor: 1,
  title: '客厅休息区',
  cameraCenters: LIVING_LOUNGE_CAMERA_CENTERS,
  occluders: LIVING_LOUNGE_OCCLUDERS,
  drawScenery: drawLivingLoungeScenery,
  drawItem: drawLivingLoungeItem,
  installSequences: installLivingLoungeSequences,
};
