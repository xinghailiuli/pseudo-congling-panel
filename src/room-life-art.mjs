// Complete-body atlas rendering. Pixel data stays unchanged; the alpha outline
// excludes adjacent cells, and the support pivot stays fixed on its furniture.
export function validateRoomLifeAssets(a){
 const counts={sofa:24,garden:24,bed:24,desk:24,upper:24,carry:16,walk:8,cover:12};
 const png=s=>typeof s==='string'&&s.length<8*1024*1024&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s);
 const vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
 if(![10,11].includes(a?.version)||!a.geometry||!a.atlases||!png(a.greenhouse))return false;
 if(a.version===11)counts['sofa-rest']=12;
 let total=a.greenhouse.length;
 for(const [name,count]of Object.entries(counts)){
  const g=a.geometry[name];if(!png(a.atlases[name])||!g||!Number.isInteger(g.width)||g.width<1||g.width>4096||!Number.isInteger(g.height)||g.height<1||g.height>4096||!Array.isArray(g.frames)||g.frames.length!==count)return false;
  total+=a.atlases[name].length;
  for(const f of g.frames)if(!vector(f.crop,4)||f.crop[0]<0||f.crop[1]<0||f.crop[2]<=0||f.crop[3]<=0||f.crop[0]+f.crop[2]>g.width||f.crop[1]+f.crop[3]>g.height||!Array.isArray(f.outline)||f.outline.length<3||f.outline.length>4096||!f.outline.every(p=>vector(p,2)&&p[0]>=0&&p[0]<=g.width&&p[1]>=0&&p[1]<=g.height))return false;
 }
 return total<48*1024*1024;
}

export function createRoomLifeArt({document:doc,root,assets}){
 const el=(tag,attrs={})=>{const n=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const shadow=el('ellipse',{'data-life-ground-shadow':true,rx:20,ry:5,fill:'#493824',opacity:.18,display:'none'}),g=el('g',{'data-full-body-life':assets.version||10,display:'none'}),sheets={};let shown=null;root.append(shadow,g);
 // Each viewport uses a local clip so multiple isolated room instances cannot
 // borrow another room's clip IDs (the CSS path is local to the SVG image).
 for(const [name,atlas]of Object.entries(assets.geometry)){
  const holder=el('g',{display:'none'}),sheet=el('svg',{overflow:'hidden'}),picture=el('image',{href:assets.atlases[name],x:0,y:0,width:atlas.width,height:atlas.height});sheet.append(picture);holder.append(sheet);g.append(holder);sheets[name]={sheet,picture,holder};
 }
 return {
  hide(){g.setAttribute('display','none');shadow.setAttribute('display','none');},
  render(sample,offset=0){
   const p=sample.frame,atlas=assets.geometry[p.atlas],frame=atlas.frames[p.cell],[x,y,w,h]=frame.crop,flip=p.flip||1,scale=p.scale;
   const rotation=p.rotation||0,radians=rotation*Math.PI/180,cos=Math.cos(radians),sin=Math.sin(radians);
   const breathing=sample.phase==='perform'&&sample.support!=='feet'&&Number.isFinite(sample.time)?1+Math.sin(sample.time/1000*Math.PI/3)*.003:1;
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
   const world=([a,b])=>{const x=(a-p.pivot[0])*scale*flip,y=(b-p.pivot[1])*scale*breathing;return [sample.position[0]+x*cos-y*sin,sample.position[1]+x*sin+y*cos];};
   const propFraction=sample.prop==='can'?[.05,.78]:[.47,.65];
   return {head:world(p.head),prop:world([x+w*propFraction[0],y+h*propFraction[1]]),bounds:[world([x,y]),world([x+w,y+h])],support:[...sample.position]};
  }
 };
}
