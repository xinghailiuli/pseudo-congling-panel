import test from 'node:test';
import assert from 'node:assert/strict';
const assets=await import('../src/action-assets.mjs').catch(()=>({}));
const response=()=>({status:0,headers:null,body:null,writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}});

test('stair repairs and the gait sheet use authenticated read-only routes',async()=>{
 const ok=assets.createActionAssetHandler({connection:{requestRejection:()=>undefined}});
 for(const [name,w,h] of [['floor-one-v6',1536,1024],['floor-two-v6',1536,1024],['stairs-v6',1774,887],['floor-two-v7',1536,1024],['upstairs-garden-v7',1536,1024]]){
  const url='/plugins/dsh-whale-status/actions/'+name+'.png',res=response();await ok({method:'GET',url},res);
  assert.equal(res.status,200);assert.equal(res.body.readUInt32BE(16),w);assert.equal(res.body.readUInt32BE(20),h);
  const denied=response();await assets.createActionAssetHandler({connection:{requestRejection:()=>401}})({method:'GET',url},denied);assert.equal(denied.status,401);
  const post=response();await ok({method:'POST',url},post);assert.equal(post.status,405);
 }
});

test('all four upstairs contact assets load through the same authenticated read-only boundary',async()=>{
 const ok=assets.createActionAssetHandler({connection:{requestRejection:()=>undefined}});
 for(const name of ['read','enchant','garden','rest']){const url='/plugins/dsh-whale-status/actions/upstairs-'+name+'-v5.png',res=response();await ok({method:'GET',url},res);assert.equal(res.status,200);assert.equal(res.body.readUInt32BE(16),1536);assert.equal(res.body.readUInt32BE(20),1024);const post=response();await ok({method:'POST',url},post);assert.equal(post.status,405);}
});
test('detailed room layers are authenticated PNG assets and cannot be written',async()=>{
 const ok=assets.createActionAssetHandler({connection:{requestRejection:()=>undefined}});
 for(const name of ['floor-one','floor-two','desk-type-a','desk-type-b','desk-write-a','desk-write-b','bed-sleep','sofa-lounge']){
  const url='/plugins/dsh-whale-status/actions/'+name+'-v4.png',res=response();await ok({method:'GET',url},res);
  assert.equal(res.status,200,name);assert.equal(res.body.readUInt32BE(16),1536);assert.equal(res.body.readUInt32BE(20),1024);
  const denied=response();await assets.createActionAssetHandler({connection:{requestRejection:()=>401}})({method:'GET',url},denied);assert.equal(denied.status,401);
  const post=response();await ok({method:'POST',url},post);assert.equal(post.status,405);
 }
});
test('room artwork is served only through authenticated, whitelisted read-only routes',async()=>{
 assert.equal(typeof assets.createActionAssetHandler,'function');
 const ok=assets.createActionAssetHandler({connection:{requestRejection:()=>undefined}});
 const res=response();await ok({method:'GET',url:assets.ACTION_ASSET_PATHS[0]},res);
 assert.equal(res.status,200);assert.equal(res.headers['Content-Type'],'image/png');assert.equal(res.body.readUInt32BE(0),0x89504e47);
 const walking=response();await ok({method:'GET',url:'/plugins/dsh-whale-status/actions/walk-v3.png'},walking);
 assert.equal(walking.status,200);assert.equal(walking.body.readUInt32BE(16),1774);assert.equal(walking.body.readUInt32BE(20),887);
 const denied=response();await assets.createActionAssetHandler({connection:{requestRejection:()=>401}})({method:'GET',url:assets.ACTION_ASSET_PATHS[0]},denied);assert.equal(denied.status,401);
 const traversal=response();await ok({method:'GET',url:'/plugins/dsh-whale-status/actions/../../runtime-token'},traversal);assert.equal(traversal.status,404);
 const post=response();await ok({method:'POST',url:assets.ACTION_ASSET_PATHS[0]},post);assert.equal(post.status,405);
});
