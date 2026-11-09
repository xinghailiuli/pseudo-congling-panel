import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument} from './helpers/workspace-dom.mjs';

test('100 reloads and reverse disposal never remove foreign plugin styles',async()=>{
  const api=await import('../src/ui/room-style-owner.mjs').catch(()=>null);
  assert.ok(api,'room styles must have explicit ownership');
  const document=createDocument();document.head=document.createElement('head');document.body.append(document.head);
  const foreign=document.createElement('style');foreign.setAttribute('data-plugin','dsh-whale-girl');foreign.textContent='original';document.head.append(foreign);
  for(let n=0;n<100;n++){
    const args={document,owner:'room-workspaces',revision:'v1',cssText:'.room-workspace{color:cyan}'};
    const first=api.attachRoomStyles(args),second=api.attachRoomStyles(args);
    assert.equal(document.head.children.length,2);second();second();assert.equal(document.head.children.length,2);
    first();assert.equal(document.head.children.length,1);assert.equal(foreign.textContent,'original');
  }
});

test('changing a feature revision releases only its own previous style',async()=>{
  const api=await import('../src/ui/room-style-owner.mjs').catch(()=>null);assert.ok(api);
  const document=createDocument();document.head=document.createElement('head');document.body.append(document.head);
  const a=api.attachRoomStyles({document,owner:'reader',revision:'one',cssText:'a{}'});
  const b=api.attachRoomStyles({document,owner:'reader',revision:'two',cssText:'b{}'});
  a();assert.equal(document.head.children.length,1);assert.equal(document.head.children[0].textContent,'b{}');b();
});
