import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {CompanionStore} from '../src/store.mjs';
import {startHost} from '../src/host.mjs';

const names=['床','书桌','台灯','窗','沙发','冰箱','电视','绿萝','旧相册','日记本','记事本','床头柜','书架','椅子','电脑','茶几','挂画','挂钟','盆栽'];
async function temporary(t){const root=await mkdtemp(join(tmpdir(),'liuli-release-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
const response=()=>({status:0,headers:{},body:null,writeHead(status,headers={}){this.status=status;this.headers=headers;},end(body){this.body=body;}});
function context(){const routes=new Map();return {routes,connection:{requestRejection:()=>undefined},webServer:{register({path,handler}){routes.set(path,handler);return()=>routes.delete(path);}},tools:{get:()=>undefined,schemas:()=>[]}};}

test('new installations have the complete 19-item room with no imported personal history',async t=>{
 const root=await temporary(t),store=await CompanionStore.open(root);t.after(()=>store.close());
 const state=store.read();assert.deepEqual(state.room.items.map(x=>x.name),names);
 assert.equal(new Set(state.room.items.map(x=>x.id)).size,19);
 for(const key of ['memories','dreams','events','personaHistory'])assert.deepEqual(state[key],[]);
 assert.deepEqual(state.room.interactions,[]);
});

test('reopening a customized or empty room never reseeds furniture',async t=>{
 const root=await temporary(t);let store=await CompanionStore.open(root);
 await store.update(0,s=>{s.room.items=[];s.room.description='A deliberately empty room';});await store.close();
 store=await CompanionStore.open(root);t.after(()=>store.close());
 assert.deepEqual(store.read().room.items,[]);assert.equal(store.read().room.description,'A deliberately empty room');
});

test('panel starts without another checkout or QQ bridge and does not contact a gateway',async t=>{
 const root=await temporary(t),ctx=context();
 const originalFetch=globalThis.fetch;let networkCalls=0;globalThis.fetch=async()=>{networkCalls++;throw Error('Unexpected external call');};t.after(()=>{globalThis.fetch=originalFetch;});
 const host=await startHost(ctx,{workspace:join(root,'not-a-checkout'),stateRoot:join(root,'state')});t.after(()=>host.close());
 const overview=(await host.service.dispatch('/overview')).data;
 assert.equal(overview.room.items.length,19);assert.equal(overview.connections.bridge.error.code,'BRIDGE_NOT_CONFIGURED');
 const health=await host.service.health();assert.equal(health.qq.error.code,'BRIDGE_NOT_CONFIGURED');
 assert.equal(health.memory.error.code,'TOOL_UNAVAILABLE');assert.equal(networkCalls,0);
 assert.ok(ctx.routes.has('/api/liuli/command'));assert.ok(ctx.routes.has('/plugins/dsh-whale-status/pet/frame'));
 await host.close();assert.equal(ctx.routes.size,0);
});

test('every emitted resident frame loads from this bundle and traversal/auth/method checks hold',async()=>{
 const assets=await import('../src/pet-assets.mjs').catch(()=>({}));
 assert.equal(typeof assets.createPetAssetHandler,'function','the panel must provide its own pet frames');
 const manifest=JSON.parse(await readFile(new URL('../assets/room-pet/manifest.json',import.meta.url),'utf8'));
 const ok=assets.createPetAssetHandler({connection:{requestRejection:()=>undefined}});
 const client=await readFile(new URL('../lib/client.js',import.meta.url),'utf8');
 const html=JSON.parse(client.match(/const panelHtml = ("[^\n]*");/)[1]);
 const csp=html.match(/Content-Security-Policy[^>]+/)[0];
 assert.ok(csp.includes('dsh-app://app/plugins/dsh-whale-status/pet/frame'),'self-contained resident route must be permitted by CSP');
 const declaration=html.match(/const DAFEIYU_CLIPS=([^\n]+);/)[1],clips=vm.runInNewContext('('+declaration+')');
 for(const [name,clip]of Object.entries(manifest.clips)){
  assert.equal(clips[name].frames.length,clip.frames.length);
  for(const [i,file]of clip.frames.entries()){
   const url=clips[name].frames[i];assert.ok(url.startsWith('/plugins/dsh-whale-status/pet/frame?'));
   const res=response();await ok({method:'GET',url},res);assert.equal(res.status,200,file);assert.equal(res.headers['Content-Type'],'image/webp');
   assert.deepEqual(res.body,await readFile(new URL('../assets/room-pet/'+file,import.meta.url)));
  }
 }
 const url='/plugins/dsh-whale-status/pet/frame?frame=idle%2Fidle_001.webp';
 const denied=response();await assets.createPetAssetHandler({connection:{requestRejection:()=>401}})({method:'GET',url},denied);assert.equal(denied.status,401);
 const traversal=response();await ok({method:'GET',url:'/plugins/dsh-whale-status/pet/frame?frame=..%2F..%2Fruntime-token'},traversal);assert.equal(traversal.status,404);
 const post=response();await ok({method:'POST',url},post);assert.equal(post.status,405);
});
