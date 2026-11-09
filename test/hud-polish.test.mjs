import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createDocument,descendants} from './helpers/workspace-dom.mjs';
import {createRoomEnvironmentControls} from '../src/room-environment.mjs';

const source=await readFile(new URL('../panel.js',import.meta.url),'utf8');
function telemetry(){
 const document=createDocument();
 const context={document,lastHudNight:null,lastHudFresh:false,lastRoomEnergy:null,roomEnergy:null,starEchoTelemetryUpdater:null,safeStorage:{getItem:()=>null},$:()=>null};
 vm.createContext(context);
 vm.runInContext(source.slice(source.indexOf(' function updateHudTelemetry('),source.indexOf(' function applyRoomData(')),context);
 return {document,update:context.updateHudTelemetry};
}
test('energy zero has zero fill; label and bar use the same rounded backend sample',()=>{
 const {document,update}=telemetry();
 for(const [value,want] of [[0,0],[72,72],[71.6,72],[100,100],[-3,0],[125,100]]){
  update({energy:value,sleeping:false,moodEmoji:'😊'});
  assert.match(document.getElementById('hud-status-text').textContent,new RegExp('精力 '+want+' ·'));
  assert.equal(document.getElementById('hud-status-bar').style.width,want+'%');
  assert.equal(document.getElementById('hud-status-bar').getAttribute('aria-valuenow'),String(want));
 }
});
test('unknown energy never fabricates 95; failed refresh retains a marked last real value',()=>{
 const {document,update}=telemetry();
 update(null);assert.match(document.getElementById('hud-status-text').textContent,/同步/);assert.doesNotMatch(document.getElementById('hud-status-text').textContent,/95/);
 for(const energy of [undefined,null,'',NaN,'72']){update({energy});assert.equal(document.getElementById('hud-status-bar').style.width,'0%');}
 update({energy:32,sleeping:true});update(null);
 assert.match(document.getElementById('hud-status-text').textContent,/精力 32/);
 assert.match(document.getElementById('hud-status-text').textContent,/待同步/);
 assert.equal(document.getElementById('hud-status-bar').style.width,'32%');
 update({energy:72,sleeping:false});assert.doesNotMatch(document.getElementById('hud-status-text').textContent,/待同步/);
});
test('closed curtain and every fold are clipped to the window above the monitor',()=>{
 const doc=createDocument();const svg=doc.createElement('svg');doc.body.append(svg);
 const el=(tag,a={})=>{const n=doc.createElement(tag);for(const[k,v]of Object.entries(a))n.setAttribute(k,v);return n};
 const a=createRoomEnvironmentControls({svg,room:{curtain:false,lamp:true},el});
 const b=createRoomEnvironmentControls({svg,room:{curtain:true,lamp:true},el});
 const curtains=descendants(svg).filter(n=>n.getAttribute('data-curtain-overlay'));
 const clipRefs=curtains.map(n=>n.getAttribute('clip-path'));
 assert.ok(clipRefs.every(Boolean));assert.notEqual(clipRefs[0],clipRefs[1]);
 for(const c of curtains){const polygon=c.children.find(n=>n.tagName==='POLYGON');const points=polygon.getAttribute('points').split(' ').map(p=>p.split(',').map(Number));assert.ok(points.every(([x,y])=>y<=274-(x-723)*39/274+.01),'cloth stays above the desk screen');}
 a.setRoomEnvironment({curtain:true});b.setRoomEnvironment({curtain:false});
 assert.equal(curtains[0].getAttribute('display'),'none');assert.equal(curtains[1].getAttribute('display'),'inline');
});

test('a cached render cannot turn a failed energy refresh into a live sample',()=>{
 const {document,update}=telemetry();const sample={energy:32,sleeping:false};
 update(sample);update(null);update(sample,false);
 assert.equal(document.getElementById('hud-status-bar').dataset.sync,'stale');
 assert.match(document.getElementById('hud-status-text').textContent,/待同步/);
 update({energy:72});update(null,false);
 assert.equal(document.getElementById('hud-status-bar').dataset.sync,'live');
 assert.equal(document.getElementById('hud-status-bar').style.width,'72%');
});

test('energy progress remains exposed to assistive technology',async()=>{
 const html=await readFile(new URL('../panel.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/<div[^>]+aria-hidden="true"[^>]*>\s*<div[^>]+id="hud-status-bar"/);
 assert.ok(/id="hud-status-text">状态同步中 · 精力 —<\//.test(html),'uninitialized HTML must not display a fictional energy value');
});
