window.__ModuleLoader__.load({
  id: 'dsh-whale-status',
  factory: (require) => {
    const React = require('react');
    let hostModules;
    const roomEntryRevision=()=>hostModules?.manifest?.modules?.find(e=>e.id==='dsh-whale-status')?.rev||window.__DSH_BOOT__?.entries?.find(e=>e.id==='dsh-whale-status')?.rev||'';
    const panelHtml = __PANEL_HTML__;
    const roomAssetManifest=__ROOM_ASSET_MANIFEST__;
    // DSH serves package chunks with a source-map postlude, even for JSON payloads.
    const readRoomPayload=async response=>JSON.parse((await response.text()).replace(/\r?\n;\r?\n\/\/# sourceMappingURL=client\.[A-Za-z0-9._-]+\.js\.map\?rev=[A-Za-z0-9_-]+\r?\n?$/,''));
    const encodeRoomPhotoImages=__ROOM_PHOTO_ENCODER__,allowedPhotoUrls=new Set();
    const loadRoomAssetPayload=async id=>{
      const record=roomAssetManifest[id];if(!record)throw Error('未知房间资源');
      const response=await fetch('/plugins/dsh-whale-status/'+record.chunk+'?rev='+encodeURIComponent(roomEntryRevision()));
      if(!response.ok)throw Error('房间资源读取失败');const payload=await readRoomPayload(response);
      if(payload.id!==id||payload.revision!==record.revision)throw Error('房间资源版本不一致');
      const origin=window.location?.protocol==='http:'&&window.location.hostname==='127.0.0.1'?window.location.origin:'dsh-app://app';
      const allow=value=>{if(!value||typeof value!=='object')return;for(const [key,child]of Object.entries(value)){if(key==='geometry')continue;if(typeof child==='string'&&/^dsh-app:\/\/app\/plugins\/dsh-whale-status\/assets\/[a-f0-9]{64}\/[A-Za-z0-9_-]+\.(png|webp|svg|jpg)$/.test(child)){value[key]=origin+new URL(child).pathname;allowedPhotoUrls.add(value[key]);}else if(child&&typeof child==='object')allow(child);}};allow(payload.assets);
      return payload.assets;
    };
    const roomUiManifest=__ROOM_MODULE_MANIFEST__,roomUiLoads=new Map();
    const loadRoomUiChunk=record=>{
      const key=record.id+'@'+record.revision;
      if(!roomUiLoads.has(key)){
        const task=(async()=>{
          const url='/plugins/dsh-whale-status/'+record.chunk+'?rev='+encodeURIComponent(roomEntryRevision());
          const response=await fetch(url);if(!response.ok)throw Error('界面资源读取失败，请重试。');
          const payload=await readRoomPayload(response);
          if(payload?.id!==record.id||payload.revision!==record.revision)throw Error('界面资源版本不一致，请刷新视窗后重试。');
          return payload;
        })();
        roomUiLoads.set(key,task);task.catch(()=>{if(roomUiLoads.get(key)===task)roomUiLoads.delete(key);});
      }
      return roomUiLoads.get(key);
    };
    let roomAssets,lifeAssets,roomRuntime,islandMapAssets,dressingAssets;
    const dressingFavoritesKey='liuli-companion:dressing-favorites:v1';
    const roomChunkDeliveries=new WeakMap();
    const roomRuntimeKey='liuli-companion:room-runtime:v1';
    try{roomRuntime=JSON.parse(localStorage.getItem(roomRuntimeKey)||'null');}catch{}
    const validRoomEnergy=__ROOM_ENERGY_VALIDATOR__,roomEnergyKey='liuli-companion:room-energy:v1';let roomEnergy=null;
    try{const saved=JSON.parse(localStorage.getItem(roomEnergyKey)||'null');if(validRoomEnergy(saved))roomEnergy=saved;}catch{}
    const wardrobeIds=new Set(__WARDROBE_IDS__),wardrobeLoads=new Map(),wardrobeKey='liuli-companion:wardrobe:v1';
    const settledWardrobeLoads=new Set();
    let selectedWardrobeId='original';
    try{const saved=localStorage.getItem(wardrobeKey);if(wardrobeIds.has(saved))selectedWardrobeId=saved;}catch{}
    const trimWardrobeLoads=()=>{
      for(const id of wardrobeLoads.keys()){
        if(wardrobeLoads.size<=6)break;
        if(id!==selectedWardrobeId&&settledWardrobeLoads.has(id)){wardrobeLoads.delete(id);settledWardrobeLoads.delete(id);}
      }
    };
    const allowedActions = new Set(__ALLOWED_ACTIONS__);
    const loadWhaleChunk = async (chunkName) => {
      try {
        const rev = roomEntryRevision();
        const url = `/plugins/dsh-whale-status/${chunkName}${rev ? `?rev=${rev}` : ''}`;
        const resp = await fetch(url);
        if (resp.ok) {
          const code = await resp.text();
          let loaded = null;
          const prev = window.__ModuleLoader__.load;
          window.__ModuleLoader__.load = function(reg) {
            if (reg.id === 'dsh-whale-status' && reg.chunk === chunkName) {
              loaded = reg.factory();
            } else {
              prev.apply(this, arguments);
            }
          };
          try {
            (0, eval)(code);
          } finally {
            window.__ModuleLoader__.load = prev;
          }
          if (loaded) return loaded;
        }
      } catch (err) {
        console.warn('[WHALE HOST] direct chunk fetch exception:', err);
      }
      if (typeof require?.async === 'function') {
        return await require.async('./' + chunkName);
      }
      throw new Error(`Cannot load chunk: ${chunkName}`);
    };
    __FRAME_BRIDGE__
    __BOOK_STORAGE__
    __HUD_SAFE_AREA__
    const requestBooks=createRoomBookStorage(window.indexedDB);
    const PANEL_ID = 'whale-status';
    function StatusPanel() {
      const frame = React.useRef(null);
      const surface = React.useRef(null);
      React.useEffect(() => attachHudSafeArea({surface:surface.current,frame:frame.current}), []);
      React.useEffect(() => attachFrameBridge(window, () => frame.current?.contentWindow, allowedActions), []);
      React.useEffect(()=>{
        let active=true;
        const receive=async event=>{
          const target=frame.current?.contentWindow,d=event.data;
          if(!target||event.source!==target||d?.channel!=='liuli-companion')return;
          if(d.type==='room-photo-image-request'&&typeof d.requestId==='string'&&d.requestId.length<100){
            try{const images=await encodeRoomPhotoImages(d.urls,{allowed:allowedPhotoUrls});if(active&&target===frame.current?.contentWindow)target.postMessage({channel:'liuli-companion',type:'room-photo-images',requestId:d.requestId,images},'*');}
            catch{if(active&&target===frame.current?.contentWindow)target.postMessage({channel:'liuli-companion',type:'room-photo-images',requestId:d.requestId,error:'照片素材读取失败，请重试。'},'*');}return;
          }
          if(d.type==='room-module-request'&&typeof d.requestId==='string'&&d.requestId.length<100){
            const record=Object.hasOwn(roomUiManifest,d.id)&&roomUiManifest[d.id];
            try{
              if(!record||record.revision!==d.revision)throw Error('界面资源版本不一致，请刷新视窗后重试。');
              const payload=await loadRoomUiChunk(record);
              if(active&&target===frame.current?.contentWindow)target.postMessage({channel:'liuli-companion',type:'room-module-assets',requestId:d.requestId,id:d.id,payload},'*');
            }catch(error){if(active&&target===frame.current?.contentWindow)target.postMessage({channel:'liuli-companion',type:'room-module-error',requestId:d.requestId,id:d.id,error:error.message},'*');}
            return;
          }
          if(d.type==='room-assets-request')return sendRoomChunk('art',d.requestId,()=>active);
          if(d.type==='dressing-favorites'&&Array.isArray(d.ids)&&d.ids.length<=14){try{localStorage.setItem(dressingFavoritesKey,JSON.stringify([...new Set(d.ids.filter(id=>id==='original'||wardrobeIds.has(id)))]));}catch{}return;}
          if(d.type==='dressing-request'&&typeof d.requestId==='string'&&d.requestId.length<100){
            let pending;
            try{pending=dressingAssets??=loadRoomAssetPayload('dressing');const assets=await pending;let favorites=[];try{const saved=JSON.parse(localStorage.getItem(dressingFavoritesKey)||'[]');if(Array.isArray(saved))favorites=saved.filter(id=>id==='original'||wardrobeIds.has(id));}catch{}
              if(active&&target===frame.current?.contentWindow)target.postMessage({channel:'liuli-companion',type:'dressing-assets',requestId:d.requestId,assets,favorites},'*');
            }catch{if(dressingAssets===pending)dressingAssets=null;if(active&&target===frame.current?.contentWindow)target.postMessage({channel:'liuli-companion',type:'dressing-error',requestId:d.requestId},'*');}return;
          }
          if(d.type==='island-map-request'){sendIslandMap();return;}
          if(d.type==='book-request'&&typeof d.requestId==='string'&&d.requestId.length<100){
            try{const value=await requestBooks(d.op,d.value);if(active&&target===frame.current?.contentWindow)target.postMessage({channel:'liuli-companion',type:'book-response',requestId:d.requestId,value},'*');}
            catch(error){if(active&&target===frame.current?.contentWindow)target.postMessage({channel:'liuli-companion',type:'book-response',requestId:d.requestId,error:error.message},'*');}return;
          }
          if(d.type==='room-runtime-request'){target.postMessage({channel:'liuli-companion',type:'room-runtime',value:roomRuntime},'*');return;}
          if(d.type==='room-energy-request'){target.postMessage({channel:'liuli-companion',type:'room-energy',value:roomEnergy},'*');return;}
          if(d.type==='room-energy-save'){if(validRoomEnergy(d.value)){roomEnergy={version:1,energy:d.value.energy,updatedAt:d.value.updatedAt};try{localStorage.setItem(roomEnergyKey,JSON.stringify(roomEnergy));}catch{}}return;}
          if(d.type==='room-runtime-save'){
            if(d.value?.version===1&&Number.isFinite(d.value.savedAt)){try{const json=JSON.stringify(d.value);if(json.length<131072){roomRuntime=JSON.parse(json);localStorage.setItem(roomRuntimeKey,json);}}catch{}}return;
          }
          if(d.type==='wardrobe-selected'&&(d.id==='original'||wardrobeIds.has(d.id))){selectedWardrobeId=d.id;try{localStorage.setItem(wardrobeKey,d.id);}catch{}trimWardrobeLoads();return;}
          if(d.type!=='wardrobe-request'||typeof d.requestId!=='string')return;
          let id=d.id;if(id===undefined){try{id=localStorage.getItem(wardrobeKey);}catch{}id=wardrobeIds.has(id)?id:'original';}
          if(id!=='original'&&!wardrobeIds.has(id))return;
          let pending;
          try{
            let assets=null;if(id!=='original'){
              pending=wardrobeLoads.get(id)||loadRoomAssetPayload('wardrobe:'+id);
              wardrobeLoads.delete(id);wardrobeLoads.set(id,pending);
              assets=await pending;
              if(wardrobeLoads.get(id)===pending){settledWardrobeLoads.add(id);trimWardrobeLoads();}
            }
            if(active&&target===frame.current?.contentWindow)target.postMessage({channel:'liuli-companion',type:'wardrobe-assets',id,requestId:d.requestId,assets},'*');
          }catch(e){console.error('[WHALE HOST ERROR wardrobe]:', e);if(wardrobeLoads.get(id)===pending){wardrobeLoads.delete(id);settledWardrobeLoads.delete(id);}if(active&&target===frame.current?.contentWindow)target.postMessage({channel:'liuli-companion',type:'wardrobe-error',requestId:d.requestId},'*');}
        };
        window.addEventListener('message',receive);
        // Start small metadata reads while the child parses its UI, then share
        // those same promises when it requests the first scene and saved outfit.
        const art=roomAssets??=loadRoomAssetPayload('art');
        art.catch(()=>{if(roomAssets===art)roomAssets=null;});
        const life=lifeAssets??=loadRoomAssetPayload('life');
        life.catch(()=>{if(lifeAssets===life)lifeAssets=null;});
        if(selectedWardrobeId!=='original'&&!wardrobeLoads.has(selectedWardrobeId)){
          const id=selectedWardrobeId,pending=loadRoomAssetPayload('wardrobe:'+id);wardrobeLoads.set(id,pending);
          pending.then(()=>{if(wardrobeLoads.get(id)===pending){settledWardrobeLoads.add(id);trimWardrobeLoads();}},()=>{if(wardrobeLoads.get(id)===pending){wardrobeLoads.delete(id);settledWardrobeLoads.delete(id);}});
        }
        const mountedTarget=frame.current?.contentWindow;
        notifyRoomFrame();
        return()=>{active=false;if(mountedTarget)roomChunkDeliveries.delete(mountedTarget);window.removeEventListener('message',receive);};
      },[]);
      React.useEffect(()=>{
        let active=true;
        const receive=async event=>{
          const target=frame.current?.contentWindow;
          if(!target||event.source!==target||event.data?.channel!=='liuli-companion'||event.data.type!=='room-life-request')return;
          return sendRoomChunk('life',event.data.requestId,()=>active);
        };
        window.addEventListener('message',receive);return()=>{active=false;window.removeEventListener('message',receive);};
      },[]);
      const sendIslandMap=async()=>{
        try{
          islandMapAssets??=loadWhaleChunk('client.island-map-v1.js');
          const assets=await islandMapAssets;
          if(frame.current?.contentWindow)frame.current.contentWindow.postMessage({channel:'liuli-companion',type:'island-map-assets',assets},'*');
        }catch(e){
          console.error('[WHALE HOST ERROR island-map]:', e);
          islandMapAssets=null;
          frame.current?.contentWindow?.postMessage({channel:'liuli-companion',type:'island-map-error'},'*');
        }
      };
      const sendRoomChunk=(kind,requestId,isActive)=>{
        const target=frame.current?.contentWindow;if(!target)return;
        let state=roomChunkDeliveries.get(target);if(!state){state={};roomChunkDeliveries.set(target,state);}
        const key=typeof requestId==='string'?requestId:'legacy';
        if(state[kind]?.key===key)return state[kind].promise;
        const delivery={key,promise:null};state[kind]=delivery;
        const current=()=>isActive()&&target===frame.current?.contentWindow&&roomChunkDeliveries.get(target)===state&&state[kind]===delivery;
        delivery.promise=(async()=>{
          let pending;
          try{
            pending=kind==='art'?(roomAssets??=loadRoomAssetPayload('art')):(lifeAssets??=loadRoomAssetPayload('life'));
            const assets=await pending;
            if(current())target.postMessage({channel:'liuli-companion',type:kind==='art'?'room-assets':'room-life-assets',requestId,assets},'*');
          }catch(error){
            if(kind==='art'&&roomAssets===pending)roomAssets=null;
            if(kind==='life'&&lifeAssets===pending)lifeAssets=null;
            if(current())target.postMessage({channel:'liuli-companion',type:kind==='art'?'room-assets-error':'room-life-error',requestId},'*');
            if(state[kind]===delivery)delete state[kind];
          }
        })();
        return delivery.promise;
      };
      const notifyRoomFrame=()=>{
        const target=frame.current?.contentWindow;if(!target)return;
        target.postMessage({channel:'liuli-companion',type:'room-runtime',value:roomRuntime},'*');
        target.postMessage({channel:'liuli-companion',type:'room-energy',value:roomEnergy},'*');
        // Recover requests sent before the host effect was listening. The child
        // reuses its request IDs, so a pending/already delivered chunk is shared.
        target.postMessage({channel:'liuli-companion',type:'room-assets-ready'},'*');
      };
      return React.createElement('div', {ref:surface,style:{position:'relative',width:'100%',height:'100%',minHeight:0,overflow:'hidden'}}, React.createElement('iframe', {
        ref: frame,
        title: '琉璃陪伴中心',
        srcDoc: panelHtml,
        onLoad:notifyRoomFrame,
        sandbox: 'allow-scripts',
        style: { position:'absolute',left:0,top:0,display: 'block', width: '100%', height: '100%', border: 0, minHeight: 0, background: '#0b171b' },
      }));
    }
    function PanelIcon() {
      return React.createElement('svg', {
        width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none',
        stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      }, React.createElement('path', { d: 'M3 12a7 7 0 0 0 14 0c2 0 4-2 4-4-2 0-3 1-4 2a7 7 0 0 0-14 2Z' }),
      React.createElement('path', { d: 'M8 5V3m0 1L6 3m2 1 2-1' }),
      React.createElement('circle', { cx: 6.5, cy: 10.5, r: .6, fill: 'currentColor', stroke: 'none' }));
    }
    function apply(ctx) {
      hostModules=ctx.modules;
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, StatusPanel));
      ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
        name: 'sidebar.panellist', id: PANEL_ID, order: 30, label: '琉璃陪伴中心',
      }, PanelIcon));
    }
    return { name: 'dsh-whale-status', inject: ['slots', 'layout', 'modules'], apply };
  },
});


