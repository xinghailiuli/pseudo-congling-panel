import {roomActivity,roomWalkPoint} from './room-life.mjs';
import {createRoomJourney} from './room-journey.mjs';
import {roomNavigation} from './room-navigation.mjs';

// The illustrated theme is tied to the original furniture set. Changed rooms
// continue to use individually rendered objects, never a stale baked inventory.
export function createArtBlockRoom(room,{document:doc,petAssets={},actionAssets={},animation={},night={},jobs=[],preview='auto',onActivity,onFloor,onLamp,onCurtain}={}){
 const house=actionAssets.house,names=['床','书桌','台灯','窗','沙发','冰箱','电视','绿萝','旧相册','日记本','记事本','床头柜','书架','椅子','电脑','茶几','挂画','挂钟','盆栽'];
 if(!house||room.items?.length!==names.length||!names.every(name=>room.items.some(item=>item.name===name)))return null;
 const el=(tag,attrs={},text)=>{const n=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
 const svg=el('svg',{viewBox:'0 1080 1536 1024',class:'room-scene block-room room-art',role:'group','aria-label':'大肥鱼的双层小屋，精细橡木与白桦木房间','data-room-art':'reference-v4','data-room-size':'14x10','data-room-floors':'2'});
 svg.append(el('title',{},'大肥鱼的双层小屋 · 一楼起居与生产，二楼休息与魔法'));
 const defs=el('defs');svg.append(defs);
 const offsets={1:1080,2:0},floors={},poses={},frames={},hitPoints={walk:[970,450],...Object.fromEntries(Object.entries(house.actions).map(([k,v])=>[k,v.head]))};
 const image=(url,attrs={})=>el('image',{x:0,y:0,width:house.width,height:house.height,...(url?{href:url}:{}),preserveAspectRatio:'none',...attrs});
 const clip=(id,rect)=>{const c=el('clipPath',{id,clipPathUnits:'userSpaceOnUse'});c.append(typeof rect==='string'?el('polygon',{points:rect}):el('rect',{x:rect[0],y:rect[1],width:rect[2],height:rect[3]}));defs.append(c);return `url(#${id})`;};
 const floorArt=(g,level)=>{g.append(image(house.floors[level]));const repair=house.repairs?.[level];if(repair){const id='room-repair-alpha-'+level+'-'+defs.children.length,mask=el('mask',{id,maskUnits:'userSpaceOnUse',x:0,y:0,width:house.width,height:house.height,style:'mask-type:alpha'});mask.append(image(house.floors[level]));defs.append(mask);const patch=el('g',{'clip-path':clip('room-repair-'+level+'-'+defs.children.length,repair.clip),mask:'url(#'+id+')'});patch.append(image(repair.url));g.append(patch);}};
 for(const level of[2,1]){const g=el('g',{'data-house-floor':level,transform:`translate(0,${offsets[level]})`});floorArt(g,level);svg.append(g);floors[level]=g;}
 // Saved identities remain inspectable; the artwork is only their presentation.
 const upper=new Set(['床','床头柜','书架','盆栽','挂画']);
 for(const item of room.items){const level=upper.has(item.name)?2:1,g=el('g',{'data-room-item':item.id,'data-object-floor':level});g.append(el('title',{},`${item.name}${item.state?' · '+item.state:''}`));floors[level].append(g);}
 const extraActions=[['read','书架翻书'],['enchant','附魔练习'],['garden','照料小麦'],['rest','露台歇脚']];
 const vector=(value,length)=>Array.isArray(value)&&value.length===length&&value.every(Number.isFinite);
 const upstairs=extraActions.every(([mode])=>{const a=house.actions[mode];return a?.floor===2&&Array.isArray(a.frames)&&a.frames.length>0&&a.frames.every(url=>typeof url==='string'&&url.length>0)&&vector(a.clip,4)&&a.clip[2]>0&&a.clip[3]>0&&vector(a.head,2)&&vector(a.feet,2);});
 const failedActions=new Set(),hotspots={};
 svg.roomActions=upstairs?extraActions:[];
 const activityAt=time=>{const a=roomActivity(room,visual.night,visual.jobs,visual.preview,time,{upstairs});return failedActions.has(a.mode)?roomActivity(room,visual.night,visual.jobs,'auto',time):a;};
 let visual={night,jobs,preview},elapsed=0,origin=null,floor='1',detail=false,currentMode=null,lastSource=null,patUntil=0,journey=null,travelling=false,lastNotice='',residentLevel='1',follow=true,departure=null,lifeClock=0,lastPaint=0,route=null,camera=null,previousPortal=null,wanderUntil=0;
 const requestFrame=animation.requestFrame||globalThis.requestAnimationFrame?.bind(globalThis),reduced=animation.reducedMotion??globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
 const portal=el('g',{'data-stair-handoff':true,display:'none','pointer-events':'none'}),portalFloors={};for(const level of[1,2]){const g=el('g');floorArt(g,level);portal.append(g);portalFloors[level]=g;}svg.append(portal);
 const resident=el('g',{'data-room-resident':'dafeiyu',class:'room-resident'});svg.append(resident);
 // Contact patches include the real chair front/desk/duvet in their original
// coordinates. Never float a front-facing upper body over a back-facing desk.
 for(const[mode,asset]of Object.entries(house.actions)){
  if(extraActions.some(([m])=>m===mode)&&!upstairs)continue;
  const g=el('g',{'data-room-pose':mode,'data-resident-floor':asset.floor,'data-contact':asset.contact,transform:`translate(${asset.offset?.[0]||0},${offsets[asset.floor]+(asset.offset?.[1]||0)})`});
  if(mode==='read')g.append(el('ellipse',{cx:736,cy:544,rx:22,ry:5,fill:'#493824',opacity:'.16'}));
  const region=el('g',{'clip-path':clip('room-art-'+mode,asset.shape||asset.clip)}),base=image(asset.frames[0]);region.append(base);g.append(region);resident.append(g);poses[mode]=g;
  if(extraActions.some(([m])=>m===mode))base.addEventListener('error',()=>{
   failedActions.add(mode);svg.roomActions=extraActions.filter(([m])=>!failedActions.has(m));
   hotspots[mode]?.setAttribute('aria-disabled','true');hotspots[mode]?.setAttribute('tabindex','-1');
   if(visual.preview===mode)visual.preview='auto';lastNotice='';paint(elapsed);
  });
  if(asset.frames.length>1){
   const handRect=mode==='type'?[832,365,48,31]:[830,369,48,39],hand=el('g',{'clip-path':clip('room-art-'+mode+'-hands',handRect),opacity:0,'data-contact-animation':mode}),alternate=image(undefined);hand.append(alternate);g.append(hand);frames[mode]={hand,alternate,asset};
  }
 }
 const walkPose=el('g',{'data-room-pose':'walk','data-resident-floor':1});resident.append(walkPose);poses.walk=walkPose;
 walkPose.append(el('ellipse',{cx:0,cy:1,rx:23,ry:6,fill:'#493824',opacity:'.22'}));
 const walkAsset=actionAssets.walk,walkSheet=el('svg',{x:-107.8,y:-186.1,width:184,height:189.8,viewBox:walkAsset.frames[0].join(' '),overflow:'hidden','data-complete-action':'walk'});walkSheet.append(el('image',{href:walkAsset.url,x:0,y:0,width:walkAsset.width,height:walkAsset.height}));walkPose.append(walkSheet);
 const standing=el('image',{x:-285*219.5/412,y:-285*344/412+9.7,width:285,height:285*344/412,preserveAspectRatio:'xMidYMax meet','data-walk-pose':'standing'});walkPose.append(standing);
 // Foreground clips follow the actual furniture silhouette. A rectangle of
 // floor pixels must never erase the resident's body above a fence.
 const occluders=[];
 const foreground=(name,level,polygons,when,url)=>{const c=el('clipPath',{id:'room-front-'+name,clipPathUnits:'userSpaceOnUse'});for(const points of polygons)c.append(el('polygon',{points}));defs.append(c);const g=el('g',{'data-room-foreground':name,'clip-path':`url(#room-front-${name})`,transform:`translate(0,${offsets[level]})`,'pointer-events':'none',display:'none'});g.append(image(url||house.floors[level]));resident.append(g);occluders.push({g,level,when});};
 foreground('sofa',1,['680,578 746,554 789,543 823,541 884,653 929,720 925,768 787,807 735,756 680,626'],p=>p.x>620&&p.x<965&&p.y<640);
 foreground('chair',1,['847,426 869,432 888,377 948,369 972,400 975,473 956,495 959,527 944,535 925,510 902,539 886,536 891,516 913,489 868,480 850,462'],p=>p.x>790&&p.x<995&&p.y<521);
 foreground('lower-rail',1,['1128,446 1155,437 1230,526 1229,578 1201,586 1127,512'],p=>p.x>1165&&p.y<650,house.repairs?.[1]?.url);
 foreground('entry-lantern',1,['1118,763 1145,749 1168,769 1167,835 1143,850 1119,832'],p=>p.x>1085&&p.y<812,house.repairs?.[1]?.url);
 foreground('greenhouse-rail',2,['955,495 1318,456 1324,503 958,549','1066,485 1080,477 1092,486 1092,537 1077,542 1067,532','1175,472 1188,464 1202,471 1202,521 1187,526 1176,518'],p=>p.x>953&&p.x<1310&&p.y<543,house.repairs?.[2]?.url);
 foreground('upper-gate-post',2,['772,477 787,467 803,474 805,515 792,523 776,512'],p=>p.x>765&&p.x<910&&p.y<558,house.repairs?.[2]?.url);
 const upstairsControls=el('g',{'data-upstairs-controls':true});svg.append(upstairsControls);
 const hotspotDefs={
  read:{label:'书架：翻书',rect:[575,283,108,190],mark:[641,289]},
  enchant:{label:'附魔台：附魔练习',rect:[359,350,186,153],mark:[391,432]},
  garden:{label:'小麦温室：照料小麦',rect:[894,311,415,215],mark:[1253,363]},
  rest:{label:'露台：坐下歇脚',rect:[967,650,305,105],mark:[1211,714]}
 };
 if(upstairs)for(const [i,[mode,label]]of extraActions.entries()){
  const def=hotspotDefs[mode],g=el('g',{'data-room-hotspot':mode,role:'button',tabindex:0,'aria-label':def.label,class:'room-upstairs-hotspot'});
  g.append(el('title',{},def.label),el('rect',{x:def.rect[0],y:def.rect[1],width:def.rect[2],height:def.rect[3],rx:12,class:'room-hotspot-zone',fill:'transparent'}),el('circle',{cx:def.mark[0],cy:def.mark[1],r:17,class:'room-hotspot-dot'}),el('text',{x:def.mark[0],y:def.mark[1]+6,'text-anchor':'middle','font-size':17,'font-weight':700,'pointer-events':'none'},String(i+1)));
  const caption=el('g',{class:'room-hotspot-caption','pointer-events':'none'});caption.append(el('rect',{x:def.mark[0]-61,y:def.mark[1]-59,width:122,height:31,rx:9}),el('text',{x:def.mark[0],y:def.mark[1]-37,'text-anchor':'middle','font-size':16},label));g.append(caption);
  hotspots[mode]=g;const select=()=>{if(!failedActions.has(mode))svg.setRoomActivity({preview:mode});};g.addEventListener('click',select);g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});upstairsControls.append(g);
 }
 const effects=el('g',{'data-upstairs-effects':true,'pointer-events':'none'});resident.append(effects);
 const sparkles=[];for(let i=0;i<6;i++){const star=el('path',{d:'M-4,0 H4 M0,-4 V4',stroke:'#dcacff','stroke-width':2,fill:'none'});effects.append(star);sparkles.push(star);}
 const page=el('path',{fill:'#fff9da',stroke:'#c6a879','stroke-width':.7}),droplets=[];effects.append(page);
 for(let i=0;i<4;i++){const drop=el('ellipse',{rx:1.9,ry:3.2,fill:'#b5f0ff'});effects.append(drop);droplets.push(drop);}
 const leaf=el('path',{d:'M-7,0 Q0,-8 8,0 Q0,7 -7,0',fill:'#abd08b',opacity:.7});effects.append(leaf);
 const controls=el('g',{'data-house-controls':true,transform:'translate(0,1080)'});svg.append(controls);
 const curtain=el('g',{'data-curtain-overlay':true,display:room.curtain?'none':'inline'});controls.append(curtain);
 curtain.append(el('polygon',{points:'723,206 997,167 997,259 723,310',fill:'#778eae',stroke:'#57728f','stroke-width':2}));
 for(let x=730;x<1000;x+=15)curtain.append(el('path',{d:`M${x},${206-(x-723)*.142} v95`,fill:'none',stroke:x%2?'#9aafc8':'#617d9d','stroke-width':4,opacity:'.65'}));
 const lampState=el('g',{'data-lamp-overlay':true,display:room.lamp?'none':'inline'});lampState.append(el('polygon',{points:'737,335 757,331 764,362 740,371',fill:'#b89458',opacity:'.85'}));controls.append(lampState);
 const control=(kind,label,rect,fn)=>{const g=el('g',{'data-room-control':kind,role:'button',tabindex:0,'aria-label':label,class:'room-art-control'});g.append(el('title',{},label),el('rect',{x:rect[0],y:rect[1],width:rect[2],height:rect[3],fill:'transparent',rx:5}));g.addEventListener('click',()=>fn?.());g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn?.();}});controls.append(g);};
 control('curtain',room.curtain?'合上窗帘':'拉开窗帘',[692,164,344,150],onCurtain);
 control('lamp',room.lamp?'关闭台灯':'打开台灯',[730,320,42,57],onLamp);
 const interaction=el('g',{role:'button',tabindex:0,'aria-label':'摸摸大肥鱼',class:'room-resident room-art-pat'}),hit=el('ellipse',{rx:62,ry:54,fill:'transparent'}),heart=el('text',{'font-size':27,fill:'#ffa8be','text-anchor':'middle',opacity:0,'pointer-events':'none'},'♥');interaction.append(hit,heart);svg.append(interaction);

 const syncVisibility=()=>{
  const crossing=Boolean(route?.transition&&follow);
  for(const[level,g]of Object.entries(floors)){const visible=!crossing&&(floor==='all'||floor===level);g.setAttribute('display',visible?'inline':'none');g.setAttribute('aria-hidden',String(!visible));}
  const visible=crossing||floor==='all'||floor===residentLevel;
  resident.setAttribute('display',visible?'inline':'none');interaction.setAttribute('display',visible?'inline':'none');
  controls.setAttribute('display',crossing||floor==='2'?'none':'inline');upstairsControls.setAttribute('display',crossing||floor==='1'?'none':'inline');
 };
 const updateView=(dt=1000,force=false)=>{
  const centers={type:[900,390],write:[900,390],sleep:[420,640],lounge:[750,650],walk:[1020,610],read:[730,470],enchant:[495,420],garden:[1090,500],rest:[1090,670]};
  let target=floor==='all'?[0,0,1536,2104]:[0,offsets[floor],1536,1024];
  if(route?.transition&&follow){const p=route.transition.from;target=[p.x-380,p.y+offsets[p.floor]-330,760,507];}
  else if(travelling&&(follow||detail)&&route?.kind==='stairs')target=[route.x-380,route.y+offsets[route.floor]-330,760,507];
  else if(detail){const center=travelling?[route.x,route.y-80]:(centers[currentMode]||centers.walk);target=[center[0]-325,center[1]+offsets[residentLevel]-216.5,650,433];}
  const alpha=force||!camera||dt>1000?1:1-Math.exp(-Math.max(0,dt)/180);camera=camera?camera.map((v,i)=>v+(target[i]-v)*alpha):target;
  svg.setAttribute('viewBox',camera.join(' '));svg.setAttribute('data-room-detail',String(detail));
 };
 const setFloor=(value,preserveDetail=false)=>{if(!['all','1','2'].includes(String(value)))return;floor=String(value);follow=false;if(!preserveDetail||floor==='all')detail=false;updateView(1000,true);svg.setAttribute('data-room-floor',floor);syncVisibility();onFloor?.(floor,{detail});};
 const paint=time=>{
  const dt=Math.max(0,time-lastPaint);lastPaint=time;
  // The leisure clock pauses during a trip, so a long climb gets to finish.
  if(!travelling||currentMode==='walk')lifeClock+=dt;
  const activity=activityAt(lifeClock),mode=activity.mode,isUpper=extraActions.some(([m])=>m===mode),changed=mode!==currentMode;
  if(changed){
   if(!journey){journey=createRoomJourney(roomNavigation(mode));journey.go(mode,time);}
   else if(!reduced){
    const wasContact=!travelling&&currentMode!=='walk';departure=departure&&time<departure.until?departure:wasContact?{mode:currentMode,at:time,until:time+240}:null;
    journey.go(mode,departure?.until||time);
   }
   if(reduced){journey=createRoomJourney(roomNavigation(mode));journey.go(mode,time);}
   currentMode=mode;wanderUntil=0;
  }
  lastSource=activity.source;route=journey.sample(time);
  if(mode==='walk'&&!reduced&&route.arrived){
   if(!wanderUntil)wanderUntil=time+650;
   if(time>=wanderUntil){journey.go(route.target==='wanderFront'?'wanderBack':'wanderFront',time);route=journey.sample(time);wanderUntil=0;}
  }
  travelling=!reduced&&(!route.arrived||Boolean(departure&&time<departure.until));
  if(previousPortal&&!route.transition&&camera){const p=previousPortal;camera[0]+=p.to.x-p.from.x;camera[1]+=p.to.y+offsets[p.to.floor]-p.from.y-offsets[p.from.floor];}
  previousPortal=follow?route.transition:null;
  residentLevel=String(route.transition?.from.floor||route.floor);
  if((follow||changed&&reduced)&&floor!=='all'&&floor!==residentLevel){floor=residentLevel;onFloor?.(floor,{detail});}
  svg.setAttribute('data-room-floor',floor);svg.setAttribute('data-room-activity',mode);svg.setAttribute('data-room-source',activity.source);svg.setAttribute('data-resident-travel',String(travelling));svg.setAttribute('data-resident-level',residentLevel);svg.setAttribute('data-travel-kind',route.kind);svg.setAttribute('data-travel-arrives',route.arrivesAt);
  const transition=route.transition;portal.setAttribute('display',transition&&follow?'inline':'none');
  if(transition){const {from,to,progress}=transition;for(const[level,g]of Object.entries(portalFloors)){const old=Number(level)===from.floor;g.setAttribute('opacity',old?1-progress:progress);g.setAttribute('transform',old?'translate(0,'+offsets[from.floor]+')':'translate('+(from.x-to.x)+','+(from.y+offsets[from.floor]-to.y)+')');}svg.setAttribute('data-stair-progress',transition.progress);}
  else svg.setAttribute('data-stair-progress','');
  const departing=departure&&time<departure.until;
  const displayed=departing&&time<departure.at+120?departure.mode:travelling?'walk':mode;
  for(const[k,g]of Object.entries(poses))g.setAttribute('display',k===displayed?'inline':'none');
  let opacity=1;
  if(departing)opacity=time<departure.at+120?1-(time-departure.at)/120:(time-departure.at-120)/120;
  else if(!travelling&&mode!=='walk'&&time-route.arrivesAt<220&&route.arrivesAt>0)opacity=Math.max(0,(time-route.arrivesAt)/220);
  resident.setAttribute('opacity',opacity);svg.setAttribute('data-resident-phase',departing?'departing':travelling?'travelling':'contact');
  const movementLabel=transition?(transition.to.floor>transition.from.floor?'沿楼梯上到二楼…':'沿楼梯回到一楼…'):route.kind==='stairs'?(route.ascending?'一步一步上台阶…':'一步一步下台阶…'):'正在走向'+({sleep:'床边',type:'电竞椅',write:'书桌',lounge:'沙发',read:'书架',enchant:'附魔台',garden:'温室',rest:'露台',walk:'过道'}[mode])+'…';
  const notice=[mode,activity.source,visual.preview,travelling,route.kind,residentLevel].join(':');
  if(notice!==lastNotice){lastNotice=notice;onActivity?.({...activity,preview:visual.preview,availableActions:svg.roomActions.map(([m])=>m),moving:travelling,target:mode,label:travelling?movementLabel:activity.label});}
  syncVisibility();updateView(dt,reduced);
  const visible=Boolean(transition&&follow)||floor==='all'||floor===residentLevel;if(!visible)return;
  const position=transition?{...transition.from,moving:false,frame:null,facing:1}:route;
  let head=hitPoints[mode]||[position.x,position.y-150],offset=offsets[residentLevel];
  for(const mask of occluders)mask.g.setAttribute('display',displayed==='walk'&&!transition&&mask.level===Number(residentLevel)&&mask.when(position)?'inline':'none');
  if(displayed==='walk'){
   const stepping=position.kind==='stairs',moving=position.moving&&!departing;
   walkPose.setAttribute('data-resident-floor',residentLevel);
   // Use the same complete walking cycle on the stairs: four phases per
   // tread, then the opposite leg. Keep facing stable through the curve.
   const facing=stepping?(position.ascending?-1:1):position.facing;
   walkPose.setAttribute('transform','translate('+position.x+','+(position.y+offset)+') scale('+(moving?facing:1)+',1)');
   walkSheet.setAttribute('display',moving?'inline':'none');standing.setAttribute('display',!moving?'inline':'none');
   if(moving)walkSheet.setAttribute('viewBox',walkAsset.frames[position.frame].join(' '));
   else{const idle=time<patUntil?(petAssets.head_pat||petAssets.idle):petAssets.idle;if(idle?.frames?.length)standing.setAttribute('href',idle.frames[reduced?0:Math.floor(time/idle.frameMs)%idle.frames.length]);else{walkSheet.setAttribute('display','inline');walkSheet.setAttribute('viewBox',walkAsset.frames[1].join(' '));}}
   svg.setAttribute('data-walk-moving',String(moving));svg.setAttribute('data-walk-frame',moving?position.frame:'standing');svg.setAttribute('data-resident-feet',position.x+','+position.y);head=[position.x,position.y-153];
  }
  const loop=frames[displayed];if(loop){const phase=reduced?0:Math.floor(time/loop.asset.frameMs)%2;loop.alternate.setAttribute('href',loop.asset.frames[1]);loop.hand.setAttribute('opacity',phase);loop.hand.setAttribute('data-animation-phase',phase);}
  effects.setAttribute('display',isUpper&&!travelling?'inline':'none');const phase=reduced?0:time/1000;
  sparkles.forEach((star,i)=>{star.setAttribute('display',mode==='enchant'?'inline':'none');star.setAttribute('transform','translate('+(422+i*14)+','+(345+(i%3)*19-Math.sin(phase*2+i)*12)+')');star.setAttribute('opacity',.4+.5*Math.abs(Math.sin(phase+i)));});
  page.setAttribute('display',mode==='read'?'inline':'none');page.setAttribute('transform','translate('+(house.actions.read?.offset||[0,0]).join(',')+')');page.setAttribute('d','M701,455 Q'+(710+Math.sin(phase)*8)+',442 727,465 L726,471 Q711,453 701,455');page.setAttribute('opacity',reduced?0:.2+.45*Math.max(0,Math.sin(phase*.7)));
  droplets.forEach((drop,i)=>{const d=(phase*1.2+i*.25)%1;drop.setAttribute('display',mode==='garden'?'inline':'none');drop.setAttribute('cx',1036-d*18);drop.setAttribute('cy',389+d*24);drop.setAttribute('opacity',reduced?.5:1-d);});
  leaf.setAttribute('display',mode==='rest'?'inline':'none');leaf.setAttribute('transform','translate('+(1200+Math.sin(phase*.6)*25)+','+(645+Math.sin(phase)*12)+') rotate('+phase*9+')');
  hit.setAttribute('cx',head[0]);hit.setAttribute('cy',head[1]+offset);heart.setAttribute('x',head[0]);heart.setAttribute('y',head[1]+offset-64);heart.setAttribute('opacity',time<patUntil?'1':'0');resident.setAttribute('data-pet-state',time<patUntil?'head_pat':'idle');
 };
 svg.setRoomFloor=setFloor;svg.setRoomDetail=value=>{detail=Boolean(value);follow=true;floor=residentLevel;updateView(1000,true);svg.setAttribute('data-room-floor',floor);syncVisibility();onFloor?.(floor,{detail});return detail;};
 svg.setRoomActivity=patch=>{visual={...visual,...patch};if(Object.hasOwn(patch,'preview')){follow=true;if(floor!=='all'&&floor!==residentLevel){floor=residentLevel;onFloor?.(floor,{detail});}}paint(elapsed);};
 const pat=()=>{patUntil=elapsed+900;paint(elapsed);};interaction.addEventListener('click',pat);interaction.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pat();}});
 const tick=time=>{if(!resident.isConnected)return;if(origin===null)origin=time;elapsed=time-origin;paint(elapsed);requestFrame(tick);};
 paint(0);updateView(1000,true);if(requestFrame&&!reduced)requestFrame(tick);return svg;
}
