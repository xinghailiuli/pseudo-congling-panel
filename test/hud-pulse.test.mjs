import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompanionPulse} from '../src/hud-pulse.mjs';
test('simulated pulse follows activity and sleep with bounded smooth transitions',()=>{
 const p=createCompanionPulse();let last=p.sample({now:0,activity:'lounge',energy:70});
 const rest=last.bpm;
 for(let now=1000;now<=45000;now+=1000){const next=p.sample({now,activity:'walk',energy:70});assert.ok(Math.abs(next.bpm-last.bpm)<=3);last=next;}
 assert.ok(last.bpm>rest+12);
 for(let now=46000;now<=100000;now+=1000)last=p.sample({now,activity:'walk',sleeping:true,energy:70});
 assert.ok(last.bpm<65);assert.equal(last.label,'熟睡');
});
test('pulse breathes over time and interaction boost decays without random flicker',()=>{
 const p=createCompanionPulse(),values=[];
 for(let now=0;now<60000;now+=1000)values.push(p.sample({now,activity:'lounge'}).bpm);
 assert.ok(new Set(values).size>=3);
 p.touch(60000);const excited=p.sample({now:65000,activity:'lounge'});
 assert.ok(excited.bpm>values.at(-1));
 const later=p.sample({now:180000,activity:'lounge'});assert.ok(later.bpm<excited.bpm);
});
test('bad energy or backwards clocks cannot emit NaN or extreme values',()=>{
 const p=createCompanionPulse();for(const now of [1000,1000,0,Infinity,30000]){const s=p.sample({now,activity:'unknown',energy:NaN});assert.ok(Number.isFinite(s.bpm));assert.ok(s.bpm>=50&&s.bpm<=110);}
});
