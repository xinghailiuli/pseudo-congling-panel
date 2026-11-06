export function createRoomIdleEvents(random=Math.random){
 let next=60000,event=null;
 return {snapshot:()=>({next,event:event?{...event,point:[...event.point]}:null}),restore(value){if(!value||!Number.isFinite(value.next)||value.event&&(!Number.isFinite(value.event.at)||!Array.isArray(value.event.point)||!value.event.point.every(Number.isFinite)))return;next=value.next;event=structuredClone(value.event);},
 sample({time,safe,point,goal}){
  if(event&&goal!==event.goal&&!event.returnAt)event.returnAt=time;
  if(event&&(time>=(event.returnAt||event.at+2400)+400))event=null;
  if(!event&&safe&&time>=next){next=time+60000+random()*30000;if(random()<.18){const cells=[2,3,4,6,7];event={at:time,point:[...point],goal,cell:cells[Math.min(4,Math.floor(random()*5))]};}}
  if(!event)return null;const local=time-event.at,returning=Boolean(event.returnAt)||local>=2400;
  return {position:[...event.point],cell:returning?event.cell:local<400?0:event.cell,nextCell:returning?0:event.cell,progress:returning?(time-(event.returnAt||event.at+2400))/400:local<400?local/400:0,duration:returning||local<400?400:2000,returning,block:true};
 }
 };
}
