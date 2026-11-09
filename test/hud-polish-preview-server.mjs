import {encodeRoomPhotoImages} from '../src/room-photo-images.mjs';
const previewPort=Number(process.env.LIULI_PREVIEW_PORT||18553);
// Isolated UI acceptance harness. Never imports production config or data.
import {fitHudViewport,attachHudSafeArea} from '../src/hud-safe-area.mjs';
import {createServer} from 'node:http';import {readFile,mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import vm from 'node:vm';
import {CompanionStore} from '../src/store.mjs';import {CompanionService} from '../src/service.mjs';import {createHandler} from '../src/routes.mjs';import {attachFrameBridge} from '../src/frame-bridge.mjs';
import {validateRoomEnergySnapshot} from '../src/hud-energy.mjs';
const root=await mkdtemp(join(tmpdir(),'liuli-ui-fixture-')),store=await CompanionStore.open(root),notes=new Map(),diary=[];
await store.update(null,s=>{s.room.items=['床','书桌','台灯','窗','沙发','冰箱','电视','绿萝','旧相册','日记本','记事本','床头柜','书架','椅子','电脑','茶几','挂画','挂钟','盆栽'].map((name,i)=>({id:'fixture-room-'+i,name,state:'隔离验收物品'}));});
let persona='这是隔离验收用的人格。',config={enabled:true,send:{firstDelayMinMs:0,firstDelayMaxMs:6000},wake:{enabled:true},wait:{enabled:true},context:{enabled:true},tools:{getImages:true},proactive:{enabled:false}};
const bridge={async request(action,args){switch(action){case 'status':return {mode:'reserved2',dshReady:true,socialV2Paused:false};case 'roles':return {current:'隔离验收人格'};case 'persona':return {name:'隔离验收人格',content:persona};case 'personaSave':persona=args.content;return {ok:true};case 'config':return {config};case 'configSave':config={...config,...args};return {ok:true};case 'sessions':return {conversations:[{key:'private:10001',unreadCount:0,lastAiReplyAt:null}]};case 'recent':case 'unread':return {messages:[]};case 'admins':return {owner:'10001'};default:return {ok:true};}}};
const memory={async write(r){notes.set(r.id,r.content);return r.id;},async hydrate(rows){return rows.map(r=>({...r,content:notes.get(r.sourceRef)||r.content||''}));},async list(){return {nodes:[]};}};
const service=new CompanionService({store,bridge,memory,diary:{async list(){return diary;},async write(input){const r={...input,id:'d'+diary.length,time:'2026-10-31 12:00'};diary.push(r);return r;}},model:{async generate(){return '仅用于隔离验收的生成文本。';}},qq:{auth:null,async status(){return {user_id:10001,nickname:'隔离测试，无真实 QQ'};},async refreshAuth(){return {ready:false,fixture:true};},async qzone(){return {items:[],fixture:true};}},tools:{async list(){return [{name:'clock',label:'北京时间',group:'生活',readOnly:true,available:true}];},async test(){return {text:'仅限隔离验收'};}}});
const {createActionAssetHandler}=await import('../src/action-assets.mjs');
const artwork=createActionAssetHandler({connection:{requestRejection:()=>undefined}});
const handler=createHandler({connection:{requestRejection(req){return req.headers.host==='127.0.0.1:'+previewPort?undefined:403;}},service,runtimeToken:'fixture'});
const imageDelivery=JSON.parse(await readFile(new URL('../lib/room-asset-manifest.json',import.meta.url),'utf8'));
const assetManifest=JSON.parse(await readFile(new URL('../assets/room-pet/manifest.json',import.meta.url),'utf8'));const assetFrames=new Set(Object.values(assetManifest.clips).flatMap(c=>c.frames));
const chunkCache=new Map();
async function getChunkPayload(filename,frozen=false){
  if(frozen==='followup'&&filename.startsWith('client.room-ui-'))return JSON.parse(await readFile(new URL('../previews/performance-followup-20261109/before/lib/'+filename,import.meta.url),'utf8'));
  if(frozen&&filename.startsWith('client.room-ui-'))return JSON.parse(await readFile(new URL('../previews/performance-repair-20261109/before/lib/'+filename,import.meta.url),'utf8'));
  if(filename.startsWith('client.room-ui-')||filename.includes('-v21.js'))return JSON.parse(await readFile(new URL('../lib/'+filename,import.meta.url),'utf8'));
  if(chunkCache.has(filename))return chunkCache.get(filename);
  const code=await readFile(new URL('../lib/'+filename,import.meta.url),'utf8');
  if(filename.startsWith('client.room-ui-')){const payload=JSON.parse(code);chunkCache.set(filename,payload);return payload;}
  let loaded=null;
  vm.runInNewContext(code,{window:{__ModuleLoader__:{load(def){loaded=def.factory();}}}});
  chunkCache.set(filename,loaded);
  return loaded;
}
const server=createServer(async(req,res)=>{try{
  if(req.url==='/fixture/state'&&req.method==='POST'){let body='';for await(const c of req)body+=c;const patch=JSON.parse(body);await store.update(null,s=>{if(typeof patch.energy==='number')s.night.energy=patch.energy;if(typeof patch.curtain==='boolean')s.room.curtain=patch.curtain;});res.writeHead(200,{'Content-Type':'application/json'});res.end('{}');return;}
  if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(req.url.startsWith('/plugins/dsh-whale-status/actions/')||req.url.startsWith('/plugins/dsh-whale-status/assets/'))return artwork(req,res);
  if(req.url.startsWith('/plugins/dsh-whale-status/pet/frame?')){
    const frame=new URL(req.url,'http://localhost').searchParams.get('frame');
    if(!assetFrames.has(frame)){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'public, max-age=86400'});
    res.end(await readFile(new URL('../assets/room-pet/'+frame,import.meta.url)));
    return;
  }
  if(req.url.startsWith('/fixture-chunk/')){
    const chunkUrl=new URL(req.url,'http://localhost'),name=chunkUrl.pathname.slice('/fixture-chunk/'.length);
    try{
      const payload=await getChunkPayload(name,chunkUrl.searchParams.has('followupBaseline')?'followup':chunkUrl.searchParams.has('performanceBaseline'));
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify(payload));
      return;
    }catch{res.writeHead(404);res.end();return;}
  }
  if(req.url.startsWith('/api/'))return handler(req,res);
  if(new URL(req.url,'http://localhost').pathname==='/'){
    // Rebase only the isolated fixture origin in CSP; production HTML stays unchanged.
    const metadata=!/[?&](baseline|performanceBaseline)=1/.test(req.url);
    const html=(await readFile(req.url.includes('followupBaseline=1')?new URL('../previews/performance-followup-20261109/before/lib/panel-built.html',import.meta.url):req.url.includes('performanceBaseline=1')?new URL('../previews/performance-repair-20261109/before/lib/panel-built.html',import.meta.url):req.url.includes('baseline=1')?'D:/deepseenhanress/_dsh/home/profiles/desktop/node_modules/dsh-whale-status/lib/panel-built.html':new URL('../lib/panel-built.html',import.meta.url),'utf8')).replaceAll('http://127.0.0.1:18406/','http://127.0.0.1:'+previewPort+'/');
    const script=`${attachFrameBridge.toString().replace('export ','')}
const frame=document.querySelector('iframe');
${fitHudViewport.toString()}
${attachHudSafeArea.toString()}
window.stopHudSafety=attachHudSafeArea({surface:document.getElementById('hud-host-surface'),frame});
attachFrameBridge(window,()=>frame.contentWindow,new Set(${JSON.stringify(Object.keys(service.handlers))}));
frame.srcdoc=${JSON.stringify(html).replace(/<\/script/gi,'<\\/script')};

const useAssetMetadata=${metadata};
const useFrozenModules=${req.url.includes('performanceBaseline=1')};
const useFollowupBaseline=${req.url.includes('followupBaseline=1')};
const encodeRoomPhotoImages=${encodeRoomPhotoImages.toString()};
const photoUrls=new Set(${JSON.stringify(imageDelivery.images.map(r=>r.url.replace('dsh-app://app/','http://127.0.0.1:'+previewPort+'/')))});
let roomRuntime=null;
let roomEnergy=null;const energyKey='liuli-companion:room-energy:v1',validRoomEnergy=${validateRoomEnergySnapshot.toString()};
try{const saved=JSON.parse(localStorage.getItem(energyKey)||'null');if(validRoomEnergy(saved))roomEnergy=saved;}catch{}
const roomRuntimeKey='liuli-companion:room-runtime:v1';
const wardrobeKey='liuli-companion:wardrobe:v1';
try{roomRuntime=JSON.parse(localStorage.getItem(roomRuntimeKey)||'null');}catch{}

const wardrobeLoads=new Map();
async function fetchChunk(name){
  if(!wardrobeLoads.has(name)){
    const pending=fetch('/fixture-chunk/'+name+(useFollowupBaseline&&name.startsWith('client.room-ui-')?'?followupBaseline=1':'')+(useFrozenModules&&name.startsWith('client.room-ui-')?'?performanceBaseline=1':'')).then(r=>{if(!r.ok)throw Error('fixture chunk load failed');return r.json();});
    wardrobeLoads.set(name,pending);
    pending.catch(()=>{if(wardrobeLoads.get(name)===pending)wardrobeLoads.delete(name);});
  }
  const payload=await wardrobeLoads.get(name);return useAssetMetadata&&name.includes('-v21.js')?JSON.parse(JSON.stringify(payload.assets).replaceAll('dsh-app://app/','http://127.0.0.1:'+location.port+'/')):payload;
}

if(useAssetMetadata&&!useFollowupBaseline){
 for(const name of ['client.room-assets-art-v21.js','client.room-assets-life-v21.js'])void fetchChunk(name).catch(()=>{});
 const selected=localStorage.getItem(wardrobeKey);
 if(${JSON.stringify(JSON.parse(await readFile(new URL('../assets/wardrobe-v1/catalog.json',import.meta.url),'utf8')).map(row=>row.id))}.includes(selected))void fetchChunk('client.wardrobe-'+selected+'-v21.js').catch(()=>{});
}

const roomChunkDeliveries=new WeakMap();
const sendRoomChunk=(kind,requestId)=>{
  const target=frame.contentWindow;if(!target)return;
  let state=roomChunkDeliveries.get(target);if(!state){state={};roomChunkDeliveries.set(target,state);}
  const key=typeof requestId==='string'?requestId:'legacy';
  if(state[kind]?.key===key)return state[kind].promise;
  const delivery={key,promise:null};state[kind]=delivery;
  const current=()=>target===frame.contentWindow&&state[kind]===delivery;
  delivery.promise=(async()=>{
    try{
      const assets=await fetchChunk(useAssetMetadata?(kind==='art'?'client.room-assets-art-v21.js':'client.room-assets-life-v21.js'):(kind==='art'?'client.room-art-v12.js':'client.room-life-v20.js'));
      if(current())target.postMessage({channel:'liuli-companion',type:kind==='art'?'room-assets':'room-life-assets',requestId,assets},'*');
    }catch(error){
      if(current())target.postMessage({channel:'liuli-companion',type:kind==='art'?'room-assets-error':'room-life-error',requestId},'*');
      if(state[kind]===delivery)delete state[kind];
    }
  })();
  return delivery.promise;
};
const notifyRoomFrame=()=>{
  const target=frame.contentWindow;if(!target)return;
  target.postMessage({channel:'liuli-companion',type:'room-runtime',value:roomRuntime},'*');
  target.postMessage({channel:'liuli-companion',type:'room-assets-ready'},'*');
};

frame.addEventListener('load',notifyRoomFrame);

window.addEventListener('message',async event=>{
  const target=frame.contentWindow;
  const d=event.data;
  if(!target||event.source!==target||d?.channel!=='liuli-companion')return;
  if(d.type==='room-energy-request'){target.postMessage({channel:'liuli-companion',type:'room-energy',value:roomEnergy},'*');return;}
  if(d.type==='room-energy-save'){if(validRoomEnergy(d.value)){roomEnergy=d.value;localStorage.setItem(energyKey,JSON.stringify(roomEnergy));}return;}
  if(d.type==='room-module-request'){
    const flags=new URL(location.href).searchParams;await new Promise(r=>setTimeout(r,Number(flags.get('moduleDelay')||0)));
    try{if(flags.get('moduleFail')===d.id)throw Error('fixture module failure');const payload={...await fetchChunk('client.room-ui-'+d.id+'-v52.js')};if(flags.get('moduleStale')===d.id)payload.revision='stale';target.postMessage({channel:'liuli-companion',type:'room-module-assets',requestId:d.requestId,id:d.id,payload},'*');}
    catch(e){target.postMessage({channel:'liuli-companion',type:'room-module-error',requestId:d.requestId,id:d.id,error:e.message},'*');}return;
  }
  if(d.type==='room-assets-request')return sendRoomChunk('art',d.requestId);
  if(d.type==='dressing-favorites'&&Array.isArray(d.ids)){try{localStorage.setItem('liuli-companion:dressing-favorites:v1',JSON.stringify(d.ids));}catch{}return;}
  if(d.type==='room-photo-image-request'){try{const images=await encodeRoomPhotoImages(d.urls,{allowed:photoUrls});target.postMessage({channel:'liuli-companion',type:'room-photo-images',requestId:d.requestId,images},'*');}catch{target.postMessage({channel:'liuli-companion',type:'room-photo-images',requestId:d.requestId,error:'fixture photo failed'},'*');}return;}
  if(d.type==='dressing-request'){
    try{const assets=await fetchChunk(useAssetMetadata?'client.room-assets-dressing-v21.js':'client.dressing-room-v52.js');let favorites=[];try{favorites=JSON.parse(localStorage.getItem('liuli-companion:dressing-favorites:v1')||'[]');}catch{}
      target.postMessage({channel:'liuli-companion',type:'dressing-assets',requestId:d.requestId,assets,favorites},'*');
    }catch{target.postMessage({channel:'liuli-companion',type:'dressing-error',requestId:d.requestId},'*');}return;
  }
  if(d.type==='island-map-request'){
    const flags=new URL(location.href).searchParams;
    await new Promise(r=>setTimeout(r,Number(flags.get('islandDelay')||0)));
    try{
      if(flags.has('islandFail'))throw Error('fixture island failure');
      const assets=await fetchChunk('client.island-map-v1.js');
      target.postMessage({channel:'liuli-companion',type:'island-map-assets',assets},'*');
    }catch(e){target.postMessage({channel:'liuli-companion',type:'island-map-error'},'*');}
    return;
  }
  if(d.type==='room-life-request')return sendRoomChunk('life',d.requestId);
  if(d.type==='room-runtime-request'){
    target.postMessage({channel:'liuli-companion',type:'room-runtime',value:roomRuntime},'*');
    return;
  }
  if(d.type==='room-runtime-save'){
    if(d.value?.version===1&&Number.isFinite(d.value.savedAt)){
      try{
        const json=JSON.stringify(d.value);
        if(json.length<131072){
          roomRuntime=JSON.parse(json);
          localStorage.setItem(roomRuntimeKey,json);
        }
      }catch{}
    }
    return;
  }
  if(d.type==='wardrobe-selected'){
    try{localStorage.setItem(wardrobeKey,d.id);}catch{}
    return;
  }
  if(d.type==='wardrobe-request'&&typeof d.requestId==='string'){
    let id=d.id;
    if(id===undefined){
      try{id=localStorage.getItem(wardrobeKey);}catch{}
      id=id||'original';
    }
    if(id==='original'){
      target.postMessage({channel:'liuli-companion',type:'wardrobe-assets',id:'original',requestId:d.requestId,assets:null},'*');
      return;
    }
    try{
      const assets=await fetchChunk('client.wardrobe-'+id+(useAssetMetadata?'-v21.js':'-v20.js'));
      target.postMessage({channel:'liuli-companion',type:'wardrobe-assets',id,requestId:d.requestId,assets},'*');
    }catch(e){
      target.postMessage({channel:'liuli-companion',type:'wardrobe-error',requestId:d.requestId},'*');
    }
    return;
  }
});
`;
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(`<!doctype html><html><body style="margin:0;background:#01040d;overflow:hidden"><div id="hud-host-surface" style="position:relative;width:100vw;height:100vh"><iframe title="琉璃陪伴中心隔离验收" sandbox="allow-scripts" style="position:absolute;width:100%;height:100%;border:0"></iframe></div><script>${script}</script></body></html>`);
  }else{res.writeHead(404);res.end();}
}catch(e){res.writeHead(500);res.end(e.message);}});
server.listen(previewPort,'127.0.0.1',()=>console.log('Fixture UI listening at http://127.0.0.1:'+previewPort));
process.on('SIGINT',async()=>{server.close();await store.close();process.exit();});
