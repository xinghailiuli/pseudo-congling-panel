import {
  normalizeRoomFurnitureId,
  normalizeRoomActionId,
  ROOM_ACTION_CATALOG,
  checkRoomActionAvailability,
} from './areas/area-registry.mjs';

// 模块 G / H：状态持久化、观察视角隔离、弹层定位引擎与动作执行控制器
// 职责：管理经典双层木屋开发版状态隔离（liuli-cottage-dev:*）、观察楼层与人物特写保持、运行时快照节流保存与恢复、HUD 菜单视口边界锚定定位（不随房间相机/人物漂移）、以及“点击 -> 校验 -> 移动 -> 到达执行”分阶段真实反馈。

export const OBSERVER_FLOOR_KEY = 'liuli-cottage-dev:room-floor:v1';
export const OBSERVER_DETAIL_KEY = 'liuli-cottage-dev:room-detail:v1';
export const VIEW_MODE_STORAGE_KEY = 'liuli-cottage-dev:view-mode:v1';

export const ROOM_PANEL_FURNITURE_GROUPS = {
  comms: { label: '全息通讯视窗', floor: '1', pages: ['overview', 'qq', 'proactive', 'expression'] },
  computer: { label: '琉璃的电脑', floor: '1', pages: ['memory', 'persona', 'relations'] },
  workbench: { label: '工坊与舱室中枢', floor: '1', pages: ['tools', 'decor', 'system', 'about'] },
  enchant: { label: '附魔台', floor: '2', pages: ['diary'] },
  bed: { label: '床', floor: '2', pages: ['night', 'dreams'] },
};

export const ROOM_PANEL_PAGE_TARGETS = {
  overview: ['comms', 'overview'],
  qq: ['comms', 'qq'],
  proactive: ['comms', 'proactive'],
  expression: ['comms', 'expression'],
  memory: ['computer', 'memory'],
  persona: ['computer', 'persona'],
  relations: ['computer', 'relations'],
  tools: ['workbench', 'tools'],
  decor: ['workbench', 'decor'],
  system: ['workbench', 'system'],
  about: ['workbench', 'about'],
  night: ['bed', 'night'],
  dreams: ['bed', 'dreams'],
  diary: ['enchant', 'read'],
};


function getSafeStorage() {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {}
  return {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
    clear() {}
  };
}

export function createRoomObserverController({ parent, storage = getSafeStorage() } = {}) {
  function getPersistedObserverFloor() {
    try {
      const val = storage?.getItem?.(OBSERVER_FLOOR_KEY);
      if (val === '1' || val === '2' || val === 'all') return val;
    } catch {}
    return '1';
  }
  const roomView = {
    floor: getPersistedObserverFloor(),
    detail: false,
    preview: 'auto',
    immersive: false,
  };
  function setObserverFloor(val, sceneInstance, onUpdateCards) {
    if (!['1', '2', 'all'].includes(val)) return;
    roomView.floor = val;
    try { storage?.setItem?.(OBSERVER_FLOOR_KEY, val); } catch {}
    try { parent?.postMessage?.({ channel: 'liuli-companion', type: 'room-view-floor-save', floor: val }, '*'); } catch {}
    if (sceneInstance?.setRoomFloor) {
      sceneInstance.setRoomFloor(val);
    }
    if (typeof onUpdateCards === 'function') {
      onUpdateCards(val);
    }
  }
  return {
    roomView,
    getPersistedObserverFloor,
    setObserverFloor,
    normalizeFurnitureId: normalizeRoomFurnitureId,
  };
}

export function createRoomRuntimePersistence({
  parent,
  window: win,
  document: doc,
  setTimeout: schedule = globalThis.setTimeout,
  clearTimeout: cancel = globalThis.clearTimeout,
  getActiveRoomScene,
} = {}) {
  let disposed=false,readyTimer;
  let roomRuntime = null;
  let runtimeReceived = false;
  let resolveRoomRuntime;
  const runtimeReady = new Promise(resolve => {
    resolveRoomRuntime = resolve;
    readyTimer=schedule(resolve, 1500);
  });

  const receiveRuntime=event=>{
    if(disposed||event.source!==parent||event.data?.channel!=='liuli-companion'||event.data.type!=='room-runtime'||runtimeReceived)return;
    runtimeReceived=true;roomRuntime=event.data.value;cancel(readyTimer);resolveRoomRuntime();
  };
  const onPageHide=()=>saveRoomRuntime(true);
  if (win?.addEventListener) {
    win.addEventListener('message',receiveRuntime);
    win.addEventListener('pagehide',onPageHide);
  }
  parent?.postMessage?.({ channel: 'liuli-companion', type: 'room-runtime-request' }, '*');

  let lastSavedSig = '', lastSavedAt = 0;
  const stateSig = v => {
    if (!v || !v.state) return '';
    const s = v.state;
    return [v.revision, v.preview, s.floor, s.residentLevel, s.currentMode, s.travelling, s.route?.kind, s.route?.floor, s.route?.target, v.life?.mode, v.life?.phase].join(':');
  };
  const saveRoomRuntime = (force = false) => {
    if(disposed)return;
    const activeRoomScene = getActiveRoomScene?.();
    const value = activeRoomScene?.getRoomRuntime?.();
    if (!value) return;
    const sig = stateSig(value), now = Date.now(), dirty = sig !== lastSavedSig, checkpoint = (now - lastSavedAt) >= 12000;
    if (force || dirty || checkpoint) {
      roomRuntime = value;
      lastSavedSig = sig;
      lastSavedAt = now;
      parent?.postMessage?.({ channel: 'liuli-companion', type: 'room-runtime-save', value }, '*');
    }
  };

  const onVisibility=() => {
    const activeRoomScene = getActiveRoomScene?.();
    if (doc.hidden) saveRoomRuntime(true);
    else if (roomRuntime) activeRoomScene?.restoreRoomRuntime?.(roomRuntime);
  };
  doc?.addEventListener?.('visibilitychange',onVisibility);

  return {
    runtimeReady,
    getRoomRuntime: () => roomRuntime,
    saveRoomRuntime,
    dispose(){if(disposed)return;disposed=true;cancel(readyTimer);resolveRoomRuntime();win?.removeEventListener?.('message',receiveRuntime);win?.removeEventListener?.('pagehide',onPageHide);doc?.removeEventListener?.('visibilitychange',onVisibility);},
  };
}

// 统一弹层定位引擎：基于触发按钮与 HUD 容器视口矩形计算位置，自动在边缘夹紧并限制最大高度（绝不混用 SVG viewBox 或人物坐标）
export function positionFloatingMenu(menuEl, anchorEl, containerEl, {
  placement = 'top',
  gap = 10,
  padding = 12,
  defaultWidth = 320,
  defaultHeight = 280,
} = {}) {
  if (!menuEl || !anchorEl || !containerEl) return null;
  const cRect = containerEl.getBoundingClientRect?.();
  const aRect = anchorEl.getBoundingClientRect?.();
  if (!cRect || !aRect || cRect.width <= 0 || cRect.height <= 0) return null;

  const scaleX = (containerEl.offsetWidth > 0 && Math.abs(containerEl.offsetWidth - cRect.width) > 1)
    ? (containerEl.offsetWidth / cRect.width)
    : 1;
  const scaleY = (containerEl.offsetHeight > 0 && Math.abs(containerEl.offsetHeight - cRect.height) > 1)
    ? (containerEl.offsetHeight / cRect.height)
    : 1;
  const cWidth = cRect.width * scaleX;
  const cHeight = cRect.height * scaleY;

  const mRect = menuEl.getBoundingClientRect?.() || {};
  const rawMenuW = (mRect.width ? mRect.width * scaleX : 0) || menuEl.offsetWidth || defaultWidth;
  const rawMenuH = (mRect.height ? mRect.height * scaleY : 0) || menuEl.offsetHeight || defaultHeight;
  const menuW = Math.min(rawMenuW, Math.max(180, cWidth - padding * 2));
  const menuH = rawMenuH;

  const anchorLeft = (aRect.left - cRect.left) * scaleX;
  const anchorRight = (aRect.right - cRect.left) * scaleX;
  const anchorTop = (aRect.top - cRect.top) * scaleY;
  const anchorBottom = (aRect.bottom - cRect.top) * scaleY;
  const anchorCenterX = anchorLeft + (aRect.width * scaleX) / 2;
  const anchorCenterY = anchorTop + (aRect.height * scaleY) / 2;

  if (placement === 'right') {
    const spaceRight = cWidth - anchorRight - gap - padding;
    const spaceLeft = anchorLeft - gap - padding;
    const useLeft = spaceRight < menuW && spaceLeft > spaceRight;
    const rawLeft = useLeft ? (anchorLeft - gap - menuW) : (anchorRight + gap);
    const left = Math.max(padding, Math.min(cWidth - menuW - padding, Math.round(rawLeft)));
    const maxHeight = Math.max(160, Math.round(cHeight - padding * 2));
    const clampedH = Math.min(menuH, maxHeight);
    const rawTop = anchorCenterY - clampedH / 2;
    const top = Math.max(padding, Math.min(cHeight - clampedH - padding, Math.round(rawTop)));

    if (menuEl.style) {
      menuEl.style.left = `${left}px`;
      menuEl.style.top = `${top}px`;
      menuEl.style.bottom = 'auto';
      menuEl.style.right = 'auto';
      menuEl.style.maxHeight = `${maxHeight}px`;
      menuEl.style.transform = 'none';
    }
    return { left, top, bottom: null, maxHeight, placement: useLeft ? 'left' : 'right' };
  }

  // placement === 'top' (e.g., teacup / bottom pill popover)
  const rawLeft = anchorCenterX - menuW / 2;
  const left = Math.max(padding, Math.min(cWidth - menuW - padding, Math.round(rawLeft)));
  const spaceAbove = anchorTop - gap - padding;
  const spaceBelow = cHeight - anchorBottom - gap - padding;
  const flipDown = spaceAbove < 150 && spaceBelow > spaceAbove;

  if (flipDown) {
    const top = Math.max(padding, Math.round(anchorBottom + gap));
    const maxHeight = Math.max(140, Math.round(cHeight - top - padding));
    if (menuEl.style) {
      menuEl.style.left = `${left}px`;
      menuEl.style.top = `${top}px`;
      menuEl.style.bottom = 'auto';
      menuEl.style.right = 'auto';
      menuEl.style.maxHeight = `${maxHeight}px`;
      menuEl.style.transform = 'none';
    }
    return { left, top, bottom: null, maxHeight, placement: 'bottom' };
  }

  const bottom = Math.max(padding, Math.round(cHeight - anchorTop + gap));
  const maxHeight = Math.max(150, Math.round(anchorTop - gap - padding));
  if (menuEl.style) {
    menuEl.style.left = `${left}px`;
    menuEl.style.bottom = `${bottom}px`;
    menuEl.style.top = 'auto';
    menuEl.style.right = 'auto';
    menuEl.style.maxHeight = `${maxHeight}px`;
    menuEl.style.transform = 'none';
  }
  return { left, top: null, bottom, maxHeight, placement: 'top' };
}

// 统一动作执行与多阶段状态追踪器（已接收 -> 正在移动 -> 正在执行 / 不可用原因）
export function createRoomActionDispatcher({
  getActiveRoomScene,
  getCurrentRoomData,
  getAvailableActions,
  show,
  storage = getSafeStorage(),
  onIntimacyChange,
} = {}) {
  let pendingOrder = null;
  let orderSeq = 0;

  function clearPendingOrder() {
    pendingOrder = null;
  }

  function triggerAction(rawActionId) {
    const scene = getActiveRoomScene?.();
    if (rawActionId === 'manual') {
      const curMode = scene?.getAttribute?.('data-room-activity') || 'walk';
      return triggerAction(curMode);
    }
    const actionId = typeof normalizeRoomActionId === 'function' ? normalizeRoomActionId(rawActionId) : rawActionId;
    const room = getCurrentRoomData?.();
    const availableActions = getAvailableActions?.();
    const check = checkRoomActionAvailability(actionId, {
      room,
      availableActions,
      hasScene: Boolean(scene && (actionId === 'pat' ? (scene.petRoomResident || scene.querySelector) : scene.setRoomActivity)),
    });
    if (!check.available) {
      show?.(check.reason, true);
      return { ok: false, stage: 'rejected', mode: actionId, reason: check.reason };
    }

    const action = ROOM_ACTION_CATALOG.find(a => a.id === actionId);
    if (actionId === 'pat') {
      if (typeof scene.petRoomResident === 'function') {
        scene.petRoomResident();
      } else {
        const patTarget = scene.querySelector?.('.room-art-pat');
        patTarget?.dispatchEvent?.(new MouseEvent('click', { bubbles: true }));
      }
      let intimacy = 100;
      try {
        intimacy = parseInt(storage?.getItem?.('liuli-cottage-dev:intimacy') || '100', 10) + 1;
        storage?.setItem?.('liuli-cottage-dev:intimacy', String(intimacy));
      } catch {}
      onIntimacyChange?.(intimacy);
      const msg = `摸了摸琉璃的小脑袋，琉璃开心地眨了眨眼~ (亲密度: ${intimacy})`;
      show?.(msg);
      return { ok: true, stage: 'executing', mode: 'pat', message: msg };
    }

    if (actionId === 'auto') {
      clearPendingOrder();
      scene.setRoomActivity({ preview: 'auto' });
      const msg = '已恢复自主生活节律，琉璃会按自己的节奏活动~';
      show?.(msg);
      return { ok: true, stage: 'executing', mode: 'auto', message: msg };
    }

    const token = ++orderSeq;
    const order = { token, mode: actionId, label: action.label, announcedMoving: false };
    pendingOrder = order;
    scene.setRoomActivity({ preview: actionId });

    // Check synchronous runtime state right after setRoomActivity
    const rt = scene.getRoomRuntime?.();
    const st = rt?.state;
    const isMoving = Boolean(st?.travelling) || scene.getAttribute?.('data-resident-travel') === 'true';

    if (isMoving) {
      order.announcedMoving = true;
      pendingOrder = order;
      const moveTarget = {
        sleep: '二楼床铺',
        lounge: '一楼沙发',
        type: '一楼电脑桌',
        write: '一楼书桌',
        read: '二楼书架',
        enchant: '二楼附魔台',
        garden: '二楼温室',
        rest: '二楼露台',
        walk: '走廊过道',
      }[actionId] || action.label;
      const msg = `已接收「${action.label}」指令 · 琉璃正前往${moveTarget}…`;
      show?.(msg);
      return { ok: true, stage: 'moving', mode: actionId, message: msg };
    }

    // Already at target or reduced motion
    clearPendingOrder();
    const msg = `正在执行「${action.label}」· ${action.description}`;
    show?.(msg);
    return { ok: true, stage: 'executing', mode: actionId, message: msg };
  }

  function handleActivityUpdate(activity) {
    if (!pendingOrder || !activity) return null;
    if (activity.preview && activity.preview !== pendingOrder.mode && activity.preview !== 'auto') {
      clearPendingOrder();
      return null;
    }
    if (activity.label?.includes('暂时没有')) {
      const msg = activity.label;
      clearPendingOrder();
      show?.(msg, true);
      return { stage: 'fallback', message: msg };
    }
    const scene = getActiveRoomScene?.();
    const isTravelling = Boolean(activity.moving)
      || scene?.getAttribute?.('data-resident-travel') === 'true'
      || Boolean(scene?.getRoomRuntime?.()?.state?.travelling);
    if (isTravelling) {
      if (!pendingOrder.announcedMoving && activity.label) {
        pendingOrder.announcedMoving = true;
        show?.(`已接收「${pendingOrder.label}」指令 · ${activity.label}`);
      }
      return { stage: 'moving', message: activity.label };
    }
    if (!isTravelling && activity.mode === pendingOrder.mode) {
      const doneOrder = pendingOrder;
      clearPendingOrder();
      const msg = `已到达并开始「${doneOrder.label}」：${activity.label || '动作进行中'}`;
      show?.(msg);
      return { stage: 'executing', mode: doneOrder.mode, message: msg };
    }
    return null;
  }

  return {
    triggerAction,
    handleActivityUpdate,
    clearPendingOrder,
    getPendingOrder: () => pendingOrder,
  };
}
