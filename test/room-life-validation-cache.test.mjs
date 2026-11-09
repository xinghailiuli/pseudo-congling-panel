import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRoomLifeAssets } from '../src/room-life-art.mjs';

const counts={sofa:24,garden:24,bed:24,desk:24,upper:24,carry:16,walk:8,cover:12,'sofa-rest':12,'bed-entry':8,transition:24,sleepMotion:16,bedBody:16,sofaSocial:16,sofaBody:16,idleChair:16,bedReference:24,sleepReference:16};
function payload(){
  const png='data:image/png;base64,AAAA';
  const geometry=Object.fromEntries(Object.entries(counts).map(([name,count])=>[name,{width:400,height:400,referenceHeight:300,frames:Array.from({length:count},()=>({crop:[0,0,90,90],outline:[[0,0],[90,0],[90,90]],hip:[45,70],head:[45,20]}))}]));
  return {version:11,revision:20,geometry,atlases:Object.fromEntries(Object.keys(counts).map(name=>[name,png])),greenhouse:png,bedding:png,mattress:png,foldedQuilt:png,chairCleanplate:png,quilt:{url:png,crop:[0,0,80,80],width:400,height:400}};
}

test('previously valid life assets reject changed PNGs at every receiving boundary',()=>{
  for(const [section,key]of [['root','greenhouse'],['root','bedding'],['root','mattress'],['root','foldedQuilt'],['root','chairCleanplate'],['quilt','url'],...Object.keys(counts).map(name=>['atlases',name])]){
    const value=payload();assert.equal(validateRoomLifeAssets(value),true);
    const owner=section==='root'?value:value[section];
    owner[key]='https://untrusted.invalid/image.png';assert.equal(validateRoomLifeAssets(value),false,section+'/'+key);
    owner[key]='data:image/png;base64,BBBB';assert.equal(validateRoomLifeAssets(value),true);
    owner[key]='data:image/png;base64,not valid!';assert.equal(validateRoomLifeAssets(value),false,section+'/'+key+' after replacement');
  }
});

test('cached image-format results never accept missing required room-life sources',()=>{
  for(const [section,key]of [['root','greenhouse'],['root','bedding'],['root','mattress'],...Object.keys(counts).map(name=>['atlases',name])]){
    const value=payload();assert.equal(validateRoomLifeAssets(value),true);
    delete (section==='root'?value:value[section])[key];
    assert.equal(validateRoomLifeAssets(value),false,section+'/'+key);
  }
});

test('unchanged PNGs do not bypass geometry checks after frame or dimensions mutate',()=>{
  const changes=[a=>a.geometry.sofa.width=Infinity,a=>a.geometry.sofa.frames.pop(),a=>a.geometry.sofa.frames[0].crop[0]=399,a=>a.geometry.sofa.frames[0].outline[0][0]=-1,a=>a.geometry.transition.frames[0].hip[0]=NaN,a=>a.quilt.crop[0]=NaN];
  for(const change of changes){const value=payload();assert.equal(validateRoomLifeAssets(value),true);change(value);assert.equal(validateRoomLifeAssets(value),false);}
});

test('image-format reuse retains the combined room-life payload size limit',()=>{
  const value=payload();assert.equal(validateRoomLifeAssets(value),true);
  const large='data:image/png;base64,'+'A'.repeat(7*1024*1024);
  for(const key of ['sofa','garden','bed','desk','upper','carry','walk'])value.atlases[key]=large;
  assert.equal(validateRoomLifeAssets(value),false);
  assert.equal(validateRoomLifeAssets(value),false,'valid individual image strings cannot bypass aggregate size checking');
});
