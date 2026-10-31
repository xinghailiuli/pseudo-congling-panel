// Deliberately use the viewing computer's local Date accessors. No fixed timezone.
export function roomDaylight(timestamp=Date.now()) {
 const date=new Date(timestamp),hour=date.getHours()+date.getMinutes()/60+date.getSeconds()/3600;
 const stops=[
  [0,'#101a37','#364665',.2,1,0,1],
  [5,'#252d50','#a17b91',.35,.7,0,.6],
  [6,'#8e92b4','#f5c7aa',.65,.15,.6,.15],
  [8,'#7db9dc','#d8edf0',1,0,1,0],
  [16,'#78b6d8','#d2e7e6',1,0,1,0],
  [18,'#84779f','#f0ae88',.65,.05,.7,0],
  [19.5,'#303b62','#77617d',.35,.65,0,.7],
  [21,'#101a37','#364665',.2,1,0,1],
  [24,'#101a37','#364665',.2,1,0,1]
 ];
 const high=stops.findIndex(s=>s[0]>hour),a=stops[Math.max(0,high-1)],b=stops[high<0?stops.length-1:high],t=(hour-a[0])/(b[0]-a[0]||1);
 const mix=(a,b)=>a+(b-a)*t,colour=(a,b)=>'#'+[1,3,5].map(i=>Math.round(mix(parseInt(a.slice(i,i+2),16),parseInt(b.slice(i,i+2),16))).toString(16).padStart(2,'0')).join('');
 const brightness=mix(a[3],b[3]),shade=(night,day)=>{const k=brightness;return '#'+[1,3,5].map(i=>Math.round(parseInt(night.slice(i,i+2),16)*(1-k)+parseInt(day.slice(i,i+2),16)*k).toString(16).padStart(2,'0')).join('');};
 return {hour,phase:hour>=5&&hour<8?'dawn':hour>=8&&hour<17?'day':hour>=17&&hour<19.5?'dusk':'night',top:colour(a[1],b[1]),horizon:colour(a[2],b[2]),brightness,stars:mix(a[4],b[4]),sun:mix(a[5],b[5]),moon:mix(a[6],b[6]),land:shade('#173140','#86ad70'),near:shade('#142b36','#5e9258'),water:shade('#2b496a','#86c6d2')};
}

let roomDaylightSerial=0;
export function createRoomDaylight({document:doc,defs,parent,owner=parent,source,now=()=>Date.now(),schedule=doc.defaultView?.setTimeout.bind(doc.defaultView),cancel=doc.defaultView?.clearTimeout.bind(doc.defaultView)}={}){
 const el=(tag,attrs={})=>{const n=doc.createElementNS('http://www.w3.org/2000/svg',tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const id='room-local-window-'+(++roomDaylightSerial),clip=el('clipPath',{id,clipPathUnits:'userSpaceOnUse'});
 // Stay inside the glass; recoloring the source retains its foliage silhouettes.
 for(const points of ['747,195 791,188 791,246 747,253','812,186 869,178 869,238 812,246','892,175 946,167 946,228 892,235','964,165 978,163 978,189 964,192'])clip.append(el('polygon',{points}));
 defs.append(clip);
 const gradient=el('linearGradient',{id:id+'-sky',x1:0,y1:0,x2:0,y2:1}),top=el('stop',{offset:0}),bottom=el('stop',{offset:1});gradient.append(top,bottom);defs.append(gradient);
 const root=el('g',{'data-room-daylight':'local','clip-path':`url(#${id})`,'pointer-events':'none','aria-hidden':'true'});parent.append(root);
 root.append(el('rect',{x:740,y:155,width:245,height:115,fill:`url(#${id}-sky)`}));
 const sun=el('rect',{x:848,y:182,width:12,height:12,rx:1,fill:'#ffedb7'}),moon=el('path',{d:'M846,179 h13 v4 h-5 v9 h5 v4 h-13 Z',fill:'#e5e4d2'});root.append(sun,moon);
 const stars=el('g',{fill:'#f7f1d7'});for(const[x,y,size]of [[757,202,1.5],[783,197,1],[819,202,1.2],[832,191,1.5],[864,189,1],[901,183,1.3],[913,201,1],[940,180,1.2]])stars.append(el('rect',{x,y,width:size,height:size}));root.append(stars);
 const far=el('path',{d:'M740,239 v-8 h18 v-10 h13 v7 h16 v-12 h18 v8 h20 v-7 h11 v-7 h16 v13 h19 v-15 h16 v8 h13 v-16 h13 v9 h14 v-12 h13 v9 h17 v-12 h20 v60 Z'});
 const near=el('path',{d:'M740,249 v-5 h20 v-5 h19 v9 h17 v-8 h18 v5 h21 v-8 h18 v-7 h17 v8 h20 v-10 h18 v6 h16 v-12 h20 v8 h25 v-10 h16 v45 Z'});
 const water=el('path',{d:'M805,263 l20,-17 h14 l8,-9 h17 l-6,7 h-15 l-6,11 h-9 l-8,12 Z'});root.append(far,near,water);
 const clouds=el('g',{fill:'#f5f2e7'});clouds.append(el('path',{d:'M760,215 h9 v-4 h13 v4 h9 v4 h-31 Z M895,193 h8 v-4 h14 v4 h10 v4 h-32 Z'}));root.append(clouds);
 const lightFilter=el('filter',{id:id+'-light','color-interpolation-filters':'sRGB'}),matrix=el('feColorMatrix',{type:'matrix'});lightFilter.append(matrix);defs.append(lightFilter);
 const picture=el('image',{...(source?{href:source}:{}),x:0,y:0,width:1536,height:1024,preserveAspectRatio:'none',filter:`url(#${id}-light)`,display:source?'inline':'none'}),tint=el('rect',{x:740,y:155,width:245,height:115,fill:`url(#${id}-sky)`});
 root.append(picture,tint,sun,moon,stars);
 let last='',timer=null,stopped=false;
 function update(timestamp=now()){
  const date=new Date(timestamp),key=Math.floor(timestamp/30000)+':'+date.getTimezoneOffset();if(key===last)return;last=key;
  const s=roomDaylight(timestamp);root.setAttribute('data-daylight-phase',s.phase);root.setAttribute('data-local-hour',s.hour.toFixed(2));top.setAttribute('stop-color',s.top);bottom.setAttribute('stop-color',s.horizon);far.setAttribute('fill',s.land);near.setAttribute('fill',s.near);water.setAttribute('fill',s.water);stars.setAttribute('opacity',s.stars);sun.setAttribute('opacity',s.sun);moon.setAttribute('opacity',s.moon);clouds.setAttribute('opacity',s.brightness*.55);
  const b=s.brightness;matrix.setAttribute('values',`${.04+.96*b} 0 0 0 0 0 ${.09+.91*b} 0 0 0 0 0 ${.19+.81*b} 0 0 0 0 0 1 0`);tint.setAttribute('opacity',source?(1-b)*.35:0);
 }
 function destroy(){stopped=true;if(timer!=null)cancel?.(timer);timer=null;doc.removeEventListener?.('visibilitychange',visible);}
 function queue(){if(stopped||doc.hidden||!schedule)return;timer=schedule(()=>{const old=timer;timer=null;cancel?.(old);if(owner.isConnected===false){destroy();return;}update();queue();},30000);}
 function visible(){if(timer!=null)cancel?.(timer);timer=null;if(!doc.hidden&&!stopped){update();queue();}}
 update();doc.addEventListener?.('visibilitychange',visible);queue();
 return {element:root,picture,update,destroy};
}
