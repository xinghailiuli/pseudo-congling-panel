import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('installer ships current complete chunks and routed assets without intermediate build duplication',async()=>{
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url))),files=pkg.files;
 for(const f of ['lib/client.js','lib/index.js','lib/client.room-life-v19.js','lib/client.wardrobe-*-v19.js','assets/room-pet','assets/room-actions','assets/room-house','src'])assert.ok(files.includes(f),f);
 assert.ok(!files.includes('lib'),'avoid packaging intermediate embedded duplicates');assert.ok(!files.includes('assets'),'source-only atlases are in the source archive');
});
