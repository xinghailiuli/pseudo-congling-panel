import test from 'node:test';import assert from 'node:assert/strict';
import {createRoomIdleEvents} from '../src/room-idle-events.mjs';
test('idle pauses only on safe flat floor, has cooldown and returns before moving',()=>{
 const c=createRoomIdleEvents(()=>.05);
 assert.equal(c.sample({time:70000,safe:false,point:[500,500],goal:'walk'}),null);
 const a=c.sample({time:70000,safe:true,point:[500,500],goal:'walk'});assert(a);assert.deepEqual(a.position,[500,500]);
 const b=c.sample({time:70400,safe:false,point:[500,500],goal:'sleep'});assert.equal(b.returning,true);assert.equal(b.block,true);
 assert.equal(c.sample({time:70800,safe:false,point:[500,500],goal:'sleep'}),null);
 assert.equal(c.sample({time:71000,safe:true,point:[500,500],goal:'walk'}),null);
});
test('restoring an idle event retains its point and remaining phase',()=>{
 const a=createRoomIdleEvents(()=>.05);a.sample({time:70000,safe:true,point:[600,650],goal:'walk'});
 const b=createRoomIdleEvents(()=>.05);b.restore(a.snapshot());assert.deepEqual(b.sample({time:71000,safe:true,point:[1,1],goal:'walk'}).position,[600,650]);
});
