// Optional wardrobe sprites. The original resident and choreography remain intact.
export function validateWardrobe(a){
 const ids=['navy-gala','red-server','voxel-whale','whale-hood','snow-earmuffs','cream-hoodie','white-beret','whale-maid','whale-sweater','doctor','hanfu','swordswoman','sailor'];
 if(a?.version!==1||!ids.includes(a.id)||typeof a.url!=='string'||a.url.length>12*1024*1024||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(a.url))return false;
 const g=a.geometry;if(!g||![g.width,g.height].every(n=>Number.isInteger(n)&&n>0&&n<=4096)||g.frames?.length!==16)return false;
 return g.frames.every(f=>Array.isArray(f.crop)&&f.crop.length===4&&f.crop.every(Number.isFinite)&&f.crop[0]>=0&&f.crop[1]>=0&&f.crop[2]>0&&f.crop[3]>0&&f.crop[0]+f.crop[2]<=g.width&&f.crop[1]+f.crop[3]<=g.height&&Array.isArray(f.outline)&&f.outline.length>=3&&f.outline.length<=4096&&f.outline.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)));
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
 const pillow=pose.support==='bed'?[8,0]:[0,0];
 return {x:position[0]+pillow[0]-width*supportX,y:position[1]+pillow[1]-height*supportY,width,height,flip};
}

// Deform the supplied complete sprite continuously. Shared mesh vertices keep
// hands and feet attached; this does not invent missing source animation frames.
export function wardrobeMotionPoint(x,y,{cell,time=0,gait=0,moving=false,reduced=false}={}){
 if(reduced)return [x,y];
 const near=(cx,cy,rx,ry)=>Math.exp(-(((x-cx)/rx)**2)-((y-cy)/ry)**2);
 let dx=0,dy=0;
 if(moving){
  const step=gait*Math.PI/4,leg=Math.max(0,(y-.72)/.28)**1.4,side=x<.4?1:-1;
  dx=((side===1?.12:-.1)+side*Math.sin(step)*.14)*leg;dy=-Math.max(0,side*Math.cos(step))*.025*leg;
  // A planted sole stays on the path; only the swinging foot lifts.
 }else{
  const breath=Math.sin(time/1000*Math.PI/2.8);
  if(cell===8||cell===9){const hand=near(.24,.67,.28,.11);dx=Math.sin(time/(cell===8?260:140))*.012*hand;dy=Math.sin(time/180)*.01*hand;}
  else if(cell===11){const nibble=Math.max(0,Math.sin(time/2100));dy=-.026*nibble*near(.37,.51,.24,.15);}
  else if(cell===13){dy=-Math.max(0,Math.sin(time/1200))*.025*near(.82,.32,.18,.35);}
  else if(cell===14){dx=Math.sin(time/1100)*.013*near(.21,.6,.29,.25);}
  else if(cell===10||cell===15){dy=breath*.009*near(.3,.67,.35,.16);}
  dy-=breath*.003*near(.5,.55,.45,.27);
 }
 return [x+dx,y+dy];
}
let wardrobeSerial=0;
export function createRoomWardrobe({document:doc,root}){
 const el=(tag,attrs={})=>{const e=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);return e;};
 const prefix='wardrobe-'+(++wardrobeSerial)+'-',group=el('g',{'data-wardrobe-actor':'original',display:'none','pointer-events':'none'}),viewport=el('svg',{overflow:'visible'}),picture=el('image',{id:prefix+'source'}),defs=el('defs'),mesh=el('g',{'data-wardrobe-motion':'connected-mesh'}),shadow=el('ellipse',{rx:23,ry:5,fill:'#493824',opacity:.18});
 defs.append(picture);viewport.append(defs,mesh);group.append(shadow,viewport);root.append(group);let asset=null,lastCell=-1,lastMotion='';
 const triangles=[],columns=[0,.18,.38,.58,.8,1];
 for(let row=0;row<8;row++)for(let col=0;col<5;col++){
  const a=[columns[col],row/8],b=[columns[col+1],row/8],c=[columns[col],(row+1)/8],d=[columns[col+1],(row+1)/8];
  for(const points of [[a,b,c],[b,d,c]]){const id=prefix+'t'+triangles.length,clip=el('clipPath',{id,clipPathUnits:'userSpaceOnUse'}),polygon=el('polygon'),g=el('g'),use=el('use',{href:'#'+prefix+'source','clip-path':'url(#'+id+')'});clip.append(polygon);defs.append(clip);g.append(use);mesh.append(g);triangles.push({points,polygon,g});}
 }
 const deform=(frame,motion)=>{
  const [cx,cy,w,h]=frame.crop;
  picture.setAttribute('x',-cx);picture.setAttribute('y',-cy);
  for(const t of triangles){
   const source=t.points.map(([x,y])=>[x*w,y*h]),target=t.points.map(([x,y])=>wardrobeMotionPoint(x,y,motion)).map(([x,y])=>[x*w,y*h]);
   // Small overlap prevents antialias cracks between adjacent triangles.
   const center=source.reduce((s,p)=>[s[0]+p[0]/3,s[1]+p[1]/3],[0,0]);
   t.polygon.setAttribute('points',source.map(p=>p.map((v,i)=>v+(v-center[i])*.06).join(',')).join(' '));
   const [p,q,r]=source,[u,v,z]=target,xx=q[0]-p[0],xy=q[1]-p[1],yx=r[0]-p[0],yy=r[1]-p[1],det=xx*yy-xy*yx;
   const a=((v[0]-u[0])*yy-(z[0]-u[0])*xy)/det,c=((z[0]-u[0])*xx-(v[0]-u[0])*yx)/det,b=((v[1]-u[1])*yy-(z[1]-u[1])*xy)/det,d=((z[1]-u[1])*xx-(v[1]-u[1])*yx)/det;
   t.g.setAttribute('transform',`matrix(${a},${b},${c},${d},${u[0]-a*p[0]-c*p[1]},${u[1]-b*p[0]-d*p[1]})`);
  }
 };
 return {
  set(a){if(a!==null&&!validateWardrobe(a))return false;asset=a;lastCell=-1;lastMotion='';group.setAttribute('data-wardrobe-actor',a?.id||'original');if(!a)group.setAttribute('display','none');else{picture.setAttribute('href',a.url);picture.setAttribute('width',a.geometry.width);picture.setAttribute('height',a.geometry.height);}return true;},
  get active(){return Boolean(asset);},hide(){group.setAttribute('display','none');},
  render(input){if(!asset)return null;const pose=wardrobePose(input),frame=asset.geometry.frames[pose.cell],placement=wardrobePlacement(frame.crop,pose,input.position,input.flip||1,asset.geometry.frames[0].crop[3],frame.outline),{x,width,height,flip}=placement;let y=placement.y;
   const motion={cell:pose.cell,time:Math.floor((input.time||0)/80)*80,gait:Math.round((input.gait??input.frame??0)*4)/4,moving:input.moving||Boolean(input.life?.move),reduced:Boolean(input.reduced)};
   if(pose.support==='feet'){
    const [cx,cy,w,h]=frame.crop,sole=frame.outline.filter(p=>p[1]>cy+h*.8).map(([a,b])=>wardrobeMotionPoint((a-cx)/w,(b-cy)/h,motion)[1]);
    if(sole.length)y+=height*(1-Math.max(...sole));
   }
   shadow.setAttribute('display',pose.support==='feet'?'inline':'none');shadow.setAttribute('cx',input.position[0]);shadow.setAttribute('cy',input.position[1]+1);
   const rotation=['cushion','elbows'].includes(pose.support)?55:input.life?.frame?.rotation||0,breathing=1;
   const [px,py]=input.position;
   group.setAttribute('display','inline');group.setAttribute('data-wardrobe-cell',pose.cell);group.setAttribute('transform',`translate(${px},${py}) rotate(${rotation}) scale(${flip},${breathing}) translate(${-px},${-py})`);
   for(const[k,v]of Object.entries({x,y,width,height,viewBox:'0 0 '+frame.crop.slice(2).join(' ')}))viewport.setAttribute(k,v);
   const key=JSON.stringify(motion);if(lastCell!==pose.cell||lastMotion!==key){
    picture.setAttribute('style','clip-path:polygon('+frame.outline.map(([a,b])=>a+'px '+b+'px').join(',')+');');
    deform(frame,motion);lastCell=pose.cell;lastMotion=key;
   }
   const hx=(x+width*.5-px)*flip,hy=(y+height*.27-py)*breathing,radians=rotation*Math.PI/180;
   return {head:[px+hx*Math.cos(radians)-hy*Math.sin(radians),py+hx*Math.sin(radians)+hy*Math.cos(radians)],prop:[px+(x+width*.18-px)*flip,y+height*.64]};
  }
 };
}
