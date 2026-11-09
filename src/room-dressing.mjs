import {isRoomImageUrl} from './room-image-source.mjs';
// The dressing room is a static fitting surface. It does not create a second room or animation loop.
const dressingImage = value => isRoomImageUrl(value,['png','webp']);
export {createDressingAssetClient} from './runtime/room-dressing-assets.mjs';
export function fittingFrame(asset){
 const frame=asset?.geometry?.frames?.[0],crop=frame?.crop;
 if(!asset?.url||!Array.isArray(crop)||crop.length!==4||!crop.every(Number.isFinite)||crop[2]<=0||crop[3]<=0)return null;
 return {url:asset.blobUrl||asset.url,crop,width:asset.geometry.width,height:asset.geometry.height,outline:frame.outline};
}
let fittingSerial=0;
// Display only the matching character from the authentic reference sheets.
const dressingReferenceCrops={
 'navy-gala':[850,479,0,40,310,400],'red-server':[850,475,0,20,310,440],
 'voxel-whale':[850,478,0,20,310,440],'whale-hood':[850,474,0,20,310,440],
 'snow-earmuffs':[850,474,0,20,310,440],'cream-hoodie':[850,850,0,140,310,570],
 'white-beret':[850,475,0,20,310,440],
 'whale-maid':[850,364,65,0,175,185],'whale-sweater':[850,364,420,0,180,185],
 doctor:[850,364,65,183,175,181],hanfu:[850,364,245,183,180,181],
 swordswoman:[850,364,420,183,190,181],sailor:[850,364,605,183,180,181],
 original:[412,344,105,45,245,295]
};
export function createRoomDressing({document:doc,catalog,getState,selectOutfit,prefetch,cancelPrefetch,artClient,onOpen,onClose,notify=()=>{}}){
 const el=(tag,cls,text)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const group=(cls,...children)=>{const e=el('div',cls);e.append(...children);return e;};
 const svg=(tag,attrs={})=>{const e=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
 const thumbnail=cls=>svg('svg',{class:cls,'aria-hidden':true});
 const setThumbnail=(target,url,id)=>{if(!dressingImage(url)||target.dataset.outfit===id)return;const [width,height,...crop]=dressingReferenceCrops[id],clipId='dressing-thumb-'+(++fittingSerial),clip=svg('clipPath',{id:clipId}),defs=svg('defs');clip.append(svg('rect',{x:crop[0],y:crop[1],width:crop[2],height:crop[3]}));defs.append(clip);target.setAttribute('viewBox',crop.join(' '));target.replaceChildren(defs,svg('image',{href:url,width,height,'clip-path':'url(#'+clipId+')'}));target.dataset.outfit=id;};
 const icons={suit:['M8 3 3 6l2 6 3-2v11h8V10l3 2 2-6-5-3-4 4Z'],hanger:['M10 5a2 2 0 1 1 3 2v3L2 17v3h20v-3L13 10'],pants:['M6 3h12l1 18h-6l-1-11-1 11H5Z'],gem:['m12 3 9 7-9 11-9-11Z','M3 10h18M7 6l5 15 5-15'],hair:['M5 15c-5-15 19-18 15-1l-3 3 3 4H4l3-5','M7 13c0-3 2-6 5-7 1 4 4 6 6 6'],heart:['M12 21C-5 10 3 0 12 7c9-7 17 3 0 14Z'],check:['m4 12 5 5L21 5'],shuffle:['M2 6h4l12 12h4','M2 18h4L18 6h4','m18 2 4 4-4 4m0 4 4 4-4 4'],left:['m15 4-8 8 8 8'],right:['m9 4 8 8-8 8']};
 const icon=name=>{const s=svg('svg',{viewBox:'0 0 24 24',class:'dressing-icon','aria-hidden':true});for(const d of icons[name]||icons.suit)s.append(svg('path',{d}));return s;};
 const button=(text,fn,cls='',i)=>{const b=el('button',cls);b.type='button';if(i)b.append(icon(i));if(text)b.append(el('span','',text));b.addEventListener('click',fn);return b;};
 const entries=[{id:'original',name:'原装'},...catalog],valid=new Set(entries.map(e=>e.id));
 let art=null,favorites=new Set(),disposed=false,returnTarget=null,renderedAsset=undefined,renderedOriginal='';
 const title=el('h3','','试衣预览 · 原装'),close=button('×',()=>api.close(),'dressing-close');close.setAttribute('aria-label','收起换装');
 const crest=group('dressing-crest',icon('hanger'));
 const header=group('dressing-header',el('span','dressing-title-star','✦'),title,el('span','dressing-title-star','✦'),close);
 const tabs=group('dressing-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','服饰分类');
 for(const [name,i]of [['套装','suit'],['上装','suit'],['下装','pants'],['饰品','gem'],['发型','hair']]){const b=button(name,()=>{},'dressing-tab',i);b.setAttribute('role','tab');b.setAttribute('aria-selected',String(name==='套装'));if(name!=='套装'){b.disabled=true;b.title='当前仅支持整套换装';}tabs.append(b);}
 const avatar=group('dressing-avatar');avatar.setAttribute('role','img');
 const step=direction=>{const id=getState().outfitId,index=entries.findIndex(e=>e.id===id);selectOutfit(entries[(index+direction+entries.length)%entries.length].id);};
 const previous=button('',()=>step(-1),'dressing-turn dressing-turn-left','left'),next=button('',()=>step(1),'dressing-turn dressing-turn-right','right');previous.setAttribute('aria-label','上一套服装');next.setAttribute('aria-label','下一套服装');
 const artStatus=el('span','dressing-art-status','正在打开更衣室…');
 const retry=button('重试背景',()=>loadArt(),'dressing-retry');retry.hidden=true;
 const stage=group('dressing-stage',avatar,previous,next,artStatus,retry);
 const currentImage=thumbnail('dressing-current-image');
 const currentName=el('strong','','原装'),currentTag=el('span','dressing-current-tag','当前试穿 ✓');
 const current=group('dressing-current',currentImage,group('dressing-current-copy',currentName,currentTag));
 const list=group('wardrobe-choices dressing-list');list.setAttribute('aria-label','全部套装');
 const outfitButtons=[];
 for(const item of entries){const thumb=thumbnail('dressing-thumb');const tick=el('span','dressing-choice-tick','✓');const b=button('',()=>selectOutfit(item.id),'dressing-choice');b.dataset.outfitId=item.id;b.append(thumb,el('span','dressing-choice-name',item.name),tick);b.addEventListener('mouseenter',()=>prefetch?.(item.id));b.addEventListener('focus',()=>prefetch?.(item.id));b.addEventListener('mouseleave',()=>cancelPrefetch?.());b.addEventListener('blur',()=>cancelPrefetch?.());list.append(b);outfitButtons.push({id:item.id,b,thumb});}
 const count=el('span','dressing-list-title','✦ 套装列表（'+entries.length+'）');
 const rail=group('dressing-rail',current,count,list);
 const favorite=button('设为最爱',()=>{const id=getState().outfitId;favorites.has(id)?favorites.delete(id):favorites.add(id);artClient.setFavorites([...favorites]);update();},'dressing-favorite','heart');
 const save=button('保存穿搭',()=>{if(getState().outfitLoading)return;notify('已保存当前穿搭');api.close();},'dressing-save','check');save.title='当前换装已自动记住，点击返回小屋';
 const random=button('随机搭配',()=>{const pool=entries.filter(e=>e.id!==getState().outfitId);selectOutfit(pool[Math.floor(Math.random()*pool.length)].id);},'dressing-random','shuffle');
 const footer=group('dressing-footer',favorite,save,random);
 const stateNotice=el('span','dressing-state-notice');stateNotice.setAttribute('role','status');stateNotice.setAttribute('aria-live','polite');
 const root=group('room-mirror-wardrobe dressing-room',crest,header,tabs,group('dressing-body',stage,rail),footer,stateNotice);root.hidden=true;root.setAttribute('role','region');root.setAttribute('aria-label','更衣室');
 function paintAvatar(asset){
  const frame=fittingFrame(asset),original=art?.original||'';
  if(asset===renderedAsset&&(asset||original===renderedOriginal))return;
  renderedAsset=asset;renderedOriginal=original;
  if(frame){const id='dressing-pose-'+(++fittingSerial),s=svg('svg',{viewBox:frame.crop.join(' '),'aria-hidden':true});const defs=svg('defs'),clip=svg('clipPath',{id});if(frame.outline?.length)clip.append(svg('polygon',{points:frame.outline.map(p=>p.join(',')).join(' ')}));else clip.append(svg('rect',{x:frame.crop[0],y:frame.crop[1],width:frame.crop[2],height:frame.crop[3]}));defs.append(clip);s.append(defs,svg('image',{href:frame.url,width:frame.width,height:frame.height,'clip-path':'url(#'+id+')'}));avatar.replaceChildren(s);
  }else if(original){const s=svg('svg',{viewBox:'105 45 245 295','aria-hidden':true});s.append(svg('image',{href:original,width:412,height:344}));avatar.replaceChildren(s);}
 }
 function update(){
  if(disposed)return;const state=getState(),item=entries.find(e=>e.id===state.outfitId)||entries[0];
  title.textContent='试衣预览 · '+item.name;currentName.textContent=item.name;avatar.setAttribute('aria-label',item.name+'站立试衣');
  stateNotice.textContent=state.outfitLoading?'正在换装…':/未能|超时|未通过/.test(state.outfitNotice)?state.outfitNotice:'';
  currentTag.textContent=state.outfitLoading?'正在换装…':'当前试穿 ✓';save.disabled=Boolean(state.outfitLoading);
  favorite.setAttribute('aria-pressed',String(favorites.has(item.id)));favorite.children[1].textContent=favorites.has(item.id)?'已设最爱':'设为最爱';
  favorite.disabled=!art;
  for(const {id,b,thumb}of outfitButtons){b.setAttribute('aria-pressed',String(id===item.id));b.setAttribute('aria-busy',String(id===state.loadingOutfitId));setThumbnail(thumb,id==='original'?art?.original:art?.thumbnails?.[id],id);}
  setThumbnail(currentImage,item.id==='original'?art?.original:art?.thumbnails?.[item.id],item.id);
  if(!root.hidden)paintAvatar(state.outfitAsset);
 }
 async function loadArt(){
  retry.hidden=true;
  try{const result=await artClient.load();if(disposed)return;art=result.assets;favorites=new Set(result.favorites.filter(id=>valid.has(id)));stage.style.backgroundImage='url("'+art.backdrop+'")';artStatus.hidden=true;update();}
  catch(error){if(disposed)return;artStatus.textContent=error.message;retry.hidden=false;}
 }
 root.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();api.close();}});
 const api={element:root,update,open(trigger){returnTarget=trigger||doc.activeElement;root.hidden=false;onOpen?.();update();void loadArt();close.focus();},close(){root.hidden=true;cancelPrefetch?.();onClose?.();if(returnTarget?.isConnected)returnTarget.focus?.();},dispose(){disposed=true;root.hidden=true;cancelPrefetch?.();}};
 return api;
}
