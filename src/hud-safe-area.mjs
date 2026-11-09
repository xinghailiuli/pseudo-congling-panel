// Read-only obstacle measurement. Only this panel's iframe is resized/repositioned.
export function fitHudViewport(bounds, blockers, gap = 8) {
 const fit=r=>{const width=Math.min(r.width,r.height*16/9),height=width*9/16;return {x:r.x+(r.width-width)/2,y:r.y+(r.height-height)/2,width,height}};
 const hit=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
 const initial=fit(bounds), obstacles=blockers.filter(b=>b.width>0&&b.height>0).map(b=>({x:b.x-gap,y:b.y-gap,width:b.width+gap*2,height:b.height+gap*2}));
 if(!obstacles.some(b=>hit(initial,b)))return initial;
 let candidates=[bounds];
 for(const b of obstacles){
  candidates=candidates.flatMap(r=>{
   if(!hit(r,b))return [r];
   return [{...r,height:b.y-r.y},{...r,y:b.y+b.height,height:r.y+r.height-b.y-b.height},{...r,width:b.x-r.x},{...r,x:b.x+b.width,width:r.x+r.width-b.x-b.width}].filter(r=>r.width>0&&r.height>0);
  });
 }
 const centerDistance=r=>Math.abs(r.x+r.width/2-initial.x-initial.width/2)+Math.abs(r.y+r.height/2-initial.y-initial.height/2);
 return candidates.map(fit).sort((a,b)=>b.width-a.width||centerDistance(a)-centerDistance(b))[0]||initial;
}

export function attachHudSafeArea({surface,frame,win=window,doc=win.document}) {
 if(!surface||!frame)return ()=>{};
 let enabled=true,last='',timer;
 const reset=()=>{Object.assign(frame.style,{left:'0px',top:'0px',width:'100%',height:'100%'});last='';};
 const update=()=>{
  if(!enabled||doc.hidden||!surface.isConnected)return;
  const b=surface.getBoundingClientRect();if(!b.width||!b.height)return;
  // Include the observed character, context/CNY card and speech bubbles. The
  // installed web-UI pet uses hashed CSS prefixes with stable _float/_bubbleStack
  // suffixes. Only measure them; never write their styles, positions or storage.
  const blockers=[...doc.querySelectorAll('#dsh-whale-girl-mount .wg-root, #dsh-whale-girl-mount .wg-context, #dsh-whale-girl-mount .wg-info, #dsh-whale-girl-mount .wg-bubble, [class$="_float"], [class$="_float"] [class$="_bubbleStack"]')]
   .filter(e=>{const s=win.getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)!==0})
   .map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}});
  const r=fitHudViewport({x:b.x,y:b.y,width:b.width,height:b.height},blockers);
  const key=[r.x-b.x,r.y-b.y,r.width,r.height].map(n=>n.toFixed(2)).join(',');if(key===last)return;last=key;
  Object.assign(frame.style,{left:(r.x-b.x)+'px',top:(r.y-b.y)+'px',width:r.width+'px',height:r.height+'px'});
  surface.dataset.hudSafeArea=blockers.length?'measured':'clear';
 };
 const receive=e=>{if(e.source!==frame.contentWindow||e.data?.channel!=='liuli-companion'||e.data.type!=='hud-safe-area')return;enabled=e.data.enabled===true;if(enabled)update();else reset()};
 const onLoad=()=>{if(enabled)update();else reset()};
 win.addEventListener('resize',update);win.addEventListener('message',receive);doc.addEventListener('visibilitychange',update);frame.addEventListener('load',onLoad);
 const observer=typeof win.ResizeObserver==='function'?new win.ResizeObserver(update):null;observer?.observe(surface);
 timer=win.setInterval(update,750);update();
 return ()=>{win.clearInterval(timer);observer?.disconnect();win.removeEventListener('resize',update);win.removeEventListener('message',receive);doc.removeEventListener('visibilitychange',update);frame.removeEventListener('load',onLoad);reset();};
}
