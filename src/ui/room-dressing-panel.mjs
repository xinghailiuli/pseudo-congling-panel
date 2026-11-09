export function mountRoomUi(root,context) {
  let instance,epoch=0,disposed=false,returnTarget;root.hidden=true;const options=context.options||{};
  const hide=()=>{epoch++;root.hidden=true;options.onClose?.();if(!instance&&returnTarget?.isConnected)returnTarget.focus?.();};
  const onEscape=event=>{if(event.key==='Escape'&&!root.hidden){event.preventDefault();api.close();}};
  root.addEventListener('keydown',onEscape);
  const api={element:root,
    async open(trigger){
      if(disposed)return;const generation=++epoch;returnTarget=trigger||context.document.activeElement;root.hidden=false;options.onOpen?.();
      if(!instance){root.tabIndex=-1;root.focus?.();context.notify?.('正在打开更衣室…');}
      try{
        if(!instance&&options.artClient)void options.artClient.load().catch(()=>{});
        if(!instance){const exports=await context.load();if(disposed||generation!==epoch)return;instance=exports.createRoomDressing({...options,onOpen:()=>{},onClose:hide});root.append(instance.element);}
        if(!disposed&&generation===epoch)instance.open(trigger);
      }catch(error){if(!disposed&&generation===epoch){hide();context.notify?.(error.message||String(error),true);}}
    },
    close(){if(disposed)return;if(instance)instance.close();else hide();},
    update(snapshot){if(!disposed)instance?.update(snapshot);},
    dispose(){if(disposed)return;disposed=true;epoch++;root.hidden=true;root.removeEventListener('keydown',onEscape);instance?.dispose();instance?.element?.remove();}
  };return api;
}
