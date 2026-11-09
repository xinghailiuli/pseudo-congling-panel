import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {createRoomImageCatalog} from '../tools/room-image-catalog.mjs';
import vm from 'node:vm';import {isRoomImageUrl} from '../src/room-image-source.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
test('lossless delivery keeps legacy bytes while registering verified WebP; stale maps fail closed',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'liuli-lossless-test-'));
 try{
 await fs.mkdir(path.join(root,'assets/room-delivery-v52'),{recursive:true});await fs.mkdir(path.join(root,'lib'));const original=Buffer.from('PNG original'),encoded=Buffer.from('WEBP smaller');
 await fs.writeFile(path.join(root,'assets/source.png'),original);await fs.writeFile(path.join(root,'assets/room-delivery-v52/source.webp'),encoded);
 const map={'assets/source.png':{file:'assets/room-delivery-v52/source.webp',sourceSha256:hash(original),sha256:hash(encoded)}};
 await fs.writeFile(path.join(root,'assets/room-delivery-v52/lossless-map.json'),JSON.stringify(map));
 const c=createRoomImageCatalog({root}),legacy=await c.inline('assets/source.png');assert.equal(legacy,'data:image/png;base64,'+original.toString('base64'));
 const external=c.externalize(legacy);assert.match(external,/\/source.webp$/);const m=await c.writeManifest();assert.equal(m.images[0].mime,'image/webp');assert.equal(m.images[0].sha256,hash(encoded));
 await fs.writeFile(path.join(root,'assets/source.png'),'changed');await assert.rejects(()=>createRoomImageCatalog({root}).inline('assets/source.png'),/stale|hash/i);
 await fs.writeFile(path.join(root,'assets/source.png'),original);await fs.writeFile(path.join(root,'assets/room-delivery-v52/source.webp'),'corrupt');await assert.rejects(()=>createRoomImageCatalog({root}).inline('assets/source.png'),/hash/i);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('panel accepts WebP scene delivery and binds room floors, navigation and HUD background',async()=>{
 const source=await fs.readFile(new URL('../panel.js',import.meta.url),'utf8'),start=source.indexOf('  const a=event.data.assets;if(!a||'),end=source.indexOf('\n });',start),properties={};
 const url=name=>'dsh-app://app/plugins/dsh-whale-status/assets/'+'a'.repeat(64)+'/'+name+'.webp';const assets=Object.fromEntries(['floor-one','floor-two','garden','mirror','hudFrame','hudNavigation'].map(k=>[k,url(k)]));
 const style={setProperty(k,v){properties[k]=v;}}; const ctx={event:{data:{assets}},isRoomImageUrl,assetRequest:{done:false},roomArtAssets:null,STAR_ECHO_FRAME_DATA_URL:'',ROOM_ACTIONS:{house:{floors:{},repairs:{1:{},2:{}},actions:{garden:{frames:[]}}}},activeRoomScene:{setRoomArtAssets(a){properties.scene=a;}},fittingScene:null,document:{documentElement:{style},querySelector(){return {style};}}};
 vm.runInNewContext('(function(){'+source.slice(start,end)+'})()',ctx);assert.equal(ctx.assetRequest.done,true);assert.equal(ctx.ROOM_ACTIONS.house.floors[1],assets['floor-one']);assert.equal(ctx.STAR_ECHO_FRAME_DATA_URL,assets.hudFrame);assert.ok(properties['--v52-nav-reference'].includes(assets.hudNavigation));assert.equal(properties.scene,assets);
});
test('all current outfit and life geometries accept local WebP atlases',async()=>{
 const {validateWardrobe}=await import('../src/room-wardrobe.mjs'),{validateRoomLifeAssets}=await import('../src/room-life-art.mjs');
 const m=JSON.parse(await fs.readFile(new URL('../lib/room-asset-manifest.json',import.meta.url),'utf8'));
 for(const record of Object.values(m.modules)){if(record.id!=='life'&&!record.id.startsWith('wardrobe:'))continue;const p=JSON.parse(await fs.readFile(new URL('../lib/'+record.chunk,import.meta.url),'utf8'));const assets=JSON.parse(JSON.stringify(p.assets).replaceAll('.png','.webp'));assert.ok(record.id==='life'?validateRoomLifeAssets(assets):validateWardrobe(assets),record.id);}
});
