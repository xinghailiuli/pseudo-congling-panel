import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/store.mjs';
const load = await import('../src/night.mjs').catch(() => null);
const room = await import('../src/room.mjs').catch(() => null);
const api = () => { assert.ok(load, 'night module must exist'); return load; };
const start = Date.parse('2026-10-30T15:00:00Z');
test('sleep stage boundaries are clock-based through midnight and restart', () => {
  const { sleepStage, startSleep, advanceNight } = api();
  const s = initialState(start); startSleep(s.night, start, 'manual');
  assert.equal(sleepStage(start,start), 'onset');
  assert.equal(sleepStage(start,start+6e5), 'light');
  assert.equal(sleepStage(start,start+30*6e4), 'deep');
  assert.equal(sleepStage(start,start+75*6e4), 'rem');
  const restarted = JSON.parse(JSON.stringify(s));
  advanceNight(restarted.night, restarted.config.night, start+8*36e5);
  assert.equal(restarted.night.sleeping, false);
  assert.ok(restarted.night.energy > 80);
});
test('automatic sleep off, manual sleep on and REM exactly once per cycle', () => {
  const { advanceNight, startSleep } = api(); const s=initialState(start);
  advanceNight(s.night,s.config.night,start+6e4); assert.equal(s.night.sleeping,false);
  startSleep(s.night,start,'manual');
  assert.equal(advanceNight(s.night,s.config.night,start+76*6e4).dreams.length,1);
  assert.equal(advanceNight(s.night,s.config.night,start+77*6e4).dreams.length,0);
  assert.equal(advanceNight(s.night,s.config.night,start+120*6e4).dreams.length,0);
});
test('sleep wake permission, privileged wake and message idempotence preserve unread', () => {
  const { startSleep, receiveNightMessage }=api();const s=initialState(start);startSleep(s.night,start,'manual');
  const event={scope:'group:1',id:'m1',subject:'42',authorized:true};
  assert.equal(receiveNightMessage(s.night,event,s.config.night,start+36e5,()=>0).woke,false);
  assert.equal(s.night.attempts,0); assert.equal(s.night.unread['group:1'],1);
  receiveNightMessage(s.night,event,s.config.night,start+36e5,()=>0);assert.equal(s.night.unread['group:1'],1);
  receiveNightMessage(s.night,{...event,id:'m2',adminWake:true,paused:true},s.config.night,start+36e5,()=>0);assert.equal(s.night.sleeping,true);
  const woke=receiveNightMessage(s.night,{...event,id:'m3',adminWake:true},s.config.night,start+36e5,()=>1);
  assert.equal(woke.woke,true);assert.equal(s.night.unread['group:1'],3);
});
test('private wake attempts have a ceiling and clock rollback does not drain energy', () => {
  const { startSleep, receiveNightMessage, advanceNight }=api();const s=initialState(start);startSleep(s.night,start,'manual');
  for(let i=0;i<s.config.night.maxWakeAttempts;i++)receiveNightMessage(s.night,{scope:'private:42',id:String(i),subject:'42',authorized:true},s.config.night,start+31*6e4,()=>1);
  assert.equal(s.night.sleeping,false);const energy=s.night.energy;
  advanceNight(s.night,s.config.night,start);assert.equal(s.night.energy,energy);
});
test('room interactions validate mutations and retain descriptive context', () => {
  assert.ok(room,'room module must exist');const s=initialState(start);
  room.updateRoom(s.room,{lamp:true,description:'一本书',items:[{id:'book',name:'书',state:'打开'}]},start);
  assert.equal(s.room.lamp,true);assert.match(room.roomContext(s.room),/一本书/);
  assert.throws(()=>room.updateRoom(s.room,{lamp:'true'},start),{code:'INVALID_INPUT'});
});
