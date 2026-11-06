// Registered pose drawings deform around local head/hip/foot landmarks at a
// joint change. Only one opaque texture is visible. Support anchors stay put:
// no root translation is used
// to simulate lifting a knee, sitting or pushing up from the mattress.
import {poseWorld,poseMeshPoint,transitionWindow} from './room-pose-transition.mjs';
let poseBlendSerial=0;
const poseBlendClipCache=new WeakMap();
const poseBlendClip=frame=>{let s=poseBlendClipCache.get(frame);if(!s){s='clip-path:polygon('+frame.outline.map(([a,b])=>a+'px '+b+'px').join(',')+');';poseBlendClipCache.set(frame,s);}return s;};
export function createRoomPoseBlend({document:doc,root}){
 const ns='http://www.w3.org/2000/svg',el=(tag,a={})=>{const n=doc.createElementNS(ns,tag);for(const[k,v]of Object.entries(a))n.setAttribute(k,v);return n;},prefix='pose-blend-'+(++poseBlendSerial)+'-';
 const group=el('g',{display:'none','data-contact-pose-blend':true}),layers=[0,1].map(i=>{const g=el('g'),viewport=el('svg',{overflow:'hidden'}),image=el('image'),defs=el('defs'),mesh=el('g'),texture=el('image',{id:prefix+i}),parts=[];defs.append(texture);viewport.append(image);g.append(viewport,defs,mesh);group.append(g);
  for(let row=0;row<7;row++)for(let col=0;col<7;col++)for(const pts of [[[col,row],[col+1,row],[col,row+1]],[[col+1,row],[col+1,row+1],[col,row+1]]]){const id=prefix+i+'-'+parts.length,clip=el('clipPath',{id,clipPathUnits:'userSpaceOnUse'}),poly=el('polygon'),part=el('g'),use=el('use',{href:'#'+prefix+i,'clip-path':'url(#'+id+')'});clip.append(poly);defs.append(clip);part.append(use);mesh.append(part);parts.push({pts,poly,part});}
  return {g,viewport,image,texture,mesh,parts,key:null,url:null};});root.append(group);
 return {hide(){group.setAttribute('display','none');},render({url,geometry,sample,offset=0,resolve}){group.setAttribute('display','inline');const first=resolve?resolve(sample.frame):{url,geometry,pose:sample.frame},second=sample.nextFrame?(resolve?resolve(sample.nextFrame):sample.nextFrame.atlas===sample.frame.atlas?{url,geometry,pose:sample.nextFrame}:first):first,current=first.pose,next=second.pose,blend=transitionWindow({...sample,frame:current,nextFrame:next});
  for(let i=0;i<2;i++){const descriptor=i?second:first,other=i?first:second,geometry=descriptor.geometry,url=descriptor.blobUrl||descriptor.url,p=i?next:current,target=i?current:next,frame=geometry.frames[p.cell],l=layers[i],[x,y,w,h]=frame.crop,morph=blend>0&&blend<1;l.g.setAttribute('display',i===(blend<.5?0:1)?'inline':'none');l.g.setAttribute('opacity',1);l.viewport.setAttribute('display',morph?'none':'inline');l.mesh.setAttribute('display',morph?'inline':'none');
   if(l.url!==url||l.key!==p.cell){const clipStyle=poseBlendClip(frame),urlChanged=l.url!==url;for(const pic of [l.image,l.texture]){if(urlChanged){pic.setAttribute('href',url);pic.setAttribute('width',geometry.width);pic.setAttribute('height',geometry.height);}pic.setAttribute('style',clipStyle);}l.url=url;l.key=p.cell;}
   if(!morph){l.g.setAttribute('transform',`translate(${p.at[0]},${p.at[1]+offset}) rotate(${p.rotation||0}) scale(${p.scale})`);for(const[k,v]of Object.entries({viewBox:frame.crop.join(' '),x:x-p.pivot[0],y:y-p.pivot[1],width:w,height:h}))l.viewport.setAttribute(k,v);continue;}
   l.g.setAttribute('transform',`translate(0,${offset})`);
   for(const {pts,poly,part}of l.parts){const source=pts.map(([a,b])=>[x+a*w/7,y+b*h/7]),dest=source.map(point=>poseMeshPoint(point,p,target,geometry,i?1-blend:blend,other.geometry));poly.setAttribute('points',source.map(point=>point.map((v,k)=>v+(v-source.reduce((n,q)=>n+q[k]/3,0))*.018).join(',')).join(' '));const [a,b,c]=source,[u,v,z]=dest,xx=b[0]-a[0],xy=b[1]-a[1],yx=c[0]-a[0],yy=c[1]-a[1],det=xx*yy-xy*yx,A=((v[0]-u[0])*yy-(z[0]-u[0])*xy)/det,C=((z[0]-u[0])*xx-(v[0]-u[0])*yx)/det,B=((v[1]-u[1])*yy-(z[1]-u[1])*xy)/det,D=((z[1]-u[1])*xx-(v[1]-u[1])*yx)/det;part.setAttribute('transform',`matrix(${A},${B},${C},${D},${u[0]-A*a[0]-C*a[1]},${u[1]-B*a[0]-D*a[1]})`);}
  }
  const head=poseWorld(current,current.head),to=poseWorld(next,next.head);return {head:head.map((v,i)=>v+(to[i]-v)*blend),prop:[...current.at],support:[...current.at]};
 }};
}
