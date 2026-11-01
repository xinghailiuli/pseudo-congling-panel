import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync as read} from 'node:fs';
import {validateWardrobe,wardrobeVisual} from '../src/room-wardrobe.mjs';
const json=p=>JSON.parse(read(new URL(p,import.meta.url)));
test('all thirteen outfits have valid distinct complete gait and bed frames',()=>{
 const base=json('../assets/wardrobe-v1/geometry.json'),walk=json('../assets/wardrobe-v16/walk-geometry.json'),bed=json('../assets/wardrobe-v16/bed-geometry.json');
 assert.equal(Object.keys(walk).length,13);assert.equal(Object.keys(bed).length,14);
 for(const id of Object.keys(walk)){
  const url='data:image/png;base64,AAAA',a={version:1,id,url,geometry:base[id]};
  for(const kind of ['walk','bed']){const g=({walk,bed})[kind][id],png=read(new URL(`../assets/wardrobe-v16/${id}-${kind}.png`,import.meta.url));assert.equal(png.readUInt32BE(16),g.width);assert.equal(png.readUInt32BE(20),g.height);a[kind]={url,geometry:g};}
  assert.equal(validateWardrobe(a),true,id);
  assert.equal(new Set(Array.from({length:8},(_,gait)=>wardrobeVisual(a,{moving:true,gait}).frame)).size,8);
  for(let bedCell=0;bedCell<8;bedCell++)assert.equal(wardrobeVisual(a,{life:{mode:'sleep',frame:{bedCell}}}).frame,a.bed.geometry.frames[bedCell]);
  const bad=structuredClone(a);bad.walk.geometry.referenceHeight=0;assert.equal(validateWardrobe(bad),false);
  const missing=structuredClone(a);delete missing.bed.geometry.frames[0].head;assert.equal(validateWardrobe(missing),false);
 }
});
