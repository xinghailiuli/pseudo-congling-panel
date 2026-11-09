import {isRoomImageUrl} from '../room-image-source.mjs';
const dressingImage = value => isRoomImageUrl(value,['png','webp']);
export function createDressingAssetClient({win,parent,uid,timeoutMs=20000}) {
 let pending=null,ready=null,disposed=false,cancelPending=null;
 return {
  load(){
   if(disposed)return Promise.reject(Error('更衣室已经关闭'));
   if(ready)return Promise.resolve(ready);
   if(pending)return pending;
   pending=new Promise((resolve,reject)=>{
    const requestId=uid();
    let finished=false;
    const finish=(error,value)=>{if(finished)return;finished=true;cancelPending=null;clearTimeout(timer);win.removeEventListener('message',receive);if(error)reject(error);else{ready=value;resolve(value);}};
    cancelPending=()=>finish(Error('更衣室已经关闭'));
    const receive=event=>{const d=event.data;if(event.source!==parent||d?.channel!=='liuli-companion'||d.requestId!==requestId)return;
     if(d.type==='dressing-error'){finish(Error('更衣室背景未能加载，可重新打开重试。'));return;}
     if(d.type!=='dressing-assets')return;
     if(!dressingImage(d.assets?.backdrop)||!dressingImage(d.assets?.original)){finish(Error('更衣室素材未通过检查。'));return;}
     finish(null,{assets:d.assets,favorites:Array.isArray(d.favorites)?d.favorites:[]});
    };
    const timer=setTimeout(()=>finish(Error('更衣室背景加载超时，可重试。')),timeoutMs);
    win.addEventListener('message',receive);parent.postMessage({channel:'liuli-companion',type:'dressing-request',requestId},'*');
   }).catch(error=>{pending=null;throw error;});
   return pending;
  },
  setFavorites(ids){if(disposed)return;if(ready)ready.favorites=ids.slice();parent.postMessage({channel:'liuli-companion',type:'dressing-favorites',ids},'*');},
  dispose(){if(disposed)return;disposed=true;cancelPending?.();ready=null;}
 };
}
