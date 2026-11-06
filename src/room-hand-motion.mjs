// Small wrist strokes with compact influence; head and seated support are fixed.
export function roomHandStroke(x,y,time=0,{writing=false,original=false}={}){
 if(y<=.49)return [x,y];
 const knots=original?[[.10,.625],[.17,.69]]:[[.135,.535],[.075,.595]];
 let dx=0,dy=0;
 const cycle=((time%6200)+6200)%6200,active=cycle<4400?Math.min(1,cycle/350,(4400-cycle)/350):0;
 for(let i=0;i<knots.length;i++){
  const[cx,cy]=knots[i],rx=.09,ry=.043,u=(x-cx)/rx,v=(y-cy)/ry,weight=Math.max(0,1-u*u-v*v)**2;
  const phase=time/(writing?330:145)+i*Math.PI;
  if(writing&&i===1)continue;
  dx+=weight*active*Math.sin(phase)*(writing?.012:.003);
  dy+=weight*active*(writing?Math.sin(phase*1.7)*.004:-Math.max(0,Math.sin(phase))*.010);
 }
 return [x+dx,y+dy];
}
