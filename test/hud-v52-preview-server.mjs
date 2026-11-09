// Isolated UI acceptance harness. Never imports production config or data.
import {createServer} from 'node:http';import {readFile,mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import vm from 'node:vm';
import {CompanionStore} from '../src/store.mjs';import {CompanionService} from '../src/service.mjs';import {createHandler} from '../src/routes.mjs';import {attachFrameBridge} from '../src/frame-bridge.mjs';
const root=await mkdtemp(join(tmpdir(),'liuli-ui-fixture-')),store=await CompanionStore.open(root),notes=new Map(),diary=[];
await store.update(null,s=>{s.room.items=['床','书桌','台灯','窗','沙发','冰箱','电视','绿萝','旧相册','日记本','记事本','床头柜','书架','椅子','电脑','茶几','挂画','挂钟','盆栽'].map((name,i)=>({id:'fixture-room-'+i,name,state:'隔离验收物品'}));});
let persona='这是隔离验收用的人格。',config={enabled:true,send:{firstDelayMinMs:0,firstDelayMaxMs:6000},wake:{enabled:true},wait:{enabled:true},context:{enabled:true},tools:{getImages:true},proactive:{enabled:false}};
const bridge={async request(action,args){switch(action){case 'status':return {mode:'reserved2',dshReady:true,socialV2Paused:false};case 'roles':return {current:'隔离验收人格'};case 'persona':return {name:'隔离验收人格',content:persona};case 'personaSave':persona=args.content;return {ok:true};case 'config':return {config};case 'configSave':config={...config,...args};return {ok:true};case 'sessions':return {conversations:[{key:'private:10001',unreadCount:0,lastAiReplyAt:null}]};case 'recent':case 'unread':return {messages:[]};case 'admins':return {owner:'10001'};default:return {ok:true};}}};
const memory={async write(r){notes.set(r.id,r.content);return r.id;},async hydrate(rows){return rows.map(r=>({...r,content:notes.get(r.sourceRef)||r.content||''}));},async list(){return {nodes:[]};}};
const service=new CompanionService({store,bridge,memory,diary:{async list(){return diary;},async write(input){const r={...input,id:'d'+diary.length,time:'2026-10-31 12:00'};diary.push(r);return r;}},model:{async generate(){return '仅用于隔离验收的生成文本。';}},qq:{auth:null,async status(){return {user_id:10001,nickname:'隔离测试，无真实 QQ'};},async refreshAuth(){return {ready:false,fixture:true};},async qzone(){return {items:[],fixture:true};}},tools:{async list(){return [{name:'clock',label:'北京时间',group:'生活',readOnly:true,available:true}];},async test(){return {text:'仅限隔离验收'};}}});
const {createActionAssetHandler}=await import('../src/action-assets.mjs');
const artwork=createActionAssetHandler({connection:{requestRejection:()=>undefined}});
const handler=createHandler({connection:{requestRejection(req){return /^127\.0\.0\.1:18552$/.test(req.headers.host)?undefined:403;}},service,runtimeToken:'fixture'});
const assetManifest=JSON.parse(await readFile(new URL('../assets/room-pet/manifest.json',import.meta.url),'utf8'));const assetFrames=new Set(Object.values(assetManifest.clips).flatMap(c=>c.frames));
const chunkCache=new Map();
async function getChunkPayload(filename){
  if(chunkCache.has(filename))return chunkCache.get(filename);
  const code=await readFile(new URL('../lib/'+filename,import.meta.url),'utf8');
  let loaded=null;
  vm.runInNewContext(code,{window:{__ModuleLoader__:{load(def){loaded=def.factory();}}}});
  chunkCache.set(filename,loaded);
  return loaded;
}
const server=createServer(async(req,res)=>{try{
  if(req.url==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(req.url.startsWith('/plugins/dsh-whale-status/actions/'))return artwork(req,res);
  if(req.url.startsWith('/plugins/dsh-dafeiyu/frame?')){
    const frame=new URL(req.url,'http://localhost').searchParams.get('frame');
    if(!assetFrames.has(frame)){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'public, max-age=86400'});
    res.end(await readFile(new URL('../assets/room-pet/'+frame,import.meta.url)));
    return;
  }
  if(req.url.startsWith('/fixture-chunk/')){
    const name=req.url.slice('/fixture-chunk/'.length);
    try{
      const payload=await getChunkPayload(name);
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify(payload));
      return;
    }catch{res.writeHead(404);res.end();return;}
  }
  if(req.url.startsWith('/api/'))return handler(req,res);
  if(req.url==='/'){
    // Rebase only the isolated fixture origin in CSP; production HTML stays unchanged.
    const html=(await readFile(new URL('../lib/panel-built.html',import.meta.url),'utf8')).replaceAll('http://127.0.0.1:18406/','http://127.0.0.1:18552/');
    const script=`${attachFrameBridge.toString().replace('export ','')}
const frame=document.querySelector('iframe');
attachFrameBridge(window,()=>frame.contentWindow,new Set(${JSON.stringify(Object.keys(service.handlers))}));
frame.srcdoc=${JSON.stringify(html).replace(/<\/script/gi,'<\\/script')};

let roomRuntime=null;
const roomRuntimeKey='liuli-companion:room-runtime:v1';
const wardrobeKey='liuli-companion:wardrobe:v1';
try{roomRuntime=JSON.parse(localStorage.getItem(roomRuntimeKey)||'null');}catch{}

const wardrobeLoads=new Map();
async function fetchChunk(name){
  if(!wardrobeLoads.has(name)){
    wardrobeLoads.set(name,fetch('/fixture-chunk/'+name).then(r=>r.json()));
  }
  return wardrobeLoads.get(name);
}

const sendRoomAssets=async()=>{
  frame.contentWindow?.postMessage({channel:'liuli-companion',type:'room-runtime',value:roomRuntime},'*');
  try{
    const assets=await fetchChunk('client.room-art-v12.js');
    frame.contentWindow?.postMessage({channel:'liuli-companion',type:'room-assets',assets},'*');
  }catch(e){}
};

frame.addEventListener('load',sendRoomAssets);

window.addEventListener('message',async event=>{
  const target=frame.contentWindow;
  const d=event.data;
  if(!target||event.source!==target||d?.channel!=='liuli-companion')return;
  if(d.type==='room-assets-request'){sendRoomAssets();return;}
  if(d.type==='room-life-request'){
    try{
      const assets=await fetchChunk('client.room-life-v20.js');
      target.postMessage({channel:'liuli-companion',type:'room-life-assets',assets},'*');
    }catch(e){}
    return;
  }
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
      const assets=await fetchChunk('client.wardrobe-'+id+'-v20.js');
      target.postMessage({channel:'liuli-companion',type:'wardrobe-assets',id,requestId:d.requestId,assets},'*');
    }catch(e){
      target.postMessage({channel:'liuli-companion',type:'wardrobe-error',requestId:d.requestId},'*');
    }
    return;
  }
});
`;
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(`<!doctype html><html><body style="margin:0;background:#01040d;overflow:hidden"><iframe title="琉璃陪伴中心隔离验收" sandbox="allow-scripts" style="width:100%;height:100vh;border:0"></iframe><script>${script}</script></body></html>`);
  }else{res.writeHead(404);res.end();}
}catch(e){res.writeHead(500);res.end(e.message);}});
server.listen(18552,'127.0.0.1',()=>console.log('Fixture UI listening at http://127.0.0.1:18552'));
process.on('SIGINT',async()=>{server.close();await store.close();process.exit();});
