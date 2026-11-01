import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {validateWardrobe,wardrobeVisual} from '../src/room-wardrobe.mjs';
const catalog=JSON.parse(await readFile(new URL('../assets/wardrobe-v1/catalog.json',import.meta.url)));
test('all thirteen built outfits contain intact base sprites and four valid seated supplements',async()=>{
 for(const {id} of catalog){
  let payload;runInNewContext(await readFile(new URL('../lib/client.wardrobe-'+id+'-v15.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:m=>payload=m.factory()}}});
  assert.ok(validateWardrobe(payload),id);
  const original=await readFile(new URL('../assets/wardrobe-v1/'+id+'.png',import.meta.url));
  assert.deepEqual(Buffer.from(payload.url.split(',')[1],'base64'),original,id+' original unchanged');
  const png=Buffer.from(payload.desk.url.split(',')[1],'base64'),g=payload.desk.geometry;
  assert.equal(png.readUInt32BE(16),g.width,id+' width');assert.equal(png.readUInt32BE(20),g.height,id+' height');
  assert.equal(png[25],6,id+' PNG has RGBA');
  for(const f of g.frames){assert.ok(f.crop[2]>100&&f.crop[3]>200,id+' nonempty full body');}
  for(const mode of ['type','write'])for(const time of [0,700,1400]){
   const v=wardrobeVisual(payload,{life:{mode,support:'hips'},time});assert.equal(v.url,payload.desk.url,id+' correct atlas');
  }
 }
 assert.equal(catalog.length,13);
});
