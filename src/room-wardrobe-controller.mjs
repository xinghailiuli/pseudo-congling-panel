import {createRoomAssetSession} from './runtime/room-asset-session.mjs';
import { validateWardrobe, decodeBaseWardrobeAsset, decodeWardrobeSupplements, revokeWardrobeBlobUrls } from './room-wardrobe.mjs';

// 模块 E-1：13 套服装资源管理、LRU 缓存、预取队列与异步竞态保护控制器
// 职责：管理主房间与全息试衣镜共享的服装资源缓存（MAX_OUTFIT_CACHE=6）、按当前活动模式优先解码补充图集、保护异步换装请求不回退，并保证关闭试衣镜不释放主屋正在使用的资源。

export function createRoomWardrobeController({
  catalog = [],
  parent,
  window: win,
  setTimeout: scheduleTimer = globalThis.setTimeout,
  clearTimeout: cancelTimer = globalThis.clearTimeout,
  uid,
  getActiveRoomScene,
  getFittingScene,
} = {}) {
  let disposed=false;const timers=new Set();
  const schedule=(fn,delay)=>{if(disposed)return null;const handle=scheduleTimer(()=>{timers.delete(handle);if(!disposed)fn();},delay);timers.add(handle);return handle;};
  const cancel=handle=>{timers.delete(handle);cancelTimer(handle);};
  const assetSession=createRoomAssetSession({load:asset=>asset,release:revokeWardrobeBlobUrls});
  let outfitAsset = null;
  let outfitId = 'original';
  let targetOutfitId = '';
  let loadingOutfitId = null;
  let outfitRequest = '';
  let outfitLoading = false;
  let outfitNotice = '';
  let updateListener = () => {};
  let outfitTimer = null;

  const outfitAssetCache = new Map();
  if (win) win.outfitAssetCache = outfitAssetCache;
  const pendingRequests = new Map();
  const requestsByOutfit = new Map();
  const processingRequests = new Set();
  const MAX_OUTFIT_CACHE = 6;
  let prefetchTimer = null, prefetchTimeout = null, activePrefetchRequest = null;
  const prefetchQueue = [];

  function priorityKeys() {
    const scene = getActiveRoomScene?.();
    const mode = scene?.getAttribute?.('data-room-activity') || 'walk';
    if (scene?.getAttribute?.('data-resident-travel') === 'true') return ['walk'];
    if (mode === 'type' || mode === 'write') return ['desk', 'deskTransition'];
    if (mode === 'lounge') return ['sofaBody', 'sofaSocial', 'transition'];
    if (mode === 'sleep') return ['bedBody', 'bedReference', 'sleepReference', 'transition'];
    return ['walk', 'idleChair'];
  }

  function finishRequest(reqId, id) {
    if(disposed)return;
    pendingRequests.delete(reqId);
    if (requestsByOutfit.get(id) === reqId) requestsByOutfit.delete(id);
    if (activePrefetchRequest === reqId) {
      cancel(prefetchTimeout);
      activePrefetchRequest = null;
    }
    schedule(pumpPrefetch, 40);
  }

  function isCurrentRequest(reqId, id, reqTarget) {
    return !disposed && pendingRequests.has(reqId) && reqId === outfitRequest &&
      ((reqTarget === '__restore__' && !targetOutfitId) || id === targetOutfitId);
  }

  function warmSupplements(id, asset) {
    if(disposed||id!==outfitId||outfitLoading)return;
    // Once evicted, queued work must not bring its decoded images back into memory.
    void decodeWardrobeSupplements(asset, {
      shouldContinue: () => !disposed && id===outfitId && !outfitLoading && outfitAssetCache.get(id) === asset,
    }).catch(() => {});
  }

  function putOutfitCache(id, asset) {
    if(disposed)return;
    if (!asset || id === 'original') return;
    if (outfitAssetCache.has(id)) {
      outfitAssetCache.delete(id);
    } else if (outfitAssetCache.size >= MAX_OUTFIT_CACHE) {
      let evictKey = null;
      for (const key of outfitAssetCache.keys()) {
        if (key !== outfitId) { evictKey = key; break; }
      }
      if (!evictKey) evictKey = outfitAssetCache.keys().next().value;
      if (evictKey) {
        const evicted = outfitAssetCache.get(evictKey);
        outfitAssetCache.delete(evictKey);
        if (evictKey !== outfitId && typeof revokeWardrobeBlobUrls === 'function') {
          assetSession.release(evicted);
        }
      }
    }
    outfitAssetCache.set(id, asset);
  }

  function pumpPrefetch() {
    if(disposed)return;
    if (activePrefetchRequest || outfitLoading || !prefetchQueue.length) return;
    const id = prefetchQueue.shift();
    if (!id || id === 'original' || outfitAssetCache.has(id) || requestsByOutfit.has(id)) {
      pumpPrefetch();
      return;
    }
    const reqId = uid();
    activePrefetchRequest = reqId;
    pendingRequests.set(reqId, id);
    requestsByOutfit.set(id, reqId);
    cancel(prefetchTimeout);
    prefetchTimeout = schedule(() => {
      if (activePrefetchRequest === reqId) finishRequest(reqId, id);
    }, 20000);
    parent.postMessage({ channel: 'liuli-companion', type: 'wardrobe-request', id, requestId: reqId }, '*');
  }

  function prefetchOutfit(id) {
    if(disposed)return;
    if (!id || id === 'original' || outfitAssetCache.has(id) || requestsByOutfit.has(id) || prefetchQueue.includes(id)) return;
    if (prefetchQueue.length >= 2) prefetchQueue.shift();
    prefetchQueue.push(id);
    pumpPrefetch();
  }

  function schedulePrefetchOutfit(id) {
    if(disposed)return;
    cancel(prefetchTimer);
    if (!id || id === 'original' || outfitAssetCache.has(id) || requestsByOutfit.has(id)) return;
    prefetchTimer = schedule(() => prefetchOutfit(id), 120);
  }

  function cancelPrefetchSchedule() {
    cancel(prefetchTimer);
    prefetchTimer = null;
  }

  function requestOutfit(id) {
    if(disposed)return;
    cancelPrefetchSchedule();
    const activeRoomScene = getActiveRoomScene?.();
    const fittingScene = getFittingScene?.();
    if (!id) {
      if (outfitRequest) return;
      outfitRequest = uid();
      outfitLoading = true;
      outfitNotice = '正在恢复上次服装…';
      const reqId = outfitRequest;
      pendingRequests.set(reqId, '__restore__');
      cancel(outfitTimer);
      outfitTimer = schedule(() => {
        pendingRequests.delete(reqId);
        if (outfitRequest === reqId) {
          outfitRequest = '';
          outfitLoading = false;
          outfitNotice = '';
          updateListener();
        }
      }, 60000);
      parent.postMessage({ channel: 'liuli-companion', type: 'wardrobe-request', requestId: reqId }, '*');
      return;
    }
    if (id === outfitId && targetOutfitId === id && !outfitLoading) return;
    targetOutfitId = id;
    if (id === 'original') {
      cancel(outfitTimer);
      outfitRequest = uid();
      outfitId = 'original';
      loadingOutfitId = null;
      outfitLoading = false;
      outfitAsset = null;
      outfitNotice = '原装 · 完整生活动作';
      activeRoomScene?.setRoomOutfit?.(null);
      fittingScene?.setRoomOutfit?.(null);
      updateListener();
      parent.postMessage({ channel: 'liuli-companion', type: 'wardrobe-selected', id: 'original' }, '*');
      schedule(pumpPrefetch, 40);
      return;
    }
    const ready = outfitAssetCache.get(id);
    if (ready?._decoded && priorityKeys().every(key => !ready[key] || ready[key]._decoded)) {
      const cached = outfitAssetCache.get(id);
      outfitAssetCache.delete(id);
      outfitAssetCache.set(id, cached);
      cancel(outfitTimer);
      outfitRequest = uid();
      outfitId = id;
      loadingOutfitId = null;
      outfitLoading = false;
      outfitAsset = cached;
      outfitNotice = '已换上「' + (catalog.find(o => o.id === id)?.name || id) + '」· 动作流畅运行中';
      activeRoomScene?.setRoomOutfit?.(cached);
      fittingScene?.setRoomOutfit?.(cached);
      updateListener();
      parent.postMessage({ channel: 'liuli-companion', type: 'wardrobe-selected', id }, '*');
      schedule(pumpPrefetch, 40);
      return;
    }
    const existingRequest = requestsByOutfit.get(id);
    if (existingRequest && outfitRequest === existingRequest && outfitLoading) return;
    outfitRequest = existingRequest || uid();
    loadingOutfitId = id;
    outfitLoading = true;
    outfitNotice = '服装加载中…';
    updateListener();
    cancel(outfitTimer);
    const reqId = outfitRequest;
    pendingRequests.set(reqId, id);
    requestsByOutfit.set(id, reqId);
    if (activePrefetchRequest === reqId) cancel(prefetchTimeout);
    outfitTimer = schedule(() => {
      finishRequest(reqId, id);
      if (outfitRequest === reqId) {
        loadingOutfitId = null;
        outfitLoading = false;
        outfitNotice = '服装加载超时，请重试';
        updateListener();
        schedule(pumpPrefetch, 40);
      }
    }, 60000);
    if (existingRequest) return;
    if (ready) {
      void handleMessage({ source: parent, data: { channel: 'liuli-companion', type: 'wardrobe-assets', id, requestId: reqId, assets: ready } });
    } else {
      parent.postMessage({ channel: 'liuli-companion', type: 'wardrobe-request', id, requestId: reqId }, '*');
    }
  }

  async function handleMessage(event) {
    if(disposed)return;
    const d = event.data;
    if (event.source !== parent || d?.channel !== 'liuli-companion') return;
    if (d.type === 'wardrobe-error') {
      if (d.requestId && pendingRequests.has(d.requestId)) {
        const reqTarget = pendingRequests.get(d.requestId);
        const current = isCurrentRequest(d.requestId, reqTarget, reqTarget);
        finishRequest(d.requestId, reqTarget);
        if (current) {
          cancel(outfitTimer);
          outfitLoading = false;
          loadingOutfitId = null;
          outfitNotice = '服装未能加载，保留当前造型';
          updateListener();
          schedule(pumpPrefetch, 40);
        }
      }
      return;
    }
    if (d.type !== 'wardrobe-assets') return;
    const reqTarget = d.requestId ? pendingRequests.get(d.requestId) : null;
    if (processingRequests.has(d.requestId) || (!reqTarget && outfitAssetCache.has(d.id))) return;
    processingRequests.add(d.requestId);
    try {
      if (reqTarget && reqTarget !== '__restore__' && reqTarget !== d.id) throw Error('unexpected outfit');
      if (d.id !== 'original' && d.assets) {
        if (!validateWardrobe(d.assets) || d.assets.id !== d.id) throw Error('invalid outfit');
        assetSession.retain(d.assets,d.assets);
        if(isCurrentRequest(d.requestId,d.id,reqTarget)||activePrefetchRequest===d.requestId)
          await Promise.all([
            decodeBaseWardrobeAsset(d.assets),
            decodeWardrobeSupplements(d.assets, { priorityKeys: priorityKeys(), priorityOnly: true }),
          ]);
        if(disposed)return;
        // A room action can change during decode; its newly visible atlas must
        // also be ready before replacing the last visible outfit.
        while (isCurrentRequest(d.requestId, d.id, reqTarget)) {
          const missing = priorityKeys().filter(key => d.assets[key] && !d.assets[key]._decoded);
          if (!missing.length) break;
          await decodeWardrobeSupplements(d.assets, { priorityKeys: missing, priorityOnly: true });
          if(disposed)return;
        }
        if(disposed)return;
        putOutfitCache(d.id, d.assets);
      }
      // Selection, scene mount and timeout can all change while decoding is pending.
      if (isCurrentRequest(d.requestId, d.id, reqTarget)) {
        const activeRoomScene = getActiveRoomScene?.();
        const fittingScene = getFittingScene?.();
        const asset = d.id === 'original' ? null : d.assets;
        if (activeRoomScene?.setRoomOutfit && activeRoomScene.setRoomOutfit(asset) === false) throw Error('invalid scene');
        fittingScene?.setRoomOutfit?.(asset);
        outfitId = d.id;
        targetOutfitId = d.id;
        outfitAsset = asset;
        outfitNotice = d.id === 'original' ? '原装 · 完整生活动作' : '已换上「' + (catalog.find(o => o.id === d.id)?.name || d.id) + '」· 动作流畅运行中';
        parent.postMessage({ channel: 'liuli-companion', type: 'wardrobe-selected', id: outfitId }, '*');
        cancel(outfitTimer);
        outfitLoading = false;
        loadingOutfitId = null;
        schedule(pumpPrefetch, 40);
      }
      if (d.assets) warmSupplements(d.id, d.assets);
    } catch {
      if (isCurrentRequest(d.requestId, d.id, reqTarget)) {
        outfitNotice = '服装素材未通过检查，保留当前造型';
        cancel(outfitTimer);
        outfitLoading = false;
        loadingOutfitId = null;
      }
    } finally {
      processingRequests.delete(d.requestId);
      finishRequest(d.requestId, reqTarget);
    }
    if(!disposed)updateListener();
  }

  if (win?.addEventListener) {
    win.addEventListener('message', handleMessage);
  }

  return {
    outfitAssetCache,
    dispose(){if(disposed)return;disposed=true;win?.removeEventListener?.('message',handleMessage);for(const timer of timers)cancelTimer(timer);timers.clear();prefetchQueue.length=0;pendingRequests.clear();requestsByOutfit.clear();processingRequests.clear();updateListener=()=>{};assetSession.dispose();outfitAssetCache.clear();outfitAsset=null;},
    requestOutfit,
    prefetchOutfit,
    schedulePrefetchOutfit,
    cancelPrefetchSchedule,
    setUpdateListener(fn) {
      updateListener = typeof fn === 'function' ? fn : () => {};
    },
    getState() {
      return {
        outfitAsset,
        outfitId,
        targetOutfitId,
        loadingOutfitId,
        outfitRequest,
        outfitLoading,
        outfitNotice,
      };
    },
  };
}
