import test from 'node:test';import assert from 'node:assert/strict';import {createDocument,descendants} from './helpers/workspace-dom.mjs';import {createRoomPoseBlend} from '../src/room-pose-blend.mjs';import {createRoomWardrobe} from '../src/room-wardrobe.mjs';
const geometry={width:100,height:100,frames:[0,1].map(()=>({crop:[0,0,100,100],hip:[50,70],head:[50,20],anchor:[50,100],outline:[[0,0],[100,0],[100,100]]}))};
const pose=cell=>({atlas:'test',cell,at:[100,100],pivot:[50,70],head:[50,20],scale:1});
test('static contact rendering allocates no hidden deformation triangles; interpolation builds only its visible layer',()=>{
 const document=createDocument(),root=document.createElement('g'),art=createRoomPoseBlend({document,root});const count=()=>descendants(root).filter(n=>n.tagName.toLowerCase()==='use').length;
 assert.equal(count(),0,'initial hidden mesh is unnecessary');
 const frame=pose(0),nextFrame=pose(1);art.render({url:'data:image/png;base64,AQID',geometry,sample:{frame,nextFrame,duration:1000,progress:0}});assert.equal(count(),0);
 const result=art.render({url:'data:image/png;base64,AQID',geometry,sample:{frame,nextFrame,duration:1000,progress:.6}});assert.equal(count(),98);assert.deepEqual(result.head,[100,50]);
 art.render({url:'data:image/png;base64,AQID',geometry,sample:{frame,nextFrame,duration:1000,progress:.9}});assert.equal(count(),196);
 art.render({url:'data:image/png;base64,AQID',geometry,sample:{frame,nextFrame,duration:1000,progress:.6}});assert.equal(count(),196,'reuses layer meshes');
});
test('original outfit does not allocate the unused alternate-outfit motion mesh',()=>{
 const document=createDocument(),root=document.createElement('g'),wardrobe=createRoomWardrobe({document,root});assert.equal(wardrobe.active,false);assert.equal(descendants(root).filter(n=>n.tagName.toLowerCase()==='polygon').length,0);
});
