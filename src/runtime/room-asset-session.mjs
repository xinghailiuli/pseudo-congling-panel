export function createRoomAssetSession({load,release}) {
  const pending=new Map(),ready=new Map();let disposed=false;
  const releaseKey=key=>{if(!ready.has(key))return;const value=ready.get(key);ready.delete(key);release(value);};
  return {
    retain(key,value){if(disposed){release(value);return;}ready.set(key,value);},
    acquire(key){
      if(disposed)return Promise.reject(Error('资源会话已经关闭（disposed）'));
      if(ready.has(key))return Promise.resolve(ready.get(key));if(pending.has(key))return pending.get(key);
      const task=(async()=>{const value=await load(key);if(disposed){release(value);throw Error('资源会话已经关闭（disposed）');}ready.set(key,value);return value;})();
      pending.set(key,task);task.finally(()=>{if(pending.get(key)===task)pending.delete(key);}).catch(()=>{});return task;
    },
    release:releaseKey,
    dispose(){if(disposed)return;disposed=true;for(const key of ready.keys())releaseKey(key);pending.clear();}
  };
}
