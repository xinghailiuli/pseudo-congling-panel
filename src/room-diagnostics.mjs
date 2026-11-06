export function createRoomDiagnostics({limit=80,now=()=>Date.now(),onEvent=()=>{}}={}){
 const events=[],keys=['asset','mode','outfit','pose','phase','stage','revision','width','height','duration','error'];
 const clean=v=>String(v).replace(/(?:data:|blob:|https?:|dsh-app:)[^\s]+/g,'[resource]').slice(0,240);
 return {record(kind,data={}){const event={at:now(),kind:clean(kind)};for(const k of keys)if(data[k]!==undefined)event[k]=typeof data[k]==='number'?data[k]:clean(data[k]);events.push(event);if(events.length>limit)events.shift();try{onEvent(event);}catch{}return event;},snapshot(){return events.map(e=>({...e}));}};
}

export function roomResourceDeadline(promise,timeoutMs=15000){
 let timer;
 return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Image decode timeout')),timeoutMs);})]).finally(()=>clearTimeout(timer));
}

// The visibility deadline must run independently of the image promise.
export function createRoomRestoreGate({scene,runtimeReady,getRuntime,hasAssets,isActive,onWait=()=>{},schedule=setTimeout,cancel=clearTimeout}){
 let disposed=false,done=false,pending=null;
 const active=()=>!disposed&&isActive();
 scene.setAttribute('opacity','0');
 const timer=schedule(()=>{if(active()&&!done){scene.setAttribute('opacity','1');onWait();}},1200);
 return {get done(){return done;},restore(){
  if(pending||done||!active())return pending||Promise.resolve();
  pending=(async()=>{await runtimeReady;if(!active())return;const value=getRuntime();if(value&&!hasAssets())return;
   const ready=scene.roomLifeReady?await scene.roomLifeReady:true;if(!active()||ready===false)return;
   if(value)scene.restoreRoomRuntime?.(value);done=true;cancel(timer);scene.setAttribute('opacity','1');
  })().catch(()=>{if(active()){scene.setAttribute('opacity','1');onWait();}}).finally(()=>{pending=null;});return pending;
 },dispose(){disposed=true;cancel(timer);}};
}

// Attribute records are collected only for the synchronous render transaction.
// A failed frame rolls back to the preceding visible frame; no per-frame SVG clone.
export function createRoomFrameGuard({root,Observer=root.ownerDocument?.defaultView?.MutationObserver,onError=()=>{}}){
 const observer=Observer?new Observer(()=>{}):null;
 observer?.observe(root,{subtree:true,attributes:true,attributeOldValue:true,childList:true});
 return {draw(fn){observer?.takeRecords();try{fn();observer?.takeRecords();return true;}catch(error){
  const records=observer?.takeRecords()||[];
  for(const r of records.reverse()){
   if(r.type==='attributes'){if(r.oldValue===null)r.target.removeAttribute(r.attributeName);else r.target.setAttribute(r.attributeName,r.oldValue);}
   else if(r.type==='childList'){for(const n of r.addedNodes)n.remove();for(const n of r.removedNodes)r.target.insertBefore(n,r.nextSibling?.parentNode===r.target?r.nextSibling:null);}
  }
  observer?.takeRecords();onError(error);return false;
 }},dispose(){observer?.disconnect();}};
}
