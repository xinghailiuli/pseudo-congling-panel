import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument, descendants} from './helpers/workspace-dom.mjs';

async function module(name) {
  const value = await import('../src/ui/'+name+'.mjs').catch(() => null);
  assert.ok(value, name+' must expose an independently usable UI module');
  return value;
}

test('UI context delegates to the live room and releases subscriptions without disposing the scene', async () => {
  const {createRoomUiContext}=await module('room-context');
  let scene={id:1},released=0;
  const context=createRoomUiContext({getScene:()=>scene,getSnapshot:()=>scene,
    subscribe:()=>()=>released++,dispatchAction:id=>scene.action=id});
  context.subscribe(()=>{});scene={id:2};
  context.dispatchAction('type');
  assert.equal(context.getScene(),scene);assert.equal(scene.action,'type');
  context.dispose();context.dispose();assert.equal(released,1);
  assert.equal(context.getSnapshot(),scene);
});

test('action tray invokes the shared dispatcher and keeps the live room attached', async () => {
  const {mountRoomUi}=await module('room-action-tray');
  const document=createDocument(),root=document.createElement('div'),scene=document.createElement('svg');
  document.body.append(scene,root);const calls=[];
  const ui=mountRoomUi(root,{document,getRoom:()=>({items:[{name:'沙发'}]}),getScene:()=>scene,
    getAvailableActions:()=>[],dispatchAction:id=>calls.push(id),setFloor(){},toggleDetail(){},
    openFurniture(){},close(){},reposition(){}});
  const sofa=descendants(root).find(e=>e.dataset.actionId==='lounge');assert.ok(sofa);
  await sofa.fire('click');assert.deepEqual(calls,['lounge']);
  ui.dispose();ui.dispose();assert.equal(scene.parentNode,document.body);
  await sofa.fire('click');assert.deepEqual(calls,['lounge'],'detached controls cannot dispatch');
});

test('closing a furniture surface during module loading cannot open it on a late reply', async () => {
  const {mountRoomUi}=await module('room-furniture-panel');
  const document=createDocument(),root=document.createElement('div');document.body.append(root);
  let deliver,opened=0,destroyed=0;
  const loading=new Promise(resolve=>deliver=resolve);
  const ui=mountRoomUi(root,{document,load:()=>loading,options:{},notify(){}});
  const pending=ui.open('computer');ui.close();
  deliver({createRoomWorkspace:()=>({open(){opened++;},destroy(){destroyed++;}})});
  await pending;assert.equal(opened,0);
  await ui.open('computer');assert.equal(opened,1);
  ui.dispose();ui.dispose();assert.equal(destroyed,1);
});

test('closing dressing during module loading preserves the room and ignores late mounting', async () => {
  const {mountRoomUi}=await module('room-dressing-panel');
  const document=createDocument(),root=document.createElement('div'),scene=document.createElement('svg');
  document.body.append(scene,root);let deliver,mounted=0;
  const ui=mountRoomUi(root,{document,load:()=>new Promise(r=>deliver=r),options:{},notify(){}});
  const pending=ui.open();ui.close();
  deliver({createRoomDressing(){mounted++;return {element:document.createElement('div'),open(){},dispose(){}};}});
  await pending;assert.equal(mounted,0);assert.equal(root.hidden,true);
  ui.dispose();assert.equal(scene.parentNode,document.body);
});

test('pending dressing has keyboard focus so Escape cancels before its code arrives',async()=>{
  const {mountRoomUi}=await module('room-dressing-panel');const document=createDocument(),root=document.createElement('div');document.body.append(root);
  const trigger=document.createElement('button');document.body.append(trigger);
  let deliver;const ui=mountRoomUi(root,{document,load:()=>new Promise(resolve=>deliver=resolve),options:{}});
  const pending=ui.open(trigger);assert.equal(document.activeElement,root);
  await root.fire('keydown',{key:'Escape'});deliver({createRoomDressing(){throw Error('late mount');}});await pending;assert.equal(root.hidden,true);assert.equal(document.activeElement,trigger);ui.dispose();
});

test('first dressing open starts art delivery alongside its UI module',async()=>{
  const {mountRoomUi}=await module('room-dressing-panel');const document=createDocument(),root=document.createElement('div');document.body.append(root);
  let deliver,artRequests=0;const ui=mountRoomUi(root,{document,load:()=>new Promise(resolve=>deliver=resolve),options:{artClient:{load(){artRequests++;return Promise.resolve({});}}}});
  const pending=ui.open();assert.equal(artRequests,1,'UI code must not delay the larger art request');ui.close();deliver({});await pending;ui.dispose();
});
