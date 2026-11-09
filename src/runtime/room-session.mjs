// A room lifetime around the existing authoritative controllers and scene.
export function createRoomSession({scene,observer,persistence,wardrobe,diagnostics}) {
  let disposed=false;const listeners=new Set();
  const getSnapshot=()=>({runtime:scene.getRoomRuntime?.(),view:observer?.roomView,outfit:wardrobe?.getState?.(),diagnostics});
  return {getSnapshot,
    subscribe(listener){if(disposed)return ()=>{};listeners.add(listener);return ()=>listeners.delete(listener);},
    publish(){if(!disposed)for(const listener of listeners)listener(getSnapshot());},
    dispose(){if(disposed)return;persistence?.saveRoomRuntime?.(true);disposed=true;listeners.clear();scene.disposeRoomAmbient?.();}
  };
}
