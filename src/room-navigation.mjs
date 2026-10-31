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
 return {nodes,edges,targets,start:targets[start]||'aisle',speed:120,stride:62};
}
