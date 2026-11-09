import test from 'node:test';
import assert from 'node:assert/strict';
import {auditPackage} from '../tools/release/audit-package.mjs';
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('offline audit retains feature manifest dependencies and reports a missing module chunk',async()=>{
  const root=await mkdtemp(join(tmpdir(),'room-module-package-'));await mkdir(join(root,'lib'));await mkdir(join(root,'assets/wardrobe-v1'),{recursive:true});
  await writeFile(join(root,'package.json'),JSON.stringify({main:'lib/client.js'}));await writeFile(join(root,'lib/client.js'),'');await writeFile(join(root,'client.template.js'),'');await writeFile(join(root,'assets/wardrobe-v1/catalog.json'),'[]');
  await writeFile(join(root,'lib/room-module-manifest.json'),JSON.stringify({reader:{chunk:'client.room-ui-reader-v52.js'}}));
  const missing=await auditPackage(root);assert.ok(missing.unresolved.some(x=>x.file==='lib/client.room-ui-reader-v52.js'));
  await writeFile(join(root,'lib/client.room-ui-reader-v52.js'),'{}');const ready=await auditPackage(root);
  assert.deepEqual(ready.unresolved,[]);assert.ok(ready.runtimeFiles.includes('lib/client.room-ui-reader-v52.js'));
});

test('image metadata includes original images without shipping unused base64 runtime chunks',async()=>{
 const root=await mkdtemp(join(tmpdir(),'room-image-package-'));await mkdir(join(root,'lib'));await mkdir(join(root,'assets/wardrobe-v1'),{recursive:true});
 for(const [file,text]of Object.entries({'package.json':JSON.stringify({main:'lib/client.js'}),'lib/client.js':"require.async('./' + chunkName)",'client.template.js':'','assets/wardrobe-v1/catalog.json':'[]','lib/client.room-art-v12.js':'old base64','lib/client.room-assets-art-v21.js':'{}','assets/required.png':'original pixels','lib/room-asset-manifest.json':JSON.stringify({modules:{art:{chunk:'client.room-assets-art-v21.js'}},images:[{file:'assets/required.png'}]})}))await writeFile(join(root,file),text);
 const audit=await auditPackage(root);assert.deepEqual(audit.unresolved,[]);assert.ok(audit.runtimeFiles.includes('assets/required.png'));assert.ok(audit.runtimeFiles.includes('lib/client.room-assets-art-v21.js'));assert.ok(!audit.runtimeFiles.includes('lib/client.room-art-v12.js'));
});
