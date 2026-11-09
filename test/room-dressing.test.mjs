import test from 'node:test';
import assert from 'node:assert/strict';
import {createDressingAssetClient, fittingFrame} from '../src/room-dressing.mjs';

test('dressing artwork is lazy, shares pending requests and accepts only matching parent replies',async()=>{
 const handlers=new Set(),sent=[],parent={postMessage:d=>sent.push(d)},win={addEventListener:(k,f)=>handlers.add(f),removeEventListener:(k,f)=>handlers.delete(f)};
 const client=createDressingAssetClient({win,parent,uid:()=> 'a',timeoutMs:2000});
 assert.equal(sent.length,0);const p=client.load();assert.equal(client.load(),p);assert.equal(sent.length,1);
 const assets={backdrop:'data:image/png;base64,AA==',original:'data:image/webp;base64,AA==',thumbnails:{}};
 const emit=(source,id)=>handlers.forEach(f=>f({source,data:{channel:'liuli-companion',type:'dressing-assets',requestId:id,assets,favorites:[]}}));
 emit({},'a');emit(parent,'wrong');assert.equal(handlers.size,1);emit(parent,'a');assert.deepEqual((await p).assets,assets);assert.equal(handlers.size,0);
 await client.load();assert.equal(sent.length,1);client.setFavorites(['original']);assert.equal(sent.at(-1).type,'dressing-favorites');assert.deepEqual((await client.load()).favorites,['original']);
});
test('failed dressing load is retryable without retaining a rejected promise',async()=>{
 const handlers=new Set(),sent=[],parent={postMessage:d=>sent.push(d)},win={addEventListener:(k,f)=>handlers.add(f),removeEventListener:(k,f)=>handlers.delete(f)};let id=0;
 const client=createDressingAssetClient({win,parent,uid:()=>String(++id),timeoutMs:2000});
 const first=client.load();handlers.forEach(f=>f({source:parent,data:{channel:'liuli-companion',type:'dressing-error',requestId:'1'}}));await assert.rejects(first);const second=client.load();assert.equal(sent.length,2);handlers.forEach(f=>f({source:parent,data:{channel:'liuli-companion',type:'dressing-error',requestId:'2'}}));await assert.rejects(second);assert.equal(handlers.size,0);
});
test('static fitting frame uses existing front pose geometry and never mutates the atlas',()=>{
 const asset={url:'data:image/png;base64,AA==',geometry:{width:400,height:500,frames:[{crop:[10,20,90,150],outline:[[10,20],[100,20],[100,170]]}]}};
 const before=JSON.stringify(asset);assert.deepEqual(fittingFrame(asset).crop,[10,20,90,150]);assert.equal(JSON.stringify(asset),before);assert.equal(fittingFrame(null),null);assert.equal(fittingFrame({geometry:{frames:[{crop:[0,0,NaN,20]}]}}),null);
});
