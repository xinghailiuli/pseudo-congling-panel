// A local animation clock only: no DOM, random timers, persistence or service calls.
export function createRoomChoreography(definitions) {
 const finite=value=>Number.isFinite(value);
 const check=(condition,message)=>{if(!condition)throw new TypeError(message);};
 const compile=(steps,poses,name)=>{
  check(Array.isArray(steps),'Missing steps: '+name);let duration=0;
  const frames=steps.map(step=>{
   check(step&&Object.hasOwn(poses,step.pose),'Unknown pose: '+name);
   check(finite(step.duration)&&step.duration>0&&step.duration<=60000,'Invalid duration: '+name);
   const frame={...step,start:duration,end:duration+step.duration};duration=frame.end;return frame;
  });return {frames,duration};
 };
 const modes={};
 for(const [mode,source]of Object.entries(definitions)){
  check(source?.poses&&Object.hasOwn(source.poses,source.still),'Missing supported still pose: '+mode);
  const poses=source.poses;
  for(const [id,pose]of Object.entries(poses))check(pose&&Array.isArray(pose.at)&&pose.at.length===2&&pose.at.every(finite)&&typeof pose.support==='string','Invalid support: '+mode+'/'+id);
  const entry=compile(source.entry,poses,mode+'/entry');
  check(Array.isArray(source.variations)&&source.variations.length>0,'Missing variations: '+mode);
  const loop=compile(source.variations.flatMap(variation=>{
   check(typeof variation.name==='string'&&variation.frames?.length,'Empty variation: '+mode);
   return variation.frames.map(step=>({...step,variation:variation.name}));
  }),poses,mode+'/loop');
  const exits={};
  for(const id of Object.keys(poses)){
   const exit=compile(source.exits?.[id],poses,mode+'/exit/'+id),last=poses[exit.frames.at(-1)?.pose||id];
   check(last.support==='feet'&&!last.prop,'Exit leaves body or prop unsupported: '+mode+'/'+id);exits[id]=exit;
  }
  const seatedExits={};
  for(const [id,steps]of Object.entries(source.seatedExits||{})){
   check(Object.hasOwn(poses,id),'Unknown seated exit: '+mode);const exit=compile(steps,poses,mode+'/seated/'+id),last=poses[exit.frames.at(-1)?.pose||id];
   check(last.support==='hips'&&!last.prop,'Seated exit must release props: '+mode+'/'+id);seatedExits[id]=exit;
  }
  modes[mode]={poses,entry,loop,exits,seatedExits,seatedEntry:compile(source.seatedEntry||[],poses,mode+'/seated-entry'),still:source.still};
 }
 let active=null;
 const time=value=>{check(finite(value),'Animation time must be finite');return value;};
 const modeFor=mode=>{check(Object.hasOwn(modes,mode),'Unknown activity: '+mode);return modes[mode];};
 const frameAt=(clip,clock)=>{
  const index=Math.min(clip.frames.findIndex(step=>clock<step.end),clip.frames.length-1);
  return index<0?clip.frames.length-1:index;
 };
 const result=(mode,pose,phase,extra={})=>{
  const frame=modeFor(mode).poses[pose];return {mode,pose,frame,phase,prop:frame.prop??null,support:frame.support,position:[...frame.at],progress:0,move:false,ready:phase==='ready',...extra};
 };
 const sampleClip=(clip,clock,base,phase,wrap)=>{
  const index=frameAt(clip,clock),step=clip.frames[index],next=clip.frames[index+1]||(wrap?clip.frames[0]:step),progress=Math.max(0,Math.min(1,(clock-step.start)/step.duration));
  const frame=active.def.poses[step.pose],nextFrame=active.def.poses[next.pose];
  const moving=Boolean(step.move&&nextFrame.support==='feet'&&frame.support==='feet');
  const position=moving?frame.at.map((v,i)=>v+(nextFrame.at[i]-v)*progress):[...frame.at];
  return result(active.mode,step.pose,phase,{progress,time:base+clock,move:moving,position,nextPose:next.pose,frameEnd:base+step.end,variation:step.variation||null});
 };
 const sample=value=>{
  const now=time(value);if(!active)return null;
  const t=Math.max(active.at,now);
  if(active.exit&&t>=active.exit.at){
   if(t>=active.exit.readyAt)return result(active.mode,active.exit.clip.frames.at(-1).pose,'ready');
   return sampleClip(active.exit.clip,t-active.exit.at,active.exit.at,'exit',false);
  }
  const entry=active.seated?active.def.seatedEntry:active.def.entry,local=t-active.at,entryDuration=active.settled&&!active.seated?0:entry.duration;
  if(local<entryDuration)return sampleClip(entry,local,active.at,'enter',false);
  const elapsed=local-entryDuration,clock=elapsed%active.def.loop.duration,base=t-clock;
  return sampleClip(active.def.loop,clock,base,'perform',true);
 };
 return {
  start(mode,at,{settled=false,seated=false}={}){active={mode,def:modeFor(mode),at:time(at),settled:Boolean(settled),seated:Boolean(seated),exit:null};return sample(at);},
  sample,
  still(mode){const def=modeFor(mode);return result(mode,def.still,'perform');},
  requestExit(value,{seated=false}={}){
   const now=time(value);if(!active)return now;if(active.exit&&(!active.exit.seated||seated))return active.exit.readyAt;
   const current=sample(now),seed=current.move?current.nextPose:current.pose,at=current.move?current.frameEnd:Math.max(now,active.at);
   const selected=seated&&active.def.seatedExits[seed]||active.def.exits[seed];
   const path=[{pose:seed,duration:120},...selected.frames.map(({pose,duration,move})=>({pose,duration,move}))];
   const clip=compile(path,active.def.poses,active.mode+'/requested-exit');active.exit={at,clip,seated:Boolean(seated&&active.def.seatedExits[seed]),readyAt:at+clip.duration};return active.exit.readyAt;
  },
  has(mode){return Object.hasOwn(modes,mode);},
  reset(){active=null;}
 };
}
