(() => {
 'use strict';
 let panelDisposed=false;const panelCleanups=[],panelTimers=new Set();
 const listen=(target,type,listener)=>{target?.addEventListener?.(type,listener);panelCleanups.push(()=>target?.removeEventListener?.(type,listener));};
 const schedulePanel=(fn,delay)=>{const handle=setTimeout(()=>{panelTimers.delete(handle);if(!panelDisposed)fn();},delay);panelTimers.add(handle);return handle;};
 const cancelPanel=handle=>{panelTimers.delete(handle);clearTimeout(handle);};

  const safeStorage = (() => {
    try {
      if (typeof window !== 'undefined' && 'safeStorage' in window && window.safeStorage) {
        window.safeStorage.setItem('__dsh_test_storage__', '1');
        window.safeStorage.removeItem('__dsh_test_storage__');
        return window.safeStorage;
      }
    } catch {}
    const mem = new Map();
    return {
      getItem: k => mem.has(k) ? mem.get(k) : null,
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: k => mem.delete(k),
      clear: () => mem.clear()
    };
  })();

 const $=id=>document.getElementById(id),content=$('content'),notice=$('notice');
 const furnitureGroups=typeof ROOM_PANEL_FURNITURE_GROUPS!=='undefined'?ROOM_PANEL_FURNITURE_GROUPS:{
  comms:{label:'全息通讯视窗',floor:'1',pages:['overview','qq','proactive','expression']},
  computer:{label:'琉璃的电脑',floor:'1',pages:['memory','persona','relations']},
  workbench:{label:'工坊与舱室中枢',floor:'1',pages:['tools','decor','system','about']},
  enchant:{label:'附魔台',floor:'2',pages:['diary']},
  bed:{label:'床',floor:'2',pages:['night','dreams']}
 };
 const pageTargets=typeof ROOM_PANEL_PAGE_TARGETS!=='undefined'?ROOM_PANEL_PAGE_TARGETS:{
  overview:['comms','overview'],qq:['comms','qq'],proactive:['comms','proactive'],expression:['comms','expression'],
  memory:['computer','memory'],persona:['computer','persona'],relations:['computer','relations'],
  tools:['workbench','tools'],decor:['workbench','decor'],system:['workbench','system'],about:['workbench','about'],
  night:['bed','night'],dreams:['bed','dreams'],diary:['enchant','read']
 };
 const OBSERVER_FLOOR_KEY = 'liuli-cottage-dev:room-floor:v1';
 const OBSERVER_DETAIL_KEY = 'liuli-cottage-dev:room-detail:v1';
 const observerCtrl = typeof createRoomObserverController === 'function'
  ? createRoomObserverController({ parent, storage: typeof safeStorage !== 'undefined' ? safeStorage : undefined })
  : null;
 function getPersistedObserverFloor() {
  if (observerCtrl) return observerCtrl.getPersistedObserverFloor();
  try {
    const val = safeStorage.getItem(OBSERVER_FLOOR_KEY);
    if (val === '1' || val === '2' || val === 'all') return val;
  } catch {}
  return '1';
 }
 const roomView = observerCtrl ? observerCtrl.roomView : { floor: getPersistedObserverFloor(), detail: false, preview: 'auto', immersive: false };
 function setObserverFloor(val, sceneInstance = activeRoomScene) {
  if (observerCtrl) {
    observerCtrl.setObserverFloor(val, sceneInstance, typeof updateFloorCards === 'function' ? updateFloorCards : undefined);
    saveRoomRuntime(true);
    return;
  }
  if (!['1', '2', 'all'].includes(val)) return;
  roomView.floor = val;
  try { safeStorage.setItem(OBSERVER_FLOOR_KEY, val); } catch {}
  try { parent.postMessage({ channel: 'liuli-companion', type: 'room-view-floor-save', floor: val }, '*'); } catch {}
  if (sceneInstance?.setRoomFloor) {
    sceneInstance.setRoomFloor(val);
  }
  if (typeof updateFloorCards === 'function') {
    updateFloorCards(val);
  }
  saveRoomRuntime(true);
 }
 const runtimePersistence = typeof createRoomRuntimePersistence === 'function'
  ? createRoomRuntimePersistence({ parent, window, document, setTimeout, clearTimeout, getActiveRoomScene: () => activeRoomScene })
  : null;
 let fallbackRuntime=null,fallbackReceived=false,resolveFallbackRuntime;
 const runtimeReady=runtimePersistence?runtimePersistence.runtimeReady:new Promise(resolve=>{resolveFallbackRuntime=resolve;schedulePanel(resolve,1500);});
 if(!runtimePersistence){
  listen(window,'message',event=>{if(event.source!==parent||event.data?.channel!=='liuli-companion'||event.data.type!=='room-runtime'||fallbackReceived)return;fallbackReceived=true;fallbackRuntime=event.data.value;resolveFallbackRuntime();});
  parent.postMessage({channel:'liuli-companion',type:'room-runtime-request'},'*');
 }
 const getRoomRuntimeSnapshot=()=>{
  const snap=runtimePersistence?runtimePersistence.getRoomRuntime():fallbackRuntime;
  if(snap&&snap.state&&typeof safeStorage!=='undefined'){
   try{const sf=safeStorage.getItem(OBSERVER_FLOOR_KEY);if(sf==='1'||sf==='2'||sf==='all')snap.state.floor=sf;}catch{}
  }
  return snap;
 };
 const saveRoomRuntime=(force=false)=>{
  if(runtimePersistence){runtimePersistence.saveRoomRuntime(force);return;}
  const value=activeRoomScene?.getRoomRuntime?.();if(value){fallbackRuntime=value;parent.postMessage({channel:'liuli-companion',type:'room-runtime-save',value},'*');}
 };
 const stageNames={awake:'清醒',onset:'刚入睡',light:'浅睡',deep:'深睡',rem:'梦境时段'};
 const statusNames={queued:'等待中',running:'进行中',done:'已完成',failed:'失败',unknown:'结果待核对',active:'有效',archived:'已归档',conflict:'待核对'};
 let current='room',activePanelKey='room',revision=0,renderVersion=0,roomRevision=0,panelRevision=0,busy=false;
 let activeRoomScene=null,fittingScene=null,roomWorkspace=null,roomBookReader=null,roomArtAssets=null,dressingAssetClient=null;
 let cachedRoomShell=null,cachedRoomResult=null,cachedRoomJson='',cachedRoomIdentity='',cachedRoomEnv='',currentRoomData=null,activeRoomRestoreGate=null,prefetchedRoom=null;
 let activeFurnitureButtons={},hudButtons=null,latestNight=null,latestJobs=[];
 const cachedViewNodes=new Map(),readCache=new Map(),inflightReads=new Map();
 const READ_CACHE_TTL=12000;
 const cloneData=typeof structuredClone==='function'?structuredClone:v=>JSON.parse(JSON.stringify(v));
 const invalidateReadCache=(dropViews=false)=>{readCache.clear();if(dropViews)cachedViewNodes.clear();};
 const roomAssetRequests={art:{},life:{}};
 const roomPhotoImages=typeof createRoomPhotoImages==='function'?createRoomPhotoImages({win:window,parent,uid:()=>uid()}):null;
 panelCleanups.push(()=>roomPhotoImages?.dispose());
 let photoExporting=false;
 const photoDownloadUrls=new Set();
 panelCleanups.push(()=>{for(const url of photoDownloadUrls)URL.revokeObjectURL(url);photoDownloadUrls.clear();});
 function requestRoomAsset(kind,{retry=false,resend=false}={}){
  const request=roomAssetRequests[kind];
  if((kind==='art'?roomArtAssets:ROOM_ACTIONS.lifeV10)&&!retry)return;
  if(request.pending&&!retry&&!resend)return;
  if(!request.id||retry)request.id=uid();
  request.pending=true;request.done=false;
  parent.postMessage({channel:'liuli-companion',type:kind==='art'?'room-assets-request':'room-life-request',requestId:request.id},'*');
 }
 schedulePanel(()=>requestRoomAsset('art'),0);
 schedulePanel(()=>requestRoomAsset('life'),60);
 schedulePanel(()=>{if(!wardrobeCtrl.getState().outfitRequest)requestOutfit();},180);

 const viewModeKey=typeof VIEW_MODE_STORAGE_KEY!=='undefined'?VIEW_MODE_STORAGE_KEY:'liuli-cottage-dev:view-mode:v1';
 const hasWebGL=typeof window!=='undefined'&&typeof window.WebGLRenderingContext!=='undefined';
 let currentViewMode='room';
 try{const m=safeStorage.getItem(viewModeKey);if(m==='room'||m==='island')currentViewMode=m;}catch{}
 if(!hasWebGL)currentViewMode='room';

 function syncVersionSwitcher(){
  const btnRoom=$('btn-ver-room'), btnIsland=$('btn-ver-island');
  if(btnRoom){
   btnRoom.classList.toggle('active', currentViewMode==='room');
   btnRoom.setAttribute('aria-pressed', String(currentViewMode==='room'));
  }
  if(btnIsland){
   btnIsland.classList.toggle('active', currentViewMode==='island');
   btnIsland.setAttribute('aria-pressed', String(currentViewMode==='island'));
  }
 }
 schedulePanel(()=>{
  syncVersionSwitcher();
  $('btn-ver-room')?.addEventListener('click',()=>switchViewMode('room'));
  $('btn-ver-island')?.addEventListener('click',()=>switchViewMode('island'));
 }, 10);

 let activeIslandInstance=null,islandLoadGeneration=0,pendingIslandMount=null,islandMapCode=null,islandLoadTimer=null;
 function failIslandLoad(message){
  islandLoadGeneration++;cancelPanel(islandLoadTimer);islandLoadTimer=null;pendingIslandMount=null;
  if(currentViewMode!=='island')return;
  content.replaceChildren(div('island-map-surface',div('island-loading-badge',node('strong','花海岛暂时无法打开'),node('p',message,'small'),div('actions',button('重试',()=>render(),'quiet'),button('回到小屋',()=>switchViewMode('room'),'quiet')))));
 }
 function requestIslandMap(){
  cancelPanel(islandLoadTimer);
  islandLoadTimer=schedulePanel(()=>failIslandLoad('资源加载超时，请重试。'),30000);
  if(typeof ROOM_MODULE_MANIFEST!=='undefined'){
   const generation=++islandLoadGeneration;
   loadRoomFeature('island').then(exports=>{
    if(panelDisposed||currentViewMode!=='island'||generation!==islandLoadGeneration)return;
    cancelPanel(islandLoadTimer);islandLoadTimer=null;
    window.mountWhaleIsland=exports.mountWhaleIsland;
    const mount=pendingIslandMount;pendingIslandMount=null;mount?.();
   }).catch(error=>{if(!panelDisposed&&generation===islandLoadGeneration)failIslandLoad(error.message);});
  }else parent.postMessage({channel:'liuli-companion',type:'island-map-request'},'*');
 }
 listen(window,'message',event=>{
  if(typeof ROOM_MODULE_MANIFEST!=='undefined')return;
  const d=event.data;if(event.source!==parent||d?.channel!=='liuli-companion')return;
  if(d.type==='island-map-assets'){
   cancelPanel(islandLoadTimer);islandLoadTimer=null;
   islandMapCode=d.assets?.code;
   if(!islandMapCode){failIslandLoad('未收到完整的花海岛资源。');return;}
   if(islandMapCode&&!window.mountWhaleIsland){
    try{
     const s=document.createElement('script');
     s.textContent=islandMapCode;
     document.head.appendChild(s);
    }catch(e){failIslandLoad('花海岛资源无法初始化。');console.error('[WHALE PANEL ERROR island-map script inject]:',e);return;}
   }
   if(pendingIslandMount&&window.mountWhaleIsland){
    const fn=pendingIslandMount;pendingIslandMount=null;fn();
   }
   if(!window.mountWhaleIsland)failIslandLoad('花海岛引擎未能加载，请重试。');
  }
  if(d.type==='island-map-error')failIslandLoad('花海岛资源读取失败，请重试。');
 });

 function switchViewMode(mode,targetFloor){
  islandLoadGeneration++;pendingIslandMount=null;cancelPanel(islandLoadTimer);islandLoadTimer=null;
  if(mode==='room'){
   currentViewMode='room';try{safeStorage.setItem(viewModeKey,'room');}catch{}
   if(targetFloor&&['1','2','all'].includes(targetFloor)){
    roomView.floor=targetFloor;try{safeStorage.setItem(typeof OBSERVER_FLOOR_KEY==='string'?OBSERVER_FLOOR_KEY:'liuli-companion:room-floor:v1',targetFloor);}catch{}
   }
   if(activeIslandInstance){activeIslandInstance.dispose?.();activeIslandInstance=null;}
   syncVersionSwitcher();
   return render();
  }else{
   if(!hasWebGL){show('当前环境暂不支持花海岛的 3D 画面。',true);return;}
   currentViewMode='island';try{safeStorage.setItem(viewModeKey,'island');}catch{}
   roomDispose();roomDispose=()=>{};cachedRoomShell=null;cachedRoomResult=null;
   syncVersionSwitcher();
   return render();
  }
 }

 let openRoomFurniture=null;
 const openFurnitureForPage=pageId=>{
  const target=pageTargets[pageId];
  if(!target)return;
  if(currentViewMode==='island'&&hasWebGL){
   void switchViewMode('room');
  }
  let attempts=0;
  const tryOpen=()=>{
   if(openRoomFurniture&&activeRoomScene){
    void openRoomFurniture(target[0],target[1]);
   }else if(attempts++<40){
    schedulePanel(tryOpen,50);
   }
  };
  tryOpen();
 };
 const uid=()=>`ui-${Date.now()}-${Array.from(crypto.getRandomValues(new Uint32Array(2)),x=>x.toString(16)).join('')}`;
 const bookRequests=new Map();
 const requestBooks=(op,value)=>new Promise((resolve,reject)=>{const requestId=uid(),timer=schedulePanel(()=>{bookRequests.delete(requestId);reject(Error('书架响应超时，请重试。'));},15000);bookRequests.set(requestId,{resolve,reject,timer});parent.postMessage({channel:'liuli-companion',type:'book-request',requestId,op,value},'*');});
 listen(window,'message',event=>{const d=event.data;if(event.source!==parent||d?.channel!=='liuli-companion'||d.type!=='book-response')return;const p=bookRequests.get(d.requestId);if(!p)return;bookRequests.delete(d.requestId);cancelPanel(p.timer);d.error?p.reject(Error(d.error)):p.resolve(d.value);});
 const moduleClient=typeof ROOM_MODULE_MANIFEST==='undefined'?null:createRoomModuleClient({window,parent,uid});
 const featureLoader=moduleClient?createRoomModuleLoader({manifest:ROOM_MODULE_MANIFEST,requestChunk:moduleClient.requestChunk,evaluateModule:payload=>evaluateRoomModule({document,window},payload),attachStyles:options=>attachRoomStyles({document,...options})}):null;
 function loadRoomFeature(id){return featureLoader?featureLoader.load(id):Promise.resolve(id==='dressing'?{createRoomDressing}:id==='workspaces'?{createRoomWorkspace}:{createRoomBookReader});}
 const workspaceStore={};
 const workspaceRequest=async(action,body,rev)=>{if(rev===undefined)return rpc(action,body,undefined,true);if(busy)throw Error("上一项操作还在处理");busy=true;try{const res=await rpc(action,body,rev,true);invalidateReadCache();return res;}finally{busy=false;}};
 const wardrobeCtrl=typeof createRoomWardrobeController==='function'
  ?createRoomWardrobeController({
    catalog:WARDROBE_CATALOG,
    parent,
    window:typeof window!=='undefined'?window:null,
    setTimeout,
    clearTimeout,
    uid,
    getActiveRoomScene:()=>activeRoomScene,
    getFittingScene:()=>fittingScene,
   })
  :(()=>{
    let outfitAsset=null,outfitId='original',targetOutfitId='',loadingOutfitId=null,outfitRequest='',outfitLoading=false,outfitNotice='',updateListener=()=>{};
    const outfitAssetCache=new Map(),pendingRequests=new Map();
    if(typeof window!=='undefined'){window.outfitAssetCache=outfitAssetCache;listen(window,'message',async event=>{const d=event.data;if(event.source!==parent||d?.channel!=='liuli-companion'||d.type!=='wardrobe-assets')return;const reqTarget=d.requestId?pendingRequests.get(d.requestId):null;if(d.requestId)pendingRequests.delete(d.requestId);if((reqTarget==='__restore__'&&!targetOutfitId)||d.id===targetOutfitId){outfitId=d.id;targetOutfitId=d.id;outfitAsset=d.id==='original'?null:d.assets;outfitLoading=false;loadingOutfitId=null;updateListener();}});}
    return{
     outfitAssetCache,
     requestOutfit(id){if(!id){outfitRequest=uid();pendingRequests.set(outfitRequest,'__restore__');parent.postMessage({channel:'liuli-companion',type:'wardrobe-request',requestId:outfitRequest},'*');return;}targetOutfitId=id;if(id==='original'){outfitId='original';loadingOutfitId=null;outfitLoading=false;outfitAsset=null;outfitNotice='原装 · 完整生活动作';activeRoomScene?.setRoomOutfit?.(null);fittingScene?.setRoomOutfit?.(null);updateListener();parent.postMessage({channel:'liuli-companion',type:'wardrobe-selected',id:'original'},'*');return;}outfitRequest=uid();loadingOutfitId=id;outfitLoading=true;pendingRequests.set(outfitRequest,id);updateListener();parent.postMessage({channel:'liuli-companion',type:'wardrobe-request',id,requestId:outfitRequest},'*');},
     prefetchOutfit(){},
     schedulePrefetchOutfit(){},
     cancelPrefetchSchedule(){},
     setUpdateListener(fn){updateListener=typeof fn==='function'?fn:()=>{};},
     getState(){return{outfitAsset,outfitId,targetOutfitId,loadingOutfitId,outfitRequest,outfitLoading,outfitNotice};},
    };
   })();
 const {outfitAssetCache,requestOutfit,prefetchOutfit,schedulePrefetchOutfit,cancelPrefetchSchedule}=wardrobeCtrl;
 listen(window,'message',event=>{
  if(event.source!==parent||event.data?.channel!=='liuli-companion')return;
  if(event.data.type==='room-assets-ready'){requestRoomAsset('art',{resend:true});requestRoomAsset('life',{resend:true});return;}
  const kind=event.data.type==='room-life-assets'||event.data.type==='room-life-error'?'life':'art',assetRequest=roomAssetRequests[kind];
  if(event.data.requestId&&event.data.requestId!==assetRequest.id)return;
  if(event.data.type==='room-life-error'||event.data.type==='room-assets-error'){
   assetRequest.pending=false;assetRequest.done=false;
   activeRoomScene?.recordRoomDiagnostic?.('asset-error',{asset:kind==='life'?'client.room-life-v20.js':'client.room-art-v12.js',stage:'chunk-load'});return;
  }
  if(event.data.type==='room-life-assets'){
   if(assetRequest.done&&event.data.requestId)return;
   assetRequest.pending=false;
   const a=event.data.assets;if(!validateRoomLifeAssets(a))return;
   assetRequest.done=true;
   ROOM_ACTIONS.lifeV10=a;if(!activeRoomScene&&typeof prewarmRoomLifeAssets==='function')void prewarmRoomLifeAssets(a);
   const p=activeRoomScene?.setRoomLifeAssets?.(a);if(p&&typeof p.then==="function")p.then(()=>activeRoomRestoreGate?.restore?.());else activeRoomRestoreGate?.restore?.();fittingScene?.setRoomLifeAssets?.(a);return;
  }
  if(event.data.type!=='room-assets')return;
  if(assetRequest.done&&event.data.requestId)return;
  assetRequest.pending=false;
  const a=event.data.assets;if(!a||!['floor-one','floor-two','garden','mirror'].every(k=>typeof a[k]==='string'&&isRoomImageUrl(a[k],['png','webp'])&&a[k].length<5*1024*1024))return;
  assetRequest.done=true;
  roomArtAssets=a;
  // Share the existing guarded offline art delivery; no changes to navigation or storage.
  if(typeof a.hudBorder==='string'&&isRoomImageUrl(a.hudBorder,['svg+xml'])&&a.hudBorder.length<4*1024*1024){
   STAR_ECHO_SVG_BORDER_DATA_URL=a.hudBorder;
   document.documentElement?.style?.setProperty('--v52-border-art','url("'+a.hudBorder+'")');
  }
  if(typeof a.hudNavigation==='string'&&isRoomImageUrl(a.hudNavigation,['png','webp'])&&a.hudNavigation.length<2*1024*1024){
   document.documentElement?.style?.setProperty('--v52-nav-reference','url("'+a.hudNavigation+'")');
  }
  if(typeof a.hudFrame==='string'&&isRoomImageUrl(a.hudFrame,['png','webp'])){
   STAR_ECHO_FRAME_DATA_URL=a.hudFrame;
   const mainEl=typeof document?.querySelector==='function'?document.querySelector('body.star-echo-theme main'):null;
   if(mainEl?.style){
    mainEl.style.setProperty('background',`#01040d url("${a.hudFrame}") no-repeat center center`,'important');
    mainEl.style.setProperty('background-size','100% 100%','important');
   }
  }
  ROOM_ACTIONS.house.floors[1]=a['floor-one'];ROOM_ACTIONS.house.floors[2]=a['floor-two'];
  ROOM_ACTIONS.house.repairs[1].url=a['floor-one'];ROOM_ACTIONS.house.repairs[2].url=a['floor-two'];ROOM_ACTIONS.house.actions.garden.frames[0]=a.garden;ROOM_ACTIONS.house.mirror=a.mirror;
  activeRoomScene?.setRoomArtAssets?.(a);fittingScene?.setRoomArtAssets?.(a);
 });
 const pending=new Map(),filters={},drafts=new Map();
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=String(text);if(cls)n.className=cls;return n;};
 const append=(parent,...children)=>{for(const c of children.flat(Infinity))if(c!==undefined&&c!==null)parent.append(typeof c==='string'?document.createTextNode(c):c);return parent;};
 const div=(cls,...children)=>append(node('div',null,cls),children);
 const badge=(label,kind='')=>node('span',label,'tag '+kind);
 const help=text=>node('p',text,'help');
 const stamp=value=>value?new Date(value).toLocaleString('zh-CN',{hour12:false,timeZone:'Asia/Shanghai'}):'尚无记录';
 const pretty=value=>node('pre',JSON.stringify(value,null,2));
 const details=(title,child)=>append(node('details'),node('summary',title),child);
 const empty=text=>div('empty',text||'这里还没有记录。');
 const card=(title,...children)=>append(node('section',null,'card'),title?node('h2',title):null,children);
 const grid=(...children)=>div('grid',children);
 let noticeTimer;function show(message,error=false){cancelPanel(noticeTimer);notice.textContent=message;notice.className=error?'error':'';if(!error)noticeTimer=schedulePanel(()=>{if(notice.textContent===message)notice.textContent='';},3500);if(roomWorkspace?.isOpen?.())roomWorkspace.announce(message,error);}
 function button(label,fn,cls=''){const b=node('button',label,cls);b.type='button';b.disabled=false;b.addEventListener('click',()=>{if(b.disabled)return Promise.resolve();try{const res=fn();if(res&&typeof res.then==='function'){const isNav=Boolean(b.dataset?.page);if(!isNav)b.disabled=true;return res.catch(e=>show(e.message||String(e),true)).finally(()=>{if(!isNav)b.disabled=false;});}return Promise.resolve(res);}catch(e){show(e.message||String(e),true);return Promise.resolve();}});return b;}
 function actions(...buttons){return div('actions',buttons);}
 function rpc(action,body={},rev,withRevision=false){const id=uid();return new Promise((resolve,reject)=>{const timer=schedulePanel(()=>{pending.delete(id);reject(Error('请求超时，已保留当前草稿。写操作请先刷新核对结果。'));},75000);pending.set(id,{resolve,reject,timer,withRevision});parent.postMessage({channel:'liuli-companion',type:'request',id,action,body,revision:rev},'*');});}
 listen(window,'message',event=>{if(event.source!==parent||event.data?.channel!=='liuli-companion'||event.data?.type!=='response')return;const {id,payload}=event.data,p=pending.get(id);if(!p)return;pending.delete(id);cancelPanel(p.timer);if(payload.error){const e=Error(payload.error.message);e.code=payload.error.code;p.reject(e);}else{revision=payload.revision;p.resolve(p.withRevision?{data:payload.data,revision:payload.revision}:payload.data);}});
 const read=(a,b)=>{const key=a+':'+JSON.stringify(b||{});const hit=readCache.get(key);if(hit&&Date.now()-hit.at<READ_CACHE_TTL)return Promise.resolve(cloneData(hit.data));if(inflightReads.has(key))return inflightReads.get(key).then(cloneData);const req=rpc(a,b).then(res=>{readCache.set(key,{data:cloneData(res),at:Date.now()});return res;}).finally(()=>inflightReads.delete(key));inflightReads.set(key,req);return req;};
 const refreshActiveSurface=(force=false)=>roomWorkspace?.isOpen?.()?roomWorkspace.refresh(force):render();
let starEchoTelemetryUpdater=null,lastHudNight=null,lastHudFresh=false,lastRoomEnergy=null;
 const energyModule=typeof ROOM_CORE!=='undefined'?ROOM_CORE['src/hud-energy.mjs']:null;
 const roomEnergy=energyModule?.createRoomEnergy({win:window,parent,onChange:()=>schedulePanel(()=>updateHudTelemetry(null,false),0)});
 panelCleanups.push(()=>roomEnergy?.dispose());
 listen(document,'visibilitychange',()=>{if(document.hidden)roomEnergy?.pause();else updateHudTelemetry(null,false);});
 function roomEnergyRate(sample){return !sample?'等待精力同步':sample.mode==='paused'?'已暂停 · 进度已保留':sample.label+' · '+(sample.rate>=0?'恢复 +':'消耗 ')+sample.rate.toFixed(1)+' / 分钟'+(sample.energy>=100&&sample.rate>0?' · 精力已满':sample.energy<=0&&sample.rate<0?' · 需要休息':'');}
 const hudPulse=typeof createCompanionPulse==='function'?createCompanionPulse():null;
 function updateHudPulse(){
  if(!hudPulse)return;
  const now=Date.now(),activity=activeRoomScene?.dataset?.residentTravel==='true'?'walk':activeRoomScene?.dataset?.roomActivity;
  const sample=hudPulse.sample({now,activity,sleeping:lastRoomEnergy?.sleeping??lastHudNight?.sleeping,energy:lastRoomEnergy?.energy??lastHudNight?.energy});
  const text=$('hud-heart-rate-text'),bar=$('hud-heart-bar'),pill=$('hud-heart-rate-pill');
  if(text)text.textContent='模拟心率 '+sample.bpm+' 次/分';
  if(pill){pill.title='陪伴律动 (模拟 · '+sample.label+')，随角色活动与互动变化';pill.dataset.pulse=String(sample.bpm);pill.style.setProperty('--pulse-period',sample.period+'s');}
  if(bar)bar.style.width=sample.fill+'%';
  const detail=$('pulse-detail-value'),state=$('pulse-detail-state');
  if(detail)detail.textContent=sample.bpm+' 次/分';if(state)state.textContent=sample.label+' · 动态模拟';
 }
 function touchHudPulse(){hudPulse?.touch(Date.now());updateHudPulse();}

 function updateHudTelemetry(n,received=true){
  const statusEl = document.getElementById('hud-status-text');
  const statusBarEl = document.getElementById('hud-status-bar');
  if(received){
   lastHudFresh = typeof n?.energy === 'number' && Number.isFinite(n.energy);
   if(lastHudFresh){lastHudNight = { ...n, energy: Math.round(Math.max(0, Math.min(100,n.energy))) };roomEnergy?.acceptNight(n);}
  }
  lastRoomEnergy=roomEnergy?.sample(energyModule.roomEnergyActivity(activeRoomScene?.dataset,Boolean(activeRoomScene?.isConnected&&!document.hidden&&currentViewMode==='room')))||null;
  const sample = roomEnergy?(lastRoomEnergy?{...lastHudNight,energy:Number(lastRoomEnergy.energy.toFixed(1)),sleeping:lastRoomEnergy.sleeping}:null):lastHudNight, isSleeping = Boolean(sample?.sleeping);
  const fresh = roomEnergy?Boolean(lastRoomEnergy):lastHudFresh;
  const detailValue=document.getElementById('energy-detail-value'),detailSync=document.getElementById('energy-detail-sync');
  if(detailValue)detailValue.textContent=sample?(roomEnergy?sample.energy.toFixed(1):sample.energy)+' / 100':'正在同步';
  if(detailSync)detailSync.textContent=roomEnergy?roomEnergyRate(lastRoomEnergy):fresh?'已同步作息状态':sample?'待同步 · 保留上次读数':'等待状态更新';
  if (statusEl) {
    const energy = roomEnergy&&sample?sample.energy.toFixed(1):sample?.energy;
    const mood = sample?.moodEmoji || (energy > 60 ? '😊' : '😴');
    statusEl.textContent = sample ? (isSleeping ? '熟睡' : '清醒') + ' · 精力 ' + energy + ' · 心情 ' + mood + (fresh ? '' : ' · 待同步') : '状态同步中 · 精力 —';
    statusEl.title = roomEnergy?'小屋精力 · '+roomEnergyRate(lastRoomEnergy):fresh ? '来自当前作息状态' : sample ? '状态暂未刷新，保留上次真实读数' : '正在读取真实作息状态';
    if (statusBarEl?.style) {
      const energyPct = lastRoomEnergy?.energy ?? energy ?? 0;
      statusBarEl.style.width = energyPct + '%';
      statusBarEl.dataset.energy = sample ? String(energyPct) : '';
      statusBarEl.dataset.sync = lastRoomEnergy ? 'activity' : fresh ? 'live' : sample ? 'stale' : 'pending';
      statusBarEl.setAttribute('role','progressbar');
      statusBarEl.setAttribute('aria-label','精力');
      statusBarEl.setAttribute('aria-valuemin','0');statusBarEl.setAttribute('aria-valuemax','100');
      statusBarEl.setAttribute('aria-valuenow',sample ? String(energyPct) : '0');
      statusBarEl.setAttribute('aria-valuetext',sample ? Number(energyPct).toFixed(1)+' / 100'+(fresh?'':'，待同步') : '状态同步中');
    }
  }
  const rightOnlineEl = document.getElementById('hud-right-online-status');
  if (rightOnlineEl) {
    rightOnlineEl.textContent = !lastHudNight ? '状态同步中' : lastHudNight.sleeping ? '熟睡 · 梦境中' : '在线 · 陪伴中';
  }
  const rightOnlineDot = document.getElementById('hud-right-online-dot');
  if (rightOnlineDot) {
    rightOnlineDot.dataset.sleeping = isSleeping ? '1' : '0';
  }
  if(typeof updateHudPulse==='function')updateHudPulse();

  if(starEchoTelemetryUpdater)starEchoTelemetryUpdater(n);
  const host=$('hud-telemetry');if(!host)return;
  if(!hudButtons){
   const bNight=button('',()=>openFurnitureForPage('night'),'hud-chip');bNight.title='打开床铺 · 作息与长夜';
   const bComms=button('◉ 通讯 · 近况',()=>openFurnitureForPage('overview'),'hud-chip');bComms.title='打开全息通讯视窗 · 近况与 QQ';
   const bWork=button('⌘ 工坊 · 舱室',()=>openFurnitureForPage('decor'),'hud-chip');bWork.title='打开工坊与舱室中枢 · 工具与物品';
   hudButtons={bNight,bComms,bWork};
   append(host,bNight,bComms,bWork);
  }
  if(n){
   const stage=stageNames[n.stage]||n.stage||'清醒';
   const e=typeof n.energy==='number'?` · 精力 ${Math.round(n.energy)}`:'';
   const m=typeof n.mood==='number'?` · 心情 ${Math.round(n.mood)}`:'';
   hudButtons.bNight.textContent=`${n.sleeping?'☾':'✧'} ${stage}${e}${m}`;
  }else if(!hudButtons.bNight.textContent){
   hudButtons.bNight.textContent='✧ 状态同步中';
  }
 }
 function applyRoomData(r){
  if(panelDisposed)return;
  currentRoomData=r;
  const nextIdentity=JSON.stringify((r.items||[]).map(({id,name})=>[id,name])),nextEnv=`${Boolean(r.lamp)}:${Boolean(r.curtain)}`;
  const envMismatch=Boolean(cachedRoomShell&&typeof activeRoomScene?.setRoomEnvironment!=='function'&&cachedRoomEnv!==nextEnv);
  if(cachedRoomShell&&(nextIdentity!==cachedRoomIdentity||envMismatch)){
   roomDispose();roomDispose=()=>{};cachedRoomShell=null;cachedRoomResult=null;cachedRoomJson='';
   const shell=roomScene(r,latestNight||{sleeping:false,stage:'awake',energy:80,mood:70},latestJobs);
   cachedRoomShell=shell;cachedRoomIdentity=nextIdentity;cachedRoomEnv=nextEnv;
   const result=[shell];cachedRoomResult=result;cachedRoomJson=JSON.stringify(r);
   content.replaceChildren(...result);
   return;
  }
  cachedRoomIdentity=nextIdentity;cachedRoomEnv=nextEnv;cachedRoomJson=JSON.stringify(r);
  if(cachedRoomShell){
   cachedRoomShell._syncHotbar?.(r.items||[]);
   cachedRoomShell.classList.toggle('lamp-on',Boolean(r.lamp));
  }
  if(activeRoomScene)activeRoomScene.setRoomEnvironment?.({lamp:Boolean(r.lamp),curtain:Boolean(r.curtain)});
 }
 async function command(a,b={},reload=true){
  if(busy)throw Error('上一项操作还在处理');
  const originKey=activePanelKey,submittedDraft=drafts.get(originKey),useRev=a==='/room/save'?roomRevision:panelRevision;
  busy=true;
  try{
   const {data:result,revision:committedRevision}=await rpc(a,b,useRev,true);
   invalidateReadCache();
   if(a==='/room/save'){
    roomRevision=committedRevision;
    if(result&&Array.isArray(result.items))applyRoomData(result);
   }else{
    panelRevision=committedRevision;
   }
   show(result?.status==='queued'?'任务已排队，可在工坊系统页查看执行进度。':'操作已完成，已读取服务返回结果。');
   if(drafts.get(originKey)===submittedDraft)drafts.delete(originKey);
   if(reload){
    if(roomWorkspace?.isOpen?.())await roomWorkspace.refresh();
    else if(a!=='/room/save'||!(result&&Array.isArray(result.items)))await render();
   }
   return result;
  }finally{busy=false;}
 }
 function field(label,name,value='',type='text',options){
  const wrap=node('label',null,'field'+(type==='checkbox'?' check':'')+(type==='textarea'?' wide':''));let input;
  if(type==='select'){input=node('select');for(const opt of options||[]){const [v,l]=Array.isArray(opt)?opt:[opt,opt];const o=node('option',l);o.value=v;input.append(o);}input.value=value??'';}
  else if(type==='textarea'){input=node('textarea');input.value=value??'';}
  else {input=node('input');input.type=type;if(type==='checkbox')input.checked=Boolean(value);else if(type!=='file')input.value=value??'';}
  input.name=name;if(type==='number'){input.step='any';input.min='0';}if(type==='file')input.accept='image/png,image/jpeg,image/webp';
  append(wrap,type==='checkbox'?input:node('span',label),type==='checkbox'?node('span',label):input);
  return {node:wrap,input,get:()=>type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value};
 }
 function form(title,specs,submit,label='保存',description){
  const f=node('form',null,'form');const fields=specs.map(s=>Array.isArray(s)?field(...s):s);const body=div('form-grid',fields.map(f=>f.node));
  const formPage=activePanelKey;const saved=drafts.get(formPage)?.[title];if(saved)for(const f of fields)if(f.input.type!=='file'&&Object.hasOwn(saved,f.input.name)){if(f.input.type==='checkbox')f.input.checked=saved[f.input.name];else f.input.value=saved[f.input.name];}
  f.addEventListener('input',()=>{const all={...(drafts.get(formPage)||{})};all[title]=Object.fromEntries(fields.filter(x=>x.input.type!=='file').map(x=>[x.input.name,x.get()]));drafts.set(formPage,all);});
  const b=node('button',label);b.type='button';const performSubmit=async e=>{e.preventDefault();if(b.disabled||!f.reportValidity())return;b.disabled=true;try{await submit(Object.fromEntries(fields.map(x=>[x.input.name,x.get()])),fields);}catch(e){show(e.message||String(e),true);}finally{b.disabled=false;}};b.addEventListener('click',performSubmit);f.addEventListener('submit',performSubmit);f.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT')void performSubmit(e);});
  append(f,body,div('actions',b));return card(title,description?help(description):null,f);
 }
 function jsonForm(title,value,submit,description){return form(title,[['设置 JSON','json',JSON.stringify(value,null,2),'textarea']],b=>{let data;try{data=JSON.parse(b.json);}catch{throw Error('JSON 格式不正确，草稿已保留');}return submit(data);},'保存设置',description);}
 function bridgeForm(title,value,submit){
  const labels={enabled:'启用',burstEnabled:'允许分条发送',burstMaxMessages:'最多连发条数',burstIntervalMinMs:'连发最短间隔',burstIntervalMaxMs:'连发最长间隔',longGapProbability:'长停顿概率',longGapMinMs:'长停顿最短时间',longGapMaxMs:'长停顿最长时间',maxSendPerMinute:'每分钟最大发送条数',maxSendPerHour:'每小时最大发送条数',maxMessageChars:'单条消息字数',maxGapMs:'最长间隔',gapBaseMs:'基础间隔',gapPerCharMs:'每字附加间隔',recommendedHint:'表达建议',firstDelayMinMs:'首条最短等候',firstDelayMaxMs:'首条最长等候',defaultMode:'默认接话模式',preSleepWaitEnabled:'潜水前先等一会儿',preSleepWaitMs:'潜水前观察时间',recommendedDefaultInfinite:'建议无限期潜水',sleepMinMs:'最短潜水时间',sleepMaxMs:'最长潜水时间',recommendedSleepMinMs:'建议最短潜水时间',recommendedSleepMaxMs:'建议最长潜水时间',recommendedProbability:'随机接话概率',recommendedKeywords:'唤醒关键词',recommendedAtMention:'被 @ 时接话',recommendedNameMention:'被叫名字时接话',recommendedQuestion:'遇到问题时接话',recommendedPoke:'被戳时接话',batchWindowMs:'消息合并窗口',maxWakePerMinute:'每分钟最多唤醒次数',maxWakePerHour:'每小时最多唤醒次数',noActionLimit:'连续不接话次数',maxWakeConfigReminders:'收尾提醒次数',proactiveProbability:'主动联系概率',defaultMs:'默认等待时间',minMs:'最短等待时间',maxMs:'最长等待时间',defaultQuietMs:'默认安静窗口',minQuietAfterNewMs:'新消息后最短安静时间',recentLimit:'近期消息保留条数',unreadLimit:'普通未读队列条数',contextWindow:'上下文消息条数',inlineWakeMessages:'唤醒时带上消息',wakeMessageLimit:'唤醒时未读条数',wakeRecentLimit:'唤醒时近期消息条数',wakeMaxChars:'唤醒消息字数预算',syncTtlMs:'表情同步间隔',maxListCount:'表情列表上限',includeInPrompt:'在提示中推荐表情',promptMaxStickers:'推荐表情数量',maxLength:'反馈字数上限',notifyOwnerOnError:'出错时通知主人',hideNotices:'隐藏一般提示',fatalNotify:'通知严重错误',checkIntervalMinMs:'最短检查间隔',checkIntervalMaxMs:'最长检查间隔',idleThresholdMs:'安静多久后考虑联系',probability:'主动联系概率',getPrompt:'读取人格',getUnread:'读取未读',getRecent:'读取近期消息',socialState:'读取社交状态',sendGroup:'群聊发言',sendPrivate:'私聊发言',reply:'引用回复',sendBurst:'分条发送',sendMessage:'发送消息',waitMessages:'等待消息',feedback:'反馈',getMyRecent:'查看自己的发言',getMessageDetail:'查看消息详情',getActiveMembers:'查看活跃成员',setWakeConfig:'设置接话条件',markRead:'标记已读',memory:'记忆工具',slangQuery:'查询黑话',slangSubmit:'学习黑话',getImages:'看图',getForwardMsg:'查看合并转发',sendPoke:'戳一戳',listStickers:'浏览表情',getStickerImage:'查看表情图片',sendSticker:'发送表情',setStickerRemark:'备注表情',stickerNote:'表情笔记',collectSticker:'收藏表情',getSelfImage:'查看自身形象',sendVoice:'发送语音'};
  const fields=[];const walk=(obj,prefix='')=>{for(const[k,v]of Object.entries(obj)){const path=prefix+k;if(v&&typeof v==='object'&&!Array.isArray(v)){walk(v,path+'.');continue;}if(!labels[k])continue;const seconds=k.endsWith('Ms'),array=Array.isArray(v);fields.push({path,seconds,array,spec:[labels[k]+(seconds?'（秒）':array?'（每行一项）':''),path,array?v.join('\n'):seconds?v/1000:v,typeof v==='boolean'?'checkbox':typeof v==='number'?'number':array||k==='recommendedHint'?'textarea':'text']});}};walk(value);
  return div('',form(title,fields.map(f=>f.spec),b=>{const patch=structuredClone(value);for(const f of fields){const parts=f.path.split('.'),key=parts.pop();let target=patch;for(const p of parts)target=target[p];target[key]=f.array?b[f.path].split('\n').map(x=>x.trim()).filter(Boolean):f.seconds?Math.round(b[f.path]*1000):b[f.path];}return submit(patch);}),details('高级完整设置',jsonForm(title+' · 高级',value,submit)));
 }
 const scopeField=(value='')=>['会话（private:QQ号 / group:群号）','scope',value];
 function filterForm(specs,key){return form('筛选',specs,async data=>{filters[key]={...data,page:1};drafts.delete(activePanelKey);await refreshActiveSurface();},'查看');}
 function pager(data,key){return div('pager',button('上一页',async()=>{filters[key]={...filters[key],page:Math.max(1,data.page-1)};await refreshActiveSurface();},'quiet'),node('span',`第 ${data.page} 页 · 共 ${data.total} 条`),button('下一页',async()=>{if(data.page*data.limit<data.total){filters[key]={...filters[key],page:data.page+1};await refreshActiveSurface();}},'quiet'));}
 function table(headers,rows){const t=node('table');append(t,append(node('thead'),append(node('tr'),headers.map(x=>node('th',x)))),append(node('tbody'),rows.map(row=>append(node('tr'),row.map(value=>append(node('td'),value instanceof Node?value:String(value??'')))))));return div('table-wrap',t);}
 function bar(label,value,desc){const p=node('progress');p.max=100;p.value=value;return card(label,node('div',Math.round(value),'metric'),p,help(desc));}
 function jsonDetails(value,title='查看详细数据'){return details(title,pretty(value));}
 function eventList(rows){return rows.length?div('list',rows.map(e=>div('entry',div('row',badge(e.type||e.kind||''),node('span',stamp(e.at),'muted')),node('p',typeof e.detail==='string'?e.detail:JSON.stringify(e.detail??e.error??e.result??{}),'small body')))):empty('还没有行为记录。');}
 function configForm(title,section,config,selected){const labels={allowSleep:'允许自动入睡',sleepHour:'夜间开始（小时）',wakeHour:'自然醒来（小时）',wakePolicy:'消息叫醒范围',maxWakeAttempts:'累计叫醒次数上限',minSleepMinutes:'最短休息（分钟）',maxSleepHours:'最长休息（小时）',dreamEnabled:'REM 自动做梦',enabled:'启用',autoExtract:'自动抽取用户事实',maxPerMessage:'每条消息最多事实数',recallBudget:'召回字符预算',forgetting:'启用遗忘降权',halfLifeDays:'0–5 级半衰期（天，JSON 数组）',archiveThreshold:'归档强度阈值',profileEnabled:'允许生成画像',dailyCap:'每日变化上限',decayPerDay:'每日自然衰减',stages:'关系阶段分数（JSON 数组）',quietStart:'安静时段开始',quietEnd:'安静时段结束',minAffinity:'最低好感度',unansweredBackoffMinutes:'未回复退避（分钟）',maxUnanswered:'最多连续主动次数',timeoutMs:'生成超时（毫秒）',maxJobsPerHour:'每小时生成任务上限',style:'附加表达风格',perceptionNotes:'感知提示补充'};
 const keys=selected||Object.keys(config[section]);const specs=keys.map(k=>{const v=config[section][k];return [labels[k]||k,k,Array.isArray(v)?JSON.stringify(v):v,k==='wakePolicy'?'select':typeof v==='boolean'?'checkbox':typeof v==='number'?'number':k==='style'||k==='perceptionNotes'?'textarea':'text',k==='wakePolicy'?[['private','仅允许私聊叫醒'],['all','私聊和群聊'],['none','仅自然醒或控制台叫醒']]:undefined];});
 return form(title,specs,b=>{const next=structuredClone(config);for(const k of keys)next[section][k]=Array.isArray(config[section][k])?JSON.parse(b[k]):b[k];return command('/settings/save',{config:next});});}
 async function overview(){const d=await read('/overview');if(d?.night){latestNight=d.night;updateHudTelemetry(d.night);}const stage=stageNames[d.night.stage]||d.night.stage;
  const hero=div('hero',div('',badge(d.connections.bridge.ok?'QQ 桥接已连接':'QQ 桥接待连接',d.connections.bridge.ok?'':'warn'),node('h2',d.night.sleeping?'在夜色里休息一会儿。':'陪伴，慢慢有了自己的日常。'),node('p',`${stage} · ${d.settings.allowSleep?'自动入睡已开启':'精力运行，自动入睡未开启'}`),help(d.night.initialized?'精力和心情为初始模拟值，尚未积累互动事件。':'精力和心情由互动及时间驱动。')),div('moon'));
  const metricActions={
   有效记忆:()=>openFurnitureForPage('memory'),
   历史日记:()=>openFurnitureForPage('diary'),
   梦境片段:()=>openFurnitureForPage('dreams'),
   待核对事实:()=>{workspaceStore.filters={...(workspaceStore.filters||{}),memory:{status:'conflict'}};openFurnitureForPage('memory');}
  };
  const metrics=div('grid four',...Object.entries({有效记忆:d.counts.activeMemory,历史日记:d.counts.diary,梦境片段:d.counts.dreams,待核对事实:d.counts.conflicts}).map(([k,v])=>{
   const c=card(k,node('div',v??'—','metric'),help(k==='有效记忆'?`陪伴索引 ${d.counts.indexedMemory} 条`:'来自实际存储 · 点击打开'));
   c.style.cursor='pointer';c.setAttribute('role','button');c.setAttribute('tabindex','0');c.title=`点击打开${k}`;
   const act=metricActions[k];if(act){c.addEventListener('click',act);c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();act();}});}
   return c;
  }));
  const connLabels={bridge:'QQ 桥接',memory:'Basic Memory',diary:'原日记服务',minecraft:'Minecraft Numen'};
  const connections=card('连接状态',...Object.entries(d.connections).map(([k,v])=>{
   const label=connLabels[k]||k,isOk=Boolean(v.ok);
   const text=isOk?'已连接':(k==='minecraft'?'未启动 / 离线':v.error?.message||'不可用');
   return div('entry row',node('span',label),badge(text,isOk?'':'warn'));
  }));
  return [hero,metrics,div('grid',bar('精力',d.night.energy,'休息恢复，清醒和互动消耗。'),bar('心情',d.night.mood,'用于陪伴表达的模拟状态。')),grid(connections,card('房间此刻',node('p',d.room.description,'body'),badge(d.room.lamp?'台灯亮着':'台灯关着'),badge(d.room.curtain?'窗帘拉开':'窗帘合上'),actions(button('回到小屋看看',()=>roomWorkspace?.close?.(),'quiet'),button('调整舱室布置',()=>openFurnitureForPage('decor'),'quiet')))),card('最近发生',eventList(d.events))];
 }
 async function expression(){const [settings,bridge]=await Promise.all([read('/settings'),read('/bridge/settings')]);return [configForm('表达补充','expression',settings.config),help('以下开关和节奏直接写回原 QQ 桥接，下一轮按桥接规则生效。工具注册表可能需要原 MCP 重载后更新。'),...['send','wake','wait','context','sticker','feedback','tools'].filter(k=>bridge.config[k]!==undefined).map(k=>bridgeForm(({send:'分句与发送节奏',wake:'接话与唤醒策略',wait:'等候与连续对话',context:'上下文与感知',sticker:'表情策略',feedback:'反馈策略',tools:'感知与工具开关'})[k],bridge.config[k],patch=>command('/bridge/settings/save',{etag:bridge.etag,patch:{[k]:patch}}),'展示当前实际值；未填写的其他配置继续保留。'))];}
 async function relations(){const [d,a,c,profileCfg]=await Promise.all([read('/subjects/merge_candidates'),read('/affinity'),read('/settings'),read('/memory/profile/config')]);const profiles=profileCfg.profiles;return [grid(card('主体列表',d.subjects.length?table(['QQ 主体','会话范围','记忆数','关联到'],d.subjects.map(s=>[s.id,s.scopes.join('\n'),s.count,s.mergedInto||'—'])):empty('记忆中还没有主体。')),form('关联同一人的身份',[['源主体 ID','from',''],['目标主体 ID','to','']],b=>command('/subjects/merge',b),'合并身份','合并只建立身份关联，保留原来会话的可见范围。')),card('合并记录',d.history.length?div('list',d.history.slice().reverse().map(r=>div('entry row',node('span',`${r.from} → ${r.to} · ${stamp(r.at)}`),r.active?button('撤销',()=>command('/subjects/rollback',{id:r.id}),'quiet'):badge('已撤销')))):empty()),grid(card('好感度',a.items.length?table(['会话','主体','分数','阶段'],a.items.map(r=>[r.scope,r.subject,r.value.toFixed(1),['初识','熟悉','亲近','信任'][r.stage]||r.stage])):empty('尚无互动结算。')),form('调整好感度',[scopeField(),['主体 QQ 号','subject',''],['好感度（0–100）','value',0,'number']],b=>command('/affinity/save',b))),configForm('关系规则','affinity',c.config),configForm('记忆等级与遗忘','memory',c.config),form('从已确认事实生成人物画像',[scopeField(),['主体 QQ 号','subject','']],b=>command('/memory/profile/build',b),'生成画像','只引用指定会话内的事实，并保留来源编号。'),...Object.values(profiles).map(p=>card(`${p.scope} · ${p.subject}`,badge(p.blocked?'已停用':'有效',p.blocked?'warn':''),node('div',p.content||'尚无正文','body'),details('编辑画像',form('画像 '+p.scope+'|'+p.subject,[['画像内容','content',p.content||'','textarea']],b=>command('/memory/profile/save',{...b,scope:p.scope,subject:p.subject,sourceIds:p.sourceIds||[]}))),jsonDetails(p.sourceIds||[],'来源记忆编号'),actions(button(p.blocked?'恢复画像':'收起并停用',()=>command(p.blocked?'/memory/profile/unblock':'/memory/profile/delete',{scope:p.scope,subject:p.subject}),'quiet'))))];}
 async function proactive(){const [d,s,settings,bridge,logs]=await Promise.all([read('/proactive/state'),read('/proactive/sessions'),read('/settings'),read('/bridge/settings'),read('/proactive/log')]);return [card('当前主动联系',badge(d.bridge.config?.proactive?.enabled?'已开启':'已关闭',d.bridge.config?.proactive?.enabled?'':'warn'),help('沿用现有 QQ 主动调度。安装面板不会改变原来的总开关。'),d.sleeping?badge('睡眠中，普通主动机会暂缓','warn'):null),grid(bridgeForm('原桥接主动设置',bridge.config.proactive||{},patch=>command('/bridge/settings/save',{etag:bridge.etag,patch:{proactive:patch}})),configForm('附加联系条件','proactive',settings.config)),form('立即联系一次',[['目标会话','scope','','select',[['','请选择'],...(s.conversations||[]).map(x=>[x.key,x.key])]]],b=>command('/proactive/now',b),'提交联系任务','此操作会调用真实 QQ 会话。仍遵守暂停、白名单和睡眠等条件。'),card('各会话状态',(s.conversations||[]).length?table(['会话','未读','上次回复','主动联系'],s.conversations.map(r=>[r.key,r.unreadCount,stamp(r.lastAiReplyAt),button(d.sessions[r.key]?.muted?'恢复':'暂停',()=>command('/proactive/mute',{scope:r.key,muted:!d.sessions[r.key]?.muted}),'quiet')])):empty()),card('最近判断',eventList(logs.items))];}
 async function tools(){const d=await read('/tools');const search=field('筛选工具','search',filters.tools?.query||'');const listing=div('list'),testOutput=div('stack');const draw=()=>{listing.replaceChildren();const q=search.input.value.toLowerCase();const selected=d.tools.filter(t=>(t.name+' '+t.label+' '+t.group).toLowerCase().includes(q));for(const t of selected)listing.append(div('entry',div('row wrap',node('strong',t.name,'tool-name'),badge(t.group)),node('p',t.label,'small'),badge(t.available?'已加载':'不可用',t.available?'':'warn'),t.readOnly?badge('可只读试运行'):null));if(!selected.length)listing.append(empty('没有匹配的工具。'));};search.input.addEventListener('input',()=>{filters.tools={query:search.input.value};draw();});draw();return [card('工具来自当前 DSH',help(`发现 ${d.tools.length} 项能力。列表反映运行时已经加载的工具；桥接开关还会在实际调用时再次检查。`),search.node,listing),form('试运行',[['能力','name','clock','select',d.tools.filter(t=>t.readOnly).map(t=>[t.name,t.name])],['输入 / 目标语言与文本','input','','textarea']],async b=>{const result=await command('/tools/test',b,false);testOutput.replaceChildren(card('试运行结果',typeof result.text==='string'?node('div',result.text,'body'):pretty(result)));},'运行一次','测试入口只提供明确的只读能力；原 QQ 写操作在对应管理页提交。'),testOutput];}
 async function qq(){const [account,avatars]=await Promise.all([read('/qzone'),read('/avatar')]);const qf=filters.qq||{},feedOutput=div('stack');return [card('当前 QQ',pretty(account.account),badge(account.auth.ready?'空间登录态已取得':'尚未读取空间登录态',account.auth.ready?'':'warn'),actions(button('从已登录 QQ 获取空间权限',()=>command('/qzone/auth'), 'quiet'))),grid(form('QQ 资料',[['昵称','nickname',account.account.nickname||''],['个性签名','personalNote','']],b=>command('/qq/profile',b),'更新真实资料'),form('群名片',[['群号','groupId',''],['自己的 QQ 号','userId',account.account.user_id||''],['群名片','card','']],b=>command('/qq/card',b),'更新群名片')),grid(form('长签名',[['签名','value','','textarea']],b=>command('/qq/signature',b),'更新签名'),form('戳一戳',[scopeField(),['对象 QQ 号','subject','']],b=>command('/qq/poke',b),'发送戳一戳')),grid(form('查看空间动态',[['QQ 号（留空看好友动态）','uin',qf.uin||''],['页码','page',qf.page||1,'number']],async b=>{filters.qq=b;const feed=await read('/qzone/feed',b);feedOutput.replaceChildren(card('空间动态',feed.items.length?div('list',feed.items.map(x=>div('entry',node('h3',x.name||x.uin),help(stamp(x.at*1000)),node('div',x.content,'body'),help(`评论 ${x.comments} · 赞 ${x.likes}`)))):empty('暂无动态。')));},'读取动态'),form('发布说说',[['正文','content','','textarea']],b=>command('/qzone/publish',b),'发布到真实 QQ 空间','日记不会自动同步到这里。点击发布会产生一条真实动态。')),feedOutput,form('加入头像库',[['名称','name',''],field('上传 PNG/JPEG/WebP（最大 2 MB）','file','','file'),['或填写 QQ 图片地址','image','']],async(b,fields)=>{const file=fields.find(f=>f.input.name==='file').input.files[0];let image=b.image;if(file){if(file.size>2*1024*1024)throw Error('图片超过 2 MB，请缩小后上传');image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});}await command('/avatar/pool/add',{name:b.name,image});},'加入待审核头像'),card('头像库',avatars.pool.length?div('grid three',avatars.pool.map(a=>{const image=node('img',null,'avatar');image.src=a.image;image.alt=a.name;return card(a.name,image,badge(a.approved?'审核通过':'待审核',a.approved?'':'warn'),avatars.current?.id===a.id?badge('当前使用'):null,actions(button(a.approved?'撤销审核':'审核通过',()=>command('/avatar/pool/review',{id:a.id,approved:!a.approved}),'quiet'),a.approved?button('设为 QQ 头像',()=>command('/avatar/set',{id:a.id})):null,button('移出头像库',()=>command('/avatar/pool/delete',{id:a.id}),'quiet')));})):empty('先加入图片，再审核和切换。'))];}
 async function decor(ctx){
  if(ctx?.force||!currentRoomData){
   const snap=await rpc('/room',{},undefined,true);
   roomRevision=snap.revision;
   if(snap.data)applyRoomData(snap.data);
  }
  const r=currentRoomData||{lamp:false,curtain:true,description:'',items:[],interactions:[]};
  return [
   card('舱室环境与照明',div('row wrap',div('',badge(r.lamp?'台灯亮着':'台灯关着'),badge(r.curtain?'窗帘拉开':'窗帘合上')),actions(button(r.lamp?'关灯':'开灯',()=>command('/room/save',{patch:{lamp:!r.lamp}})),button(r.curtain?'合上窗帘':'拉开窗帘',()=>command('/room/save',{patch:{curtain:!r.curtain}}),'quiet'))),help('也可直接在小屋全息视窗中点击台灯或窗帘切换。')),
   form('房间里的故事',[['描述','description',r.description,'textarea']],b=>command('/room/save',{patch:{description:b.description}}),'保存房间','房间描述和物品状态会进入琉璃的对话上下文。'),
   grid(
    form('添一件物品',[['物品名称','name',''],['摆放位置或状态','state','','textarea']],b=>command('/room/save',{patch:{items:[...(r.items||[]),{id:uid(),...b}]}}),'放进房间'),
    card('房间里的物品',(r.items||[]).length?r.items.map(item=>div('entry',node('h3',item.name),node('p',item.state,'body'),details('调整物品',form('物品 · '+item.name,[['名称','name',item.name],['位置或状态','state',item.state,'textarea']],b=>command('/room/save',{patch:{items:r.items.map(x=>x.id===item.id?{...x,...b}:x)}}))),actions(button('收起这件物品',()=>command('/room/save',{patch:{items:r.items.filter(x=>x.id!==item.id)}}),'quiet')))):empty('还没有添加物品。'))
   ),
   card('互动记录',eventList((r.interactions||[]).slice().reverse().map(x=>({at:x.at,type:'房间互动',detail:x.changes}))))
  ];
 }
 async function system(){const [d,s,backups]=await Promise.all([read('/diagnostics'),read('/settings'),read('/system/backups')]);const sysOutput=div('stack');return [sysOutput,card('模块与来源',pretty(d.sources),jsonDetails(d.runtime,'运行时能力'),actions(button('检查全部连接',async()=>sysOutput.replaceChildren(card('连接检查',pretty(await read('/health')))),'quiet'),button('查看管理员与白名单',async()=>sysOutput.replaceChildren(card('原 QQ 管理范围',pretty(await read('/admins')))),'quiet'))),configForm('生成任务预算','generation',s.config),card('后台任务',d.jobs.length?div('list',d.jobs.map(j=>div('entry',div('row wrap',badge(({dream:'做梦',diary:'写日记',extract:'记忆抽取',profile:'人物画像'})[j.kind]||j.kind),badge(statusNames[j.status],['failed','unknown'].includes(j.status)?'warn':'')),help(`${stamp(j.at)} · ${j.payload?.scope||''}`),j.error?node('div',j.error.message,'body small'):null,jsonDetails({id:j.id,result:j.result,generatedContent:j.generatedContent},'任务详情'),j.status==='unknown'&&j.kind==='diary'&&j.generatedContent?actions(button('核对原日记',()=>command('/jobs/reconcile',{id:j.id}),'quiet')):j.status==='failed'?actions(button('重试已失败任务',()=>command('/jobs/retry',{id:j.id}),'quiet')):null))):empty('还没有后台任务。'),help('结果待核对表示进程中断或外部结果未知；不会自动重复写入或发布。')),card('状态备份',help('备份包括陪伴设置与元数据。原聊天、Basic Memory 笔记和历史日记继续使用各自的原存储。'),actions(button('创建状态备份',()=>command('/system/backup'))),backups.items.length?div('list',backups.items.slice(0,20).map(name=>div('entry row',node('span',name,'small'),button('恢复此备份',()=>command('/system/restore',{name}),'quiet')))):empty('还没有手动备份。每次状态写入另有自动上一版备份。')),card('行为与错误记录',eventList(d.events))];}
 async function about(){return [card('从一页状态，到完整的日常',node('p','琉璃陪伴中心将记忆、关系、睡眠、梦境、日记与房间接进已有的 DeepSeek Harness 和 QQ 桥接。','body'),node('p','继续使用原来的人格、记忆库和日记。状态分数是可解释的陪伴模拟，所有写操作由本机服务处理。','body')),card('作品与素材',node('p','星海回响 · 作者 xinghailiuli。','body'),node('p','角色动画随本插件提供；来源 PC2005-cloud/dsh-pet。程序代码 MIT；素材及衍生作品须署名、禁止商用，详见 THIRD_PARTY_NOTICES.md。','body'),node('p','早期版本曾参考 LUOSHUI319 / astrbot_plugin_congling 的功能设计；本版以星海回响独立作品发布。','body'),node('p','参考版本：9ed658dcfa0e6abf1e471cc338560a46cc298436','muted'),node('p','版本 1.3.0 · 完全重制版 · 星海回响','muted')),card('数据与边界',node('p','私聊和群聊记忆按会话隔离；日记只追加，收起不删除；房间和睡眠由一位琉璃共享。原有主动联系开关与自动日记任务沿用当前设置。','body'),node('p','QQ 扩展实际可用性取决于当前网关支持。未支持的操作会显示真实失败，不会用成功提示代替结果。','body'))];}
 function ensureReader(){
  if(!roomBookReader)roomBookReader=mountRoomReaderPanel(null,{document,load:()=>loadRoomFeature('reader'),notify:show,options:{document,request:requestBooks,onRead:()=>activeRoomScene?.setRoomActivity?.({preview:'read'})}});
  return roomBookReader;
 }
 function wrapCustomView(key,fn,{cacheable=true}={}){
  const wrapped=async ctx=>{
   activePanelKey=key;
   if(ctx?.force)invalidateReadCache();
   const nodes=await fn(ctx);
   if(key!=='decor')panelRevision=revision;
   if(cacheable)cachedViewNodes.set(key,nodes);
   $('updated').textContent='更新于 '+new Date().toLocaleTimeString('zh-CN',{hour12:false});
   return nodes;
  };
  if(cacheable)wrapped.warm=()=>cachedViewNodes.get(key)||null;
  return wrapped;
 }
 function ensureWorkspace(){
  if(!roomWorkspace){
   roomWorkspace=mountRoomFurniturePanel(null,{document,load:()=>loadRoomFeature('workspaces'),notify:show,options:{
    document,
    request:workspaceRequest,
    store:workspaceStore,
    onClose:()=>{activePanelKey='room';},
    customViews:{
     overview:wrapCustomView('overview',overview),
     qq:wrapCustomView('qq',qq),
     proactive:wrapCustomView('proactive',proactive),
     expression:wrapCustomView('expression',expression),
     relations:wrapCustomView('relations',relations),
     tools:wrapCustomView('tools',tools),
     decor:wrapCustomView('decor',decor,{cacheable:false}),
     system:wrapCustomView('system',system),
     about:wrapCustomView('about',about)
    }
   }});
  }
  return roomWorkspace;
 }
 let roomDispose=()=>{};
 const activeHudDelegates = {
   toggleBottomPopover: null,
   btnBottomRemind: null,
   btnBottomCompanion: null,
 };
 function roomScene(r,night,jobs){
  let shell,roomSession=null;
  let latestAvailableActions = [];
  const remembered={...roomView},furnitureButtons={};
  const actionDispatcher = typeof createRoomActionDispatcher === 'function' ? createRoomActionDispatcher({
    storage: safeStorage,
    getActiveRoomScene: () => activeRoomScene,
    getCurrentRoomData: () => currentRoomData || r,
    getAvailableActions: () => latestAvailableActions,
    show: (msg, isErr) => show(msg, isErr),
    onIntimacyChange: () => touchHudPulse()
  }) : null;
  requestRoomAsset('art');requestRoomAsset('life');
  let pillStatus=null;
  const status=node('span','','room-life-status'),source=badge(''),buttons=[],floorButtons=[];let detailButton=null,roomDetail=false;
  const diagnosticText=node('pre',''),diagnosticError=node('p',''),diagnosticPanel=details('画面加载提示',div('',diagnosticError));diagnosticError.setAttribute('role','alert');
  diagnosticPanel.className='room-render-notice';diagnosticPanel.hidden=true;
  const onDiagnostic=event=>{if(event.kind.endsWith('error')){diagnosticError.textContent=event.kind==='draw-error'?'动作绘制失败，已保留上一帧。切换动作可重试。':'部分动作素材未能加载，已保留当前可见画面。可重试加载。';diagnosticPanel.open=true;diagnosticPanel.hidden=false;}else if(event.kind==='draw-retry'||event.kind==='load-ready'){diagnosticError.textContent='';diagnosticPanel.hidden=true;}diagnosticText.textContent=(diagnosticText.textContent+'\n'+JSON.stringify(event)).split('\n').slice(-80).join('\n');};
  const setImmersive=full=>{if(full!==undefined)shell.classList.toggle('room-immersive',full);else full=shell.classList.toggle('room-immersive');roomView.immersive=full;expand.textContent=full?'收回小屋':'放大看';};
  const expand=button('放大看',()=>setImmersive(),'quiet room-expand');
  let centerStage = null, updateFloorCards = null, updateDetailCard = null;
  const scene=createBlockRoom(r,{petAssets:DAFEIYU_CLIPS,actionAssets:ROOM_ACTIONS,night,jobs,preview:remembered.preview,onDiagnostic,onFurniture:id=>openFurniture(id),onHotspotAction:mode=>{if(actionDispatcher)actionDispatcher.triggerAction(mode);else scene.setRoomActivity({preview:mode});},onFloor:(value,view)=>{roomView.floor=String(value);roomView.detail=Boolean(view?.detail);for(const b of floorButtons)b.node.setAttribute('aria-pressed',String(b.value===value));roomDetail=Boolean(view?.detail);detailButton?.setAttribute('aria-pressed',String(roomDetail));centerStage?.setAttribute?.('data-stage-floor',String(value));centerStage?.setAttribute?.('data-stage-detail',String(roomDetail));if(typeof updateFloorCards==='function')updateFloorCards(String(value));if(typeof updateDetailCard==='function')updateDetailCard(roomDetail);},onActivity:a=>{roomSession?.publish();if(a.preview!==undefined)roomView.preview=a.preview;status.textContent=a.label;if(pillStatus)pillStatus.textContent=a.mode==='sleep'?'• 休息中':a.mode==='type'||a.mode==='write'?'• 工作中':a.mode==='walk'?'• 散步中':'• 待命';if(a.availableActions)latestAvailableActions=a.availableActions;actionDispatcher?.handleActivityUpdate?.(a);if(a.preview!==undefined)for(const item of buttons){item.node.setAttribute('aria-pressed',String(item.mode===a.preview));if(item.upstairs&&a.availableActions)item.node.disabled=!a.availableActions.includes(item.mode);}source.textContent=({night:'跟随真实睡眠',diary:'正在写日记',preview:'动作预览',leisure:'日常小动作'})[a.source];},onLamp:()=>command('/room/save',{patch:{lamp:!(currentRoomData||r).lamp}}).catch(e=>show(e.message,true)),onCurtain:()=>command('/room/save',{patch:{curtain:!(currentRoomData||r).curtain}}).catch(e=>show(e.message,true))});
  activeRoomScene=scene;
  roomSession=createRoomSession({scene,observer:observerCtrl,wardrobe:wardrobeCtrl});
  const sceneUiContext=createRoomUiContext({getScene:()=>scene,getSnapshot:roomSession.getSnapshot,subscribe:roomSession.subscribe,dispatchAction:id=>actionDispatcher?actionDispatcher.triggerAction(id):scene.setRoomActivity({preview:id})});
  const restoreGate=createRoomRestoreGate({scene,runtimeReady,getRuntime:getRoomRuntimeSnapshot,hasAssets:()=>Boolean(ROOM_ACTIONS.lifeV10),isActive:()=>activeRoomScene===scene,onWait:()=>onDiagnostic({kind:'asset-error',stage:'restore',error:'动作恢复等待超时，先显示当前房间'})});
  activeRoomRestoreGate=restoreGate;
  if(ROOM_ACTIONS.lifeV10){const p=scene.setRoomLifeAssets?.(ROOM_ACTIONS.lifeV10);if(p&&typeof p.then==='function')p.then(()=>restoreGate.restore());}
  if(roomArtAssets)scene.setRoomArtAssets?.(roomArtAssets);
  let runtimeRestored=false;const restoreRuntime=async()=>{const wasDone=restoreGate.done;await restoreGate.restore();runtimeRestored=restoreGate.done;if(!wasDone&&restoreGate.done){try{const sf=typeof safeStorage!=='undefined'?safeStorage.getItem(OBSERVER_FLOOR_KEY):null;if(sf==='1'||sf==='2'||sf==='all')setObserverFloor(sf,scene);}catch{}}};
  diagnosticPanel.append(button('重试动作素材',async()=>{if(ROOM_ACTIONS.lifeV10)await scene.setRoomLifeAssets?.(ROOM_ACTIONS.lifeV10);else requestRoomAsset('life',{retry:true});if(roomArtAssets)scene.setRoomArtAssets?.(roomArtAssets);else requestRoomAsset('art',{retry:true});await restoreRuntime();},'quiet'));
  void restoreRuntime();
  const initialWardrobe=wardrobeCtrl.getState();
  if(initialWardrobe.outfitAsset)scene.setRoomOutfit?.(initialWardrobe.outfitAsset);
  dressingAssetClient??=createDressingAssetClient({win:window,parent,uid});
  const dressingRoot=node('div',null,'dressing-room-slot');
  const dressing=mountRoomDressingPanel(dressingRoot,{document,load:()=>loadRoomFeature('dressing'),notify:show,options:{document,catalog:WARDROBE_CATALOG,getState:()=>wardrobeCtrl.getState(),selectOutfit:requestOutfit,prefetch:schedulePrefetchOutfit,cancelPrefetch:cancelPrefetchSchedule,artClient:dressingAssetClient,
   onOpen:()=>{closeDrawer();closeBottomPopover();shell.classList.add('dressing-open');btnNavCabin.classList.remove('active');btnNavWardrobe.classList.add('active');},
   onClose:()=>{shell.classList.remove('dressing-open');btnNavWardrobe.classList.remove('active');btnNavCabin.classList.add('active');},notify:message=>show(message)}});
  const wardrobeBox=dressing.element;
  wardrobeCtrl.setUpdateListener(()=>dressing.update());
  const openFurniture=(rawId,initialView,returnTarget)=>{
   const id=typeof normalizeRoomFurnitureId==='function'?normalizeRoomFurnitureId(rawId):(rawId==='enchanting'?'enchant':rawId);
   if(id!=='mirror'&&!wardrobeBox.hidden)dressing.close();
   if(id==='bookshelf'){void ensureReader().open();return;}
   if(id==='mirror'){dressing.open(returnTarget||document.activeElement);return;}
   const group=furnitureGroups[id];if(!group)return;
   const workspace=ensureWorkspace();
   const focused=document.activeElement;
   const fallback=activeFurnitureButtons[id]||furnitureButtons[id];
   const trigger=returnTarget||(focused?.getAttribute?.('data-room-furniture')===id?focused:fallback?.isConnected?fallback:(floatingDrawer._anchor||btnNavCabin));
   void workspace.open(id,trigger,initialView).catch(e=>show(e.message||String(e),true));
  };
  openRoomFurniture=openFurniture;
  dressing.update();if(!wardrobeCtrl.getState().outfitRequest)requestOutfit();
  const floorControls=div('room-floor-controls');
  const bIsland=button('🌸 3D 五彩花海岛 (V5.0)',()=>switchViewMode('island'),'quiet room-island-toggle');
  bIsland.title='切换到 3D 360° 自由旋转漫游视角';
  bIsland.textContent='🔄 360° 旋转视角 (3D)';
  floorControls.append(bIsland);
  for(const[value,label]of[['all','双层总览'],['1','一楼'],['2','二楼']]){const b=button(label,()=>scene.setRoomFloor(value),'quiet');b.setAttribute('aria-pressed',String(value===(night?.sleeping?'2':'1')));floorButtons.push({value,node:b});floorControls.append(b);}
  if(scene.setRoomDetail){detailButton=button('人物特写',()=>scene.setRoomDetail(!roomDetail),'quiet room-detail-button');detailButton.setAttribute('aria-pressed','false');floorControls.append(detailButton);}
  const controls=div('room-life-controls');
  for(const[mode,label]of[['auto','随她生活'],['sleep','盖被睡觉'],['write','写字'],['type','敲键盘'],['lounge','沙发休息'],['walk','散步'],...(scene.roomActions||[])]){const b=button(label,()=>{scene.setRoomActivity({preview:mode});for(const item of buttons)item.node.setAttribute('aria-pressed',String(item.mode===mode));},'quiet');b.setAttribute('aria-pressed',String(mode===remembered.preview));buttons.push({mode,node:b,upstairs:(scene.roomActions||[]).some(([m])=>m===mode)});controls.append(b);}
  const furnitureControls=div('room-furniture-controls');
  const mirrorButton=button('全息镜 · 换装',()=>openFurniture('mirror'),'quiet');
  for(const[id,label]of [['comms','通讯屏 · 近况与QQ'],['computer','电脑 · 记忆与人格'],['workbench','工坊台 · 工具与系统'],['bed','床 · 长夜与梦境'],['enchant','附魔台 · 日记'],['bookshelf','书架 · 翻书与续读']]){const b=button(label,()=>openFurniture(id),'quiet');furnitureButtons[id]=b;furnitureControls.append(b);}
  furnitureButtons.mirror=mirrorButton;furnitureControls.append(mirrorButton);
  activeFurnitureButtons=furnitureButtons;
  const hotbarSlots=[];
  const hotbarDetails=details('屋里的 '+(r.items||[]).length+' 件物品',div('block-hotbar',(r.items||[]).map((item,i)=>{const slot=div('block-slot',node('small',String(i+1).padStart(2,'0')),node('span',item.name));slot.title=item.state;hotbarSlots.push(slot);return slot;})));
  const bBackIsland=button('🌸 切换至 3D 岛屿 (V5.0)',()=>switchViewMode('island'),'quiet');
  bBackIsland.title='切换至小鲸鱼岛 3D 自由视角';

  // --- Star Echo 5-Tab Floating Secondary Drawer & Popover UI ---
  let activeDrawerTab = 'cabin';
  const drawerHeaderTitle = node('span', '小屋视角', 'drawer-title');
  const drawerHeaderSub = node('span', '// VIEWPORT', 'drawer-subtitle');
  const drawerCloseBtn = button('✕', () => closeDrawer(true), 'star-echo-drawer-close quiet');
  drawerCloseBtn.title = '收起面板';

  const drawerHeader = div('star-echo-drawer-header',
    div('drawer-title-group', drawerHeaderTitle, drawerHeaderSub),
    drawerCloseBtn
  );

  const drawerBody = div('star-echo-drawer-body');
  const floatingDrawer = div('star-echo-floating-drawer hidden', drawerHeader, drawerBody);

  const closeDrawer = (restoreFocus=false) => {
    activeDrawerTab = null;
    floatingDrawer.classList.add('hidden');
    navButtons.forEach(btn => btn.classList.remove('active'));
    btnNavCabin.classList.add('active');
    if(restoreFocus)floatingDrawer._anchor?.focus?.();
  };

  const navButtons = [];

  updateFloorCards = (floorVal) => {
    drawerBody.querySelectorAll?.('.drawer-floor-card')?.forEach(card => {
      card.classList.toggle('active', card.getAttribute('data-floor') === floorVal);
    });
  };

  updateDetailCard = (isDetail) => {
    const card = drawerBody.querySelector?.('.drawer-detail-card');
    if (card) card.classList.toggle('active', Boolean(isDetail));
  };

  const renderDrawerTab = (tab) => {
    drawerBody.replaceChildren();
    if (tab === 'cabin') {
      drawerHeaderTitle.textContent = '小屋视角';
      drawerHeaderSub.textContent = '// VIEWPORT';
      const curFloor = roomView.floor || (night?.sleeping ? '2' : '1');

      const cardF1 = div('cyber-drawer-card drawer-floor-card' + (curFloor === '1' ? ' active' : ''),
        node('span', '🛋️', 'drawer-card-icon'),
        div('drawer-card-info',
          node('strong', '一楼 · 起居室', 'drawer-card-name'),
          node('small', '客厅沙发、工坊台、电脑与绿植', 'drawer-card-desc')
        )
      );
      cardF1.setAttribute('data-floor', '1');
      cardF1.addEventListener('click', () => {
        setObserverFloor('1', scene);
        show('已切换至一楼起居室');
      });

      const cardF2 = div('cyber-drawer-card drawer-floor-card' + (curFloor === '2' ? ' active' : ''),
        node('span', '🛏️', 'drawer-card-icon'),
        div('drawer-card-info',
          node('strong', '二楼 · 卧室温室', 'drawer-card-name'),
          node('small', '舒适大床、魔法阁书架与麦田温室', 'drawer-card-desc')
        )
      );
      cardF2.setAttribute('data-floor', '2');
      cardF2.addEventListener('click', () => {
        setObserverFloor('2', scene);
        show('已切换至二楼卧室与温室');
      });

      const cardAll = div('cyber-drawer-card drawer-floor-card' + (curFloor === 'all' ? ' active' : ''),
        node('span', '🏛️', 'drawer-card-icon'),
        div('drawer-card-info',
          node('strong', '双层总览', 'drawer-card-name'),
          node('small', '两层整体结构与空间格局', 'drawer-card-desc')
        )
      );
      cardAll.setAttribute('data-floor', 'all');
      cardAll.addEventListener('click', () => {
        setObserverFloor('all', scene);
        show('已切换至双层总览视角');
      });

      const cardDetail = div('cyber-drawer-card drawer-detail-card' + (roomView.detail ? ' active' : ''),
        node('span', '🔍', 'drawer-card-icon'),
        div('drawer-card-info',
          node('strong', '人物特写', 'drawer-card-name'),
          node('small', '跟随小鲸鱼当前所处区域镜头特写', 'drawer-card-desc')
        )
      );
      cardDetail.addEventListener('click', () => {
        const nextDetail = !roomView.detail;
        roomView.detail = nextDetail;
        scene.setRoomDetail?.(nextDetail);
        updateDetailCard(nextDetail);
        show(nextDetail ? '已开启人物特写镜头' : '已返回常规全景视角');
      });

      drawerBody.append(cardF1, cardF2, cardAll, cardDetail);
    } else if (tab === 'wardrobe') {
      drawerHeaderTitle.textContent = '装扮衣橱';
      drawerHeaderSub.textContent = '// WARDROBE';
      const openWardrobeBtn = div('cyber-drawer-card active',
        node('span', '👗', 'drawer-card-icon'),
        div('drawer-card-info',
          node('strong', '全息试衣镜', 'drawer-card-name'),
          node('small', '浏览并换上 13 套专属生活服装', 'drawer-card-desc')
        )
      );
      openWardrobeBtn.addEventListener('click', () => {
        closeDrawer();
        openFurniture('mirror');
      });
      drawerBody.append(openWardrobeBtn);
    } else if (tab === 'memories') {
      drawerHeaderTitle.textContent = '回响记忆';
      drawerHeaderSub.textContent = '// MEMORIES';
      const cardDiary = div('cyber-drawer-card',
        node('span', '📖', 'drawer-card-icon'),
        div('drawer-card-info',
          node('strong', '附魔手记 · 历史日记', 'drawer-card-name'),
          node('small', '翻阅生活随笔与手记记录', 'drawer-card-desc')
        )
      );
      cardDiary.addEventListener('click', () => {
        closeDrawer();
        openFurniture('enchant');
      });

      const cardMem = div('cyber-drawer-card',
        node('span', '✨', 'drawer-card-icon'),
        div('drawer-card-info',
          node('strong', '核心记忆 · 长期存贮', 'drawer-card-name'),
          node('small', '查看沉淀事实与人格记忆', 'drawer-card-desc')
        )
      );
      cardMem.addEventListener('click', () => {
        closeDrawer();
        openFurniture('computer');
      });

      const cardDream = div('cyber-drawer-card',
        node('span', '🌙', 'drawer-card-icon'),
        div('drawer-card-info',
          node('strong', '长夜梦境 · 睡眠记录', 'drawer-card-name'),
          node('small', '查看梦境片段与睡眠状态', 'drawer-card-desc')
        )
      );
      cardDream.addEventListener('click', () => {
        closeDrawer();
        openFurniture('bed');
      });

      drawerBody.append(cardDiary, cardMem, cardDream);
    } else if (tab === 'expansion') {
      drawerHeaderTitle.textContent = '空间扩展';
      drawerHeaderSub.textContent = '// EXPANSION';
      const card3D = div('cyber-drawer-card active',
        node('span', '🌸', 'drawer-card-icon'),
        div('drawer-card-info',
          node('strong', '3D 自由漫游花海岛', 'drawer-card-name'),
          node('small', '360° 可移动旋转视角，沉浸式外景', 'drawer-card-desc')
        )
      );
      card3D.addEventListener('click', () => {
        closeDrawer();
        switchViewMode('island');
      });
      drawerBody.append(card3D);
    } else if (tab === 'settings') {
      drawerHeaderTitle.textContent = '系统偏好';
      drawerHeaderSub.textContent = '// SETTINGS';
      const cardLamp = div('cyber-drawer-card',
        node('span', '💡', 'drawer-card-icon'),
        div('drawer-card-info',
          node('strong', '暖光台灯', 'drawer-card-name'),
          node('small', '点击切换小屋温暖氛围照明', 'drawer-card-desc')
        )
      );
      cardLamp.addEventListener('click', () => {
        command('/room/save', { patch: { lamp: !(currentRoomData || r).lamp } })
          .then(() => show('已切换台灯照明'))
          .catch(e => show(e.message, true));
      });

      const cardCurtain = div('cyber-drawer-card',
        node('span', '🪟', 'drawer-card-icon'),
        div('drawer-card-info',
          node('strong', '窗帘透光', 'drawer-card-name'),
          node('small', '拉开/合上窗外星光视野', 'drawer-card-desc')
        )
      );
      cardCurtain.addEventListener('click', () => {
        command('/room/save', { patch: { curtain: !(currentRoomData || r).curtain } })
          .then(() => show('已切换窗帘状态'))
          .catch(e => show(e.message, true));
      });

      const cardReset = div('cyber-drawer-card',
        node('span', '🔄', 'drawer-card-icon'),
        div('drawer-card-info',
          node('strong', '恢复默认视角', 'drawer-card-name'),
          node('small', '重置视角为一楼全景', 'drawer-card-desc')
        )
      );
      cardReset.addEventListener('click', () => {
        setObserverFloor('1', scene);
        roomView.detail = false;
        scene.setRoomDetail?.(false);
        show('已恢复默认视角');
      });

      drawerBody.append(cardLamp, cardCurtain, cardReset);
    }
    for(const card of drawerBody.querySelectorAll?.('.cyber-drawer-card')||[]){
      const icon=card.querySelector('.drawer-card-icon');
      if(icon){const label=card.textContent;icon.replaceChildren(hudLineIcon(/试衣/.test(label)?'mirror':/日记|记忆|梦境/.test(label)?'book':/灯|窗帘/.test(label)?'leaf':/特写/.test(label)?'focus':'home'));}
      card.setAttribute('role','button');card.setAttribute('tabindex','0');
      card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click();}});
    }
  };

  const toggleDrawerTab = (tab, btn) => {
    if(tab==='wardrobe'){if(wardrobeBox.hidden)openFurniture('mirror',undefined,btn);else dressing.close();return;}
    if(!wardrobeBox.hidden)dressing.close();
    closeBottomPopover();
    if (activeDrawerTab === tab && !floatingDrawer.classList.contains('hidden')) {
      closeDrawer();
    } else {
      activeDrawerTab = tab;
      floatingDrawer._anchor=btn;
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderDrawerTab(tab);
      floatingDrawer.classList.remove('hidden');
      if (typeof positionFloatingMenu === 'function' && shell) {
        positionFloatingMenu(floatingDrawer, btn, shell, { placement: 'right', gap: 12 });
      }
      drawerCloseBtn.focus?.();
    }
  };

  const makeVectorIcon = (paths) => {
    if (typeof document?.createElementNS !== 'function') return null;
    const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('class', 'hud-vector-icon');
    svgEl.setAttribute('viewBox', '0 0 24 24');
    svgEl.setAttribute('aria-hidden', 'true');
    for (const d of paths) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      svgEl.append(p);
    }
    return svgEl;
  };
  const decorateIconBtn = (btn, paths, labelText) => {
    btn.replaceChildren();
    const ic = makeVectorIcon(paths);
    if (ic) btn.append(ic);
    btn.setAttribute('aria-label', labelText);
    return btn;
  };

  // 5 capsule buttons accurately aligned with V5.2 luminous pod specification:
  const btnNavCabin = decorateIconBtn(
    button('', () => toggleDrawerTab('cabin', btnNavCabin), 'capsule-btn capsule-cabin nav-cabin active'),
    [
      'M12 3.3 L2.4 11.4 H5.7 V20.2 H10.1 V14.5 H13.9 V20.2 H18.3 V11.4 H21.6 Z',
      'M16.3 4.5 H18.6 V7.6 L16.3 5.6 Z'
    ],
    '小屋视角'
  );

  const btnNavWardrobe = decorateIconBtn(
    button('', () => toggleDrawerTab('wardrobe', btnNavWardrobe), 'capsule-btn capsule-wardrobe nav-dress'),
    [
      'M 9.5 5.2 C 9.5 6.8 10.6 7.8 12 7.8 C 13.4 7.8 14.5 6.8 14.5 5.2 L 19.5 7.6 L 22 11.2 L 17.8 12.8 L 17.8 19.6 H 6.2 L 6.2 12.8 L 2 11.2 L 4.5 7.6 Z'
    ],
    '装扮衣橱'
  );

  const btnNavMemories = decorateIconBtn(
    button('', () => toggleDrawerTab('memories', btnNavMemories), 'capsule-btn capsule-memories nav-memory'),
    [
      'M12 6.2 V19.4',
      'M12 6.2 C9.5 4.8 6.2 4.8 3.8 6 V17.4 C6.2 16.2 9.5 16.2 12 17.6',
      'M12 6.2 C14.5 4.8 17.8 4.8 20.2 6 V17.4 C17.8 16.2 14.5 16.2 12 17.6',
      'M2.6 7.6 V19 C5.6 17.8 9.2 18 12 19.6 C14.8 18 18.4 17.8 21.4 19 V7.6'
    ],
    '回忆日记'
  );

  const btnNavExpansion = decorateIconBtn(
    button('', () => toggleDrawerTab('expansion', btnNavExpansion), 'capsule-btn capsule-expansion nav-island'),
    [
      'M12 19.8 V11.5',
      'M12 14.6 C7.5 14.6 4.8 11.6 4.8 7.6 C8.8 7.6 11.5 10.4 12 14.6',
      'M12 14.6 C16.5 14.6 19.2 11.6 19.2 7.6 C15.2 7.6 12.5 10.4 12 14.6',
      'M6.5 19.8 C6.5 18 9.2 18 12 19.8 C14.8 18 17.5 18 17.5 19.8 H6.5 Z'
    ],
    '3D 五彩花海岛'
  );

  const btnNavSettings = decorateIconBtn(
    button('', () => toggleDrawerTab('settings', btnNavSettings), 'capsule-btn capsule-settings nav-settings'),
    [
      'M12 14.8 A2.8 2.8 0 1 0 12 9.2 A2.8 2.8 0 0 0 12 14.8 Z',
      'M10.7 3.5 H13.3 L13.8 5.6 L15.5 6.3 L17.3 5.1 L19.1 6.9 L17.9 8.7 L18.6 10.4 L20.7 10.9 V13.1 L18.6 13.6 L17.9 15.3 L19.1 17.1 L17.3 18.9 L15.5 17.7 L13.8 18.4 L13.3 20.5 H10.7 L10.2 18.4 L8.5 17.7 L6.7 18.9 L4.9 17.1 L6.1 15.3 L5.4 13.6 L3.3 13.1 V10.9 L5.4 10.4 L6.1 8.7 L4.9 6.9 L6.7 5.1 L8.5 6.3 L10.2 5.6 Z'
    ],
    '系统设置'
  );

  navButtons.push(btnNavCabin, btnNavWardrobe, btnNavMemories, btnNavExpansion, btnNavSettings);

  const capsuleSidebar = div('star-echo-capsule-sidebar',
    btnNavCabin,
    btnNavWardrobe,
    btnNavMemories,
    btnNavExpansion,
    btnNavSettings
  );

  // Approved reference art is independent of the five original interactive buttons.
  capsuleSidebar.classList.add('v52-reference-nav');
  for (const btn of navButtons) {
    const ring = node('span', '', 'v52-energy-ring');
    ring.setAttribute('aria-hidden', 'true');
    btn.append(ring);
  }
  const referenceNavArt = div('v52-reference-nav-art');
  referenceNavArt.setAttribute('aria-hidden', 'true');
  const leftDock = div('star-echo-left-dock', referenceNavArt, capsuleSidebar, floatingDrawer);

  // Apply saved observer perspective immediately:
  const savedObserverFloor = getPersistedObserverFloor();
  roomView.floor = savedObserverFloor;
  scene.setRoomFloor?.(savedObserverFloor);

  // Lightweight decorative compensation wings for 'all' two-floor overview mode:
  const allModeWings = div('star-echo-all-mode-wings',
    div('all-mode-wing wing-left',
      div('wing-floor-card',
        node('span', '2F // UPPER DECK', 'wing-floor-tag'),
        node('strong', '二楼 · 卧室与魔法温室', 'wing-floor-title'),
        node('span', '睡眠区 · 附魔书架 · 麦田温室 · 露台歇脚', 'wing-floor-sub')
      ),
      div('wing-floor-card',
        node('span', '1F // MAIN HABITAT', 'wing-floor-tag'),
        node('strong', '一楼 · 起居与工坊中枢', 'wing-floor-title'),
        node('span', '电脑桌 · 客厅沙发 · 储物工坊 · 全息通讯', 'wing-floor-sub')
      )
    ),
    div('all-mode-wing wing-right',
      div('wing-floor-card',
        node('span', 'SCHEME C // 1.60:1 STAGE', 'wing-floor-tag'),
        node('strong', '双层总览 · 等比居中视窗', 'wing-floor-title'),
        node('span', '外框固定 · 零裁切家具 · 跨层楼梯直连', 'wing-floor-sub')
      ),
      div('wing-floor-card',
        node('span', 'STAR ECHO // TELEMETRY', 'wing-floor-tag'),
        node('strong', '星海同频 · 实时动态场景', 'wing-floor-title'),
        node('span', '点击任意楼层热区或左侧「小屋」可切换单层特写', 'wing-floor-sub')
      )
    )
  );
  allModeWings.setAttribute('aria-hidden', 'true');

  // Pure Center Stage: scene + all-mode side compensation inside the 1.60:1 aperture:
  centerStage = div('star-echo-center-stage',
    allModeWings,
    scene
  );
  centerStage.setAttribute('data-stage-floor', savedObserverFloor);
  centerStage.setAttribute('data-stage-detail', String(Boolean(roomView.detail)));

  // --- Bottom Dock 4 Icons & Lightweight Popover ---
  let activeBottomPopover = null;
  const popoverHeaderTitle = node('span', '对话', 'popover-title');
  const popoverCloseBtn = button('✕', () => closeBottomPopover(true), 'star-echo-popover-close quiet');
  popoverCloseBtn.setAttribute('aria-label','收起面板');
  const popoverHeader = div('star-echo-popover-header', popoverHeaderTitle, popoverCloseBtn);
  const popoverBody = div('star-echo-popover-body');
  const bottomPopover = div('star-echo-bottom-popover hidden', popoverHeader, popoverBody);

  const closeBottomPopover = (restoreFocus=false) => {
    activeBottomPopover = null;
    bottomPopover.classList.add('hidden');
    bottomPopover._anchor?.classList.remove('active');
    bottomActionButtons.forEach(btn => btn.classList.remove('active'));
    if(restoreFocus)bottomPopover._anchor?.focus?.();
  };

  // --- Real Snapshot Export Function ---
  let photoSceneDisposed=false;
  const photoCancelled=()=>panelDisposed||photoSceneDisposed;
  async function downloadCottagePhoto(canvas,type,filename){
    if(photoCancelled())return false;
    show('正在编码 PNG 照片…');
    const blob=await ROOM_CORE['src/room-photo-images.mjs'].encodeRoomPhotoPng(canvas);
    if(photoCancelled())return false;
    const url=URL.createObjectURL(blob),dl=document.createElement('a');photoDownloadUrls.add(url);
    dl.download=filename;dl.href=url;document.body.appendChild(dl);dl.click();dl.remove();
    schedulePanel(()=>{photoDownloadUrls.delete(url);URL.revokeObjectURL(url);},60000);
    window.__lastExportedPhoto={type,filename,width:canvas.width,height:canvas.height,size:blob.size,timestamp:Date.now()};
    return true;
  }
  async function exportCottagePhoto({ withHud = false } = {}) {
    if(photoCancelled())return;
    if(photoExporting){show('照片正在生成，请稍候…');return;}
    photoExporting=true;
    try {
      const svg = centerStage.querySelector('svg') || document.querySelector('svg[data-room-art]') || document.querySelector('svg');
      if (!svg) {
        show('未找到可导出的场景');
        return;
      }

      show('正在读取照片素材…');
      const photo=roomPhotoImages?await roomPhotoImages.prepare(svg,withHud?[STAR_ECHO_FRAME_DATA_URL,STAR_ECHO_SVG_BORDER_DATA_URL]:[]):{svg:svg.cloneNode(true),url:value=>value};
      if(photoCancelled())return;

      if (!withHud) {
        // Pure Room Snapshot without HUD
        show('正在生成纯净小屋 PNG 快照…');
        const vb = svg.viewBox?.baseVal;
        const w = vb?.width || 1536;
        const h = vb?.height || 1024;

        const clone = photo.svg;
        if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        if (!clone.getAttribute('xmlns:xlink')) clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

        const xml = new XMLSerializer().serializeToString(clone);
        const img = await loadRoomPhotoSvg(xml);
        if(photoCancelled())return;

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#020712';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        

        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = 'liuli-cottage-pure-' + ts + '.png';
        if(!await downloadCottagePhoto(canvas,'pure',filename))return;

        show('📸 纯净小屋快照已导出：' + filename + ' (' + w + '×' + h + ')');
      } else {
        // Framed Snapshot with Scheme C 2560x1440 HUD (exported at 1920x1080)
        show('正在生成星海回响相框快照…');
        closeDrawer();
        closeBottomPopover();

        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#01040d';
        ctx.fillRect(0, 0, 1920, 1080);

        const frameImg = new Image();
        await new Promise((resolve, reject) => {
          frameImg.onload = resolve;
          frameImg.onerror = () => reject(new Error('HUD相框加载失败'));
          frameImg.src = typeof STAR_ECHO_FRAME_DATA_URL === 'string'
            ? photo.url(STAR_ECHO_FRAME_DATA_URL)
            : './assets/star-echo/hud_frame_2560x1440_clean.png';
        });
        if(photoCancelled())return;
        ctx.drawImage(frameImg, 0, 0, 1920, 1080);

        const clone = photo.svg;
        if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        if (!clone.getAttribute('xmlns:xlink')) clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        const xml = new XMLSerializer().serializeToString(clone);
        const roomImg = await loadRoomPhotoSvg(xml);
        if(photoCancelled())return;
        // Scheme C placement scaled from 2560x1440 (x=416, y=122, w=1728, h=1152) to 1920x1080 (* 0.75):
        ctx.drawImage(roomImg, 312, 92, 1296, 864);

        if (typeof STAR_ECHO_SVG_BORDER_DATA_URL === 'string') {
          const borderImg = new Image();
          await new Promise(resolve => {
            borderImg.onload = resolve;
            borderImg.onerror = resolve;
            borderImg.src = photo.url(STAR_ECHO_SVG_BORDER_DATA_URL);
          });
          if(photoCancelled())return;
          if (borderImg.complete && borderImg.naturalWidth > 0) {
            ctx.drawImage(borderImg, 0, 0, 1920, 1080);
          }
        }
        

        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = 'liuli-star-echo-frame-' + ts + '.png';
        if(!await downloadCottagePhoto(canvas,'framed',filename))return;

        show('📸 相框快照已导出：' + filename + ' (1920×1080)');
      }
    } catch (err) {
      console.error('Photo export error:', err);
      if(!photoCancelled())show('快照导出失败: ' + (err.message || '未知错误'));
    } finally {photoExporting=false;}
  }


 function hudLineIcon(name){
  const paths={home:['M3 11 12 3 21 11','M5 10v11h5v-7h4v7h5V10'],walk:['M14 3a2 2 0 1 0 0 .1','m10 7 4 1 3 5 4 1','m10 7-4 5-4 1','m13 9-3 6 6 3 2 4','m10 15-5 6'],chair:['M5 11V7a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v4','M5 11H3v8h18v-8h-2v5H5Z','M5 19v3m14-3v3'],computer:['M4 3h16v13H4Z','M2 20h20l-2-4H4Z'],bed:['M3 12h18v8H3Z','M3 12V5h5a4 4 0 0 1 4 4v3','M3 20v2m18-2v2','M14 4h6l-6 5h6'],book:['M12 5v16','M12 5C8 2 5 3 2 4v16c4-1 7-1 10 1 3-2 6-2 10-1V4c-3-1-6-2-10 1'],leaf:['M12 22V12','M12 16C4 16 2 10 3 4c7 0 10 4 9 12Z','M12 12c0-7 4-10 10-10 0 7-4 11-10 10Z'],pen:['m4 16 12-12 4 4L8 20l-5 1Z','m14 6 4 4'],star:['m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z'],info:['M12 22a10 10 0 1 0-.1 0','M9 8a3 3 0 1 1 4 3v3','M13 17v.1'],hand:['M7 13V7a2 2 0 0 1 4 0v6','M11 10V4a2 2 0 0 1 4 0v9','M15 11V7a2 2 0 0 1 4 0v7','M7 12 5 10c-2-1-3 1-2 3l4 7c3 3 11 1 12-3l2-5'],mirror:['M6 4a6 6 0 0 1 12 0v12H6Z','M9 16v5m6-5v5H9','m9 5 6 6'],chat:['M21 12c0 5-6 9-12 6l-6 3 1-6C-1 5 12 0 19 5a9 9 0 0 1 2 7Z'],tools:['m4 20 9-9','M13 11c-3-5-1-9 4-9l-2 5 4 2 3-3c1 6-4 9-9 5Z'],focus:['M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5','M12 7a5 5 0 1 0 .1 0'],heart:['M12 21C-5 10 3 0 12 7c9-7 17 3 0 14Z']};
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','hud-menu-icon');svg.setAttribute('aria-hidden','true');for(const d of paths[name]||paths.star){const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);svg.append(p);}return svg;
 }

  let actionTrayUi=null;
  const renderBottomPopover = (kind) => {
    actionTrayUi?.dispose();actionTrayUi=null;
    bottomPopover.setAttribute('data-panel',kind);
    popoverBody.replaceChildren();
    if (kind === 'energy') {
      popoverHeaderTitle.textContent = '精力与作息';
      const value=node('strong',lastRoomEnergy ? lastRoomEnergy.energy.toFixed(1)+' / 100' : '正在同步','energy-detail-value');
      value.id='energy-detail-value';
      const sync=node('span',roomEnergyRate(lastRoomEnergy),'energy-detail-sync');sync.id='energy-detail-sync';
      popoverBody.append(div('energy-detail',value,sync,node('p','小屋精力随实际动作变化：睡眠 +2.0/分钟，沙发或露台休息 +0.8，工作 −0.6，散步 −0.3。走到休息位置后开始恢复；离开页面时暂停并保存。此数值用于小屋生活模拟，QQ 作息单独保留。','small'),actions(button('去沙发休息',()=>{closeBottomPopover();actionDispatcher?.triggerAction('lounge');},'popover-grid-btn'),button('盖被睡觉',()=>{closeBottomPopover();actionDispatcher?.triggerAction('sleep');},'popover-grid-btn'))));
      updateHudTelemetry(null,false);
    } else if (kind === 'pulse') {
      popoverHeaderTitle.textContent='心跳与陪伴';
      const value=node('strong','','energy-detail-value');value.id='pulse-detail-value';
      const state=node('span','','energy-detail-sync');state.id='pulse-detail-state';
      popoverBody.append(div('energy-detail',value,state,node('p','这是角色的模拟心率：走动与互动时稍快，坐下和睡眠时放缓，数值会自然起伏。','small')));
      updateHudPulse();
    } else if (kind === 'chat') {
      popoverHeaderTitle.textContent = '💬 琉璃对话';
      const chatBox = div('popover-chat-box',
        div('unintegrated-notice-badge',
          node('span', '⚠️ 未接入 · 独立规划中', 'unintegrated-tag'),
          div('unintegrated-desc', '当前面板尚未连接大模型对话后端或外部通讯桥接。本轮严格遵循工程与安全边界，不显示虚构回复。后续将作为独立功能专项接入。')
        ),
        div('chat-preview-card',
          node('span', '房间伴侣状态：', 'chat-meta-label'),
          node('span', '“一直都在呢，有什么心事都可以告诉我哦。”', 'chat-quote')
        )
      );
      popoverBody.append(chatBox);
    } else if (kind === 'companion') {
      popoverHeaderTitle.textContent='陪伴与生活';
      actionTrayUi=mountRoomActionTray(popoverBody,{...sceneUiContext,document,icon:hudLineIcon,getRoom:()=>currentRoomData||r,getScene:()=>activeRoomScene,getAvailableActions:()=>latestAvailableActions,
       dispatchAction:id=>actionDispatcher?actionDispatcher.triggerAction(id):activeRoomScene?.setRoomActivity?.({preview:id}),notify:show,
       openFurniture:key=>openFurniture(key,undefined,btnBottomCompanion),close:closeBottomPopover,setFloor:value=>setObserverFloor(value,scene),
       toggleDetail:()=>{roomView.detail=!roomView.detail;scene.setRoomDetail?.(roomView.detail);},reposition:()=>{if(!bottomPopover.classList.contains('hidden'))positionFloatingMenu(bottomPopover,bottomPopover._anchor,shell,{placement:'top',gap:12});}});
    } else if (kind === 'remind') {
      popoverHeaderTitle.textContent = '🔔 待办提醒';
      const items = div('popover-remind-list',
        div('unintegrated-notice-badge',
          node('span', '⚠️ 未接入 · 规划中', 'unintegrated-tag'),
          div('unintegrated-desc', '当前插件未启用独立的后台定时器与待办提醒服务。当前仅提供房间作息只读状态，真实提醒功能将在后续版本独立上线。')
        ),
        div('remind-item',
          node('span', '当前作息：', 'remind-label'),
          node('span', latestNight?.sleeping ? '夜间睡眠' : '白天清醒活动', 'remind-val')
        ),
        div('remind-item',
          node('span', '当前精力：', 'remind-label'),
          node('span', lastHudNight ? lastHudNight.energy + ' / 100' : '状态同步中', 'remind-val')
        ),
        div('remind-item',
          node('span', '定时代办：', 'remind-label'),
          node('span', '暂无活跃提醒任务 (未接入)', 'remind-val')
        ),
        div('remind-item',
          node('span', '环境照明：', 'remind-label'),
          node('span', currentRoomData?.lamp ? '台灯点亮' : '自然光照', 'remind-val')
        )
      );
      popoverBody.append(items);
    } else if (kind === 'photo') {
      popoverHeaderTitle.textContent = '📷 快照摄影';
      const snapButtons = div('popover-photo-box',
        button('🖼️ 截取纯净小屋 (无 HUD 导出 PNG)', () => {
          closeBottomPopover();
          exportCottagePhoto({ withHud: false });
        }, 'popover-grid-btn'),
        button('📸 截取星海回响全景 (含 HUD 导出 PNG)', () => {
          closeBottomPopover();
          exportCottagePhoto({ withHud: true });
        }, 'popover-grid-btn'),
        button('📐 快照视角选择', () => {
          closeBottomPopover();
          toggleDrawerTab('cabin', btnNavCabin);
        }, 'popover-grid-btn')
      );
      popoverBody.append(snapButtons);
    }
  };

  const toggleBottomPopover = (kind, btn) => {
    if(!wardrobeBox.hidden)dressing.close();
    closeDrawer();
    if (activeBottomPopover === kind && !bottomPopover.classList.contains('hidden')) {
      closeBottomPopover();
    } else {
      bottomPopover._anchor?.classList.remove('active');
      activeBottomPopover = kind;
      bottomPopover._anchor = btn;
      bottomActionButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderBottomPopover(kind);
      bottomPopover.classList.remove('hidden');
      if (typeof positionFloatingMenu === 'function' && shell) {
        positionFloatingMenu(bottomPopover, btn, shell, { placement: 'top', gap: 12 });
      }
      popoverCloseBtn.focus?.();
    }
  };

  // 4 circular hotspot buttons on bottom center pill (2560x1440: x=1005..1555, y=1308..1396):
  const btnBottomChat = decorateIconBtn(
    button('', () => toggleBottomPopover('chat', btnBottomChat), 'bottom-pill-btn pill-chat'),
    [
      'M21 11.5 C21 16.2 16.97 20 12 20 C10.4 20 8.9 19.57 7.6 18.82 L3 20 L4.32 15.86 C3.5 14.58 3 13.1 3 11.5 C3 6.81 7.03 3 12 3 C16.97 3 21 6.81 21 11.5 Z',
      'M8.5 11.5 A1 1 0 1 1 8.5 11.4 Z M12 11.5 A1 1 0 1 1 12 11.4 Z M15.5 11.5 A1 1 0 1 1 15.5 11.4 Z'
    ],
    '琉璃对话'
  );
  btnBottomChat.title = '对话 (输入/快捷问候)';

  const btnBottomCompanion = decorateIconBtn(
    button('', () => toggleBottomPopover('companion', btnBottomCompanion), 'bottom-pill-btn pill-companion'),
    [
      'M8.5 2.5 V5 M12 2.5 V5 M15.5 2.5 V5',
      'M4 7.5 H17 V14.5 C17 17.5 14.5 19.5 10.5 19.5 C6.5 19.5 4 17.5 4 14.5 Z',
      'M17 9.5 H18.5 C20 9.5 21 10.5 21 12 C21 13.5 20 14.5 18.5 14.5 H17',
      'M2.5 21.5 H18.5'
    ],
    '陪伴与生活动作'
  );
  btnBottomCompanion.title = '陪伴核心 (摸摸头/坐会儿/去休息/随她生活/全部动作)';

  const btnBottomRemind = decorateIconBtn(
    button('', () => toggleBottomPopover('remind', btnBottomRemind), 'bottom-pill-btn pill-remind'),
    [
      'M18 9 A6 6 0 0 0 6 9 V15 C6 16.2 4 17.5 4 17.5 H20 C20 17.5 18 16.2 18 15 Z',
      'M10.3 20.5 A2 2 0 0 0 13.7 20.5'
    ],
    '待办提醒与状态'
  );
  btnBottomRemind.title = '提醒与状态 (今日提醒/精力/心情)';

  const btnBottomPhoto = decorateIconBtn(
    button('', () => toggleBottomPopover('photo', btnBottomPhoto), 'bottom-pill-btn pill-photo'),
    [
      'M21 20 H3 A2 2 0 0 1 1 18 V9 A2 2 0 0 1 3 7 H7.5 L9.5 4 H14.5 L16.5 7 H21 A2 2 0 0 1 23 9 V18 A2 2 0 0 1 21 20 Z',
      'M12 10.5 A3.5 3.5 0 1 0 12 17.5 A3.5 3.5 0 0 0 12 10.5 Z',
      'M17.5 9.5 A0.5 0.5 0 1 0 17.5 9.4 Z'
    ],
    '拍照留影'
  );
  btnBottomPhoto.title = '拍照留影 (当前画面/纯净无UI/特写)';

  const bottomActionButtons = [btnBottomChat, btnBottomCompanion, btnBottomRemind, btnBottomPhoto];

  const bottomCenterPill = div('star-echo-action-pill',
    btnBottomChat,
    node('span', '✦', 'pill-star-divider'),
    btnBottomCompanion,
    node('span', '✦', 'pill-star-divider'),
    btnBottomRemind,
    node('span', '✦', 'pill-star-divider'),
    btnBottomPhoto
  );

  const onOutsideClick = (e) => {
    if (!e.target || (document.contains && !document.contains(e.target))) return;
    if (!e.target.closest?.('.star-echo-capsule-sidebar') && !e.target.closest?.('.star-echo-floating-drawer')) {
      closeDrawer();
    }
    if (!e.target.closest?.('.star-echo-action-pill') && !e.target.closest?.('.star-echo-bottom-popover') && !e.target.closest?.('#hud-status-pill') && !e.target.closest?.('#hud-heart-rate-pill')) {
      closeBottomPopover();
    }
  };
  document.addEventListener?.('click', onOutsideClick);

  const stageFrameOverlay = div('star-echo-stage-frame-overlay');
  stageFrameOverlay.setAttribute('aria-hidden', 'true');

  const hudUi=mountRoomHud(null,{document,night,show,toggleBottomPopover,toggleDrawerTab,avatarUrl:typeof LIULI_CARD_AVATAR_DATA_URL==='string'?LIULI_CARD_AVATAR_DATA_URL:'',getButtons:()=>({companion:btnBottomCompanion,chat:btnBottomChat,wardrobe:btnNavWardrobe})});
  const rightInfoSidebar=hudUi.element;

  const legacyDock = div('star-echo-legacy-dock', floorControls, furnitureControls, controls, expand, bBackIsland);
  const stageRow = div('star-echo-stage-row',
    leftDock,
    centerStage,
    stageFrameOverlay,
    rightInfoSidebar,
    legacyDock
  );

  shell=div('block-room-shell star-echo-cabin-shell'+(r.lamp?' lamp-on':'')+(remembered.immersive?' room-immersive':''),
    stageRow,
    bottomPopover,
    bottomCenterPill
  );
    shell._syncHotbar=items=>{items.forEach((item,i)=>{if(hotbarSlots[i])hotbarSlots[i].title=item.state||'';});};
  shell.append(wardrobeBox,diagnosticPanel);
  const onImmersiveEsc=e=>{
    if(e.defaultPrevented||e.key!=='Escape'||roomWorkspace?.isOpen?.()||!wardrobeBox.hidden||document.querySelector?.('dialog[open]'))return;
    if(!bottomPopover.classList.contains('hidden')){e.preventDefault();closeBottomPopover(true);return;}
    if(!floatingDrawer.classList.contains('hidden')){e.preventDefault();closeDrawer(true);return;}
    if(!roomView.immersive)return;e.preventDefault();setImmersive(false);expand.focus?.();
  };
  document.addEventListener?.('keydown',onImmersiveEsc);

  const onWindowResize = () => {
    if (activeDrawerTab && !floatingDrawer.classList.contains('hidden')) {
      const activeBtn = navButtons.find(b => b.classList.contains('active'));
      if (activeBtn && typeof positionFloatingMenu === 'function' && shell) {
        positionFloatingMenu(floatingDrawer, activeBtn, shell, { placement: 'right', gap: 12 });
      }
    }
    if (activeBottomPopover && !bottomPopover.classList.contains('hidden')) {
      const activeBtn = bottomPopover._anchor;
      if (activeBtn && typeof positionFloatingMenu === 'function' && shell) {
        positionFloatingMenu(bottomPopover, activeBtn, shell, { placement: 'top', gap: 12 });
      }
    }
  };
  window.addEventListener?.('resize', onWindowResize);

  activeHudDelegates.toggleBottomPopover = toggleBottomPopover;
  activeHudDelegates.btnBottomRemind = btnBottomRemind;
  activeHudDelegates.btnBottomCompanion = btnBottomCompanion;

  const weatherPill = typeof document !== 'undefined' ? document.getElementById('weather-clock-pill') : null;
  if (weatherPill && !weatherPill._hasClick) {
    weatherPill._hasClick = true;
    weatherPill.style.cursor = 'pointer';
    weatherPill.setAttribute('role', 'button');
    weatherPill.setAttribute('tabindex', '0');
    const onWeatherClick = () => {
      const clockText = document.getElementById('clock-text')?.textContent || '--:--';
      const weatherText = document.getElementById('weather-text')?.textContent || '晴';
      show(`🌤️ 当前小屋环境：${weatherText} · 本地时间 ${clockText}`);
    };
    weatherPill.addEventListener('click', onWeatherClick);
    weatherPill.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWeatherClick(); } });
  }

  const statusPillEl = typeof document !== 'undefined' ? document.getElementById('hud-status-pill') : null;
  if (statusPillEl && !statusPillEl._hasClick) {
    statusPillEl._hasClick = true;
    statusPillEl.style.cursor = 'pointer';
    statusPillEl.setAttribute('role', 'button');
    statusPillEl.setAttribute('tabindex', '0');
    const onStatusClick = () => {
      activeHudDelegates.toggleBottomPopover?.('energy', statusPillEl);
    };
    statusPillEl.addEventListener('click', onStatusClick);
    statusPillEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStatusClick(); } });
  }

  const heartPillEl = typeof document !== 'undefined' ? document.getElementById('hud-heart-rate-pill') : null;
  if (heartPillEl && !heartPillEl._hasClick) {
    heartPillEl._hasClick = true;
    heartPillEl.style.cursor = 'pointer';
    heartPillEl.setAttribute('role', 'button');
    heartPillEl.setAttribute('tabindex', '0');
    const onHeartClick = () => {
      activeHudDelegates.toggleBottomPopover?.('pulse', heartPillEl);
    };
    heartPillEl.addEventListener('click', onHeartClick);
    heartPillEl.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onHeartClick(); } });
  }

  if(remembered.floor)scene.setRoomFloor?.(remembered.floor);if(remembered.detail)scene.setRoomDetail?.(true);expand.textContent=remembered.immersive?'收回小屋':'放大看';
  let stopped=false,timer;
  const poll=async()=>{if(stopped||activeRoomScene!==scene)return;if(!scene.isConnected||document.hidden){timer=setTimeout(poll,5000);return;}try{const[n,j]=await Promise.all([rpc('/night/state'),rpc('/jobs')]);latestNight=n;latestJobs=j.items||[];updateHudTelemetry(n);readCache.set('/night/state:{}',{data:cloneData(n),at:Date.now()});readCache.set('/jobs:{}',{data:cloneData(j),at:Date.now()});if(!stopped&&activeRoomScene===scene&&scene.isConnected)scene.setRoomActivity({night:n,jobs:j.items});}catch{if(!stopped){source.textContent='状态暂未刷新';updateHudTelemetry(null);}}finally{if(!stopped&&activeRoomScene===scene)timer=setTimeout(poll,5000);}};
  let runtimeTimer;const runtimeTick=()=>{if(stopped)return;void restoreRuntime();if(!document.hidden){updateHudTelemetry(null,false);if(runtimeRestored)saveRoomRuntime();}runtimeTimer=setTimeout(runtimeTick,1000);};runtimeTimer=setTimeout(runtimeTick,1000);
  timer=setTimeout(poll,5000);roomDispose=()=>{roomEnergy?.pause();photoSceneDisposed=true;if(runtimeRestored)saveRoomRuntime(true);stopped=true;document.removeEventListener?.('keydown',onImmersiveEsc);document.removeEventListener?.('click',onOutsideClick);window.removeEventListener?.('resize',onWindowResize);restoreGate.dispose();clearTimeout(runtimeTimer);clearTimeout(timer);roomSession.dispose();dressing.dispose();sceneUiContext.dispose();hudUi.dispose();actionTrayUi?.dispose();if(activeRoomScene===scene){activeRoomScene=null;activeHudDelegates.toggleBottomPopover=null;wardrobeCtrl.setUpdateListener(null);openRoomFurniture=null;activeFurnitureButtons={};}};return shell;
 }
 
const DEFAULT_ROOM_STATE = {
  lamp: false,
  curtain: false,
  items: [
    { id: 'item-bed', name: '床', state: '良好' },
    { id: 'item-desk', name: '书桌', state: '整洁' },
    { id: 'item-lamp', name: '台灯', state: '关闭' },
    { id: 'item-window', name: '窗', state: '明净' },
    { id: 'item-sofa', name: '沙发', state: '舒适' },
    { id: 'item-fridge', name: '冰箱', state: '运行中' },
    { id: 'item-tv', name: '电视', state: '待机' },
    { id: 'item-pothos', name: '绿萝', state: '生机' },
    { id: 'item-album', name: '旧相册', state: '珍藏' },
    { id: 'item-diary', name: '日记本', state: '私密' },
    { id: 'item-notebook', name: '记事本', state: '记录' },
    { id: 'item-nightstand', name: '床头柜', state: '整齐' },
    { id: 'item-bookshelf', name: '书架', state: '藏书丰富' },
    { id: 'item-chair', name: '椅子', state: '就绪' },
    { id: 'item-pc', name: '电脑', state: '待命' },
    { id: 'item-teatable', name: '茶几', state: '整洁' },
    { id: 'item-painting', name: '挂画', state: '星海' },
    { id: 'item-clock', name: '挂钟', state: '走动' },
    { id: 'item-pot', name: '盆栽', state: '翠绿' }
  ]
};

 async function room(){
  const version=renderVersion;
  let snapshot = null, n = null, j = null;
  try {
    const fetchPromise = prefetchedRoom || Promise.all([rpc('/room',{},undefined,true), read('/night/state'), read('/jobs')]);
    prefetchedRoom = null;
    // The bridge already owns the request timeout. A second 1.5s race discarded
    // valid late replies and replaced actual energy/room settings with defaults.
    [snapshot, n, j] = await fetchPromise;
  } catch (err) {
    if(!currentRoomData)throw err;
    snapshot = snapshot || { data: currentRoomData || DEFAULT_ROOM_STATE, revision: roomRevision || 1 };
    n = null;
    j = j || { items: latestJobs || [] };
  }
  if (!snapshot || !snapshot.data) {
    snapshot = { data: currentRoomData || DEFAULT_ROOM_STATE, revision: roomRevision || 1 };
  }
  if(panelDisposed||version!==renderVersion)return [];
  const r=snapshot.data;
  roomRevision=snapshot.revision;
  currentRoomData=r;if(n)latestNight=n;latestJobs=j?.items||[];
  updateHudTelemetry(n);
  const nextIdentity=JSON.stringify((r.items||[]).map(({id,name})=>[id,name])),nextEnv=`${Boolean(r.lamp)}:${Boolean(r.curtain)}`;
  const envMismatch=Boolean(cachedRoomShell&&typeof activeRoomScene?.setRoomEnvironment!=='function'&&cachedRoomEnv!==nextEnv);
  if(cachedRoomShell&&(nextIdentity!==cachedRoomIdentity||envMismatch)){roomDispose();roomDispose=()=>{};cachedRoomShell=null;cachedRoomResult=null;cachedRoomJson='';}
  cachedRoomIdentity=nextIdentity;cachedRoomEnv=nextEnv;
  const shell=cachedRoomShell||roomScene(r,n,j.items);
  cachedRoomShell=shell;
  shell._syncHotbar?.(r.items||[]);
  shell.classList.toggle('lamp-on',Boolean(r.lamp));
  if(activeRoomScene){
   activeRoomScene.setRoomPaused?.(false);
   activeRoomScene.setRoomEnvironment?.({lamp:Boolean(r.lamp),curtain:Boolean(r.curtain)});
   activeRoomScene.setRoomActivity?.({night:n,jobs:j.items});
  }
  if(fittingScene&&!fittingScene.closest?.('[hidden]'))fittingScene.setRoomPaused?.(false);
  const nextJson=JSON.stringify(r);
  if(cachedRoomResult&&nextJson===cachedRoomJson)return cachedRoomResult;
  cachedRoomJson=nextJson;
  const result=[shell];
  cachedRoomResult=result;
  return result;
 }
 async function render(){
  if(panelDisposed)return;
  document.body.classList?.toggle?.('room-wide',true);
  document.body.classList?.toggle?.('holo-deck',true);
  const version=++renderVersion;
  syncVersionSwitcher();
  const isIslandMode=currentViewMode==='island'&&hasWebGL;
  parent.postMessage({channel:'liuli-companion',type:'hud-safe-area',enabled:!isIslandMode},'*');
  document.body.classList?.toggle?.('island-mode',isIslandMode);

  if(isIslandMode){
   $('title').textContent='琉璃的小鲸鱼岛';
   $('eyebrow').textContent='GLOBAL MAP // WHALE HABITAT V5';
   updateHudTelemetry(latestNight,false);
   if(activeRoomScene){activeRoomScene.setRoomPaused?.(true);}
   const islandWrapper=div('island-map-surface');
   content.replaceChildren(islandWrapper);
   const mount=()=>{
    if(version!==renderVersion||currentViewMode!=='island'||!islandWrapper.isConnected)return;
    if(activeIslandInstance){activeIslandInstance.dispose?.();activeIslandInstance=null;}
    if(!window.mountWhaleIsland)return;
    try{activeIslandInstance=window.mountWhaleIsland(islandWrapper,{
     onEnterRoom:(floor)=>switchViewMode('room',floor),
     onPet:()=>{
      try{const saved=Number(safeStorage.getItem('liuli-cottage-dev:intimacy'));const intimacy=(Number.isFinite(saved)&&saved>=100?saved:100)+1;safeStorage.setItem('liuli-cottage-dev:intimacy',String(intimacy));}catch{}
      updateHudTelemetry(latestNight,false);
     },
     getRoomState:()=>({room:currentRoomData,night:latestNight,jobs:latestJobs}),
    });}catch(e){failIslandLoad('3D 画面初始化失败，可先返回小屋。');console.error('[island mount]',e);}
   };
   if(window.mountWhaleIsland){
    mount();
   }else{
    const loadingCard=div('island-loading-badge',
      div('loading','正在开启琉璃的小鲸鱼岛 3D 自由视角…'),
      div('small muted','初次加载 3D WebGL 引擎，请稍候…'),
      div('actions',button('直接进入 2D 小屋',()=>switchViewMode('room'),'quiet small'))
    );
    islandWrapper.appendChild(loadingCard);
    pendingIslandMount=()=>{
      loadingCard.remove();
      mount();
    };
    requestIslandMap();
   }
   panelRevision=revision||roomRevision;
   $('updated').textContent='更新于 '+new Date().toLocaleTimeString('zh-CN',{hour12:false});
   return;
  }

  $('title').textContent='她的房间';
  $('eyebrow').textContent='琉璃 · 与你同频相伴';
  if(typeof STAR_ECHO_FRAME_DATA_URL==='string'&&STAR_ECHO_FRAME_DATA_URL.startsWith('data:image/png;base64,')){
   const mainEl=typeof document?.querySelector==='function'?document.querySelector('body.star-echo-theme main'):null;
   if(mainEl?.style){
    mainEl.style.setProperty('background',`#01040d url("${STAR_ECHO_FRAME_DATA_URL}") no-repeat center center`,'important');
    mainEl.style.setProperty('background-size','100% 100%','important');
   }
  }
  updateHudTelemetry(latestNight,false);
  const paint=(...children)=>content.replaceChildren(...children);
  const prevRoomResult=cachedRoomResult,hasWarmRoom=Boolean(prevRoomResult);
  if(hasWarmRoom){
   paint(...prevRoomResult);
   activeRoomScene?.setRoomPaused?.(false);
   if(fittingScene&&!fittingScene.closest?.('[hidden]'))fittingScene.setRoomPaused?.(false);
  }else{
   // Do not mount/save a provisional room with default items before the real inventory arrives.
   paint(div('room-initial-loading',node('span','正在读取小屋…','loading')));
  }
  try{
   const result=await room();
   if(panelDisposed||version!==renderVersion)return;
   if(!(hasWarmRoom&&result===prevRoomResult))paint(...result);
   panelRevision=revision||roomRevision;
   $('updated').textContent='更新于 '+new Date().toLocaleTimeString('zh-CN',{hour12:false});
  }catch(e){
   if(panelDisposed||version!==renderVersion)return;
   cachedRoomShell=null;cachedRoomResult=null;cachedRoomJson='';cachedRoomIdentity='';roomDispose();roomDispose=()=>{};
   paint(div('errorbox',e.message),actions(button('重新连接',render,'quiet')));
   $('updated').textContent='读取失败';
  }
 }
 listen($('refresh'),'click',()=>{if(roomWorkspace?.isOpen?.())return roomWorkspace.refresh(true);invalidateReadCache(true);prefetchedRoom=null;return render();});
 // --- Realtime Clock Timer ---
function initRealtimeClock() {
  const clockEl = typeof document !== 'undefined' ? document.getElementById('clock-text') : null;
  const weatherEl = typeof document !== 'undefined' ? document.getElementById('weather-text') : null;
  function tick() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const isDay = now.getHours() >= 6 && now.getHours() < 19;
    if (clockEl) clockEl.textContent = h + ':' + m;
    if (weatherEl) weatherEl.textContent = isDay ? '白天·晴' : '夜晚·晴';
  }
  tick();
  if (typeof setInterval !== 'undefined') {
    const timer=setInterval(tick,1000);panelCleanups.push(()=>{if(typeof clearInterval!=='undefined')clearInterval(timer);});
  }
}
initRealtimeClock();

 function disposeRoomPanel(){
  if(panelDisposed)return;panelDisposed=true;renderVersion++;islandLoadGeneration++;pendingIslandMount=null;activeIslandInstance?.dispose?.();activeIslandInstance=null;roomDispose();roomWorkspace?.dispose?.();roomBookReader?.dispose?.();wardrobeCtrl.dispose?.();runtimePersistence?.dispose?.();featureLoader?.dispose();moduleClient?.dispose();dressingAssetClient?.dispose?.();
  for(const cleanup of panelCleanups.splice(0))cleanup();for(const timer of panelTimers)clearTimeout(timer);panelTimers.clear();cancelPanel(noticeTimer);
  for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error('视窗已经关闭'));}pending.clear();
  for(const request of bookRequests.values()){clearTimeout(request.timer);request.reject(Error('视窗已经关闭'));}bookRequests.clear();
 }
 listen(window,'pagehide',event=>{if(!event.persisted)disposeRoomPanel();});
 window.__disposeWhaleRoomUi=disposeRoomPanel;
render();
})();
