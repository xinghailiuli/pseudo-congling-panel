// A capability boundary over existing state owners, never a second room store.
export function createRoomUiContext(capabilities) {
  const releases=new Set();let disposed=false;
  return Object.freeze({...capabilities,
    subscribe(listener){
      if(disposed)return ()=>{};
      const release=capabilities.subscribe?.(listener)||(()=>{});
      const unsubscribe=()=>{if(releases.delete(unsubscribe))release();};
      releases.add(unsubscribe);return unsubscribe;
    },
    dispose(){if(disposed)return;disposed=true;for(const release of releases)release();}
  });
}
