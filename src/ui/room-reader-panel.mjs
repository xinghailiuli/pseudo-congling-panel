export function mountRoomUi(root,context) {
  let reader,epoch=0,disposed=false,opening=false;
  const cancel=event=>{if(event.key==='Escape'&&opening){event.preventDefault();api.close();}};
  context.document?.addEventListener?.('keydown',cancel);
  const api={async open(){
    if(disposed)return;const generation=++epoch;opening=true;
    try{if(!reader){context.notify?.('正在打开书架…');const exports=await context.load();if(disposed||generation!==epoch)return;reader=exports.createRoomBookReader(context.options);}if(generation===epoch)await reader.open();}
    catch(error){if(!disposed&&generation===epoch)context.notify?.(error.message||String(error),true);}
    finally{if(generation===epoch)opening=false;}
  },close(){epoch++;opening=false;reader?.destroy();},update(){},dispose(){if(disposed)return;disposed=true;epoch++;opening=false;reader?.destroy();context.document?.removeEventListener?.('keydown',cancel);}};
  api.destroy=api.dispose;return api;
}
