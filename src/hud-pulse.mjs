// Character-only simulation. Energy remains owned by the existing night service.
export function createCompanionPulse(){
 let value=null,lastTime=null,touched=-Infinity;
 const levels={sleep:[58,'熟睡'],lounge:[67,'休息'],rest:[69,'歇脚'],terrace:[69,'歇脚'],read:[70,'阅读'],write:[76,'书写'],type:[79,'打字'],walk:[90,'走动'],garden:[87,'园艺'],enchant:[81,'专注'],pat:[84,'互动']};
 return {
  touch(now){if(Number.isFinite(now))touched=now;},
  sample({now=0,activity='auto',sleeping=false,energy=70}={}){
   now=Number.isFinite(now)?Math.max(lastTime??now,now):(lastTime??0);
   const [base,label]=levels[sleeping?'sleep':activity]||[73,'陪伴'];
   const tired=Number.isFinite(energy)?Math.max(-2,Math.min(2,(energy-70)/20)):0;
   const variation=Math.sin(now/5100)*1.8+Math.sin(now/11300+.8)*1.2;
   const affection=sleeping?0:14*Math.exp(-Math.max(0,now-touched)/9000);
   const target=Math.max(50,Math.min(110,base+tired+variation+affection));
   const seconds=lastTime===null?0:Math.min(5,(now-lastTime)/1000);
   if(value===null)value=target;
   else value+=Math.max(-2.5*seconds,Math.min(2.5*seconds,(target-value)*(1-Math.exp(-seconds/4))));
   lastTime=now;
   return {bpm:Math.round(value),label,period:60/value,fill:Math.round((value-45)/65*100)};
  }
 };
}
