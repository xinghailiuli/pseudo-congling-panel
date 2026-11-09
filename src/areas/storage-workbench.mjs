// 模块 B-1：一楼储物与工作台区（Storage & Workbench Area）
// 职责：拥有一楼工作台（workbench）、全息通讯屏（comms）、储物室、铁砧工坊、冰箱的区域配置、交互热区、工作台分组与方块屋绘制逻辑。

export const STORAGE_WORKBENCH_FEATURES = [
  {
    id: 'comms',
    level: 1,
    label: '通讯屏：近况 · QQ · 表达',
    short: '通讯屏 · 近况与QQ',
    title: '全息通讯视窗',
    rect: [135, 418, 108, 226],
    mark: [185, 516],
    symbol: '讯',
    pages: ['overview', 'qq', 'proactive', 'expression'],
  },
  {
    id: 'workbench',
    level: 1,
    label: '工坊台：工具 · 舱室 · 系统',
    short: '工坊台 · 工具与系统',
    title: '工坊与舱室中枢',
    rect: [250, 235, 335, 335],
    mark: [542, 435],
    symbol: '工',
    pages: ['tools', 'decor', 'system', 'about'],
  },
];

export const STORAGE_WORKBENCH_WORKSPACE_GROUPS = {
  comms: { title: '全息通讯视窗', pages: ['overview', 'qq', 'proactive', 'expression'] },
  workbench: { title: '工坊与舱室中枢', pages: ['tools', 'decor', 'system', 'about'] },
};

export function drawStorageWorkbenchScenery(ctx) {
  const { scenery, box, face, top, rug, plant, wood, dark, ink } = ctx;
  // 储物室：墙面储物柜与收纳箱
  scenery(1, '储物室', g => {
    box(g, .65, .55, 0, 4.8, 2.15, .12, dark);
    for (let z = .15; z < 2.8; z += .9) {
      for (let x = .8; x < 5.2; x += 1.45) {
        box(g, x, .65, z, 1.32, 1.35, .81, wood);
        face(g, x + .06, 2.01, z + .08, 1.2, .59, '#ab6a2b');
        face(g, x + .06, 2.02, z + .54, 1.2, .08, '#704821');
        face(g, x + .61, 2.04, z + .34, .13, .25, '#d2c6a7');
        face(g, x + .19, 2.04, z + .16, .28, .26, '#6b4928');
        face(g, x + .23, 2.05, z + .2, .2, .18, ['#8aaa60', '#c98b4e', '#87a9b1'][Math.round(x + z) % 3]);
      }
    }
    plant(g, .55, 2.55, 0, .8);
  });
  // 铁砧工坊：铁砧与合成工作台
  scenery(1, '铁砧工坊', g => {
    rug(g, 1.4, 4, 3.1, 2.3);
    box(g, 1.7, 4.25, 0, 1.25, 1.25, .42, ['#9da0a0', '#7b8184', '#626b72']);
    box(g, 1.85, 4.4, .42, .95, .95, .2, ink);
    box(g, 2.05, 4.55, .62, .55, .64, .58, ink);
    box(g, 1.7, 4.25, 1.16, 1.25, 1.15, .23, ['#697582', '#465463', '#303d4b']);
    box(g, 3.3, 4.25, 0, 1.03, 1.03, 1.05, wood);
    top(g, 3.31, 4.26, 1.06, 1.01, 1.01, '#6a432a');
    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        top(g, 3.38 + x * .29, 4.33 + y * .29, 1.07, .21, .21, '#dba873');
      }
    }
    face(g, 3.44, 5.3, .23, .16, .56, '#3f3932');
    face(g, 3.81, 5.3, .34, .12, .49, '#51452f');
  });
}

export function drawStorageWorkbenchItem(item, ctx) {
  const { draw, box, face, plant } = ctx;
  if (item.name === '冰箱') {
    draw(item, 1, 6.5, g => {
      box(g, 12, .5, 0, 1.05, 1.25, 2.5, ['#eee9dc', '#dad5c8', '#b4b5b2']);
      face(g, 12.08, 1.76, .16, .9, 1.46, '#e5e0d2');
      face(g, 12.08, 1.76, 1.72, .9, .64, '#e8e4d7');
      for (const z of [1.1, 1.9]) face(g, 12.18, 1.78, z, .06, .3, '#929a9c');
      plant(g, 12.25, .72, 2.52, .65);
    });
    return true;
  }
  return false;
}

export const STORAGE_WORKBENCH_AREA = {
  id: 'storage-workbench',
  floor: 1,
  title: '储物与工作台区',
  features: STORAGE_WORKBENCH_FEATURES,
  workspaceGroups: STORAGE_WORKBENCH_WORKSPACE_GROUPS,
  drawScenery: drawStorageWorkbenchScenery,
  drawItem: drawStorageWorkbenchItem,
};
