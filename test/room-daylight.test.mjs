import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {createDocument} from './helpers/workspace-dom.mjs';
import {descendants} from './helpers/workspace-dom.mjs';
const mod=await import('../src/room-daylight.mjs').catch(()=>null);
const at=(hour,minute=0)=>new Date(2026,9,31,hour,minute).getTime();
test('glass scenery follows local dawn, noon, dusk and midnight with continuous colors',()=>{
 assert.ok(mod?.roomDaylight,'the window needs a local wall-clock model');
 for(const [hour,phase]of [[0,'night'],[6,'dawn'],[12,'day'],[18,'dusk'],[22,'night']])assert.equal(mod.roomDaylight(at(hour)).phase,phase);
 assert.equal(mod.roomDaylight(at(12)).stars,0);assert.ok(mod.roomDaylight(at(0)).stars>.9);
 const a=mod.roomDaylight(at(7,59)),b=mod.roomDaylight(at(8));assert.ok(Math.abs(a.brightness-b.brightness)<.02);
});
test('the same instant uses each client timezone, never a fixed server or Beijing timezone',()=>{
 assert.ok(mod?.roomDaylight);const url=new URL('../src/room-daylight.mjs',import.meta.url).href;
 const code=`import {roomDaylight} from ${JSON.stringify(url)};console.log(JSON.stringify(roomDaylight(Date.parse('2026-10-31T12:00:00Z'))));`;
 const run=tz=>JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,TZ:tz},encoding:'utf8'}));
 assert.equal(run('UTC').hour,12);assert.equal(run('America/Los_Angeles').hour,5);assert.equal(run('Asia/Tokyo').hour,21);
});
test('wall time refreshes after hidden or clock change without relying on actor animation',()=>{
 assert.ok(mod?.createRoomDaylight);const doc=createDocument(),events=new Map(),scheduled=new Map();let time=at(12),id=0;doc.createElementNS=(_,tag)=>doc.createElement(tag);doc.addEventListener=(name,fn)=>events.set(name,fn);doc.removeEventListener=name=>events.delete(name);
 const parent=doc.createElement('g'),defs=doc.createElement('defs');doc.body.append(parent,defs);
 const sky=mod.createRoomDaylight({document:doc,defs,parent,now:()=>time,schedule:fn=>{scheduled.set(++id,fn);return id;},cancel:id=>scheduled.delete(id)});
 assert.equal(sky.element.getAttribute('data-daylight-phase'),'day');time=at(23);doc.hidden=true;events.get('visibilitychange')();doc.hidden=false;events.get('visibilitychange')();assert.equal(sky.element.getAttribute('data-daylight-phase'),'night');
 time=at(6);[...scheduled.values()].at(-1)();assert.equal(sky.element.getAttribute('data-daylight-phase'),'dawn');sky.destroy();assert.equal(events.size,0);assert.equal(scheduled.size,0);
});
test('illustrated scenery retains the original outdoor detail and changes its light inside glass only',()=>{
 assert.ok(mod?.createRoomDaylight);const doc=createDocument();doc.createElementNS=(_,tag)=>doc.createElement(tag);const parent=doc.createElement('g'),defs=doc.createElement('defs');doc.body.append(parent,defs);
 const sky=mod.createRoomDaylight({document:doc,defs,parent,source:'/original-floor.png',now:()=>at(12)});
 const picture=descendants(sky.element).find(e=>e.tagName==='IMAGE');assert.ok(picture,'keep the illustrated scene, not a flat replacement');assert.equal(picture.getAttribute('href'),'/original-floor.png');assert.ok(sky.element.getAttribute('clip-path'));
 const matrix=descendants(defs).find(e=>e.tagName==='FECOLORMATRIX');assert.ok(matrix);const day=matrix.getAttribute('values');sky.update(at(23));assert.notEqual(matrix.getAttribute('values'),day);sky.destroy();
});
