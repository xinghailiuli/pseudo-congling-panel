// 模块 B-0：全屋功能区域注册中心（Area Registry & Shared Contracts）
// 职责：统一聚合经典双层木屋 6 大功能区域与全息镜跨区域适配器的热区、遮挡、相机焦点、工作台路由、方块屋绘制与动作序列接口。

import { STORAGE_WORKBENCH_AREA, STORAGE_WORKBENCH_FEATURES, STORAGE_WORKBENCH_WORKSPACE_GROUPS, drawStorageWorkbenchScenery, drawStorageWorkbenchItem } from './storage-workbench.mjs';
import { LIBRARY_READING_AREA, LIBRARY_READING_HOTSPOTS, LIBRARY_READING_CAMERA_CENTERS, LIBRARY_READING_WORKSPACE_GROUPS, drawLibraryReadingScenery, drawLibraryReadingItem, createLibraryReadingEffects, installLibraryReadingSequences } from './library-reading.mjs';
import { GREENHOUSE_TERRACE_AREA, GREENHOUSE_TERRACE_HOTSPOTS, GREENHOUSE_TERRACE_CAMERA_CENTERS, GREENHOUSE_TERRACE_OCCLUDERS, drawGreenhouseTerraceScenery, drawGreenhouseTerraceItem, createGreenhouseTerraceArt, installGreenhouseTerraceSequences } from './greenhouse-terrace.mjs';
import { COMPUTER_WORKSPACE_AREA, COMPUTER_WORKSPACE_FEATURES, COMPUTER_WORKSPACE_CAMERA_CENTERS, COMPUTER_WORKSPACE_WORKSPACE_GROUPS, COMPUTER_WORKSPACE_OCCLUDERS, drawComputerWorkspaceItem, createComputerWorkspaceArt, installComputerWorkspaceSequences, installComputerDeskTransitions } from './computer-workspace.mjs';
import { LIVING_LOUNGE_AREA, LIVING_LOUNGE_CAMERA_CENTERS, LIVING_LOUNGE_OCCLUDERS, drawLivingLoungeScenery, drawLivingLoungeItem, installLivingLoungeSequences } from './living-lounge.mjs';
import { BEDROOM_SLEEP_AREA, BEDROOM_SLEEP_FEATURES, BEDROOM_SLEEP_CAMERA_CENTERS, BEDROOM_SLEEP_WORKSPACE_GROUPS, BEDROOM_SLEEP_OCCLUDERS, drawBedroomSleepScenery, createBedroomBlanketDrawer, drawBedroomSleepItem, createBedroomSleepArt, installBedroomSleepSequences, installBedBody, installBedReference, roomSleepVariation } from './bedroom-sleep.mjs';
import { MIRROR_WARDROBE_AREA, MIRROR_WARDROBE_FEATURES, createMirrorWardrobeArt } from './mirror-wardrobe.mjs';

export const ROOM_AREAS = [
  STORAGE_WORKBENCH_AREA,
  COMPUTER_WORKSPACE_AREA,
  LIVING_LOUNGE_AREA,
  BEDROOM_SLEEP_AREA,
  LIBRARY_READING_AREA,
  GREENHOUSE_TERRACE_AREA,
  MIRROR_WARDROBE_AREA,
];

export const ROOM_REQUIRED_FURNITURE_NAMES = [
  '床', '书桌', '台灯', '窗', '沙发', '冰箱', '电视', '绿萝', '旧相册',
  '日记本', '记事本', '床头柜', '书架', '椅子', '电脑', '茶几', '挂画', '挂钟', '盆栽',
];

export const ROOM_UPPER_FLOOR_ITEMS = new Set(['床', '床头柜', '书架', '盆栽', '挂画']);

export const ROOM_UPSTAIRS_ACTIONS = [
  ['read', LIBRARY_READING_HOTSPOTS.read.actionLabel],
  ['enchant', LIBRARY_READING_HOTSPOTS.enchant.actionLabel],
  ['garden', GREENHOUSE_TERRACE_HOTSPOTS.garden.actionLabel],
  ['rest', GREENHOUSE_TERRACE_HOTSPOTS.rest.actionLabel],
];

export const ROOM_UPSTAIRS_HOTSPOT_DEFS = {
  read: LIBRARY_READING_HOTSPOTS.read,
  enchant: LIBRARY_READING_HOTSPOTS.enchant,
  garden: GREENHOUSE_TERRACE_HOTSPOTS.garden,
  rest: GREENHOUSE_TERRACE_HOTSPOTS.rest,
};

export const ROOM_FEATURE_TARGETS = [
  ...STORAGE_WORKBENCH_FEATURES,
  ...COMPUTER_WORKSPACE_FEATURES,
  ...BEDROOM_SLEEP_FEATURES,
  ...MIRROR_WARDROBE_FEATURES,
];

export function getRoomFeatureTargets({ upstairs = true } = {}) {
  const targets = [...ROOM_FEATURE_TARGETS];
  if (!upstairs) {
    const e = LIBRARY_READING_HOTSPOTS.enchant;
    targets.push({
      id: 'enchant',
      level: 2,
      label: e.furnitureLabel,
      short: e.furnitureShort,
      rect: e.rect,
      mark: e.mark,
      symbol: e.symbol,
    });
  }
  return targets;
}

export const ROOM_CAMERA_CENTERS = {
  ...COMPUTER_WORKSPACE_CAMERA_CENTERS,
  ...BEDROOM_SLEEP_CAMERA_CENTERS,
  ...LIVING_LOUNGE_CAMERA_CENTERS,
  ...LIBRARY_READING_CAMERA_CENTERS,
  ...GREENHOUSE_TERRACE_CAMERA_CENTERS,
};

export const ROOM_AREA_OCCLUDERS = [
  LIVING_LOUNGE_OCCLUDERS[0], // sofa
  COMPUTER_WORKSPACE_OCCLUDERS[0], // chair
  LIVING_LOUNGE_OCCLUDERS[1], // lower-rail
  LIVING_LOUNGE_OCCLUDERS[2], // entry-lantern
  ...GREENHOUSE_TERRACE_OCCLUDERS, // greenhouse-rail, upper-gate-post, life-garden
  ...BEDROOM_SLEEP_OCCLUDERS, // wardrobe-quilt
];

export const ROOM_WORKSPACE_GROUPS = {
  ...STORAGE_WORKBENCH_WORKSPACE_GROUPS,
  ...COMPUTER_WORKSPACE_WORKSPACE_GROUPS,
  ...LIBRARY_READING_WORKSPACE_GROUPS,
  ...BEDROOM_SLEEP_WORKSPACE_GROUPS,
};

export function normalizeRoomFurnitureId(id) {
  if (id === 'enchanting') return 'enchant';
  return id;
}

export const ROOM_ACTION_ALIASES = {
  drink: 'rest',
  tea: 'rest',
  typing: 'type',
  writing: 'write',
  sofa: 'lounge',
  bed: 'sleep',
  reading: 'read',
  enchanting: 'enchant',
  watering: 'garden',
  walking: 'walk',
};

export function normalizeRoomActionId(actionId) {
  if (!actionId) return actionId;
  return ROOM_ACTION_ALIASES[actionId] || actionId;
}

// 统一动作目录：HUD 茶杯快捷菜单、全部动作菜单、主房间控制栏、全息试衣镜预览均从同一能力定义获取适用动作
export const ROOM_ACTION_CATALOG = [
  {
    id: 'auto',
    label: '随她生活',
    shortLabel: '🌱 随她生活',
    previewLabel: null,
    group: 'schedule',
    groupLabel: '自主作息与漫游',
    floor: 'any',
    areaId: 'house',
    upstairs: false,
    mainRoom: true,
    preview: false,
    quickCompanion: true,
    requiredFurniture: [],
    description: '恢复自主生活节律，按时间与精力自动切换日常活动',
  },
  {
    id: 'pat',
    label: '摸摸头',
    shortLabel: '💖 摸摸头',
    previewLabel: null,
    group: 'interaction',
    groupLabel: '亲密互动',
    floor: 'current',
    areaId: 'resident',
    upstairs: false,
    mainRoom: true,
    preview: false,
    quickCompanion: true,
    requiredFurniture: [],
    description: '轻抚小脑袋，触发开心眨眼与红晕回应，不打断当前位置',
  },
  {
    id: 'lounge',
    label: '沙发休息',
    shortLabel: '🛋️ 陪我坐会儿',
    previewLabel: '沙发',
    group: 'floor1',
    groupLabel: '一楼 · 起居与工作',
    floor: 1,
    areaId: 'living-lounge',
    upstairs: false,
    mainRoom: true,
    preview: true,
    quickCompanion: true,
    requiredFurniture: ['沙发'],
    description: '前往一楼客厅沙发喝茶休息',
  },
  {
    id: 'sleep',
    label: '盖被睡觉',
    shortLabel: '🛏️ 去休息吧',
    previewLabel: '睡觉',
    group: 'floor2',
    groupLabel: '二楼 · 睡眠与魔法温室',
    floor: 2,
    areaId: 'bedroom-sleep',
    upstairs: false,
    mainRoom: true,
    preview: true,
    quickCompanion: true,
    requiredFurniture: ['床'],
    description: '前往二楼卧室床铺盖被睡觉',
  },
  {
    id: 'write',
    label: '写字',
    shortLabel: '✍️ 写字',
    previewLabel: '写字',
    group: 'floor1',
    groupLabel: '一楼 · 起居与工作',
    floor: 1,
    areaId: 'computer-workspace',
    upstairs: false,
    mainRoom: true,
    preview: true,
    quickCompanion: false,
    requiredFurniture: ['书桌', '椅子', '日记本'],
    description: '在一楼书桌前执笔写字记事',
  },
  {
    id: 'type',
    label: '敲键盘',
    shortLabel: '⌨️ 敲键盘',
    previewLabel: '打字',
    group: 'floor1',
    groupLabel: '一楼 · 起居与工作',
    floor: 1,
    areaId: 'computer-workspace',
    upstairs: false,
    mainRoom: true,
    preview: true,
    quickCompanion: false,
    requiredFurniture: ['书桌', '椅子', '电脑'],
    description: '在一楼电脑桌前坐电竞椅认真敲键盘',
  },
  {
    id: 'walk',
    label: '散步',
    shortLabel: '🚶 散步',
    previewLabel: '走动',
    group: 'schedule',
    groupLabel: '自主作息与漫游',
    floor: 'any',
    areaId: 'house',
    upstairs: false,
    mainRoom: true,
    preview: true,
    quickCompanion: false,
    requiredFurniture: [],
    description: '在小屋走廊与楼层间散步驻足',
  },
  {
    id: 'read',
    label: '书架翻书',
    shortLabel: '📖 书架翻书',
    previewLabel: '翻书',
    group: 'floor2',
    groupLabel: '二楼 · 睡眠与魔法温室',
    floor: 2,
    areaId: 'library-reading',
    upstairs: true,
    mainRoom: true,
    preview: true,
    quickCompanion: false,
    requiredFurniture: ['书架'],
    description: '在二楼书架旁翻阅喜欢的书',
  },
  {
    id: 'enchant',
    label: '附魔练习',
    shortLabel: '✨ 附魔练习',
    previewLabel: '附魔',
    group: 'floor2',
    groupLabel: '二楼 · 睡眠与魔法温室',
    floor: 2,
    areaId: 'library-reading',
    upstairs: true,
    mainRoom: true,
    preview: true,
    quickCompanion: false,
    requiredFurniture: ['书架'],
    description: '在二楼附魔台前跟着书页练习小魔法',
  },
  {
    id: 'garden',
    label: '照料小麦',
    shortLabel: '🌾 照料小麦',
    previewLabel: '浇水',
    group: 'floor2',
    groupLabel: '二楼 · 睡眠与魔法温室',
    floor: 2,
    areaId: 'greenhouse-terrace',
    upstairs: true,
    mainRoom: true,
    preview: true,
    quickCompanion: false,
    requiredFurniture: ['盆栽'],
    description: '在二楼温室里给小麦浇水照料',
  },
  {
    id: 'rest',
    label: '露台歇脚',
    shortLabel: '🍵 露台品茶 · 喝水',
    previewLabel: '露台',
    aliases: ['drink', 'tea'],
    group: 'floor2',
    groupLabel: '二楼 · 睡眠与魔法温室',
    floor: 2,
    areaId: 'greenhouse-terrace',
    upstairs: true,
    mainRoom: true,
    preview: true,
    quickCompanion: false,
    requiredFurniture: [],
    description: '坐在二楼露台长椅上吹风歇脚、喝口水',
  },
];

// 内部过渡帧与自动子状态登记（仅由编排器内部驱动，不作为直接手选动作暴露）
export const ROOM_INTERNAL_SEQUENCES = [
  { id: 'walkUp', owner: 'living-lounge / navigation', purpose: '二楼走廊移动步态（内部寻路使用）' },
  { id: 'sofa-rest', owner: 'living-lounge', purpose: '沙发倚靠休息姿态变体（lounge 内部阶段）' },
  { id: 'desk-contact-type', owner: 'computer-workspace', purpose: '电脑桌打字入座过渡帧（type 内部过渡）' },
  { id: 'desk-contact-write', owner: 'computer-workspace', purpose: '书桌写字入座过渡帧（write 内部过渡）' },
  { id: 'desk-settle-type', owner: 'computer-workspace', purpose: '电脑桌打字坐定微调帧（type 内部过渡）' },
  { id: 'desk-settle-write', owner: 'computer-workspace', purpose: '书桌写字坐定微调帧（write 内部过渡）' },
  { id: 'bed-entry', owner: 'bedroom-sleep', purpose: '上床入睡过渡序列（sleep 内部过渡）' },
  { id: 'bedBody', owner: 'bedroom-sleep', purpose: '床上呼吸与微动图集（sleep 内部阶段）' },
  { id: 'bedReference', owner: 'bedroom-sleep', purpose: '床铺姿态参考校准层（sleep 内部阶段）' },
  { id: 'idleChair', owner: 'room-idle-events', purpose: '散步途中驻足看椅微互动（walk 内部随机事件）' },
];

export function getRoomQuickCompanionActions() {
  return ROOM_ACTION_CATALOG.filter(a => a.quickCompanion);
}

export function getRoomExecutableActions({ includePat = false } = {}) {
  return ROOM_ACTION_CATALOG.filter(a => a.mainRoom && (includePat || a.id !== 'pat'));
}

export function getRoomPreviewActions() {
  const order = ['walk', 'lounge', 'type', 'write', 'sleep', 'read', 'enchant', 'garden', 'rest'];
  return order
    .map(id => ROOM_ACTION_CATALOG.find(a => a.id === id))
    .filter(a => a && a.preview)
    .map(a => [a.id, a.previewLabel || a.label]);
}

export function getRoomActionGroups() {
  const groups = [
    { id: 'special', key: 'special', name: '亲密互动与自主节律', title: '亲密互动与自主节律', actions: [], items: [] },
    { id: 'floor1', key: 'floor1', name: '一楼 · 起居与工作', title: '一楼 · 起居与工作', actions: [], items: [] },
    { id: 'floor2', key: 'floor2', name: '二楼 · 睡眠与魔法温室', title: '二楼 · 睡眠与魔法温室', actions: [], items: [] },
  ];
  const map = {
    interaction: groups[0],
    schedule: groups[0],
    floor1: groups[1],
    floor2: groups[2],
  };
  for (const action of ROOM_ACTION_CATALOG) {
    const target = map[action.group];
    if (target) {
      target.actions.push(action);
      target.items.push(action);
    }
  }
  return groups;
}

export function checkRoomActionAvailability(rawActionId, { room = null, availableActions = null, hasScene = true } = {}) {
  const actionId = normalizeRoomActionId(rawActionId);
  const action = ROOM_ACTION_CATALOG.find(a => a.id === actionId);
  if (!action) return { available: false, normalizedId: actionId, reason: '未知动作指令' };
  if (!hasScene) return { available: false, normalizedId: actionId, reason: '房间场景尚未就绪' };
  if (action.upstairs && Array.isArray(availableActions) && !availableActions.includes(actionId)) {
    return { available: false, normalizedId: actionId, reason: '该二楼动作素材未就绪或暂不可用' };
  }
  if (room && Array.isArray(room.items) && action.requiredFurniture?.length) {
    const missing = action.requiredFurniture.find(name => !room.items.some(i => i.name === name));
    if (missing) {
      return { available: false, normalizedId: actionId, reason: `房间里暂时没有「${missing}」（可在工坊舱室与物品中添加）` };
    }
  }
  return { available: true, normalizedId: actionId, reason: '' };
}

export {
  drawStorageWorkbenchScenery,
  drawStorageWorkbenchItem,
  drawLibraryReadingScenery,
  drawLibraryReadingItem,
  createLibraryReadingEffects,
  installLibraryReadingSequences,
  drawGreenhouseTerraceScenery,
  drawGreenhouseTerraceItem,
  createGreenhouseTerraceArt,
  installGreenhouseTerraceSequences,
  drawComputerWorkspaceItem,
  createComputerWorkspaceArt,
  installComputerWorkspaceSequences,
  installComputerDeskTransitions,
  drawLivingLoungeScenery,
  drawLivingLoungeItem,
  installLivingLoungeSequences,
  drawBedroomSleepScenery,
  createBedroomBlanketDrawer,
  drawBedroomSleepItem,
  createBedroomSleepArt,
  installBedroomSleepSequences,
  installBedBody,
  installBedReference,
  roomSleepVariation,
  createMirrorWardrobeArt,
};
