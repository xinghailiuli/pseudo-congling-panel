// Visual activity only. This module never issues service commands.
export function roomActivity(room, night = {}, jobs = [], preview = 'auto', elapsed = 0, {upstairs=false} = {}) {
  const labels = { sleep:'裹好被子，做个好梦', write:'坐下来写几行字', type:'在窗边敲敲键盘', lounge:'窝在沙发里歇一会', walk:'在小屋里慢慢散步' };
  if(upstairs)Object.assign(labels,{read:'在书架旁翻几页喜欢的书',enchant:'跟着书页练习一个小魔法',garden:'给温室里的小麦浇点水',rest:'坐在露台上，慢慢歇一会'});
  const cycle = upstairs?['walk','lounge','write','read','enchant','garden','rest','type']:['walk','lounge','walk','write','walk','type'];
  let mode = cycle[Math.floor(Math.max(0,elapsed)/20000)%cycle.length], source='leisure';
  if(night?.sleeping){mode='sleep';source='night';}
  else if(jobs.some(j=>j.kind==='diary'&&j.status==='running')){mode='write';source='diary';}
  if(Object.hasOwn(labels,preview)){mode=preview;source='preview';}
  const required={sleep:['床'],write:['书桌','椅子','日记本'],type:['书桌','椅子','电脑'],lounge:['沙发'],read:['书架'],enchant:['书架'],garden:['盆栽']}[mode]||[];
  const missing=required.find(name=>!room.items?.some(i=>i.name===name));
  if(missing)return {mode:'walk',source,label:`房间里暂时没有${missing}，先散散步`};
  return {mode,source,label:labels[mode]};
}

export function roomWalkPoint(elapsed = 0, options = {}) {
  const points=options.points||[[5.2,4.6],[9.9,4.6],[9.9,8],[9.9,4.6],[5.2,4.6]];
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  // A complete left/right stride travels about 44 projected pixels, matching
  // the foot span in the registered sheet at its rendered size. Ease velocity
  // only at the ends; the animation clock is distance, not wall-clock time.
  const {speed=.7,stride=1.04,pause=650,ramp=320}=options;
  const duration=lengths.reduce((a,b)=>a+b/speed*1000+ramp+pause,0);
  let clock=Math.max(0,elapsed)%duration,covered=0;
  for(let i=0;i<lengths.length;i++){
    const a=points[i],b=points[i+1],facing=(options.screenSpace?b[0]>a[0]:b[0]-b[1]>a[0]-a[1])?1:-1;
    if(clock<pause)return {x:a[0],y:a[1],facing,moving:false,distance:covered,step:Math.floor(covered/(stride/2)),frame:null};
    clock-=pause;
    const travel=lengths[i]/speed*1000+ramp;
    if(clock<=travel){
      const local=clock<ramp?speed*clock*clock/(2*ramp*1000):clock>travel-ramp?lengths[i]-speed*(travel-clock)**2/(2*ramp*1000):speed*(clock-ramp/2)/1000;
      const k=local/lengths[i],distance=covered+local;
      return {x:a[0]+(b[0]-a[0])*k,y:a[1]+(b[1]-a[1])*k,facing,moving:true,distance,step:Math.floor(distance/(stride/2)),frame:Math.floor(local/stride*8)%8};
    }
    clock-=travel;covered+=lengths[i];
  }
  return {x:points[0][0],y:points[0][1],facing:1,moving:false,distance:0,step:0,frame:null};
}
