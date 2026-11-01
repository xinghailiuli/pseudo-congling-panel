import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixtureAssetReply} from './fixture-assets.mjs';

test('documented motion preview loads only artwork URLs served by its fixture',async()=>{
 const source=await readFile(new URL('./motion-server.mjs',import.meta.url),'utf8');
 const files=[...source.matchAll(/\/fixture-assets\/(client\.[a-z0-9.-]+\.js)/g)].map(m=>m[1]);
 assert.ok(files.length>=2);
 for(const file of files){const res={status:0,body:null,writeHead(s){this.status=s;},end(b){this.body=b;}};await fixtureAssetReply({method:'GET',url:'/fixture-assets/'+file},res);assert.equal(res.status,200,file);assert.ok(JSON.parse(res.body));}
});

test('public display version matches the requested optimized edition',async()=>{
 const panel=await readFile(new URL('../panel.js',import.meta.url),'utf8');
 assert.ok(panel.includes('伪从绫开始的面板 1.11 优化版'));
 assert.ok(!panel.includes('优化版.'));
});

test('distributed artwork inventory is complete and byte-exact',async()=>{
 const base=new URL('../',import.meta.url),entries=JSON.parse(await readFile(new URL('assets/asset-integrity.json',base)));
 async function walk(relative){const result=[];for(const item of await readdir(new URL(relative,base),{withFileTypes:true})){const file=relative+item.name;if(item.isDirectory())result.push(...await walk(file+'/'));else if(/\.(png|webp)$/.test(file))result.push(file);}return result;}
 assert.deepEqual(entries.map(e=>e.file).sort(),(await walk('assets/')).sort());
 for(const entry of entries){const bytes=await readFile(new URL(entry.file,base));assert.equal(bytes.length,entry.bytes,entry.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,entry.file);}
});

test('isolated preview delivers all current lazy assets and rejects unknown files',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../assets/wardrobe-v1/catalog.json',import.meta.url)));
 const response=()=>({status:0,body:null,writeHead(s){this.status=s;},end(b){this.body=b;}});
 for(const file of ['client.room-art-v12.js','client.room-life-v19.js',...catalog.map(o=>'client.wardrobe-'+o.id+'-v19.js')]){
  const res=response();assert.equal(await fixtureAssetReply({method:'GET',url:'/fixture-assets/'+file},res),true);assert.equal(res.status,200,file);assert.ok(JSON.parse(res.body));
 }
 const res=response();await fixtureAssetReply({method:'GET',url:'/fixture-assets/client.js'},res);assert.equal(res.status,404);
});
