// Async UI ownership is independent from the mounted room and its state.
export function mountRoomUi(root,context) {
  let instance,epoch=0,disposed=false,opening=false;
  const onEscape=event=>{if(event.key==='Escape'&&opening){event.preventDefault();api.close();}};
  context.document?.addEventListener?.('keydown',onEscape);
  const api={
    async open(...args){
      if(disposed)return;const generation=++epoch;opening=true;
      try{
        if(!instance){context.notify?.('正在打开家具面板…');const exports=await context.load();if(disposed||generation!==epoch)return;instance=exports.createRoomWorkspace(context.options);}
        if(generation===epoch)return await instance.open(...args);
      }catch(error){if(!disposed&&generation===epoch)context.notify?.(error.message||String(error),true);}
      finally{if(generation===epoch)opening=false;}
    },
    close(){epoch++;opening=false;instance?.close();},
    refresh(...args){return instance?.refresh(...args);},
    announce(...args){return instance?.announce(...args);},
    current(){return instance?.current();},
    isOpen(){return opening||Boolean(instance?.isOpen?.());},
    update(){},
    dispose(){if(disposed)return;disposed=true;epoch++;opening=false;context.document?.removeEventListener?.('keydown',onEscape);instance?.destroy();}
  };
  return api;
}
