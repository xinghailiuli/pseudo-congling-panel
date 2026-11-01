// Complete-body atlas rendering. Pixel data stays unchanged; the alpha outline
// excludes adjacent cells, and the support pivot stays fixed on its furniture.
export function validateRoomLifeAssets(a){
 const counts={sofa:24,garden:24,bed:24,desk:24,upper:24,carry:16,walk:8,cover:12};
 const png=s=>typeof s==='string'&&s.length<8*1024*1024&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s);
 const vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
 if(![10,11].includes(a?.version)||!a.geometry||!a.atlases||!png(a.greenhouse))return false;
 if(a.version===11)counts['sofa-rest']=12;
 if(a.geometry['bed-entry']){counts['bed-entry']=8;if(!png(a.bedding))return false;}
 if(a.quilt&&(!png(a.quilt.url)||!vector(a.quilt.crop,4)||![a.quilt.width,a.quilt.height].every(n=>Number.isFinite(n)&&n>0)))return false;
 if(a.geometry.sleepMotion)counts.sleepMotion=16;
 if(a.geometry.bedReference)counts.bedReference=24;
 if(a.geometry.sleepReference)counts.sleepReference=16;
 if(a.foldedQuilt&&!png(a.foldedQuilt))return false;
 if(a.geometry.transition){counts.transition=24;if(!png(a.mattress))return false;}
 let total=a.greenhouse.length;
 for(const [name,count]of Object.entries(counts)){
  const g=a.geometry[name];if(!png(a.atlases[name])||!g||!Number.isInteger(g.width)||g.width<1||g.width>4096||!Number.isInteger(g.height)||g.height<1||g.height>4096||!Array.isArray(g.frames)||g.frames.length!==count)return false;
  if(['transition','sleepMotion','bedReference','sleepReference'].includes(name)&&(!Number.isFinite(g.referenceHeight)||g.referenceHeight<=0||!g.frames.every(f=>vector(f.hip,2)&&vector(f.head,2))))return false;
  total+=a.atlases[name].length;
  for(const f of g.frames)if(!vector(f.crop,4)||f.crop[0]<0||f.crop[1]<0||f.crop[2]<=0||f.crop[3]<=0||f.crop[0]+f.crop[2]>g.width||f.crop[1]+f.crop[3]>g.height||!Array.isArray(f.outline)||f.outline.length<3||f.outline.length>4096||!f.outline.every(p=>vector(p,2)&&p[0]>=0&&p[0]<=g.width&&p[1]>=0&&p[1]<=g.height))return false;
 }
 return total<48*1024*1024;
}

export function roomDeskHandPoint(x,y,time=0){
 if(y<=7/12||y>=.75)return [x,y];
 const weight=Math.max(0,1-((x-.12)/.20)**2-((y-.65)/.07)**2)**2;
 return [x+Math.sin(time/240)*.006*weight,y+Math.sin(time/170)*.007*weight];
}
let roomLifeSerial=0;
export function roomQuiltPoint(x,y,cover=1,lift=0){
 const amount=Math.max(0,Math.min(1,cover)),v=Math.max(0,Math.min(1,(754-y)/136));
 // The section already laid on the bed keeps its texture scale. Excess cloth
 // gathers into a shallow stack at the advancing hem, never flips the sheet.
 const yy=754-30*(1-amount)-136*Math.min(v,amount)-56*Math.max(0,v-amount)-lift*.3*Math.sin(v*Math.PI);
 return [x+(yy-y)*.28,yy];
}
export function createRoomQuilt({document:doc,root,picture,id}){
 const el=(tag,attrs={})=>{const n=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const defs=el('defs'),mesh=el('g',{'data-articulated-quilt':true}),parts=[];picture.setAttribute('id',id);defs.append(picture);root.append(defs,mesh);root.setAttribute('clip-path','none');
 for(let row=0;row<8;row++)for(let col=0;col<6;col++){
  const x=330+218*col/6,y=618+136*row/8,xx=330+218*(col+1)/6,yy=618+136*(row+1)/8;
  for(const source of [[[x,y],[xx,y],[x,yy]],[[xx,y],[xx,yy],[x,yy]]]){const clip=el('clipPath',{id:id+'-'+parts.length,clipPathUnits:'userSpaceOnUse'}),polygon=el('polygon',{points:source.map(p=>p.map((v,k)=>v+(v-source.reduce((n,q)=>n+q[k]/3,0))*.025).join(',')).join(' ')}),part=el('g'),use=el('use',{href:'#'+id,'clip-path':'url(#'+id+'-'+parts.length+')'});clip.append(polygon);defs.append(clip);part.append(use);mesh.append(part);parts.push({source,part});}
 }
 let last='';return (cover,lift=0)=>{const key=cover.toFixed(3)+':'+lift.toFixed(2);if(key===last)return;last=key;
  for(const{source,part}of parts){const target=source.map(([x,y])=>roomQuiltPoint(x,y,cover,lift));const[p,q,r]=source,[u,v,z]=target,xx=q[0]-p[0],xy=q[1]-p[1],yx=r[0]-p[0],yy=r[1]-p[1],det=xx*yy-xy*yx,a=((v[0]-u[0])*yy-(z[0]-u[0])*xy)/det,c=((z[0]-u[0])*xx-(v[0]-u[0])*yx)/det,b=((v[1]-u[1])*yy-(z[1]-u[1])*xy)/det,d=((z[1]-u[1])*xx-(v[1]-u[1])*yx)/det;part.setAttribute('transform',`matrix(${a},${b},${c},${d},${u[0]-a*p[0]-c*p[1]},${u[1]-b*p[0]-d*p[1]})`);}
 };
}
export function createRoomLifeArt({document:doc,root,assets}){
 const el=(tag,attrs={})=>{const n=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const prefix='life-desk-'+(++roomLifeSerial)+'-',shadow=el('ellipse',{'data-life-ground-shadow':true,rx:20,ry:5,fill:'#493824',opacity:.18,display:'none'}),g=el('g',{'data-full-body-life':assets.version||10,display:'none'}),sheets={};let shown=null;root.append(shadow,g);
 // Each viewport uses a local clip so multiple isolated room instances cannot
 // borrow another room's clip IDs (the CSS path is local to the SVG image).
 for(const [name,atlas]of Object.entries(assets.geometry)){
  const holder=el('g',{display:'none'}),sheet=el('svg',{overflow:'hidden'}),picture=el('image',{href:assets.atlases[name],x:0,y:0,width:atlas.width,height:atlas.height});sheet.append(picture);holder.append(sheet);g.append(holder);sheets[name]={sheet,picture,holder};
  if(name==='desk'){
   const definitions=el('defs'),mesh=el('g'),triangles=[];picture.setAttribute('id',prefix+'image');definitions.append(picture);sheet.append(definitions,mesh);
   for(let row=0;row<12;row++)for(let col=0;col<8;col++){
    const a=[col/8,row/12],b=[(col+1)/8,row/12],c=[col/8,(row+1)/12],d=[(col+1)/8,(row+1)/12];
    for(const pts of [[a,b,c],[b,d,c]]){const id=prefix+triangles.length,clip=el('clipPath',{id,clipPathUnits:'userSpaceOnUse'}),poly=el('polygon'),part=el('g'),use=el('use',{href:'#'+prefix+'image','clip-path':'url(#'+id+')'});clip.append(poly);definitions.append(clip);part.append(use);mesh.append(part);triangles.push({pts,poly,part});}
   }
   sheets[name].animate=(frame,time)=>{const [x,y,w,h]=frame.crop;for(const{pts,poly,part}of triangles){
    const src=pts.map(([a,b])=>[x+a*w,y+b*h]),dst=pts.map(([a,b])=>roomDeskHandPoint(a,b,time)).map(([a,b])=>[x+a*w,y+b*h]);
    const center=src.reduce((s,p)=>[s[0]+p[0]/3,s[1]+p[1]/3],[0,0]);poly.setAttribute('points',src.map(p=>p.map((v,i)=>v+(v-center[i])*.04).join(',')).join(' '));
    const [p,q,r]=src,[u,v,z]=dst,xx=q[0]-p[0],xy=q[1]-p[1],yx=r[0]-p[0],yy=r[1]-p[1],det=xx*yy-xy*yx;
    const a=((v[0]-u[0])*yy-(z[0]-u[0])*xy)/det,c=((z[0]-u[0])*xx-(v[0]-u[0])*yx)/det,b=((v[1]-u[1])*yy-(z[1]-u[1])*xy)/det,d=((z[1]-u[1])*xx-(v[1]-u[1])*yx)/det;
    part.setAttribute('transform',`matrix(${a},${b},${c},${d},${u[0]-a*p[0]-c*p[1]},${u[1]-b*p[0]-d*p[1]})`);
   }};
  }
 }
 return {
  hide(){g.setAttribute('display','none');shadow.setAttribute('display','none');},
  render(sample,offset=0){
   let p=sample.frame;
   if(sample.phase==='perform'&&['type','write'].includes(sample.mode)&&sample.support==='hips'){
    const cell=sample.mode==='type'?5:13,f=assets.geometry.desk.frames[cell];
    p={...p,atlas:'desk',cell,pivot:[f.crop[0]+f.crop[2]*.48,f.crop[1]+f.crop[3]*.84]};
   }
   const atlas=assets.geometry[p.atlas],frame=atlas.frames[p.cell],[x,y,w,h]=frame.crop,flip=p.flip||1,scale=p.scale;
   const rotation=p.rotation||0,radians=rotation*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
   const breathing=sample.phase==='perform'&&!['type','write'].includes(sample.mode)&&sample.support!=='feet'&&Number.isFinite(sample.time)?1+Math.sin(sample.time/1000*Math.PI/3)*.003:1;
   g.setAttribute('display','inline');g.setAttribute('transform',`translate(${sample.position[0]},${sample.position[1]+offset}) rotate(${rotation}) scale(${flip*scale},${scale*breathing})`);
   shadow.setAttribute('display',sample.support==='feet'?'inline':'none');shadow.setAttribute('cx',sample.position[0]);shadow.setAttribute('cy',sample.position[1]+offset+1);
   const key=p.atlas+'/'+p.cell+'/'+p.pivot.join(',');
   if(shown!==key)for(const [name,{sheet,picture,holder}]of Object.entries(sheets)){
    holder.setAttribute('display',name===p.atlas?'inline':'none');if(name!==p.atlas)continue;
    sheet.setAttribute('viewBox',frame.crop.join(' '));sheet.setAttribute('x',x-p.pivot[0]);sheet.setAttribute('y',y-p.pivot[1]);sheet.setAttribute('width',w);sheet.setAttribute('height',h);
    sheet.setAttribute('style',`width:${w}px;height:${h}px;overflow:hidden`);
    picture.setAttribute('style','clip-path:polygon('+frame.outline.map(([a,b])=>a+'px '+b+'px').join(',')+');');
   }
   shown=key;
   if(p.atlas==='desk')sheets.desk.animate(frame,sample.phase==='perform'?sample.time||0:0);
   const world=([a,b])=>{const x=(a-p.pivot[0])*scale*flip,y=(b-p.pivot[1])*scale*breathing;return [sample.position[0]+x*cos-y*sin,sample.position[1]+x*sin+y*cos];};
   const propFraction=sample.prop==='can'?[.05,.78]:[.47,.65];
   return {head:world(p.head),prop:world([x+w*propFraction[0],y+h*propFraction[1]]),bounds:[world([x,y]),world([x+w,y+h])],support:[...sample.position]};
  }
 };
}


