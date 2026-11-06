import {transitionWindow} from './room-pose-transition.mjs';
import {createRoomPoseBlend} from './room-pose-blend.mjs';
import {roomHandStroke} from './room-hand-motion.mjs';
// Optional wardrobe sprites. The original resident and choreography remain intact.
export function validateWardrobe(a){
 const ids=['navy-gala','red-server','voxel-whale','whale-hood','snow-earmuffs','cream-hoodie','white-beret','whale-maid','whale-sweater','doctor','hanfu','swordswoman','sailor'];
 if(a?.version!==1||!ids.includes(a.id)||typeof a.url!=='string'||a.url.length>12*1024*1024||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(a.url))return false;
 const g=a.geometry;if(!g||![g.width,g.height].every(n=>Number.isInteger(n)&&n>0&&n<=4096)||g.frames?.length!==16)return false;
 for(const [key,count]of [['desk',4],['walk',8],['bed',8],['transition',24],['sleepMotion',16],['deskTransition',8],['bedReference',24],['sleepReference',16],['bedBody',16],['sofaSocial',16],['sofaBody',16],['idleChair',16]])if(a[key]){const d=a[key];if(d.geometry?.frames?.length!==count||!validateWardrobe({...a,desk:undefined,walk:undefined,bed:undefined,transition:undefined,sleepMotion:undefined,deskTransition:undefined,bedReference:undefined,sleepReference:undefined,bedBody:undefined,sofaSocial:undefined,sofaBody:undefined,idleChair:undefined,url:d.url,geometry:{...d.geometry,frames:Array.from({length:16},(_,i)=>d.geometry.frames[i%count])}}))return false;}
 for(const key of ['walk','bed','transition','sleepMotion','deskTransition','bedReference','sleepReference','bedBody','sofaSocial','sofaBody','idleChair'])if(a[key]){const g=a[key].geometry,k=key==='walk'?'anchor':['transition','sleepMotion','deskTransition','bedReference','sleepReference','bedBody','sofaSocial','sofaBody','idleChair'].includes(key)?'hip':'head';if(!Number.isFinite(g.referenceHeight)||g.referenceHeight<=0||g.referenceHeight>4096||!g.frames.every(f=>Array.isArray(f[k])&&f[k].length===2&&f[k].every(Number.isFinite)&&f[k][0]>=0&&f[k][0]<=g.width&&f[k][1]>=0&&f[k][1]<=g.height))return false;}
 const valid=(f,g)=>Array.isArray(f.crop)&&f.crop.length===4&&f.crop.every(Number.isFinite)&&f.crop[0]>=0&&f.crop[1]>=0&&f.crop[2]>0&&f.crop[3]>0&&f.crop[0]+f.crop[2]<=g.width&&f.crop[1]+f.crop[3]<=g.height&&Array.isArray(f.outline)&&f.outline.length>=3&&f.outline.length<=4096&&f.outline.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite));
 for(const key of ['transition','sleepMotion','deskTransition','bedReference','sleepReference','bedBody','sofaSocial','sofaBody','idleChair'])if(a[key]){const g=a[key].geometry;if(!g.frames.every(f=>valid(f,g)&&Array.isArray(f.head)&&f.head.length===2&&f.head.every(Number.isFinite)))return false;}
 return g.frames.every(f=>valid(f,g));
}
export function wardrobeVisual(asset,input){
 const pose=wardrobePose(input),desk=asset.desk;
 for(const [key,field]of [['sleepMotion','sleepCell'],['deskTransition','deskCell'],['bedReference','bedReferenceCell'],['sleepReference','sleepReferenceCell']])if(asset[key]&&Number.isInteger(input.life?.frame?.[field])){const t=asset[key],cell=input.life.frame[field];return {pose,frame:t.geometry.frames[cell],url:t.url,blobUrl:t.blobUrl,geometry:t.geometry,transition:true,sleeping:key==='sleepMotion'||key==='sleepReference'};}
 if(asset.transition&&Number.isInteger(input.life?.frame?.transitionCell)){const t=asset.transition,cell=input.life.frame.transitionCell;return {pose,frame:t.geometry.frames[cell],url:t.url,blobUrl:t.blobUrl,geometry:t.geometry,transition:true};}
 if((input.moving||input.life?.move)&&asset.walk){const walk=asset.walk,cell=input.reduced?2:Math.floor(input.gait??input.frame??0)%8;return {pose,frame:walk.geometry.frames[cell],url:walk.url,blobUrl:walk.blobUrl,geometry:walk.geometry,walking:true};}
 if(input.life?.mode==='sleep'&&Number.isInteger(input.life.frame?.bedCell)&&asset.bed){const bed=asset.bed;return {pose,frame:bed.geometry.frames[input.life.frame.bedCell],url:bed.url,blobUrl:bed.blobUrl,geometry:bed.geometry,bedding:true};}
 if(desk&&pose.support==='hips'&&([8,9].includes(pose.cell)||input.life?.mode==='sleep')){
  const cell=input.life?.mode==='sleep'?3:pose.cell===8?2:0;
  return {pose,frame:desk.geometry.frames[cell],url:desk.url,blobUrl:desk.blobUrl,geometry:desk.geometry,desk:true};
 }
 return {pose,frame:asset.geometry.frames[pose.cell],url:asset.url,blobUrl:asset.blobUrl,geometry:asset.geometry,desk:false};
}
export function wardrobePose({moving=false,frame=0,life=null,mode='walk'}={}){
 const walk=()=>({cell:4+Math.floor(((Number(frame)||0)%8)/2),support:'feet'});
 if(moving||life?.move)return walk();
 if(life){
  const {support,prop}=life;mode=life.mode;
  if(support==='feet')return {cell:mode==='garden'&&prop==='can'?14:mode==='enchant'&&life.phase==='perform'?15:mode==='read'&&prop==='book'?10:1,support};
  if(mode==='sleep'&&support==='bed')return {cell:12,support};
  if(mode==='lounge'&&support==='elbows')return {cell:13,support};
  if(mode==='lounge'&&support==='cushion')return {cell:12,support};
  return {cell:mode==='write'?8:mode==='type'?9:['read','rest'].includes(mode)?10:mode==='enchant'?15:mode==='lounge'?11:10,support};
 }
 return {cell:({sleep:12,write:8,type:9,lounge:11,read:10,enchant:15,garden:14,rest:10})[mode]??0,support:mode==='sleep'?'bed':['write','type','lounge','read','rest'].includes(mode)?'hips':'feet'};
}
export function wardrobePlacement(crop,pose,position,flip=1,referenceHeight=crop[3],outline=null){
 const [, ,w,h]=crop;
 const scale=188/referenceHeight,width=w*scale,height=h*scale;
 const supportY=pose.support==='feet'?1:pose.support==='hips'?([8,9].includes(pose.cell)?.92:.85):pose.support==='elbows'?.83:.72;
 // Hair, skirts and carried tools make crop centres unreliable foot anchors.
 const sole=pose.support==='feet'?outline?.filter(p=>p[1]>=crop[1]+h*.95):null,xs=sole?.map(p=>(p[0]-crop[0])/w);
 const supportX=pose.cell>=4&&pose.cell<=7?.4:xs?.length?(Math.min(...xs)+Math.max(...xs))/2:.5;
 if(pose.support==='bed')return {x:position[0]-width*.25,y:position[1]-height*.60,width,height,flip:1};
 const pillow=[0,0];
 return {x:position[0]+pillow[0]-width*supportX,y:position[1]+pillow[1]-height*supportY,width,height,flip};
}

// Deform the supplied complete sprite continuously. Shared mesh vertices keep
// hands and feet attached; this does not invent missing source animation frames.
export function wardrobeMotionPoint(x,y,{cell,time=0,gait=0,moving=false,reduced=false}={}){
 if(reduced)return [x,y];
 const near=(cx,cy,rx,ry)=>Math.exp(-(((x-cx)/rx)**2)-((y-cy)/ry)**2);
 let dx=0,dy=0;
 if(moving){
  const step=gait*Math.PI/4,leg=Math.max(0,(y-.72)/.28)**1.4;
  // A continuous, bounded displacement cannot reverse neighbouring mesh
  // vertices. The previous step at x=.4 folded the shoes over each other.
  const side=Math.max(-1,Math.min(1,(.4-x)/.2));
  dx=side*Math.sin(step)*.025*leg;dy=-Math.max(0,side*Math.cos(step))*.025*leg;
  // A planted sole stays on the path; only the swinging foot lifts.
 }else{
  const breath=Math.sin(time/1000*Math.PI/2.8);
  if(cell===8||cell===9){
   // Compact support: head, torso and seated hips remain exactly still.
   // Supplement hands occupy the leading edge at half-height, not the waist.
   return roomHandStroke(x,y,time,{writing:cell===8});
  }
  else if(cell===11){const nibble=Math.max(0,Math.sin(time/2100));dy=-.026*nibble*near(.37,.51,.24,.15);}
  else if(cell===13){dy=-Math.max(0,Math.sin(time/1200))*.025*near(.82,.32,.18,.35);}
  else if(cell===14){dx=Math.sin(time/1100)*.013*near(.21,.6,.29,.25);}
  else if(cell===10||cell===15){dy=breath*.009*near(.3,.67,.35,.16);}
  dy-=breath*.003*near(.5,.55,.45,.27);
 }
 return [x+dx,y+dy];
}
let wardrobeSerial=0;
const WARDROBE_SUPPLEMENT_KEYS=['desk','walk','bed','transition','sleepMotion','deskTransition','bedReference','sleepReference','bedBody','sofaSocial','sofaBody','idleChair'];
const wardrobeClipCache=new WeakMap();
const wardrobeOutlineClip=frame=>{let s=wardrobeClipCache.get(frame);if(!s){s='clip-path:polygon('+frame.outline.map(([a,b])=>a+'px '+b+'px').join(',')+');';wardrobeClipCache.set(frame,s);}return s;};
async function decodeSingleWardrobeAtlas(atlas,ImageClass=globalThis.Image){
 const isNative=ImageClass===globalThis.Image&&Boolean(ImageClass);
 if(isNative&&atlas._decoded)return atlas._decodedImage||null;
 const src=atlas.blobUrl||atlas.url;
 const image=new ImageClass();image.src=src;await image.decode();
 if(image.naturalWidth!==atlas.geometry.width||image.naturalHeight!==atlas.geometry.height)throw new Error('invalid atlas size');
 if(isNative){atlas._decoded=true;atlas._decodedImage=image;}
 return image;
}
export function decodeBaseWardrobeAsset(asset,ImageClass=globalThis.Image){
 if(!validateWardrobe(asset))return Promise.reject(new Error('invalid outfit'));
 return decodeSingleWardrobeAtlas(asset,ImageClass);
}
export function decodeWardrobeAssets(asset,ImageClass=globalThis.Image){
 if(!validateWardrobe(asset))return Promise.reject(new Error('invalid outfit'));
 return Promise.all([asset,...WARDROBE_SUPPLEMENT_KEYS.filter(k=>asset[k]).map(k=>asset[k])].map(atlas=>decodeSingleWardrobeAtlas(atlas,ImageClass)));
}
export async function decodeWardrobeSupplements(asset,{priorityKeys=[],ImageClass=globalThis.Image,yieldFrame}={}){
 if(!validateWardrobe(asset))throw new Error('invalid outfit');
 const available=WARDROBE_SUPPLEMENT_KEYS.filter(k=>asset[k]);
 const prio=priorityKeys.filter(k=>available.includes(k));
 const rest=available.filter(k=>!prio.includes(k));
 if(prio.length)await Promise.all(prio.map(k=>decodeSingleWardrobeAtlas(asset[k],ImageClass)));
 const pause=yieldFrame||(fn=>typeof setTimeout==='function'?setTimeout(fn,12):fn());
 for(let i=0;i<rest.length;i+=2){
  await new Promise(resolve=>pause(resolve));
  await Promise.all(rest.slice(i,i+2).map(k=>decodeSingleWardrobeAtlas(asset[k],ImageClass)));
 }
}
export function revokeWardrobeBlobUrls(asset){
 if(!asset)return;
 for(const item of [asset,...WARDROBE_SUPPLEMENT_KEYS.map(k=>asset[k]).filter(Boolean)]){
  if(item.blobUrl&&typeof URL?.revokeObjectURL==='function'){try{URL.revokeObjectURL(item.blobUrl);}catch{}}
  delete item.blobUrl;delete item._decoded;delete item._decodedImage;
 }
}
export function createRoomWardrobe({document:doc,root}){
 const el=(tag,attrs={})=>{const e=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
 const prefix='wardrobe-'+(++wardrobeSerial)+'-',group=el('g',{'data-wardrobe-actor':'original',display:'none','pointer-events':'none'}),viewport=el('svg',{overflow:'visible'}),picture=el('image',{id:prefix+'source'}),defs=el('defs'),mesh=el('g',{'data-wardrobe-motion':'connected-mesh'}),shadow=el('ellipse',{rx:23,ry:5,fill:'#493824',opacity:.18});
 const complete=el('use',{href:'#'+prefix+'source',display:'none','data-wardrobe-complete-frame':true});
 defs.append(picture);viewport.append(defs,mesh,complete);group.append(shadow,viewport);root.append(group);let asset=null,lastCell=-1,lastMotion='',currentHref='';const contactArt=createRoomPoseBlend({document:doc,root});
 const fixedClip=el('clipPath',{id:prefix+'fixed',clipPathUnits:'userSpaceOnUse'}),fixedPath=el('path'),fixed=el('use',{href:'#'+prefix+'source','clip-path':'url(#'+prefix+'fixed)','data-stationary-body':true});fixedClip.append(fixedPath);defs.append(fixedClip);mesh.append(fixed);
 const triangles=[],columns=[0,.05,.1,.15,.2,.25,.38,.58,.8,1],rows=[0,.25,.4,.46,.49,.515,.54,.56,.585,.61,.64,.68,.72,.8,.9,1];
 for(let row=0;row<rows.length-1;row++)for(let col=0;col<columns.length-1;col++){
  const a=[columns[col],rows[row]],b=[columns[col+1],rows[row]],c=[columns[col],rows[row+1]],d=[columns[col+1],rows[row+1]];
  for(const points of [[a,b,c],[b,d,c]]){const id=prefix+'t'+triangles.length,clip=el('clipPath',{id,clipPathUnits:'userSpaceOnUse'}),polygon=el('polygon'),g=el('g'),use=el('use',{href:'#'+prefix+'source','clip-path':'url(#'+id+')'});clip.append(polygon);defs.append(clip);g.append(use);mesh.append(g);triangles.push({points,polygon,g});}
 }
 const deform=(frame,motion)=>{
  const [cx,cy,w,h]=frame.crop;
  picture.setAttribute('x',-cx);picture.setAttribute('y',-cy);
  let stationary='';for(const t of triangles){
   const source=t.points.map(([x,y])=>[x*w,y*h]),target=t.points.map(([x,y])=>wardrobeMotionPoint(x,y,motion)).map(([x,y])=>[x*w,y*h]);
   const still=source.every((p,i)=>p.every((v,j)=>Math.abs(v-target[i][j])<1e-8));t.g.setAttribute('display',still?'none':'inline');if(still){stationary+='M'+source.map(p=>p.join(',')).join('L')+'Z';continue;}
   // Small overlap prevents antialias cracks between adjacent triangles.
   const center=source.reduce((s,p)=>[s[0]+p[0]/3,s[1]+p[1]/3],[0,0]);
   t.polygon.setAttribute('points',source.map(p=>p.map((v,i)=>v+(v-center[i])*.06).join(',')).join(' '));
   const [p,q,r]=source,[u,v,z]=target,xx=q[0]-p[0],xy=q[1]-p[1],yx=r[0]-p[0],yy=r[1]-p[1],det=xx*yy-xy*yx;
   const a=((v[0]-u[0])*yy-(z[0]-u[0])*xy)/det,c=((z[0]-u[0])*xx-(v[0]-u[0])*yx)/det,b=((v[1]-u[1])*yy-(z[1]-u[1])*xy)/det,d=((z[1]-u[1])*xx-(v[1]-u[1])*yx)/det;
   t.g.setAttribute('transform',`matrix(${a},${b},${c},${d},${u[0]-a*p[0]-c*p[1]},${u[1]-b*p[0]-d*p[1]})`);
  }fixedPath.setAttribute('d',stationary);
 };
 return {
  set(a){if(a!==null&&!validateWardrobe(a))return false;asset=a;contactArt.hide();lastCell=-1;lastMotion='';group.setAttribute('data-wardrobe-actor',a?.id||'original');if(!a)group.setAttribute('display','none');else{const href=a.blobUrl||a.url;if(currentHref!==href){picture.setAttribute('href',href);currentHref=href;}picture.setAttribute('width',a.geometry.width);picture.setAttribute('height',a.geometry.height);}return true;},
  get active(){return Boolean(asset);},hide(){group.setAttribute('display','none');contactArt.hide();},
  render(input){if(!asset)return null;
   const kind=input.life?.frame?.atlas,nextKind=input.life?.nextFrame?.atlas;
   const isArticulatedAtlas=atlas=>Boolean(asset[atlas]?.geometry?.referenceHeight||(atlas==='desk'&&asset.deskTransition));
   const hasArticulated=(input.life?.frame?.articulated&&isArticulatedAtlas(kind))||(input.life?.nextFrame?.articulated&&isArticulatedAtlas(nextKind)&&transitionWindow(input.life)>0);
   if(hasArticulated){
    group.setAttribute('display','none');const offset=input.position[1]-input.life.position[1];
    const resolve=p=>{if(p.articulated&&asset[p.atlas]&&asset[p.atlas].geometry?.referenceHeight){const a=asset[p.atlas],geometry=a.geometry,f=geometry.frames[p.cell]||geometry.frames[0],chair=p.atlas==='idleChair'&&p.cell>=8;return {url:a.url,blobUrl:a.blobUrl,geometry,pose:{...p,pivot:chair||p.support==='feet'?(f.anchor||f.hip||[0,0]):p.support==='bed'?(f.head||f.hip||[0,0]):(f.hip||f.head||[0,0]),head:f.head||f.anchor||[0,0],scale:chair?285/geometry.frames[8].crop[3]:188/geometry.referenceHeight}};}
     const life={...input.life,frame:p,position:p.at,support:p.support,prop:p.prop,move:false},v=wardrobeVisual(asset,{...input,life,moving:false}),f=v.frame,cell=v.geometry.frames.indexOf(f),[x,y,w,h]=f.crop;
     if(v.desk)return {url:v.url,blobUrl:v.blobUrl,geometry:v.geometry,pose:{...p,atlas:'wardrobe-desk',cell,pivot:[x+w*.45,y+h*.8],head:[x+w*.5,y+h*.27],scale:188/h}};
     if(v.transition)return {url:v.url,blobUrl:v.blobUrl,geometry:v.geometry,pose:{...p,atlas:'wardrobe-transition',cell,pivot:f.hip||[x+w*.5,y+h*.8],head:f.head||[x+w*.5,y+h*.27],scale:188/(v.geometry.referenceHeight||h)}};
     const place=wardrobePlacement(f.crop,v.pose,p.at,1,asset.geometry.frames[0].crop[3],f.outline),scale=place.height/h;return {url:v.url,blobUrl:v.blobUrl,geometry:v.geometry,pose:{...p,cell,pivot:[x+(p.at[0]-place.x)/scale,y+(p.at[1]-place.y)/scale],head:[x+w*.5,y+h*.27],scale}};
    };
    const result=contactArt.render({resolve,offset,sample:input.life});return {...result,head:[result.head[0],result.head[1]+offset],prop:[result.prop[0],result.prop[1]+offset]};
   }contactArt.hide();const visual=wardrobeVisual(asset,input),{pose,frame}=visual;
   const custom=visual.walking||visual.bedding||visual.transition,scale=custom?188/visual.geometry.referenceHeight*(Number.isInteger(input.life?.frame?.deskCell)?1+(visual.geometry.referenceHeight/visual.geometry.frames[7].crop[3]-1)*input.life.frame.deskCell/7:1):1;
   const anchor=visual.sleeping?frame.head:visual.transition?frame.hip:visual.bedding?frame.head:frame.anchor;
   let placementPosition=input.position;
   if(visual.sleeping&&input.life?.restPosition){const g=asset.bedReference?.geometry||asset.transition.geometry,f=g.frames[asset.bedReference?11:15],s=188/g.referenceHeight;placementPosition=input.life.restPosition.map((v,i)=>v+(f.head[i]-f.hip[i])*s);}
   const placement=custom?{width:frame.crop[2]*scale,height:frame.crop[3]*scale,x:placementPosition[0]-(anchor[0]-frame.crop[0])*scale,y:placementPosition[1]-(anchor[1]-frame.crop[1])*scale,flip:visual.bedding?1:input.flip||1}:visual.desk?{width:188*frame.crop[2]/frame.crop[3],height:188,x:input.position[0]-188*frame.crop[2]/frame.crop[3]*.45,y:input.position[1]-188*.8,flip:1}:wardrobePlacement(frame.crop,pose,input.position,input.flip||1,asset.geometry.frames[0].crop[3],frame.outline),{x,width,height,flip}=placement;let y=placement.y;
   const motion={cell:pose.cell,time:Math.floor((input.time||0)/80)*80,gait:Math.round((input.gait??input.frame??0)*4)/4,moving:input.moving||Boolean(input.life?.move),reduced:Boolean(input.reduced)};
   if(pose.support==='feet'&&!custom){
    const [cx,cy,w,h]=frame.crop,sole=frame.outline.filter(p=>p[1]>cy+h*.8).map(([a,b])=>wardrobeMotionPoint((a-cx)/w,(b-cy)/h,motion)[1]);
    if(sole.length)y+=height*(1-Math.max(...sole));
   }
   shadow.setAttribute('display',pose.support==='feet'?'inline':'none');shadow.setAttribute('cx',input.position[0]);shadow.setAttribute('cy',input.position[1]+1);
   const rotation=visual.transition?input.life?.frame?.rotation||0:visual.bedding||pose.support==='bed'?0:['cushion','elbows'].includes(pose.support)?55:input.life?.frame?.rotation||0,breathing=1;
   const [px,py]=input.position;
   group.setAttribute('display','inline');group.setAttribute('data-wardrobe-cell',pose.cell);group.setAttribute('transform',`translate(${px},${py}) rotate(${rotation}) scale(${flip},${breathing}) translate(${-px},${-py})`);
   for(const[k,v]of Object.entries({x,y,width,height,viewBox:'0 0 '+frame.crop.slice(2).join(' ')}))viewport.setAttribute(k,v);
   const key=JSON.stringify([motion,visual.desk,visual.walking,visual.bedding,visual.transition,frame.crop]);if(lastCell!==pose.cell||lastMotion!==key){
    const href=visual.blobUrl||visual.url;if(currentHref!==href){picture.setAttribute('href',href);currentHref=href;picture.setAttribute('width',visual.geometry.width);picture.setAttribute('height',visual.geometry.height);}
    picture.setAttribute('style',wardrobeOutlineClip(frame));
    mesh.setAttribute('display',custom?'none':'inline');complete.setAttribute('display',custom?'inline':'none');
    if(custom){picture.setAttribute('x',-frame.crop[0]);picture.setAttribute('y',-frame.crop[1]);}
    else deform(frame,motion);lastCell=pose.cell;lastMotion=key;
   }
   const hx=(x+width*.5-px)*flip,hy=(y+height*.27-py)*breathing,radians=rotation*Math.PI/180;
   return {head:visual.bedding?[px,py]:[px+hx*Math.cos(radians)-hy*Math.sin(radians),py+hx*Math.sin(radians)+hy*Math.cos(radians)],prop:[px+(x+width*.18-px)*flip,y+height*.64]};
  }
 };
}
