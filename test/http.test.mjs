import test from 'node:test';import assert from 'node:assert/strict';import {createServer} from 'node:http';
const mod=await import('../src/routes.mjs').catch(()=>null);
test('HTTP guard rejects anonymous, foreign origins, invalid methods and oversized JSON',async t=>{
 assert.ok(mod,'HTTP routes module must exist');let writes=0;
 const handler=mod.createHandler({connection:{requestRejection(req){return req.headers.authorization==='ok'?undefined:401;}},service:{async dispatch(action,body){writes++;return {data:{action,body},revision:1};}},runtimeToken:'secret'});
 const server=createServer(handler);await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.close());const base=`http://127.0.0.1:${server.address().port}`;
 assert.equal((await fetch(base+'/api/liuli/state')).status,401);
 assert.equal((await fetch(base+'/api/liuli/command',{method:'POST',headers:{authorization:'ok',origin:'https://evil.example','content-type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/liuli/command',{method:'POST',headers:{authorization:'ok','content-type':'text/plain'},body:'{}'})).status,415);
 assert.equal((await fetch(base+'/api/liuli/runtime',{method:'POST',headers:{authorization:'ok','content-type':'application/json'},body:'{}'})).status,403);
 assert.equal((await fetch(base+'/api/liuli/command',{headers:{authorization:'ok'}})).status,405);
 assert.equal((await fetch(base+'/api/liuli/command',{method:'POST',headers:{authorization:'ok','content-type':'application/json'},body:JSON.stringify({large:'x'.repeat(13*1024*1024)})})).status,413);
 assert.equal(writes,0);
 const response=await fetch(base+'/api/liuli/command',{method:'POST',headers:{authorization:'ok',origin:base,'content-type':'application/json'},body:JSON.stringify({action:'/overview',body:{}})});assert.equal(response.status,200);assert.equal((await response.json()).data.action,'/overview');
 assert.equal(response.headers.get('cache-control'),'no-store');
});
