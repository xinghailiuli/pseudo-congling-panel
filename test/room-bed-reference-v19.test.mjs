import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRoomLifeDefinitions} from '../src/room-life-sequences.mjs';
import {createRoomChoreography} from '../src/room-choreography.mjs';
import {runInNewContext} from 'node:vm';
import {validateWardrobe} from '../src/room-wardrobe.mjs';
import {validateRoomLifeAssets} from '../src/room-life-art.mjs';
const read=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const refs=await read('../assets/room-bed-reference-v19/geometry.json');
const geometry={...await read('../assets/room-life-v11/geometry.json'),...await read('../assets/room-life-v16/geometry.json'),transition:(await read('../assets/room-transition-v17/geometry.json')).original,bedReference:refs.original};
test('original and all thirteen outfits have separate complete entry and exit drawings',()=>{
 assert.equal(Object.keys(refs).length,14);
 for(const g of Object.values(refs)){assert.equal(g.frames.length,24);for(const f of g.frames){assert.ok(f.crop[0]>0&&f.crop[1]>0&&f.crop[0]+f.crop[2]<g.width&&f.crop[1]+f.crop[3]<g.height);assert.ok(f.outline.length>=3);assert.ok(f.hip.every(Number.isFinite));}}
 const defs=createRoomLifeDefinitions(geometry),d=defs.sleep;
 assert.deepEqual(d.entry.filter(s=>s.pose.startsWith('bed-ref-')).map(s=>s.pose),Array.from({length:12},(_,i)=>'bed-ref-'+i));
 assert.deepEqual(d.exits['bed-ref-11'].filter(s=>s.pose.startsWith('bed-ref-')).map(s=>s.pose),Array.from({length:12},(_,i)=>'bed-ref-'+(i+12)));
 for(const id of Object.keys(d.poses)){const last=d.poses[d.exits[id].at(-1)?.pose||id];assert.equal(last.support,'feet');}
});
test('interruption at any bed entry point reaches supported exit without pose lookup failure',()=>{
 const defs=createRoomLifeDefinitions(geometry);
 for(let at=0;at<14000;at+=137){const c=createRoomChoreography(defs);c.start('sleep',0);const ready=c.requestExit(at);assert.equal(c.sample(ready).support,'feet');assert.equal(c.sample(ready).ready,true);}
});
test('built revision nineteen loads original and every outfit with both reference sheets',async()=>{
 const chunk=async file=>{let payload;runInNewContext(await readFile(new URL('../lib/'+file,import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:value=>{payload=value.factory();}}}});return payload;};
 const life=await chunk('client.room-life-v19.js');assert.ok(validateRoomLifeAssets(life));assert.equal(life.geometry.sleepReference.frames.length,16);assert.equal(life.revision,19);
 for(const id of Object.keys(refs).filter(id=>id!=='original')){const a=await chunk('client.wardrobe-'+id+'-v19.js');assert.ok(validateWardrobe(a),id);assert.equal(a.sleepReference.geometry.frames.length,16);assert.equal(a.bedReference.geometry.frames.length,24);}
});
