import test from 'node:test';import assert from 'node:assert/strict';import { initialState } from '../src/store.mjs';
const memory=await import('../src/memory.mjs').catch(()=>null),relations=await import('../src/relationships.mjs').catch(()=>null);
function setup(){assert.ok(memory,'memory module must exist');assert.ok(relations,'relationships module must exist');return initialState(0);}
test('memory source and semantic dedup never expand scope',()=>{
 const s=setup();const input={scope:'private:1',subject:'1',sourceId:'m1',content:'我喜欢猫',attribute:'pet',value:'cat',level:2};
 const a=memory.addMemory(s.memories,input,1000);assert.equal(a.duplicate,false);
 assert.equal(memory.addMemory(s.memories,input,2000).duplicate,true);
 assert.equal(memory.addMemory(s.memories,{...input,sourceId:'m2'},2000).duplicate,true);
 memory.addMemory(s.memories,{...input,scope:'group:2'},2000);
 assert.equal(memory.recall(s.memories,{scope:'group:2',query:'猫',now:2000,config:s.config.memory}).length,1);
 assert.equal(memory.recall(s.memories,{scope:'group:3',query:'猫',now:2000,config:s.config.memory}).length,0);
});
test('contradictions retain evidence, correction archives and restores history',()=>{
 const s=setup();const a=memory.addMemory(s.memories,{scope:'private:1',subject:'1',sourceId:'a',content:'喜欢猫',attribute:'pet',value:'cat',level:0},0).record;
 const b=memory.addMemory(s.memories,{scope:'private:1',subject:'1',sourceId:'b',content:'喜欢狗',attribute:'pet',value:'dog',level:2},100).record;
 assert.equal(b.status,'conflict');assert.equal(a.status,'active');
 memory.resolveMemory(s.memories,b.id,{status:'active',supersedes:a.id},200);assert.equal(a.status,'archived');assert.equal(b.status,'active');
 memory.resolveMemory(s.memories,a.id,{status:'active',supersedes:b.id},300);assert.equal(a.status,'active');
 assert.equal(memory.strength(a,1000*86400000,s.config.memory),1);
 assert.ok(memory.strength({...a,level:5},1000*86400000,s.config.memory)<0.01);
});
test('identity merge and rollback preserve private visibility, affinity settles once per source',()=>{
 const s=setup();const merge=relations.mergeSubjects(s,'1','2',100);
 assert.equal(relations.canonicalSubject(s,'1'),'2');
 assert.throws(()=>relations.mergeSubjects(s,'2','1',101),{code:'INVALID_MERGE'});
 relations.rollbackMerge(s,merge.id,200);assert.equal(relations.canonicalSubject(s,'1'),'1');
 const input={scope:'private:1',subject:'1',id:'m1',delta:2};
 relations.settleAffinity(s,input,300);relations.settleAffinity(s,input,301);
 assert.equal(s.affinity['private:1|1'].value,2);assert.equal(s.settlements.length,1);
});
test('profile only uses active facts in the requested scope and keeps provenance',()=>{
 const s=setup();memory.addMemory(s.memories,{scope:'private:1',subject:'1',sourceId:'a',content:'喜欢猫',level:2},10);
 memory.addMemory(s.memories,{scope:'group:2',subject:'1',sourceId:'b',content:'工作地址',level:2},20);
 const p=relations.profileEvidence(s,s.memories,'private:1','1');assert.equal(p.length,1);assert.equal(p[0].sourceId,'a');
});
