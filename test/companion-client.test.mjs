import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
const mod=await import('../src/companion-client.mjs');
test('runtime client persists failed inbound events and flushes exactly once on recovery',async t=>{
 assert.ok(mod,'companion bridge client must exist');const root=await mkdtemp(join(tmpdir(),'liuli-runtime-'));t.after(()=>rm(root,{recursive:true,force:true}));await writeFile(join(root,'runtime-token'),'fixture-token');let offline=true;const ingested=[];
 const api={async doFetch(url,init){if(offline)throw Error('offline');const b=JSON.parse(init.body);if(b.action==='ingest')ingested.push(b.body.id);return new Response(JSON.stringify({data:{allow:true,sleeping:false}}));}};
 const client=mod.createCompanionClient({api,baseUrl:'http://127.0.0.1:19387',root,log:()=>{}});
 await client.ingest({scope:'private:1',id:'m1',subject:'1',text:'hello',authorized:true});assert.equal(JSON.parse(await readFile(join(root,'bridge-outbox.json'),'utf8')).length,1);
 offline=false;await client.flush();await client.flush();assert.deepEqual(ingested,['m1']);assert.equal(JSON.parse(await readFile(join(root,'bridge-outbox.json'),'utf8')).length,0);
});
test('offline sleep state still gates normal wake; no remembered context from other scopes',async t=>{
 assert.ok(mod);const root=await mkdtemp(join(tmpdir(),'liuli-runtime-'));t.after(()=>rm(root,{recursive:true,force:true}));await writeFile(join(root,'state.json'),JSON.stringify({night:{sleeping:true}}));
 const client=mod.createCompanionClient({api:{async doFetch(){throw Error('offline');}},baseUrl:'http://127.0.0.1:19387',root,log:()=>{}});
 assert.equal((await client.beforeWake({scope:'group:2',reason:'mention'})).allow,false);
 assert.equal((await client.context({scope:'group:2'})).text,'');
 await writeFile(join(root,'state.json'),JSON.stringify({night:{sleeping:false},sessions:{'group:2':{muted:true}}}));
 assert.equal((await client.beforeWake({scope:'group:2',reason:'proactiveCheck'})).allow,false);
});
