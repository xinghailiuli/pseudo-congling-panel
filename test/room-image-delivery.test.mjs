import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';

test('image metadata carries immutable local URLs and exact original bytes, not base64 artwork',async()=>{
 const {createRoomImageCatalog}=await import('../tools/room-image-catalog.mjs');const root=await fs.mkdtemp(path.join(os.tmpdir(),'liuli-image-delivery-'));
 try{await fs.mkdir(path.join(root,'assets'),{recursive:true});const pixels=Buffer.from('original image bytes');await fs.writeFile(path.join(root,'assets/source.png'),pixels);
  const c=createRoomImageCatalog({root}),legacy=await c.inline('assets/source.png');
  assert.match(legacy,/^data:image\/png;base64,/);const url=c.externalize({url:legacy}).url;
  assert.equal(url,'dsh-app://app/plugins/dsh-whale-status/assets/'+createHash('sha256').update(pixels).digest('hex')+'/source.png');
  await c.writePayload('wardrobe:test','client.wardrobe-test-v21.js',{url:legacy,geometry:{width:1}});const m=await c.writeManifest();
  assert.equal(m.images[0].file,'assets/source.png');assert.equal(m.images[0].bytes,pixels.length);
  const payload=JSON.parse(await fs.readFile(path.join(root,'lib/client.wardrobe-test-v21.js'),'utf8'));assert.equal(payload.assets.url,url);assert.ok(!JSON.stringify(payload).includes('base64'));assert.equal(payload.revision,m.modules['wardrobe:test'].revision);
  await assert.rejects(()=>c.inline('../outside.png'),/asset path/i);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('image URL validation accepts only existing inline format or content-addressed loopback images',async()=>{
 const {isRoomImageUrl}=await import('../src/room-image-source.mjs');const good='http://127.0.0.1:18406/plugins/dsh-whale-status/assets/'+'a'.repeat(64)+'/source.png';
 assert.ok(isRoomImageUrl(good,['png']));assert.ok(isRoomImageUrl(good.replace('18406','18555'),['png']));assert.ok(isRoomImageUrl('data:image/png;base64,YQ==',['png']));
 assert.ok(isRoomImageUrl(good.replace('http://127.0.0.1:18406','dsh-app://app'),['png']));
 for(const bad of [good.replace('127.0.0.1','example.com'),good+'?x=1',good.replace('/source.png','/../source.png'),good.replace('http:','javascript:'),good.replace('/source.png','/source.svg'),good.replace(':18406',':99999')])assert.equal(isRoomImageUrl(bad,['png']),false,bad);
});

test('current room and all outfits have small metadata delivery and complete file dependencies',async()=>{
 const {validateWardrobe}=await import('../src/room-wardrobe.mjs');const {validateRoomLifeAssets}=await import('../src/room-life-art.mjs');
 const root=new URL('../',import.meta.url),m=JSON.parse(await fs.readFile(new URL('lib/room-asset-manifest.json',root),'utf8'));
 assert.equal(Object.keys(m.modules).length,16);let bytes=0;
 for(const r of Object.values(m.modules)){const text=await fs.readFile(new URL('lib/'+r.chunk,root),'utf8'),p=JSON.parse(text);assert.equal(p.revision,r.revision);assert.ok(text.length<1024*1024,r.id);assert.ok(!text.includes('data:image/'),r.id);bytes+=Buffer.byteLength(text);if(r.id.startsWith('wardrobe:'))assert.ok(validateWardrobe(p.assets),r.id);if(r.id==='life')assert.ok(validateRoomLifeAssets(p.assets));}
 assert.ok(bytes<8*1024*1024);assert.ok(m.images.length>100);assert.ok(m.images.every(r=>r.url.startsWith('dsh-app://app/plugins/dsh-whale-status/assets/')),'native images use application routing rather than a fixed HTTP port');
 for(const image of m.images){const b=await fs.readFile(new URL(image.file,root));assert.equal(b.length,image.bytes);assert.equal(createHash('sha256').update(b).digest('hex'),image.sha256);}
});

test('immutable image route preserves exact bytes, caching and loopback-only access',async()=>{
 const {createActionAssetHandler}=await import('../src/action-assets.mjs');const manifest=JSON.parse(await fs.readFile(new URL('../lib/room-asset-manifest.json',import.meta.url),'utf8')),record=manifest.images[0];
 const handler=createActionAssetHandler({connection:{requestRejection:()=>403}});
 const send=async(req)=>{const r={writeHead(status,headers){this.status=status;this.headers=headers;},end(body){this.body=body;}};await handler({method:'GET',url:new URL(record.url).pathname,headers:{'sec-fetch-dest':'image'},socket:{remoteAddress:'127.0.0.1'},...req},r);return r;};
 const first=await send({});assert.equal(first.status,200);assert.equal(first.headers['Content-Type'],record.mime);assert.match(first.headers['Cache-Control'],/immutable/);assert.equal(createHash('sha256').update(first.body).digest('hex'),record.sha256);
 const cached=await send({headers:{'sec-fetch-dest':'image','if-none-match':'"'+record.sha256+'"'}});assert.equal(cached.status,304);assert.equal(cached.body,undefined);
 assert.equal((await send({socket:{remoteAddress:'192.0.2.1'}})).status,403);
 assert.equal((await send({url:'/plugins/dsh-whale-status/assets/'+record.sha256+'/missing.png'})).status,404);
});
