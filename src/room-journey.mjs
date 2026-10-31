// Finite routes use explicit walkable edges. Floor changes have a timed landing
// edge; redirecting cannot draw a nearest-node shortcut through furniture.
export function createRoomJourney({nodes,edges,targets,start,speed=100,stride=62}) {
 const points=Object.fromEntries(Object.entries(nodes).map(([key,p])=>[key,Array.isArray(p)?{x:p[0],y:p[1],floor:p[2]||1}:{...p}]));
 const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y),graph=Object.fromEntries(Object.keys(points).map(k=>[k,[]]));
 for(const[a,b,meta={}]of edges){const edge={a,b,kind:meta.kind||'walk',duration:meta.duration??distance(points[a],points[b])/speed*1000};graph[a].push(edge);graph[b].push(edge);}
 let segments=[],station=points[start],stationKey=start,stationPhase=0,target=null;
 const endTime=()=>segments.at(-1)?.end??0;
 function at(time){return segments.find(s=>time<s.end)||null;}
 function sample(time){
  const s=at(time),arrived=!s,p=s?Math.max(0,Math.min(1,(time-s.start)/(s.end-s.start))):1;
  // Keep forward momentum at tread boundaries. Per-step easing made the
  // resident brake to a stop, then lurch forward on every step.
  const k=p;
  const point=s?{x:s.from.x+(s.to.x-s.from.x)*k,y:s.from.y+(s.to.y-s.from.y)*k,floor:s.from.floor}:station;
  const gaitPhase=s?s.gaitStart+s.gaitSpan*k:stationPhase;
  const transition=s?.kind==='landing'?{from:s.from,to:s.to,progress:p}:null;
  return {...point,moving:!arrived,arrived,gaitPhase,frame:arrived?null:Math.floor(gaitPhase+1e-9)%8,facing:s&&s.to.x<s.from.x?-1:1,target,kind:s?.kind||'idle',ascending:s? s.to.floor>s.from.floor||(s.to.floor===s.from.floor&&s.to.y<s.from.y):false,transition,arrivesAt:endTime(),step:s?.step??0};
 }
 function shortest(begin,goal){
  const pending=new Set(Object.keys(points)),cost={[begin]:0},previous={};
  while(pending.size){const key=[...pending].reduce((a,b)=>(cost[a]??Infinity)<(cost[b]??Infinity)?a:b);pending.delete(key);if(!Number.isFinite(cost[key])||key===goal)break;
   for(const edge of graph[key]){const next=edge.a===key?edge.b:edge.a,candidate=cost[key]+edge.duration;if(candidate<(cost[next]??Infinity)){cost[next]=candidate;previous[next]={key,edge};}}
  }
  if(!Number.isFinite(cost[goal]))return null;
  const result=[];let key=goal;while(key!==begin){const prev=previous[key];result.unshift({...prev.edge,fromKey:prev.key,toKey:key});key=prev.key;}return {edges:result,cost:cost[goal]};
 }
 function go(mode,time){
  if(mode===target||!Object.hasOwn(targets,mode))return;
  const goal=targets[mode],old=at(time),current=sample(time);let prefix=[],begin=stationKey,clock=time;
  if(old?.kind==='landing'){
   // Finish the visible handoff before reversing, retaining its original clock.
   prefix=[old];begin=old.toKey;clock=old.end;
  }else if(old){
   const fraction=Math.max(0,Math.min(1,(time-old.start)/(old.end-old.start))),candidates=[{key:old.fromKey,portion:fraction},{key:old.toKey,portion:1-fraction}].map(c=>({...c,path:shortest(c.key,goal)})).filter(c=>c.path);
   const best=candidates.sort((a,b)=>a.path.cost+a.portion*(old.end-old.start)-b.path.cost-b.portion*(old.end-old.start))[0];if(!best)return;
   begin=best.key;const duration=distance(current,points[begin])/Math.max(.01,distance(old.from,old.to))*(old.end-old.start);
   if(duration>.001){prefix=[{...old,from:{x:current.x,y:current.y,floor:current.floor},to:points[begin],toKey:begin,fromKey:old.fromKey===begin?old.toKey:old.fromKey,start:time,end:time+duration,gaitStart:current.gaitPhase,gaitSpan:old.gaitSpan*duration/(old.end-old.start)}];clock+=duration;}
  }
  const path=shortest(begin,goal);if(!path)return;
  // Replanning changes the destination, not the foot that is currently down.
  // A partial tread consumes only its remaining share of a four-phase step.
  let gaitStart=prefix.length?prefix.at(-1).gaitStart+prefix.at(-1).gaitSpan:old?current.gaitPhase:0,step=0;segments=[...prefix];
  for(const e of path.edges){const from=points[e.fromKey],to=points[e.toKey],gaitSpan=e.kind==='stairs'?4:e.kind==='landing'?0:distance(from,to)/stride*8;segments.push({...e,from,to,start:clock,end:clock+e.duration,gaitStart,gaitSpan,step});clock+=e.duration;gaitStart+=gaitSpan;if(e.kind==='stairs')step++;}
  station=points[goal];stationKey=goal;stationPhase=gaitStart;target=mode;
 }
 return {go,sample};
}
