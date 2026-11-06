// Shared contact poses for the original resident and all outfit atlases.
// Furniture coordinates belong to the current illustrated house.
export function installRoomLeisureV20(defs,geometry){
 const step=(pose,duration=1000)=>({pose,duration}),seq=(prefix,ids,duration=1000)=>ids.map(i=>step(prefix+i,duration));
 if(geometry.sofaSocial){const d=defs.lounge,g=geometry.sofaSocial,scale=188/g.referenceHeight,oldExit=d.exits[d.still];
  for(let cell=0;cell<16;cell++){const f=g.frames[cell],prop=cell>=12?'snack':cell>=8?'remote':cell>=4?'cup':cell>=1?'pillow':null;d.poses['social-'+cell]={atlas:'sofaSocial',cell,at:[755,674],support:'hips',pivot:f.hip,head:f.head,scale,prop,articulated:true};}
  const release=p=>p==='pillow'?seq('social-',[2,1,0],900):p==='cup'?seq('social-',[6,7,0],1000):p==='remote'?seq('social-',[11,8,0],900):p==='snack'?seq('social-',[12,0],1000):[];
  d.still='social-0';d.entry.push(step(d.still,800));
  d.variations=[
   {name:'拿起身旁的杯子，慢慢喝水再放稳',frames:[step('social-7',1400),...seq('social-',[6,4],1600),step('social-5',1800),step('social-4',1200),step('social-6',8000),step('social-7',1800),step('social-0',20000)]},
   {name:'抱着小鲸鱼抱枕，慢慢打个盹',frames:[step('social-0',20000),...seq('social-',[1,2],1400),step('social-2',8000),step('social-3',20000),...seq('social-',[2,1,0],1300),step('social-0',18000)]},
   {name:'拿起遥控器，看看电视',frames:[...seq('social-',[8,9,10],1400),step('social-11',30000),...seq('social-',[8,0],1400),step('social-0',15000)]},
   {name:'慢慢打开薯片，吃几口再歇一会',frames:[step('social-12',1400),step('social-13',1600),...seq('social-',[14,15],1200),step('social-12',14000),...seq('social-',[14,15],1200),step('social-12',16000),step('social-0',15000)]},
   ...d.variations.filter(v=>!v.name.includes('零食'))
  ];
  for(let cell=0;cell<16;cell++){const id='social-'+cell;d.exits[id]=[...release(d.poses[id].prop),...oldExit];}
 }
 if(geometry.sofaBody){const d=defs.lounge,g=geometry.sofaBody,scale=188/g.referenceHeight,oldExit=d.exits[d.still];
  for(let cell=0;cell<16;cell++){const f=g.frames[cell],lying=cell>=5,prop=cell>=12?'blanket':cell===11?'book':null;d.poses['sofa-v20-'+cell]={atlas:'sofaBody',cell,at:lying?[792,688]:[755,674],support:lying?'cushion':'hips',pivot:f.hip,head:f.head,scale,rotation:lying?48:0,prop,articulated:true};}
  const rise=seq('sofa-v20-',[5,4,1,0],1100);
  d.variations=d.variations.filter(v=>!v.name.includes('侧躺')&&!v.name.includes('趴一会')).concat([
   {name:'坐着伸个懒腰，再把手放回腿上',frames:[...seq('sofa-v20-',[0,2,3],1400),step('sofa-v20-3',1800),...seq('sofa-v20-',[2,0],1400),step('sofa-v20-0',18000)]},
   {name:'沿沙发长边侧躺，枕好靠垫休息',frames:[...seq('sofa-v20-',[1,4,5,6,7],1300),step('sofa-v20-7',30000),...rise,step('sofa-v20-0',16000)]},
   {name:'趴着看会书，左右脚交替轻轻抬起',frames:[...seq('sofa-v20-',[1,4,5,8],1300),step('sofa-v20-8',18000),step('sofa-v20-9',1400),step('sofa-v20-8',12000),step('sofa-v20-10',1400),step('sofa-v20-11',25000),step('sofa-v20-8',1300),...rise]},
   {name:'把毯子展开盖住腿，休息后收回身旁',frames:[...seq('sofa-v20-',[1,4,5,12,13,14,15],1500),step('sofa-v20-15',35000),...seq('sofa-v20-',[14,13,12,5],1500),...rise]}
  ]);
  for(let cell=0;cell<16;cell++)d.exits['sofa-v20-'+cell]=[...(cell>=12?seq('sofa-v20-',[14,13,12,5],1300):cell===11?seq('sofa-v20-',[8],1000):[]),...(cell>=5?rise:seq('sofa-v20-',[1,0],1000)),...oldExit];
 }
 if(geometry.idleChair)for(const mode of ['type','write']){const d=defs[mode],g=geometry.idleChair,oldExit=d.exits[d.still],seatedExit=d.seatedExits?.[d.still];
  for(let cell=8;cell<16;cell++){const f=g.frames[cell];d.poses['chair-v20-'+cell]={atlas:'idleChair',cell,at:[928,537],pivot:f.anchor,head:f.head,scale:285/g.frames[8].crop[3],support:'hips',prop:null,articulated:true,chair:true};d.exits['chair-v20-'+cell]=[step('chair-v20-8',1000),step(d.still,1000),...oldExit];if(seatedExit)d.seatedExits['chair-v20-'+cell]=[step('chair-v20-8',1000),step(d.still,1000),...seatedExit];}
  const putPen=mode==='write'?[step('d12',1500)]:[];
  d.variations.push({name:'放下手上的事情，转过椅子放松一下',frames:[...putPen,step('d18',1600),...seq('chair-v20-',[8,9,10],1800),step('chair-v20-10',12000),...seq('chair-v20-',[12,13],1600),step('chair-v20-13',16000),...seq('chair-v20-',[14,15,14,13,12,10,11,8],1800),step(d.still,20000)]});
 }
}
