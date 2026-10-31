import {roomActivity,roomWalkPoint} from './room-life.mjs';
import {createRoomHouse} from './room-house.mjs';
import {createArtBlockRoom} from './room-art.mjs';

export function createBlockRoom(room,{document:doc=document,onLamp,onCurtain,petAssets,actionAssets={},animation={},night={},jobs=[],preview='auto',onActivity,onFloor}={}){
 const illustrated=createArtBlockRoom(room,{document:doc,onLamp,onCurtain,petAssets,actionAssets,animation,night,jobs,preview,onActivity,onFloor});if(illustrated)return illustrated;
 const {svg,el,point,floors,drawings,staticKeyboard,blanket,anchors}=createRoomHouse(room,doc,{onLamp,onCurtain});
 let visual={night,jobs,preview},elapsed=0,lastMode,lastSource,patStart=null,patPending=false,origin=null,floor='1';
 const requestFrame=animation.requestFrame||globalThis.requestAnimationFrame?.bind(globalThis),reduced=animation.reducedMotion??globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
 const clips=petAssets||{},pictures=[],sheets=[],poses={},props={};
 const resident=el('g',{'data-room-resident':'dafeiyu',class:'room-resident',role:'button',tabindex:'0','aria-label':'摸摸大肥鱼'});
 const sprite=(g,x,y,w=198,clipName='idle')=>{const n=el('image',{x:x-w*219.5/412,y:y-w*344/412,width:w,height:w*344/412,preserveAspectRatio:'xMidYMax meet',class:'room-resident-sprite'});pictures.push({n,clipName,mode:'walk',standing:true});g.append(n);return n;};
 const setFloor=value=>{if(!['all','1','2'].includes(String(value)))return;floor=String(value);svg.setAttribute('viewBox',floor==='all'?'0 0 1100 1230':floor==='2'?'15 0 1050 560':'15 660 1050 560');for(const[level,g]of Object.entries(floors)){g.setAttribute('display',floor==='all'||floor===level?'inline':'none');g.setAttribute('aria-hidden',String(floor!=='all'&&floor!==level));}svg.setAttribute('data-room-floor',floor);onFloor?.(floor);};
 svg.setRoomFloor=setFloor;
 if(clips.idle?.frames?.length){
  svg.append(resident);resident.append(el('title',{},'大肥鱼 · 点点她的头'));
  for(const mode of['walk','sleep','write','type','lounge']){poses[mode]=el('g',{'data-room-pose':mode,'data-resident-floor':mode==='sleep'?'2':'1',transform:mode==='sleep'?'translate(0,0)':'translate(0,660)'});resident.append(poses[mode]);}
  const sheet=(g,kind,x,y,width,height)=>{const a=actionAssets[kind];if(!a)return null;const viewport=el('svg',{x,y,width,height,viewBox:a.frames[0].join(' '),overflow:'hidden','data-complete-action':kind});viewport.append(el('image',{href:a.url,x:0,y:0,width:a.width,height:a.height,preserveAspectRatio:'none'}));g.append(viewport);sheets.push({viewport,asset:a,kind});return viewport;};
  poses.walk.append(el('ellipse',{cx:0,cy:0,rx:19,ry:5.5,fill:'#66513b',opacity:'.18'}));
  props.walking=sheet(poses.walk,'walk',-75,-129.5,128,132);
  props.standing=el('g',{'data-walk-pose':'standing'});poses.walk.append(props.standing);sprite(props.standing,0,6.73);
  const[bx,by]=point(...anchors.bed),head=el('g',{transform:`translate(${bx},${by-20}) rotate(63)`});poses.sleep.append(head);
  const crop=el('svg',{x:-43,y:-42,width:86,height:84,viewBox:'112 56 220 204',overflow:'hidden'});head.append(crop);const sleepImage=el('image',{x:0,y:0,width:412,height:344});crop.append(sleepImage);pictures.push({n:sleepImage,clipName:'sleep_head',mode:'sleep',allowPat:false});props.quilt=blanket(poses.sleep,true);
  props.zzz=el('text',{x:bx+48,y:by-65,fill:'#647da8','font-size':18,'font-family':'monospace'},'z Z');poses.sleep.append(props.zzz);
  const[workX,workY]=point(...anchors.work);
  const writing=sheet(poses.write,'write',workX-65.5,workY-132,155,155);if(writing)writing.setAttribute('data-room-prop','pen');
  // Original frames contain both hands and the keyboard. Do not split them.
  const typing=el('svg',{x:workX-52,y:workY-123.5,width:145,height:132.1,viewBox:'110 80 225 205',overflow:'hidden','data-complete-action':'native-typing','data-room-prop':'typing-hands'}),typingImage=el('image',{x:0,y:0,width:412,height:344});typing.append(typingImage);poses.type.append(typing);pictures.push({n:typingImage,clipName:'working',mode:'type',allowPat:false,range:[79,170]});
  const[lx,ly]=point(...anchors.sofa);poses.lounge.setAttribute('data-room-seat','sofa');poses.lounge.append(el('ellipse',{cx:lx,cy:ly+5,rx:29,ry:8,fill:'#38435b',opacity:'.14'}));sheet(poses.lounge,'lounge',lx-74.6,ly-123,144,144);
  props.pat=el('text',{'font-size':18,fill:'#d3839d','text-anchor':'middle','pointer-events':'none',opacity:0},'♥');resident.append(props.pat);
 }
 const paint=time=>{
  const activity=roomActivity(room,visual.night,visual.jobs,visual.preview,time),mode=activity.mode;
  if(mode!==lastMode||activity.source!==lastSource){if(mode!==lastMode&&floor!=='all')setFloor(mode==='sleep'?'2':'1');lastMode=mode;lastSource=activity.source;svg.setAttribute('data-room-activity',mode);svg.setAttribute('data-room-source',activity.source);for(const[k,g]of Object.entries(poses))g.setAttribute('display',k===mode?'inline':'none');onActivity?.(activity);}
  const walk=roomWalkPoint(reduced?0:time),[wx,localY]=point(walk.x,walk.y,0),wy=localY+660;
  // Ground-plane translation and the full stride use the same distance clock.
  // Pauses use the neutral standing clip, not a frozen spread-legged frame.
  poses.walk?.setAttribute('transform',`translate(${wx},${wy}) scale(${walk.moving?walk.facing:1},1)`);
  props.walking?.setAttribute('display',walk.moving?'inline':'none');props.standing?.setAttribute('display',walk.moving&&props.walking?'none':'inline');
  svg.setAttribute('data-walk-step',String(walk.step));svg.setAttribute('data-walk-frame',walk.frame===null?'standing':String(walk.frame));svg.setAttribute('data-walk-moving',String(walk.moving));
  props.quilt?.setAttribute('transform',`translate(0,${reduced?0:Math.sin(time/1250)*.7})`);props.zzz?.setAttribute('opacity',reduced?'.75':String(.45+(Math.sin(time/1000)+1)*.25));
  const deskActivity=mode==='write'||mode==='type';for(const g of staticKeyboard)g.setAttribute('display',deskActivity?'none':'inline');for(const d of drawings)if(d.itemName==='日记本')d.g.setAttribute('display',mode==='write'?'none':'inline');
  for(const item of sheets){if(item.kind!==mode||item.kind==='walk'&&!walk.moving)continue;const index=reduced?0:item.kind==='walk'?walk.frame%item.asset.frames.length:Math.floor(time/item.asset.frameMs)%item.asset.frames.length;item.viewport.setAttribute('viewBox',item.asset.frames[index].join(' '));}
  if(patPending){patStart=time;patPending=false;}let phase='idle';if(patStart!==null){const c=clips.head_pat||clips.idle;if(time-patStart<c.frames.length*c.frameMs)phase='head_pat';else patStart=null;}resident.setAttribute('data-pet-state',phase);
  if(props.pat){const p=mode==='walk'?[wx,wy-145]:mode==='sleep'?point(anchors.bed[0],anchors.bed[1],4):point(...(mode==='lounge'?[anchors.sofa[0],anchors.sofa[1],4.3]:[anchors.work[0],anchors.work[1],4.8]));if(mode!=='walk'&&mode!=='sleep')p[1]+=660;props.pat.setAttribute('x',p[0]);props.pat.setAttribute('y',p[1]);props.pat.setAttribute('opacity',phase==='head_pat'?'1':'0');}
  for(const p of pictures){if(p.mode!==mode||p.standing&&walk.moving&&props.walking)continue;const usePat=phase==='head_pat'&&p.allowPat!==false&&p.clipName!=='sleep_head',clip=clips[usePat?'head_pat':p.clipName]||clips.idle;if(!clip)continue;const t=usePat?time-patStart:time,start=p.range&&clip===clips[p.clipName]?p.range[0]:0,count=p.range&&clip===clips[p.clipName]?p.range[1]-start+1:clip.frames.length,index=start+(reduced?0:Math.floor(t/clip.frameMs)%count),href=clip.frames[index];if(p.last!==href){p.n.setAttribute('href',href);p.last=href;}}
 };
 svg.setRoomActivity=patch=>{visual={...visual,...patch};if(Object.hasOwn(patch,'preview')&&floor!=='all'){const mode=roomActivity(room,visual.night,visual.jobs,visual.preview,elapsed).mode;setFloor(mode==='sleep'?'2':'1');}paint(elapsed);};
 const pet=()=>{if(patStart!==null||patPending||!clips.head_pat?.frames?.length)return;patPending=true;paint(elapsed);};resident.addEventListener('click',pet);resident.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pet();}});
 const tick=time=>{if(!resident.isConnected)return;if(origin===null)origin=time;elapsed=time-origin;paint(elapsed);requestFrame(tick);};
 setFloor('1');paint(0);if(requestFrame&&!reduced&&clips.idle?.frames?.length)requestFrame(tick);return svg;
}
