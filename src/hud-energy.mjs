const profiles={sleep:['睡眠',2],lounge:['沙发休息',0.8],rest:['露台休息',0.8],idle:['待命',0.1],type:['敲键盘',-0.6],write:['写字',-0.6],walk:['散步',-0.3],garden:['园艺',-0.8],read:['阅读',-0.2],enchant:['附魔练习',-0.4],paused:['暂停',0]};
const clamp=value=>Math.max(0,Math.min(100,value));
export function validateRoomEnergySnapshot(value){return value?.version===1&&Number.isFinite(value.energy)&&value.energy>=0&&value.energy<=100&&Number.isFinite(value.updatedAt)&&value.updatedAt>=0;}
export function roomEnergyActivity(data,active=true){
 if(!active||!data)return 'paused';
 if(data.residentTravel==='true'||data.lifeMoving==='true')return 'walk';
 if(data.lifePhase==='perform'&&Object.hasOwn(profiles,data.lifeMode))return data.lifeMode;
 return !data.lifeMode&&Object.hasOwn(profiles,data.roomActivity)?data.roomActivity:data.roomActivity==='walk'?'walk':'idle';
}
export function createRoomEnergyModel(initialEnergy,{now=Date.now}={}){
 let energy=clamp(initialEnergy),at=now(),mode='paused';
 return {sample(nextMode=mode){
  const time=now(),nextAt=Number.isFinite(time)?Math.max(at,time):at;
  energy=clamp(energy+(nextAt-at)/60000*profiles[mode][1]);at=nextAt;
  mode=Object.hasOwn(profiles,nextMode)?nextMode:'paused';
  return {energy,mode,label:profiles[mode][0],rate:profiles[mode][1],sleeping:mode==='sleep',at};
 }};
}
// The parent owns storage because the room iframe deliberately has an opaque origin.
// Only visible-room time is counted. A remount keeps the value, never credits an
// unobserved night of whatever pose happened to be selected before closing.
export function createRoomEnergy({win,parent,now=Date.now,onChange=()=>{}}){
 let model=null,received=false,disposed=false,night=null,mode='paused',lastSave=-Infinity;
 const initialize=value=>{if(model)return;if(validateRoomEnergySnapshot(value))model=createRoomEnergyModel(value.energy,{now});else if(Number.isFinite(night?.energy))model=createRoomEnergyModel(night.energy,{now});if(model)onChange();};
 const save=(force=false)=>{
  if(disposed||!model)return null;const sample=model.sample(mode),value={version:1,energy:sample.energy,updatedAt:sample.at};
  if(force||sample.at-lastSave>=15000){lastSave=sample.at;parent.postMessage({channel:'liuli-companion',type:'room-energy-save',value},'*');}return value;
 };
 const sample=nextMode=>{if(disposed||!model)return null;const changed=nextMode!==mode;mode=nextMode;const value=model.sample(mode);save(changed);return value;};
 const pause=()=>{sample('paused');return save(true);};
 const receive=event=>{
  if(disposed||received||event.source!==parent||event.data?.channel!=='liuli-companion'||event.data.type!=='room-energy')return;
  received=true;initialize(event.data.value);
 };
 win.addEventListener('message',receive);parent.postMessage({channel:'liuli-companion',type:'room-energy-request'},'*');
 return {sample,save,pause,acceptNight(value){if(disposed)return;night=value;if(received)initialize(null);},
  dispose(){if(disposed)return;pause();disposed=true;win.removeEventListener('message',receive);}
 };
}
