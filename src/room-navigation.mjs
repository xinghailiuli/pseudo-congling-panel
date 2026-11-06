// Feet coordinates calibrated against the illustrated floors. The graph goes
// around furniture; steps and the floor handoff are explicit edges, not jumps.
export function roomNavigation(start='type') {
 const nodes={},edges=[],point=(id,x,y,floor)=>{nodes[id]={x,y,floor};},link=(a,b,meta)=>edges.push([a,b,meta||{}]);
 for(const[id,x,y]of [['desk',1008,531],['aisle',1030,575],['front',1050,785],['sofaLane',650,564],['sofaApproach',672,650],['sofa',676,722],['entry',1175,762],['step0',1264,742],['step1',1283,708],['step2',1288,666],['step3',1284,621],['step4',1278,577],['step5',1269,538],['lowerLanding',1254,488]])point(id,x,y,1);
 link('desk','aisle');link('aisle','front');link('aisle','sofaLane');link('sofaLane','sofaApproach');link('sofaApproach','sofa');link('front','entry');link('entry','step0');
 const low=['step0','step1','step2','step3','step4','step5','lowerLanding'];for(let i=1;i<low.length;i++)link(low[i-1],low[i],{kind:'stairs',duration:480});
 for(const[id,x,y]of [['upperEntry',1360,746],['upperStep1',1352,713],['upperStep2',1342,681],['upperLanding',1330,646],['garden',1120,563],['gate',1030,583],['gateFoot',878,579],['gateStep',861,546],['gateTop',843,512],['hall',727,545],['book',704,535],['magic',548,510],['bed',581,611],['terraceEntry',1280,654],['terrace',1220,660],['restEast',1220,736],['restNorth',1050,625],['restWest',1050,736],['rest',1102,736]])point(id,x,y,2);
 link('lowerLanding','upperEntry',{kind:'landing',duration:1250});
 const high=['upperEntry','upperStep1','upperStep2','upperLanding'];for(let i=1;i<high.length;i++)link(high[i-1],high[i],{kind:'stairs',duration:480});
 link('upperLanding','garden');link('garden','gate');link('gate','gateFoot');link('gateFoot','gateStep',{kind:'stairs',duration:400});link('gateStep','gateTop',{kind:'stairs',duration:400});link('gateTop','hall');link('hall','book');link('hall','magic');link('hall','bed');
 // Finish the flight before turning left onto the new broad, level terrace.
 // The former bottom-tread diagonal ran through the inner stair support.
 link('upperLanding','terraceEntry');link('terraceEntry','terrace');link('terrace','restEast');link('restEast','rest');
 // The terrace is an open floor now. Approaches from the greenhouse and
 // left passage must reach the seat locally instead of returning to stairs.
 // The v10 bench occupies the old direct line. Approach its front from the
 // nearby end, keeping a full foot stance clear of both legs and stair support.
 link('garden','restNorth');link('restNorth','restWest');link('gate','restWest');link('restWest','rest');
 const targets={type:'desk',write:'desk',lounge:'sofa',walk:'aisle',sleep:'bed',read:'book',enchant:'magic',garden:'garden',rest:'rest',wanderFront:'front',wanderBack:'aisle'};
 for(const node of ['front','aisle','entry','sofaLane','hall','garden','terrace','restWest'])targets['roam-'+node]=node;
 for(const p of roomRoamingPoints()){const id='free-'+p.floor+'-'+p.x+'-'+p.y;point(id,p.x,p.y,p.floor);const anchors=Object.keys(nodes).filter(k=>!k.startsWith('free-')&&edges.some(e=>(e[0]===k||e[1]===k)&&!e[2].kind)&&roomWalkVisible(p,nodes[k]));if(anchors.length){link(id,anchors[0]);targets['roam-'+id]=id;}else delete nodes[id];}
 return {nodes,edges,targets,start:targets[start]||'aisle',speed:120,stride:62,canWalk:roomWalkVisible};
}
// Foot-space polygons include a stance margin. The raised upper-left landing
// and the lower terrace are separate islands, joined only by explicit stairs.
export function roomWalkVisible(a,b){
 if(a.floor!==b.floor)return false;
 const areas=a.floor===1?[
  [[980,518],[1110,505],[1122,615],[1118,743],[1184,750],[1185,792],[968,814],[948,774],[970,620]],
  [[635,538],[1034,535],[1054,580],[640,590]],
  [[632,552],[673,559],[702,741],[658,762],[619,599]]
 ]:[
  [[527,500],[750,489],[774,548],[701,584],[710,724],[635,759],[567,742],[563,590]],
  [[975,568],[1315,550],[1335,625],[1293,670],[1232,680],[1239,749],[1020,769],[984,689]]
 ];
 const obstacles=a.floor===1?[
  [[687,575],[820,530],[950,749],[787,824]],
  [[1106,624],[1207,612],[1208,745],[1121,764]]
 ]:[[[1068,650],[1185,636],[1200,710],[1070,730]]];
 const inside=(p,polygon)=>{let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const [x,y]=polygon[i],[xx,yy]=polygon[j];if((y>p.y)!==(yy>p.y)&&p.x<(xx-x)*(p.y-y)/(yy-y)+x)yes=!yes;
 }return yes;};
 const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/3));
 for(let i=0;i<=n;i++){const p={x:a.x+(b.x-a.x)*i/n,y:a.y+(b.y-a.y)*i/n};if(!areas.some(poly=>inside(p,poly))||obstacles.some(poly=>inside(p,poly)))return false;}
 return true;
}
export function chooseRoomWander(current,random=Math.random){
 const choices=Object.keys(roomNavigation().targets).filter(n=>n.startsWith('roam-')&&n!==current);
 return choices[Math.min(choices.length-1,Math.max(0,Math.floor(random()*choices.length)))];
}
function roomRoamingPoints(){const out=[];for(const floor of [1,2])for(let y=550;y<=760;y+=70)for(let x=600;x<=1300;x+=70){const p={x,y,floor};if(roomWalkVisible(p,p))out.push(p);}return out;}
