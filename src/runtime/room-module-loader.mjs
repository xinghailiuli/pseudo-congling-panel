export function createRoomModuleLoader({manifest,requestChunk,evaluateModule,attachStyles}) {
  const pending=new Map(),releases=new Map();let disposed=false;
  const closed=()=>{if(disposed)throw Error('界面已经关闭（module loader disposed）');};
  function load(id,ancestors=[]) {
    if(disposed)return Promise.reject(Error('界面已经关闭（module loader disposed）'));
    const record=Object.hasOwn(manifest,id)&&manifest[id];
    if(!record)return Promise.reject(Error('未知界面模块：'+id));
    if(ancestors.includes(id))return Promise.reject(Error('界面模块循环依赖：'+id));
    if(pending.has(id))return pending.get(id);
    const task=(async()=>{
      for(const dependency of record.dependencies||[])await load(dependency,[...ancestors,id]);
      closed();const payload=await requestChunk(record);closed();
      if(payload?.id!==id||payload.revision!==record.revision||typeof payload.code!=='string'||typeof payload.cssText!=='string')throw Error('界面资源版本不一致，请刷新视窗后重试。');
      const exports=await evaluateModule(payload);closed();
      releases.set(id,attachStyles({owner:'room-ui-'+id,revision:record.revision,cssText:payload.cssText}));
      return exports;
    })();
    pending.set(id,task);task.catch(()=>{if(pending.get(id)===task)pending.delete(id);});return task;
  }
  return {load,dispose(){if(disposed)return;disposed=true;for(const release of releases.values())release();releases.clear();pending.clear();}};
}

export function createRoomModuleClient({window:win,parent,uid,schedule=globalThis.setTimeout,cancel=globalThis.clearTimeout}) {
  const requests=new Map();let disposed=false;
  const receive=event=>{
    const data=event.data;if(event.source!==parent||data?.channel!=='liuli-companion'||!['room-module-assets','room-module-error'].includes(data.type))return;
    const request=requests.get(data.requestId);if(!request||request.id!==data.id)return;
    requests.delete(data.requestId);cancel(request.timer);
    if(data.type==='room-module-error')request.reject(Error(data.error||'界面资源未能加载，请重试。'));else request.resolve(data.payload);
  };
  win.addEventListener('message',receive);
  return {
    requestChunk(record){
      if(disposed)return Promise.reject(Error('界面已经关闭（module client disposed）'));
      return new Promise((resolve,reject)=>{
        const requestId=uid(),timer=schedule(()=>{requests.delete(requestId);reject(Error('界面资源加载超时，请重试。'));},20000);
        requests.set(requestId,{id:record.id,resolve,reject,timer});
        parent.postMessage({channel:'liuli-companion',type:'room-module-request',requestId,id:record.id,revision:record.revision},'*');
      });
    },
    dispose(){if(disposed)return;disposed=true;win.removeEventListener('message',receive);for(const request of requests.values()){cancel(request.timer);request.reject(Error('界面已经关闭（module client disposed）'));}requests.clear();}
  };
}

export function evaluateRoomModule({document,window:win},payload) {
  const registry=win.__ROOM_UI_MODULES??=Object.create(null),key=payload.id+'@'+payload.revision;
  const script=document.createElement('script');script.setAttribute('data-plugin','dsh-whale-status');
  script.textContent='window.__ROOM_UI_MODULES['+JSON.stringify(key)+']=('+payload.code+');';
  try{document.head.append(script);if(!Object.hasOwn(registry,key))throw Error('界面模块初始化失败：'+payload.id);return registry[key];}
  finally{script.remove();delete registry[key];}
}
