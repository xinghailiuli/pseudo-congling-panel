import {installRoomLeisureV20} from './room-contact-v20.mjs';
// Calibrated full-body poses. Coordinates are in the existing 1536x1024 floor art.
export function createRoomLifeDefinitions(geometry) {
 const defs={},step=(pose,duration=180,move=false)=>({pose,duration,move});
 const make=(mode,atlas,height=190)=>{
  const def={poses:{},entry:[],variations:[],exits:{},still:null};defs[mode]=def;
  const reference={sofa:0,garden:2,bed:0,desk:0,upper:6,walk:0,carry:0,cover:0,'sofa-rest':0};
  const add=(id,cell,at,support='feet',pivot=[.5,.98],extra={})=>{
   const name=extra.atlas||atlas,g=geometry[name],frame=g?.frames[cell];if(!frame)throw new TypeError('Missing full character: '+name+'/'+cell);
   const crop=frame.crop,scale=height/geometry[name].frames[reference[name]].crop[3];
   def.poses[id]={atlas:name,cell,at:[...at],support,prop:null,pivot:[crop[0]+crop[2]*pivot[0],crop[1]+crop[3]*pivot[1]],scale,head:[crop[0]+crop[2]*.5,crop[1]+crop[3]*.22],...extra};return id;
  };return {def,add};
 };
 const sequence=(ids,duration=180)=>ids.map(id=>step(id,duration));
 const route=(add,prefix,points,prop=null,carried=false)=>{
  const positions=[points[0]];
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],count=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/7.75);for(let n=1;n<=count;n++)positions.push(a.map((v,j)=>v+(b[j]-v)*n/count));}
  const forward=[],backward=[];
  positions.forEach((at,i)=>{
   const frame=carried?i%8+(prop==='hoe'?8:0):i%8,atlas=carried?'carry':'walk',next=positions[Math.min(i+1,positions.length-1)],facing=next[0]>=at[0]?1:-1;
   forward.push(add(prefix+'-'+i,frame,at,'feet',[.48,.98],{atlas,prop,flip:carried?-facing:facing,route:prefix,routeIndex:i}));
   backward.push(add(prefix+'-back-'+i,frame,at,'feet',[.48,.98],{atlas,prop,flip:carried?facing:-facing,route:prefix,routeIndex:i}));
  });
  return {positions,forward,backward,steps:forward.map(id=>step(id,86,true)),backSteps:index=>backward.slice(0,index+1).reverse().map(id=>step(id,86,true))};
 };
 {
  const {def,add}=make('lounge','sofa');
  add('stand',0,[676,722]);add('lower',1,[684,722],'feet',[.48,.97]);
  for(const i of [2,4,5,6,7,8,9,11,12])add('s'+i,i,[755,674],'hips',[.51,.76],{prop:i>=4&&i<=9?'snack':null});
  add('s3',3,[750,675],'hips',[.75,.72]);add('s10',10,[750,675],'hips',[.75,.72],{prop:'snack'});
  add('s13',13,[764,674],'hips',[.52,.75]);add('s14',14,[780,674],'cushion',[.58,.78]);
  for(const i of [15,16,17])add('s'+i,i,[790,675],'cushion',[.62,.72]);
  add('s18',18,[776,671],'cushion',[.58,.74]);add('s19',19,[764,669],'elbows',[.42,.76]);
  for(const i of [20,21,22,23])add('s'+i,i,[755,670],'elbows',[.27,.81]);
  // The corrected sheet follows the sofa's far-left to near-right long axis.
  // Rotate around its supported hip/elbow anchor; never rotate around the head.
  if(geometry['sofa-rest'])for(const [id,cell]of Object.entries({s14:8,s15:0,s16:1,s17:2,s18:10,s19:11,s20:4,s21:6,s22:7,s23:5})){
   const support=Number(id.slice(1))>=18?'elbows':'cushion';
   add(id,cell,[767,662],support,[.60,.66],{atlas:'sofa-rest',scale:.46,rotation:25});
   const p=def.poses[id],crop=geometry['sofa-rest'].frames[cell].crop;p.head=[crop[0]+crop[2]*.25,crop[1]+crop[3]*.34];
  }
  def.still='s2';def.entry=sequence(['stand','lower','s2'],380);
  def.variations=[
   {name:'坐稳歇一会，偶尔吃一口零食',frames:[step('s2',15000),step('s4',2200),...sequence(['s5','s6','s7'],800),step('s8',1400),step('s9',5500),...sequence(['s6','s7'],900),step('s8',1500),step('s9',5500),step('s4',1400),step('s11',6500)]},
   {name:'沿着沙发侧躺休息',frames:[...sequence(['s12','s13','s14','s15'],650),step('s16',20000),step('s17',6500),step('s16',18000)]},
   {name:'沿着坐垫趴一会，偶尔动动脚',frames:[...sequence(['s18','s20'],700),step('s23',12000),step('s21',1000),step('s23',10000),step('s22',1000),step('s23',14000),...sequence(['s20','s19','s15','s14','s13','s12'],450)]}
  ];
  const seated=['lower','stand'],up=['s14','s13','s12',...seated];
  for(const id of Object.keys(def.poses)){
   const i=Number(id.slice(1));let exit=id==='stand'?[]:id==='lower'?['stand']:id==='s3'?['s2',...seated]:id==='s10'?['s11',...seated]:i>=4&&i<=9?['s8','s9','s4','s11',...seated]:i>=18?['s20','s19','s18','s15',...up]:i>=15?up:i===14?['s13','s12',...seated]:i===13?['s12',...seated]:seated;
   def.exits[id]=sequence(exit,360);
  }
 }
 {
  const {def,add}=make('garden','garden'),home=[1120,563],tool=[1045,555],gate=[1124,548],near=[1116,510],far=[1074,408];
  add('home',23,home);add('tool-empty',13,tool);
  const approach=route(add,'approach',[home,tool]),paths={};
  for(const prop of ['can','hoe',null]){
   const key=prop||'empty',r=route(add,key,[tool,gate,near,far],prop,Boolean(prop));paths[key]=r;
  }
  for(const [name,at]of [['tool',tool],['far',far],['near',near]]){
   for(const cell of [0,1,2,6,7,8,9,10,11,12])add(name+'-can-'+cell,cell,at,'feet',[.48,.98],{prop:'can',flip:name==='near'?-1:1});
   for(const cell of [14,15,16,17])add(name+'-hoe-'+cell,cell,at,'feet',[.48,.98],{prop:'hoe'});
   for(const cell of [18,19,20,21,22,23])add(name+'-weed-'+cell,cell,at,'feet',[.48,.98],{prop:cell===20?'weed':null});
  }
  const nearIndex=paths.can.positions.findIndex(p=>p[0]===near[0]&&p[1]===near[1]);
  const homeward=approach.backSteps(approach.positions.length-1),back=r=>r.backSteps(r.positions.length-1);
  const putCan=[...sequence(['tool-can-12','tool-can-0','tool-empty'],400)];
  const putHoe=sequence(['tool-hoe-16','tool-hoe-14','tool-empty'],400);
  def.still='home';def.entry=[step('home',180),...approach.steps,step('tool-empty',180)];
  def.variations=[
   {name:'提壶进入菜园，慢慢浇透土壤',frames:[...sequence(['tool-can-0','tool-can-1','tool-can-2'],550),...paths.can.steps,...sequence(['far-can-6','far-can-7','far-can-8'],650),step('far-can-9',10000),...sequence(['far-can-10','far-can-11'],650),...paths.can.backward.slice(nearIndex).reverse().map(id=>step(id,86,true)),...sequence(['near-can-6','near-can-7','near-can-8'],650),step('near-can-9',8000),...sequence(['near-can-10','near-can-11'],650),...paths.can.backSteps(nearIndex),...putCan,step('tool-empty',3500)]},
   {name:'扶稳小锄头，一下一下松土',frames:[...sequence(['tool-hoe-14','tool-hoe-15'],600),...paths.hoe.steps,step('far-hoe-14',3500),...sequence(['far-hoe-15','far-hoe-16','far-hoe-17'],1200),step('far-hoe-14',5000),...sequence(['far-hoe-15','far-hoe-16','far-hoe-17'],1200),step('far-hoe-14',4000),...back(paths.hoe),...putHoe,step('tool-empty',3500)]},
   {name:'蹲下来仔细拔掉杂草',frames:[...paths.empty.steps,step('far-weed-18',900),...sequence(['far-weed-19','far-weed-20','far-weed-21'],1800),step('far-weed-19',6000),...sequence(['far-weed-20','far-weed-21'],1800),step('far-weed-19',5000),...sequence(['far-weed-22','far-weed-23'],700),...back(paths.empty),step('tool-empty',3500)]}
  ];
  const indexFor=(r,at)=>r.positions.reduce((best,p,i)=>Math.hypot(p[0]-at[0],p[1]-at[1])<Math.hypot(r.positions[best][0]-at[0],r.positions[best][1]-at[1])?i:best,0);
  for(const [id,pose]of Object.entries(def.poses)){
   if(id==='home'){def.exits[id]=[];continue;}
   if(pose.route==='approach'){def.exits[id]=[...approach.backSteps(pose.routeIndex),step('home',120)];continue;}
   const prop=pose.prop,key=prop==='can'?'can':prop==='hoe'?'hoe':'empty',r=paths[key],idx=indexFor(r,pose.at);
   const weed=id.includes('-weed-')&&pose.cell<23?[...(prop==='weed'?[step((pose.at[1]<500?'far':'near')+'-weed-21',180)]:[]),step((pose.at[1]<500?'far':'near')+'-weed-22',180),step((pose.at[1]<500?'far':'near')+'-weed-23',180)]:[];
   const place=pose.at[1]<500?'far':pose.at[1]<540?'near':'tool';
   const lower=prop==='can'&&!pose.route&&pose.cell>=6&&pose.cell<=9?sequence([place+'-can-10',place+'-can-11'],180):prop==='hoe'&&!pose.route?sequence([place+'-hoe-14'],180):[];
   def.exits[id]=[...lower,...weed,...r.backSteps(idx),...(prop==='can'?putCan:prop==='hoe'?putHoe:[]),...homeward,step('home',120)];
  }
 }
 for(const mode of ['type','write']){
  const {def,add}=make(mode,'desk');
  add('stand',23,[1008,531],'feet',[.48,.98]);add('closer',0,[972,496],'feet',[.48,.98]);add('lower',1,[925,475],'feet',[.4,.98]);
  const chairApproach=route(add,'chair-approach',[[1008,531],[982,510],[972,496]]);
  for(let i=2;i<=21;i++)add('d'+i,i,[912,421],'hips',[.48,.84],{prop:mode==='write'&&i>=13&&i<=17?'pen':null});
  add('rise',22,[925,475],'feet',[.48,.98]);
  def.still=mode==='type'?'d5':'d13';def.entry=[step('stand',180),...chairApproach.steps,step('closer',180),step('lower',180),step('d2',180),step(def.still,180)];
  def.seatedEntry=sequence(mode==='write'?['d12','d13']:['d3','d4','d5'],160);def.seatedExits={};
  for(const [id,pose]of Object.entries(def.poses))if(pose.support==='hips')def.seatedExits[id]=sequence([mode==='write'?'d12':'d18'],180);
  const typing=()=>[step('d5',1800),...sequence(['d6','d7','d8'],650),step('d9',850),step('d11',1800)];
  const writing=()=>[step('d13',2300),step('d14',1200),step('d17',1500)];
  def.variations=mode==='type'?[{name:'坐稳敲键盘，偶尔停下来看看屏幕',frames:[...Array.from({length:5},typing).flat(),step('d10',6000),...Array.from({length:3},typing).flat()]},{name:'歇一下，放松肩膀',frames:[step('d18',3500),step('d19',900),step('d20',3000),step('d21',900),step('d5',4000)]}]:[{name:'压住纸页，慢慢写完这一段',frames:[...Array.from({length:6},writing).flat(),step('d15',8000),step('d16',2000),...Array.from({length:4},writing).flat()]},{name:'放下笔休息片刻',frames:[step('d12',1500),step('d18',6000),step('d20',2500),step('d21',900),step('d13',2000)]}];
  const chairBack=chairApproach.backSteps(chairApproach.positions.length-1);
  for(const [id,pose]of Object.entries(def.poses))def.exits[id]=id==='stand'?[]:pose.route?[...chairApproach.backSteps(pose.routeIndex),step('stand',120)]:[...(id==='closer'?[]:id==='lower'||id==='rise'?sequence(['closer']):sequence([...(pose.prop==='pen'?['d12']:[]),'d18','rise','closer'],180)),...chairBack,step('stand',120)];
 }
 {
  const {def,add}=make('sleep','bed');
  add('stand',23,[581,611]);add('edge',0,[575,648]);add('lower',1,[578,658]);
  const bedApproach=route(add,'bed-approach',[[581,611],[575,648]]);
  for(const i of [2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22]){
   const covered=i>=7&&i<=21,pivot=covered?[.48,.72]:[.55,.80],at=covered?[386,679]:i<=4?[476,655]:[405,650];
   add('b'+i,i,at,covered?'bed':'hips',pivot,{prop:covered?'quilt':null,headFraction:covered?[.45,.22]:undefined});
  }
  def.poses.b2.at=[517,655];def.poses.b3.at=[499,655];def.poses.b22.at=[517,655];
  // Use a bare lying character on the room's actual pillow. The old cover
  // atlas contains another pillow/duvet and cannot be composited onto this bed.
  if(geometry['sofa-rest'])for(const id of ['b7','b8','b9','b10','b11','b12','b13','b14','b15','b16','b17','b18','b19','b20','b21']){
   add(id,['b7','b8','b18','b19','b20','b21'].includes(id)?0:1,[323,625],'bed',[.25,.45],{atlas:'sofa-rest',scale:.48,rotation:-20,prop:'quilt'});
  }
  def.poses.b5.at=[405,644];def.poses.b6.at=[365,632];
  if(geometry['bed-entry']){
   const entries={b2:[0,489,565,0],b3:[1,460,575,0],b4:[2,422,583,0],b5:[3,383,598,0],b6:[4,339,615,0],b7:[4,325,621,.2],b8:[4,325,621,.6],b9:[5,325,621,1],b10:[5,325,621,1],b11:[6,325,621,1],b12:[5,325,621,1],b13:[6,325,621,1],b14:[6,325,621,1],b15:[5,325,621,1],b16:[5,325,621,1],b17:[5,325,621,1],b18:[4,325,621,1],b19:[7,383,598,.3],b20:[2,422,583,0],b21:[1,460,575,0],b22:[0,489,565,0]};
   for(const[id,[cell,x,y,cover]]of Object.entries(entries)){
    const atlas=geometry['bed-entry'],f=atlas.frames[cell];
    def.poses[id]={atlas:'bed-entry',cell,bedCell:cell,at:[x,y],support:cell>=4&&cell<=6?'bed':'hips',prop:cover?'quilt':null,pivot:[...f.head],head:[...f.head],scale:188/atlas.referenceHeight,cover};
   }
  }
  def.still='b10';def.entry=[step('stand',180),...bedApproach.steps,...sequence(['edge','lower','b2','b3','b4','b5','b6','b7','b8','b9'],650)];
  def.variations=[{name:'盖好被子，安静睡一会',frames:[step('b10',18000),step('b11',13000),step('b12',18000)]},{name:'轻轻翻身，继续睡觉',frames:[...sequence(['b13','b14','b15','b16'],800),step('b17',20000),step('b16',15000),step('b10',15000)]}];
  const bedBack=bedApproach.backSteps(bedApproach.positions.length-1);
  for(const [id,pose]of Object.entries(def.poses))def.exits[id]=id==='stand'?[]:pose.route?[...bedApproach.backSteps(pose.routeIndex),step('stand',120)]:[...(id==='edge'?[]:id==='lower'?sequence(['edge']):sequence([...(pose.support==='bed'?['b18','b19','b20','b21']:['b4','b3','b2']),'b22','lower','edge'],400)),...bedBack,step('stand',120)];
 }
 for(const mode of ['read','enchant','rest']){
  const {def,add}=make(mode,'upper'),base=mode==='read'?[704,535]:mode==='enchant'?[548,510]:[1102,736];
  add('stand',6,base);add('lower',23,mode==='rest'?[1120,740]:base,'feet',[.48,.98]);
  if(mode==='read'){
   for(let i=0;i<6;i++)add('u'+i,i,base,'feet',[.48,.98],{prop:'book'});
   def.still='u2';def.entry=sequence(['stand','u0','u1'],450);def.variations=[{name:'读完这一页，再慢慢翻过去',frames:[step('u2',14000),step('u3',800),step('u4',18000),step('u2',16000),step('u3',800),step('u4',18000)]}];
   for(const id of Object.keys(def.poses))def.exits[id]=id==='stand'?[]:sequence(['u5','stand'],220);
  }else if(mode==='enchant'){
   for(let i=6;i<12;i++)add('u'+i,i,base,'feet',[.48,.98],{prop:i>=8&&i<=10?'crystal':null});
   def.still='u7';def.entry=sequence(['stand','u7'],450);def.variations=[{name:'看一会书，再试一次小魔法',frames:[step('u7',14000),step('u8',1500),step('u9',5500),step('u10',1500),step('u11',16000)]}];
   for(const [id,pose]of Object.entries(def.poses))def.exits[id]=id==='stand'?[]:sequence(pose.prop?['u10','u11','stand']:['u11','stand'],200);
  }else{
   for(let i=12;i<=22;i++)add('u'+i,i,[1140,661],'hips',[.51,.77],{prop:i>=13&&i<=17?'cup':null});
   def.still='u12';def.entry=sequence(['stand','lower','u12'],450);
   def.variations=[{name:'坐着看看风景，偶尔喝一口水',frames:[step('u12',25000),step('u13',800),step('u14',1600),step('u15',2200),step('u16',900),step('u17',900),step('u18',20000)]},{name:'歇一会，轻轻动动脚',frames:[step('u19',1500),step('u20',1500),step('u18',20000),step('u19',1500),step('u20',1500),step('u18',16000),step('u21',1600),step('u22',3000)]}];
   for(const [id,pose]of Object.entries(def.poses))def.exits[id]=id==='stand'?[]:sequence([...(pose.prop?['u16','u17']:[]),'u18','lower','stand'],220);
  }
 }
 if(geometry.transition)installFurnitureTransitions(defs,geometry);
 if(geometry.bedReference)installBedReference(defs,geometry);
 if(geometry.bedBody)installBedBody(defs,geometry);
 installRoomLeisureV20(defs,geometry);
 return defs;
}

function installBedBody(defs,geometry){
 const d=defs.sleep,g=geometry.bedBody,scale=188/g.referenceHeight,step=(pose,duration=600,move=false)=>({pose,duration,move});
 const contacts=[[405,780],[405,780],[414,720],[414,720],[410,707],[405,684],[325,625],[325,625],[325,625],[325,625],[325,625],[335,621],[416,714],[414,720],[405,780],[405,780]];
 for(let i=0;i<16;i++){const f=g.frames[i],feet=[0,1,14,15].includes(i),lying=i>=6&&i<=11,pivot=feet?f.anchor:lying?f.head:f.hip;d.poses['bed-body-'+i]={atlas:'bedBody',cell:i,bedBodyCell:i,at:contacts[i],support:feet?'feet':lying?'bed':'hips',pivot,head:f.head,scale,prop:null,cover:[8,9,10,11].includes(i)?1:i===12?.3:0,articulated:true,compositeQuilt:false,rotation:lying?14:0};}
 for(const i of [1,2,3,4,5,6,7,13,14])d.poses['bed-body-'+i].cover=.2;
 d.poses['bed-open']={...d.poses['bed-body-0'],cover:.2};
 const walk=(from,to,prefix)=>{const count=Math.max(1,Math.ceil(Math.hypot(to[0]-from[0],to[1]-from[1])/7));return Array.from({length:count+1},(_,i)=>{const cell=i%8,f=geometry.walk.frames[cell],id=prefix+i;d.poses[id]={atlas:'walk',cell,at:from.map((v,k)=>v+(to[k]-v)*i/count),support:'feet',prop:null,pivot:[f.crop[0]+f.crop[2]*.48,f.crop[1]+f.crop[3]*.98],head:[f.crop[0]+f.crop[2]*.5,f.crop[1]+f.crop[3]*.22],scale:190/geometry.walk.frames[0].crop[3],flip:to[0]>=from[0]?1:-1,cover:0};return step(id,86,true);});};
 const origin=d.poses.stand.at,approach=[...walk(origin,[572,790],'body-outside-'),...walk([572,790],[405,780],'body-front-')],leave=[...walk([405,780],[572,790],'body-leave-'),...walk([572,790],origin,'body-home-'),step('stand',120)];
 const enter=[step('bed-body-0',800),step('bed-body-1',1000),step('bed-open',500),...[14,13,2,3,4,5,6].map(i=>step('bed-body-'+i,i===4||i===5?950:650)),step('bed-body-7',1500),step('bed-body-8',1200)];
 const exit=[step('bed-body-8',500),step('bed-body-11',900),step('bed-body-12',950),step('bed-body-2',550),step('bed-body-13',650),step('bed-body-14',600),step('bed-body-15',1100),step('bed-body-0',900),...leave];
 d.entry=[...approach,...enter];d.still='bed-body-8';d.variations=[{name:'枕好枕头，拉好被子安静休息',frames:[step(d.still,60000)]}];
 for(const id of Object.keys(d.poses)){const a=approach.findIndex(s=>s.pose===id),b=enter.findIndex(s=>s.pose===id);d.exits[id]=id==='stand'?[]:a>=0?[...approach.slice(0,a).reverse(),step('stand',120)]:b>=0?[...enter.slice(b+1),...exit]:[...exit];}
}

// Reference storyboard: entry and exit are separate drawings. Every pose
// keeps the quilt's mattress contact anchored; only the drawn limbs move.
function installBedReference(defs,geometry){
 const d=defs.sleep,g=geometry.bedReference,step=(pose,duration=260,move=false)=>({pose,duration,move});
 const scale=188/g.referenceHeight;
 for(let cell=0;cell<24;cell++){
  const places={7:[530,730],8:[510,720],9:[485,710],10:[470,710],11:[460,710],12:[460,710],13:[470,710],14:[485,710],15:[510,720],16:[530,730]};
  const f=g.frames[cell];d.poses['bed-ref-'+cell]={atlas:'bedReference',cell,bedReferenceCell:cell,at:places[cell]||[540,740],support:cell<3||cell>=19?'feet':cell>=8&&cell<=14?'bed':'hips',prop:null,pivot:[...f.hip],head:[...f.head],scale,articulated:true,compositeQuilt:true,cover:cell>=10&&cell<=14?1:0};
 }
 const walk=(from,to,prefix)=>{const count=Math.max(1,Math.ceil(Math.hypot(to[0]-from[0],to[1]-from[1])/7));return Array.from({length:count+1},(_,i)=>{const cell=i%8,f=geometry.walk.frames[cell],id=prefix+i;d.poses[id]={atlas:'walk',cell,at:from.map((v,k)=>v+(to[k]-v)*i/count),support:'feet',prop:null,pivot:[f.crop[0]+f.crop[2]*.48,f.crop[1]+f.crop[3]*.98],head:[f.crop[0]+f.crop[2]*.5,f.crop[1]+f.crop[3]*.22],scale:190/geometry.walk.frames[0].crop[3],flip:to[0]>=from[0]?1:-1,cover:0};return step(id,86,true);});};
 const contact=f=>[540+(f.feet[0]-f.hip[0])*scale,740+(f.feet[1]-f.hip[1])*scale];
 const origin=d.poses.stand.at,front=contact(g.frames[0]),end=contact(g.frames[23]);
 const approach=[...walk(origin,[572,790],'reference-outside-'),...walk([572,790],front,'reference-front-')];
 const leave=[...walk(end,[572,790],'reference-leave-'),...walk([572,790],origin,'reference-home-'),step('stand',120)];
 const entry=Array.from({length:12},(_,i)=>step('bed-ref-'+i,[260,300,260,350,300,260,300,300,350,300,600,1000][i]));
 const exit=Array.from({length:12},(_,i)=>step('bed-ref-'+(i+12),[300,500,400,400,300,300,400,350,300,500,500,500][i]));
 d.entry=[...approach,...entry];d.still='bed-ref-11';d.variations=[{name:'枕好枕头，拉好被子安静休息',frames:[step(d.still,60000)]}];
 for(const id of Object.keys(d.poses)){
  const a=approach.findIndex(s=>s.pose===id),cell=d.poses[id].bedReferenceCell;
  if(id==='stand')d.exits[id]=[];
  else if(a>=0)d.exits[id]=[...approach.slice(0,a).reverse(),step('stand',120)];
  else if(Number.isInteger(cell)&&cell<12)d.exits[id]=[...entry.slice(cell+1),...exit,...leave];
  else if(Number.isInteger(cell))d.exits[id]=[...exit.slice(cell-12+1),...leave];
  else {const i=leave.findIndex(s=>s.pose===id);d.exits[id]=i>=0?leave.slice(i+1):[...exit,...leave];}
 }
}

// The body drawings articulate at the support point. Do not interpolate a
// sleeping cutout across the mattress between these frames.
function installFurnitureTransitions(defs,geometry){
 const g=geometry.transition,scale=188/g.referenceHeight;
 const pose=(cell,at,support='hips',extra={})=>{const f=g.frames[cell];return {atlas:'transition',cell,transitionCell:cell,at:[...at],support,prop:null,pivot:[...f.hip],head:[...f.head],scale,articulated:true,...extra};};
 const step=(name,duration=115,move=false)=>({pose:name,duration,move});
 const walkTo=(d,from,to,prefix)=>{const length=Math.hypot(to[0]-from[0],to[1]-from[1]),n=Math.max(1,Math.ceil(length/7));const names=[];
  for(let i=0;i<=n;i++){const cell=i%8,f=geometry.walk.frames[cell],p=from.map((v,k)=>v+(to[k]-v)*i/n),id=prefix+i;d.poses[id]={atlas:'walk',cell,at:p,support:'feet',prop:null,pivot:[f.crop[0]+f.crop[2]*.48,f.crop[1]+f.crop[3]*.98],head:[f.crop[0]+f.crop[2]*.5,f.crop[1]+f.crop[3]*.22],scale:190/geometry.walk.frames[0].crop[3],flip:to[0]>=from[0]?1:-1};names.push(id);}
  return names.map(id=>step(id,86,true));
 };
 for(const mode of ['type','write']){
  const d=defs[mode],approach=walkTo(d,d.poses.stand.at,[950,490],'desk-contact-'),lower=[];
  for(let i=0;i<8;i++){
   const cell=[0,0,1,1,2,3,4,5][i],f=geometry.desk.frames[cell],id='desk-settle-'+i;
   d.poses[id]={atlas:'desk',cell,deskCell:i,at:[950-38*i/7,464-43*i/7],support:i<5?'feet':'hips',prop:null,pivot:[f.crop[0]+f.crop[2]*.48,f.crop[1]+f.crop[3]*.84],head:[f.crop[0]+f.crop[2]*.5,f.crop[1]+f.crop[3]*.22],scale:190/geometry.desk.frames[0].crop[3],articulated:true};lower.push(step(id,125));
  }
  d.entry=[...approach,...lower,step(d.still,200)];
  const getUp=[...lower.slice().reverse(),...approach.slice().reverse(),step('stand',120)];
  for(const[id,p]of Object.entries(d.poses)){if(id==='stand')d.exits[id]=[];else{const i=d.entry.findIndex(s=>s.pose===id);d.exits[id]=i>=0?[...d.entry.slice(0,i).reverse(),step('stand',120)]:[...(p.prop==='pen'?[step('d12',160)]:[]),...getUp];}}
 }
 for(const mode of ['sleep','lounge','rest']){
  const d=defs[mode],sleep=mode==='sleep',target=sleep?[490,660]:mode==='lounge'?[755,674]:[1140,661],floor=sleep?[490,785]:mode==='lounge'?[740,742]:[1128,738],origin=d.poses.stand.at;
  const approach=sleep?[...walkTo(d,origin,[572,780],'approach-outside-'),...walkTo(d,[572,780],floor,'approach-front-')]:walkTo(d,origin,floor,'approach-contact-');
  if(sleep){d.poses.stand.cover=0;for(const s of approach)d.poses[s.pose].cover=0;}
  const lower=[];
  for(let i=0;i<8;i++){const f=g.frames[16+i],p0=g.frames[16],start=[floor[0],floor[1]-(p0.anchor[1]-p0.hip[1])*scale],at=start.map((v,k)=>v+(target[k]-v)*i/7),id='settle-'+i;d.poses[id]=pose(16+i,at,i<6?'feet':'hips',{cover:sleep?0:1});lower.push(step(id,125));}
  let enter=[...approach,...lower,step('settle-7',350)];
  if(sleep){
   const bed=[];for(let i=0;i<16;i++){const amount=Math.min(1,i/8),at=[490+(450-490)*amount,660+(615-660)*amount],id='bed-joint-'+i;d.poses[id]=pose(i,at,i<10?'hips':'bed',{prop:i>=12?'quilt':null,cover:i<13?0:(i-12)/3});bed.push(step(id,i>=12?500:i===0?350:150));}
   enter.push(...bed);d.still='bed-joint-15';
   d.variations=[{name:'盖好被子，安静睡觉',frames:[step(d.still,60000)]}];
   d.sleepEvents=true;
  }else enter.push(step(d.still,250));
  d.entry=enter;
  const outward=[...lower.slice(0,7).reverse().map(s=>step(s.pose,125)),...approach.slice().reverse().map(s=>step(s.pose,86,true)),step('stand',120)];
  for(const id of Object.keys(d.poses)){
   if(id==='stand'){d.exits[id]=[];continue;}
   const at=enter.findIndex(s=>s.pose===id);
   if(at>=0)d.exits[id]=[...enter.slice(0,at).reverse().map(s=>step(s.pose,s.move?86:sleep&&/^bed-joint-1[234]$/.test(s.pose)?550:150,s.move)),step('stand',120)];
   else if(sleep)d.exits[id]=[...enter.slice().reverse().map(s=>step(s.pose,s.move?86:/^bed-joint-1[234]$/.test(s.pose)?550:150,s.move)),step('stand',120)];
   else d.exits[id]=[...(d.exits[id]||[]).filter(s=>!['stand','lower'].includes(s.pose)),...outward];
  }
 }
}

export function roomSleepVariation(elapsed,seed=0){
 if(elapsed<60000)return null;
 const index=Math.floor((elapsed-60000)/90000),local=(elapsed-60000)%90000;
 if(local>=6500)return null;
 const n=((Math.imul((seed|0)+index+1,1103515245)+12345)>>>0)%100;
 if(n>=80)return null;
 return {kind:n<25?'kick':'turn',progress:local/6500,index};
}


