// The house is visual scenery. Saved room objects keep their IDs and controls.
export function createRoomHouse(room,doc,{onLamp,onCurtain}={}) {
 const el=(tag,attrs={},text)=>{const n=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
 const svg=el('svg',{viewBox:'0 660 1100 710',class:'room-scene block-room',role:'group','aria-label':'大肥鱼的双层小屋，一楼起居与生产，二楼休息与魔法','data-room-size':'14x10','data-room-floors':'2'});
 svg.append(el('title',{},'大肥鱼的双层小屋 · 橡木与白桦木'));
 const point=(x,y,z=0)=>[450+(x-y)*38,157+(x+y)*15-z*32];
 const polygon=(g,ps,fill,attrs={})=>{const n=el('polygon',{points:ps.map(p=>point(...p).join(',')).join(' '),fill,...attrs});g.append(n);return n;};
 const line=(g,a,b,color='#785027',width=1,attrs={})=>{const p=point(...a),q=point(...b);g.append(el('line',{x1:p[0],y1:p[1],x2:q[0],y2:q[1],stroke:color,'stroke-width':width,...attrs}));};
 const box=(g,x,y,z,w,d,h,c)=>{const edge={stroke:'#51371d','stroke-opacity':'.27','stroke-width':'.65','stroke-linejoin':'round'};polygon(g,[[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]],c[1],edge);polygon(g,[[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]],c[2],edge);polygon(g,[[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],c[0],edge);};
 const top=(g,x,y,z,w,d,c,attrs={})=>polygon(g,[[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z]],c,attrs);
 const face=(g,x,y,z,w,h,c,attrs={})=>polygon(g,[[x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h]],c,attrs);
 const side=(g,x,y,z,d,h,c,attrs={})=>polygon(g,[[x,y,z],[x,y+d,z],[x,y+d,z+h],[x,y,z+h]],c,attrs);
 const wood=['#c58b48','#a76b33','#7a4b26'],dark=['#9b652e','#70451f','#50321b'],cream=['#f4e8ce','#ddc9a8','#bfaa8b'],blue=['#a0bde8','#7896c6','#556f9b'],ink=['#48526a','#2a3246','#1b2434'];
 const items=Array.isArray(room.items)?room.items:[],has=n=>items.some(i=>i.name===n),drawings=[],staticKeyboard=[];
 const floors={};
 const lantern=(g,x,y,z=1.4)=>{const[cx,cy]=point(x+.18,y+.18,z+.38);g.append(el('circle',{cx,cy,r:32,fill:'#ffc85e',opacity:'.09'}),el('circle',{cx,cy,r:17,fill:'#ffdf85',opacity:'.15'}));box(g,x,y,z,.37,.37,.12,dark);box(g,x+.04,y+.04,z+.12,.29,.29,.52,['#fff5b6','#ffe395','#efb84f']);box(g,x,y,z+.64,.37,.37,.12,dark);for(const dx of[0,.31])for(const dy of[0,.31])box(g,x+dx,y+dy,z+.12,.055,.055,.52,wood);box(g,x+.13,y+.13,z+.76,.1,.1,.16,dark);};
 const plant=(g,x,y,z=0,s=1)=>{box(g,x,y,z,.65*s,.65*s,.55*s,['#ede2cc','#d4bda1','#a98f70']);box(g,x-.03*s,y-.03*s,z+.46*s,.71*s,.71*s,.13*s,cream);top(g,x+.08*s,y+.08*s,z+.6*s,.49*s,.49*s,'#574531');line(g,[x+.3*s,y+.3*s,z+.5*s],[x+.3*s,y+.3*s,z+1.55*s],'#618052',3);for(let j=0;j<7;j++){const a=j*2.4,dx=Math.cos(a)*.39*s,dy=Math.sin(a)*.39*s,dz=(.82+j*.1)*s,p=point(x+.3*s+dx,y+.3*s+dy,z+dz);g.append(el('ellipse',{cx:p[0],cy:p[1],rx:10*s,ry:4.8*s,fill:['#688e49','#89a859','#527942'][j%3],transform:`rotate(${a*45},${p[0]},${p[1]})`}));}};
 const rug=(g,x,y,w,d)=>{top(g,x,y,.04,w,d,'#7d96b7');top(g,x+.12,y+.12,.055,w-.24,d-.24,'#b7c7db');for(let u=.16;u<w-.2;u+=.6)for(let v=.16;v<d-.2;v+=.6)top(g,x+u,y+v,.06,Math.min(.58,w-u-.15),Math.min(.58,d-v-.15),['#b3c6e0','#d2dbdf','#8da9cd'][(Math.floor(u/.6)+Math.floor(v/.6))%3]);};
 const beams=(g)=>{for(const[x,y]of[[0,0],[13.55,0],[0,9.55],[13.55,9.55]]){const h=x===13.55&&y===9.55?1.45:4.35;box(g,x,y,0,.45,.45,h,dark);box(g,x-.07,y-.07,h,.59,.59,.32,wood);for(let z=.3;z<h;z+=.72){face(g,x+.09,y+.46,z,.25,.035,'#94612f');side(g,x+.46,y+.07,z,.27,.035,'#62431f');}}};
 const makeFloor=(level,offset)=>{
  const g=el('g',{'data-house-floor':level,transform:`translate(0,${offset})`});svg.append(g);floors[level]=g;
  polygon(g,[[-.2,-.2,-.52],[14.5,-.2,-.52],[14.5,10.5,-.52],[-.2,10.5,-.52]],'#526079',{opacity:'.09'});
  box(g,0,0,-.46,14,10,.46,wood);
  for(let y=0;y<10;y+=.5)for(let x=0;x<14;x+=1){const xx=x,shade=['#edcf99','#f1d7a5','#f5ddb0','#e9c890'][(x*7+Math.round(y*2)*3)%4];top(g,xx+.015,y+.012,.012,.97,.476,shade);top(g,xx+.08,y+.15,.019,.64,.012,'#d8b57c');top(g,xx+.34,y+.32,.02,.48,.009,'#e3bd84');}
  const wall=el('g');g.append(wall);
  for(let z=.12;z<4;z+=.45){for(let x=.3;x<13.7;x+=1.1)box(wall,x,0,z,1.09,.24,.43,[wood[0],['#b87938','#bd8341','#b77c3a'][Math.round(x+z)%3],wood[2]]);for(let y=.3;y<9.7;y+=1.1)box(wall,0,y,z,.24,1.09,.43,[wood[0],wood[1],['#98612e','#a16a31','#a97135'][Math.round(y+z)%3]]);}
  box(wall,0,0,4.05,14,.4,.25,wood);box(wall,0,.4,4.05,.4,9.6,.25,wood);beams(wall);
  for(const p of[[.6,.6,2.7],[6.2,.5,2.9],[13,.6,2.7],[.5,9.1,1.2],[12.9,9.3,.9]])lantern(g,...p);
  const label=el('g',{'pointer-events':'none'});label.append(el('rect',{x:42,y:44,width:210,height:56,rx:12,fill:'#f8f4e9',stroke:'#e0d7bf'}),el('text',{x:59,y:68,fill:'#224162','font-size':18,'font-weight':700},level===1?'一楼 · 起居与生产':'二楼 · 休息与魔法'),el('text',{x:59,y:87,fill:'#8d7f67','font-size':10,'letter-spacing':1.7},level===1?'LIVING / WORKSHOP':'REST / ENCHANTMENT'));g.append(label);
  return g;
 };
 const upstairs=makeFloor(2,0),downstairs=makeFloor(1,660);
 const control=(g,kind,label,fn)=>{for(const[k,v]of Object.entries({'data-room-control':kind,role:'button',tabindex:0,'aria-label':label,class:'block-object block-control'}))g.setAttribute(k,v);g.addEventListener('click',()=>fn?.());g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn?.();}});};
 const draw=(item,level,depth,fn)=>{const g=el('g',{'data-room-item':item.id,class:'block-object','data-object-floor':level});g.append(el('title',{},`${item.name}${item.state?' · '+item.state:''}`));drawings.push({g,level,depth,fn,itemName:item.name});};
 const foreground=[];
 const scenery=(level,name,fn)=>{const g=el('g',{'data-house-feature':name});g.append(el('title',{},name));if(name==='附魔区')foreground.push({level,g});else floors[level].append(g);fn(g);return g;};
 // Storage wall with individual chest latches and item frames.
 scenery(1,'储物室',g=>{box(g,.65,.55,0,4.8,2.15,.12,dark);for(let z=.15;z<2.8;z+=.9)for(let x=.8;x<5.2;x+=1.45){box(g,x,.65,z,1.32,1.35,.81,wood);face(g,x+.06,2.01,z+.08,1.2,.59,'#ab6a2b');face(g,x+.06,2.02,z+.54,1.2,.08,'#704821');face(g,x+.61,2.04,z+.34,.13,.25,'#d2c6a7');face(g,x+.19,2.04,z+.16,.28,.26,'#6b4928');face(g,x+.23,2.05,z+.2,.2,.18,['#8aaa60','#c98b4e','#87a9b1'][Math.round(x+z)%3]);}plant(g,.55,2.55,0,.8);});
 scenery(1,'铁砧工坊',g=>{rug(g,1.4,4,3.1,2.3);box(g,1.7,4.25,0,1.25,1.25,.42,['#9da0a0','#7b8184','#626b72']);box(g,1.85,4.4,.42,.95,.95,.2,ink);box(g,2.05,4.55,.62,.55,.64,.58,ink);box(g,1.7,4.25,1.16,1.25,1.15,.23,['#697582','#465463','#303d4b']);box(g,3.3,4.25,0,1.03,1.03,1.05,wood);top(g,3.31,4.26,1.06,1.01,1.01,'#6a432a');for(let x=0;x<3;x++)for(let y=0;y<3;y++)top(g,3.38+x*.29,4.33+y*.29,1.07,.21,.21,'#dba873');face(g,3.44,5.3,.23,.16,.56,'#3f3932');face(g,3.81,5.3,.34,.12,.49,'#51452f');});
 const bookshelf=(g,x,y,w=4.5)=>{box(g,x,y,0,w,.75,2.9,dark);for(let z=.12;z<2.7;z+=.85){box(g,x+.06,y+.04,z,w-.12,.8,.12,wood);for(let i=.18;i<w-.15;i+=.25){const color=['#3d7794','#a93e59','#80a34c','#d2a449','#8761a0'][Math.round(i*19+z*5)%5];box(g,x+i,y+.29,z+.12,.19,.43,.5+(Math.round(i*10)%3)*.07,[color,color,'#4d4351']);face(g,x+i+.02,y+.73,z+.26,.15,.035,'#d5b970');}}};
 scenery(2,'附魔区',g=>{rug(g,1.1,1.3,4.4,3.1);box(g,2.55,2.2,.05,1.5,1.5,.65,['#254154','#132739','#0e2434']);box(g,2.55,2.2,.7,1.5,1.5,.16,['#bc305b','#8d2646','#601e38']);for(const[x,y]of[[2.55,2.2],[3.72,2.2],[2.55,3.37],[3.72,3.37]])box(g,x,y,.45,.33,.33,.38,['#7adcf3','#2babc4','#14728e']);const[cx,cy]=point(3.3,2.95,1.4);g.append(el('ellipse',{cx,cy:cy+22,rx:37,ry:13,fill:'#a877ff',opacity:'.11'}));polygon(g,[[2.65,2.6,1.45],[3.25,2.65,1.28],[3.25,3.4,1.28],[2.65,3.35,1.45]],'#fff3c9');polygon(g,[[3.25,2.65,1.28],[3.85,2.6,1.45],[3.85,3.35,1.45],[3.25,3.4,1.28]],'#efdfb3');for(let i=0;i<6;i++){const[p,q]=point(2.3+(i%3)*.9,2.4+Math.floor(i/3)*1.1,1.7+(i%2)*.35);g.append(el('text',{x:p,y:q,fill:'#ccacff','font-family':'monospace','font-size':13,opacity:'.8'},['✦','⋆','+'][i%3]));}});
 scenery(2,'小麦温室',g=>{box(g,7.2,.8,0,5.1,4.3,.3,wood);top(g,7.4,1,.31,4.7,3.9,'#755434');top(g,9.25,2.3,.32,1.05,1.05,'#329acf');top(g,9.38,2.45,.33,.75,.12,'#8ce0ef');for(let x=7.6;x<12;x+=.4)for(let y=1.2;y<4.7;y+=.4){if(x>=9.1&&x<10.5&&y>=2.1&&y<3.5)continue;const h=.65+((Math.round(x*10)+Math.round(y*10))%3)*.12;line(g,[x,y,.32],[x,y,.32+h],'#c8ac43',2);for(let z=.55;z<h+.3;z+=.18){line(g,[x,y,z],[x-.1,y,z+.14],'#e8bd45',3);line(g,[x,y,z+.05],[x+.1,y,z+.19],'#f2d267',3);}}for(const x of[7.25,12.15])for(const y of[.85,4.95])box(g,x,y,.3,.1,.1,2.75,cream);for(let x=7.25;x<12.2;x+=1.23){line(g,[x,.85,3.05],[x,4.95,3.05],'#a9cad3',2);line(g,[x,4.95,.35],[x,4.95,3.05],'#a9cad3',2);}for(let y=.85;y<5;y+=1.025){line(g,[7.25,y,3.05],[12.25,y,3.05],'#bed7dc',2);line(g,[12.25,y,.35],[12.25,y,3.05],'#acc8cc',2);}top(g,7.3,.9,3,4.9,4,'#c8eafa',{opacity:'.12'});side(g,12.2,.9,.35,4,2.7,'#c8eafa',{opacity:'.1'});face(g,7.3,4.95,.35,4.9,2.7,'#c8eafa',{opacity:'.08'});for(const[x,y]of[[8.1,4.96],[10.5,4.96]]){line(g,[x,y,1.8],[x+.55,y,2.65],'#eaf9ff',2,{opacity:'.65'});}plant(g,6.4,4.2,0,.8);});
 const stairs=(g,upper=false)=>{
  if(upper){
   const clip=el('clipPath',{id:'room-stair-opening'});top(clip,11.65,5.2,.04,1.85,4.2,'#fff');svg.append(clip);
   const steps=el('g',{'clip-path':'url(#room-stair-opening)'});g.append(steps);top(steps,11.65,5.2,.04,1.85,4.2,'#5a3b25');
   for(let j=0;j<9;j++){const y=8.9-j*.46,z=-2.52+j*.28;box(steps,11.65,y,-2.8,1.85,.48,z+2.8,wood);top(steps,11.67,y+.015,z+.01,1.8,.42,'#cfac77');}
   for(let y=5.15;y<9.5;y+=.84)box(g,11.43,y,0,.16,.16,1,wood);
   box(g,11.4,5.1,1,.23,4.45,.16,wood);box(g,11.4,5.1,0,2.35,.18,1,dark);box(g,11.4,5.1,1,2.35,.24,.16,wood);
  }else{
   for(let j=0;j<9;j++){const y=8.9-j*.46,z=j*.28;box(g,11.65,y,0,1.85,.48,z+.28,wood);top(g,11.67,y+.015,z+.29,1.8,.42,'#f0d19c');}
   for(let j=0;j<5;j++){const y=9.05-j*.94;box(g,13.65,y,0,.18,.18,1+j*.56,dark);}
   for(let j=0;j<8;j++)line(g,[13.75,9-j*.46,1.1+j*.28],[13.75,8.54-j*.46,1.38+j*.28],'#a8753e',7);
  }
 };
 scenery(1,'通往二楼的橡木楼梯',g=>stairs(g));scenery(2,'楼梯口与护栏',g=>stairs(g,true));
 scenery(1,'客厅地毯',g=>rug(g,2.7,6.2,6.3,3.1));scenery(2,'床边地毯',g=>rug(g,.8,6,5.1,3.25));
 const blanket=(g,occupied=false)=>{const q=el('g',{'data-room-prop':'quilt'});g.append(q);box(q,1.05,7.2,.95,2.85,1.9,occupied?.23:.1,blue);box(q,1.05,7.18,1.08,2.85,.3,.08,cream);for(let x=1.22;x<3.8;x+=.68)for(let y=7.65;y<9;y+=.55)top(q,x,y,occupied?1.19:1.06,.3,.3,'#84a4d7');const[p,qy]=point(2.4,8.2,occupied?1.2:1.08);q.append(el('path',{d:`M ${p-15} ${qy} q -4 -10 9 -11 q 16 -2 21 8 l 8 -6 l -1 12 l -10 -1 q -17 10 -27 -2`,fill:'#eaf0ef'}));return q;};
 const desk=g=>{box(g,7,.85,0,.75,1.9,1.25,ink);box(g,10.6,.85,0,.7,1.9,1.25,ink);for(const x of[7.1,10.7])for(const z of[.3,.67,1.04]){face(g,x,2.76,z,.5,.26,'#4f5867');face(g,x+.17,2.77,z+.14,.18,.025,'#a8a9a8');}box(g,6.85,.7,1.25,4.7,2.2,.2,['#bbab99','#827d7b','#62656a']);top(g,7.2,1.65,1.46,3.8,1.05,'#2e4655');};
 const keyboard=g=>{const z=has('书桌')?1.48:0;const k=el('g',{'data-room-prop':'keyboard'});g.append(k);staticKeyboard.push(k);box(k,8,2.07,z,1.65,.54,.07,['#e0dfe5','#acb0c0','#8a91a5']);for(let x=8.09;x<9.6;x+=.15)for(let y=2.15;y<2.55;y+=.13)top(k,x,y,z+.08,.11,.08,'#737e99');};
 const computer=g=>{const z=has('书桌')?1.48:0;for(let n=0;n<2;n++){const x=7.25+n*1.7;box(g,x+.45,1.22,z,.7,.5,.08,ink);box(g,x+.73,1.3,z+.08,.1,.15,.35,ink);box(g,x,.91,z+.4,1.58,.12,1.03,ink);face(g,x+.08,1.04,z+.49,1.42,.84,'#092c36');face(g,x+.1,1.05,z+1.2,1.38,.07,'#1b5860');for(let j=0;j<6;j++){face(g,x+.15,1.06,z+.56+j*.09,.18+((j*7+n)%5)*.19,.025,['#66e3ce','#3da2be','#b5eac7'][j%3]);}if(n){for(let j=0;j<4;j++)line(g,[x+.3+j*.29,1.07,z+.7+(j%2)*.22],[x+.59+j*.22,1.07,z+.91-(j%2)*.16],'#67c9e4',1);}}box(g,10.75,.91,z,.65,1.25,1.47,['#d9e1f1','#4d6599','#23375f']);face(g,10.85,2.17,z+.15,.43,1.18,'#0f2459');for(const zz of[.4,.8,1.2]){const[cx,cy]=point(11.06,2.18,z+zz);g.append(el('ellipse',{cx,cy,rx:7.5,ry:10,fill:'#4c71e4',stroke:'#92dfff','stroke-width':3}),el('circle',{cx,cy,r:2,fill:'#e2f3ff'}));}keyboard(g);box(g,9.96,2.12,z,.23,.37,.12,cream);for(const x of[6.88,10.25]){box(g,x,1.36,z,.3,.4,.65,ink);const[cx,cy]=point(x+.15,1.77,z+.3);g.append(el('ellipse',{cx,cy,rx:4,ry:6,fill:'#6d7b8b'}));}};
 const chair=g=>{box(g,8.3,3.15,.1,1.1,.13,.1,ink);box(g,8.78,2.7,.1,.13,1.1,.1,ink);box(g,8.78,3.14,.15,.13,.13,.6,ink);box(g,8.25,2.68,.73,1.25,1.15,.22,blue);box(g,8.25,3.7,.85,1.25,.18,1.35,ink);face(g,8.4,3.89,1.05,.96,.91,'#6f86ad');for(const x of[8.18,9.43])box(g,x,2.97,1,.15,.65,.12,ink);};
 const mug=(g,x,y,z)=>{const[cx,cy]=point(x,y,z);const m=el('g',{'data-room-prop':'mug','data-room-support':'coffee-table'});g.append(m);m.append(el('ellipse',{cx,cy:cy+2,rx:10,ry:4,fill:'#765c3f',opacity:'.3'}),el('path',{d:`M ${cx+5} ${cy-11} q 9 0 6 7 q -1 3 -6 1`,fill:'none',stroke:'#d7e6e7','stroke-width':2}),el('rect',{x:cx-6,y:cy-12,width:12,height:12,rx:2,fill:'#9cb9c5'}),el('ellipse',{cx,cy:cy-12,rx:6,ry:2.4,fill:'#edf0e5'}),el('ellipse',{cx,cy:cy-12,rx:4,ry:1.6,fill:'#75604b'}));};
 let custom=0;
 for(const item of items){switch(item.name){
 case '床':draw(item,2,9,g=>{box(g,.9,5.95,.25,3.15,3.3,.4,wood);box(g,.9,5.9,.4,3.15,.22,1.1,dark);box(g,1.02,6.18,.65,2.91,2.94,.3,cream);box(g,1.3,6.25,.95,2.3,.75,.18,['#d9e2f5','#b0c0df','#879bc2']);blanket(g);});break;
 case '床头柜':draw(item,2,9.1,g=>{box(g,.7,8.8,0,1,1,1.1,wood);face(g,.8,9.81,.25,.8,.55,'#bd864b');face(g,1.1,9.82,.49,.18,.08,cream[0]);lantern(g,.95,9,1.12);});break;
 case '书架':draw(item,2,1,g=>{bookshelf(g,.85,.55,4.8);for(const[x,depth]of[[.85,2.4],[5.15,1.65]]){box(g,x,1.25,0,.7,depth,2.9,dark);for(let z=.12;z<2.7;z+=.85){box(g,x,1.25,z,.76,depth,.12,wood);for(let y=1.4;y<1.25+depth-.1;y+=.25){const color=['#487f9a','#b04d69','#8fa34d','#d2a449'][Math.round(y*20+z*5)%4];box(g,x+.22,y,z+.12,.48,.19,.55,[color,color,color]);side(g,x+.71,y+.02,z+.28,.15,.035,'#d7b669');}}}});break;
 case '窗':draw(item,1,0,g=>{control(g,'curtain',room.curtain?'合上窗帘':'拉开窗帘',onCurtain);box(g,6.8,.25,1.65,4.8,.13,2,dark);face(g,6.95,.39,1.8,4.5,1.68,room.curtain?'#91c2d2':'#7d98ba');if(room.curtain){face(g,6.95,.4,1.8,4.5,.5,'#83a67f');for(let x=7.1;x<11.3;x+=.56)face(g,x,.41,1.9,.4,.45+(Math.round(x*10)%3)*.16,['#9fbc85','#618c70','#c2cf9b'][Math.round(x*10)%3]);face(g,9.4,.42,2.9,.44,.44,'#f9ecc2');}else for(let x=6.95;x<11.45;x+=.28)face(g,x,.42,1.8,.22,1.68,'#9cb0ca');for(const x of[8.45,9.95])box(g,x,.44,1.8,.08,.09,1.68,cream);box(g,6.95,.44,2.65,4.5,.09,.08,cream);for(const x of[6.7,11.4])box(g,x,.45,1.55,.3,.15,2.2,blue);});break;
 case '书桌':draw(item,1,6,desk);break;
 case '椅子':draw(item,1,7,chair);break;
 case '电脑':draw(item,1,6.1,computer);break;
 case '日记本':draw(item,1,6.2,g=>{const z=has('书桌')?1.48:0;box(g,7.18,2.1,z,.68,.57,.055,dark);top(g,7.2,2.12,z+.06,.29,.53,'#fff0d2');top(g,7.53,2.12,z+.06,.29,.53,'#eaddbd');});break;
 case '记事本':draw(item,1,6.3,g=>{const z=has('书桌')?1.48:0;box(g,10.23,2.24,z,.35,.42,.06,blue);top(g,10.29,2.31,z+.07,.22,.12,'#efead4');});break;
 case '台灯':draw(item,1,6.4,g=>{control(g,'lamp',room.lamp?'关闭台灯':'打开台灯',onLamp);const z=has('书桌')?1.48:0;box(g,6.92,2.1,z,.4,.4,.09,ink);line(g,[7.12,2.3,z+.1],[7.12,2.3,z+.7],'#48546a',3);box(g,6.85,2.03,z+.7,.55,.55,.3,room.lamp?['#fff1b8','#f6cf7d','#c09b55']:cream);if(room.lamp){const[cx,cy]=point(7.12,2.3,z+.65);g.append(el('circle',{cx,cy,r:36,fill:'#ffe2a2',opacity:'.13'}));}});break;
 case '冰箱':draw(item,1,6.5,g=>{box(g,12,.5,0,1.05,1.25,2.5,['#eee9dc','#dad5c8','#b4b5b2']);face(g,12.08,1.76,.16,.9,1.46,'#e5e0d2');face(g,12.08,1.76,1.72,.9,.64,'#e8e4d7');for(const z of[1.1,1.9])face(g,12.18,1.78,z,.06,.3,'#929a9c');plant(g,12.25,.72,2.52,.65);});break;
 case '电视':draw(item,1,8,g=>{box(g,.4,6.5,0,.7,2.6,.58,wood);box(g,.68,6.6,.7,.15,2.45,1.75,ink);side(g,.84,6.7,.8,2.24,1.55,'#194e78');side(g,.85,6.7,.8,2.24,.35,'#68a2ad');side(g,.86,7,.95,.6,.62,'#427c8d');side(g,.87,7.7,.93,.56,.94,'#91bdc5');side(g,.88,8.4,.98,.35,.54,'#366d91');});break;
 case '沙发':draw(item,1,14,g=>{box(g,7.3,6.15,.2,1.7,3.15,.48,['#bbbccc','#979bac','#777f93']);box(g,8.65,6.15,.65,.35,3.15,1.1,['#c9c8d3','#a8a9bb','#858c9f']);for(let y=6.45;y<9;y+=.86)box(g,7.35,y,.68,1.25,.78,.24,['#d1d1dc','#b4b8ca','#969eb4']);for(const y of[6.15,9.05])box(g,7.3,y,.65,1.7,.25,.6,['#c9c8d3','#a8a9bb','#858c9f']);box(g,8.1,6.55,.93,.5,.7,.4,blue);box(g,8,8.55,.93,.55,.45,.3,cream);});break;
 case '茶几':draw(item,1,13,g=>{for(const x of[4.1,5.8])for(const y of[7.2,8.55])box(g,x,y,0,.17,.17,.5,dark);box(g,3.95,7.1,.48,2.2,1.65,.22,wood);top(g,4.2,7.35,.71,1.55,1.04,'#b1834e');mug(g,5.5,7.65,.72);box(g,4.5,8,.72,.6,.4,.06,cream);});break;
 case '旧相册':draw(item,1,13.1,g=>{const z=has('茶几')?.72:0;box(g,4.15,7.4,z,.7,.55,.08,['#a67f63','#81614e','#594334']);top(g,4.25,7.51,z+.09,.46,.3,'#dbcaa7');});break;
 case '绿萝':draw(item,1,17,g=>plant(g,10.5,8.7,0,1));break;
 case '盆栽':draw(item,2,16,g=>{plant(g,4.7,8.65,0,1);plant(g,.55,4.95,0,.8);});break;
 case '挂画':draw(item,2,0,g=>{box(g,6.35,.24,2.2,.75,.13,1,dark);face(g,6.43,.38,2.29,.59,.82,'#74a4ba');face(g,6.44,.39,2.3,.57,.27,'#abc388');face(g,6.76,.4,2.87,.13,.13,'#f6e3a8');});break;
 case '挂钟':draw(item,1,0,g=>{box(g,5.6,.25,2.65,.8,.15,.8,dark);face(g,5.68,.41,2.73,.64,.64,'#f2e5c6');face(g,5.99,.42,3.04,.024,.23,'#424957');face(g,5.99,.42,3.04,.21,.024,'#424957');});break;
 default:{const i=custom++;draw(item,1,18+i*.01,g=>{const x=5.5+(i%3)*.66,y=8.8+Math.floor((i%6)/3)*.6,z=Math.floor(i/6)*.4;box(g,x,y,z,.57,.5,.35,wood);face(g,x+.22,y+.51,z+.1,.1,.13,'#e8d5a4');});}
 }}
 drawings.sort((a,b)=>a.depth-b.depth);for(const d of drawings){d.fn(d.g);floors[d.level].append(d.g);}
 for(const feature of foreground)floors[feature.level].append(feature.g);
 // Low foreground beams leave both floors readable and expose the front door.
 for(const g of[upstairs,downstairs]){box(g,0,9.85,0,6.5,.22,.3,wood);box(g,9.3,9.85,0,4.7,.22,.3,wood);box(g,13.8,.3,0,.2,9.4,.3,wood);for(const x of[6.35,9.3]){box(g,x,9.7,0,.35,.35,.8,dark);box(g,x-.03,9.67,.8,.41,.41,.15,wood);}top(g,6.7,9.4,.03,2.4,.55,'#a6b4be');}
 return {svg,el,point,floors,drawings,staticKeyboard,blanket,anchors:{work:[8.85,2.55,1.51],sofa:[7.95,7.7,.96],bed:[2.42,6.65,1.15]}};
}
