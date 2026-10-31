import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomChoreography} from '../src/room-choreography.mjs';

const step=(pose,duration,move=false)=>({pose,duration,move});
const definitions=()=>({sofa:{still:'sit',poses:{stand:{at:[0,0],prop:null,support:'feet'},sit:{at:[10,-8],prop:null,support:'hips'},eat:{at:[10,-8],prop:'snack',support:'hips'},returnBag:{at:[10,-8],prop:'snack',support:'hips'},lie:{at:[14,-10],prop:null,support:'cushion'}},entry:[step('stand',100),step('sit',100)],variations:[{name:'snack',frames:[step('eat',300),step('returnBag',150),step('sit',100)]},{name:'rest',frames:[step('lie',400),step('sit',100)]}],exits:{stand:[],sit:[step('stand',200)],eat:[step('returnBag',150),step('sit',100),step('stand',200)],returnBag:[step('sit',100),step('stand',200)],lie:[step('sit',100),step('stand',200)]}},garden:{still:'home',poses:{home:{at:[0,0],prop:null,support:'feet'},carryA:{at:[0,0],prop:'can',support:'feet'},carryB:{at:[12,0],prop:'can',support:'feet'},pour:{at:[12,0],prop:'can',support:'feet'},putDown:{at:[0,0],prop:'can',support:'feet'}},entry:[step('home',100)],variations:[{name:'water',frames:[step('carryA',100,true),step('carryB',100),step('pour',200),step('putDown',100),step('home',100)]}],exits:{home:[],carryA:[step('putDown',100),step('home',100)],carryB:[step('carryA',100,true),step('putDown',100),step('home',100)],pour:[step('carryA',100,true),step('putDown',100),step('home',100)],putDown:[step('home',100)]}}});

test('contact entry and varied whole-body clips follow their declared durations',()=>{
 const c=createRoomChoreography(definitions());c.start('sofa',1000);
 assert.equal(c.sample(1000).pose,'stand');assert.equal(c.sample(1100).pose,'sit');
 assert.equal(c.sample(1200).phase,'perform');assert.equal(c.sample(1200).prop,'snack');
 assert.equal(c.sample(1750).pose,'lie');assert.equal(c.sample(2250).pose,'eat');
 assert.equal(c.sample(1000000000000).phase,'perform');
});
test('exit returns an occupied prop before becoming ready and repeated requests do not restart it',()=>{
 const c=createRoomChoreography(definitions());c.start('sofa',0);c.requestExit(250);
 assert.equal(c.sample(250).pose,'eat');assert.equal(c.sample(250).ready,false);
 const first=c.requestExit(270);assert.equal(c.requestExit(300),first);
 const samples=Array.from({length:100},(_,i)=>c.sample(250+i*10));
 const release=samples.findIndex(s=>s.prop===null);assert(release>0);assert(samples.slice(0,release).some(s=>s.pose==='returnBag'));
 const end=c.sample(5000);assert.equal(end.ready,true);assert.equal(end.pose,'stand');assert.equal(end.prop,null);
});
test('every sofa variation and entry frame has a finite supported exit',()=>{
 for(let t=0;t<1400;t+=25){const c=createRoomChoreography(definitions());c.start('sofa',0);const before=c.sample(t);c.requestExit(t);assert.equal(c.sample(t).pose,before.pose);const end=c.sample(t+2500);assert(end.ready);assert.equal(end.support,'feet');assert.equal(end.prop,null);}
});
test('interrupting an aisle step completes only that partial step before returning the can',()=>{
 const c=createRoomChoreography(definitions());c.start('garden',0);const before=c.sample(150);assert(before.move);assert.deepEqual(before.position,[6,0]);c.requestExit(150);
 assert.deepEqual(c.sample(150).position,[6,0]);assert(Math.abs(c.sample(199).position[0]-11.88)<1e-9);assert.deepEqual(c.sample(200).position,[12,0]);assert.equal(c.sample(200).phase,'exit');assert(c.sample(3000).ready);
});
test('settled start and still sample preserve a supported contact pose without mutating definitions',()=>{
 const defs=definitions(),copy=structuredClone(defs),c=createRoomChoreography(defs);c.start('sofa',0,{settled:true});assert.equal(c.sample(0).phase,'perform');assert.equal(c.still('sofa').pose,'sit');assert.deepEqual(defs,copy);
});
test('malformed choreography cannot leave a missing frame, unbounded interval or unreturnable prop',()=>{
 for(const alter of [d=>d.sofa.entry[0].duration=0,d=>d.sofa.entry[0].duration=Infinity,d=>d.sofa.entry[0].pose='missing',d=>delete d.sofa.exits.eat,d=>d.sofa.exits.lie=[]]){const d=definitions();alter(d);assert.throws(()=>createRoomChoreography(d));}
 const c=createRoomChoreography(definitions());assert.throws(()=>c.start('missing',0));assert.throws(()=>c.start('sofa',NaN));c.start('sofa',0);assert.throws(()=>c.sample(Infinity));
});
