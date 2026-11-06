// Register head, pelvis and feet separately while changing the drawn pose.
// This keeps a seated pelvis planted and lets the upper body bend continuously.
export function poseWorld(p, point){const pivot=p?.pivot||p?.at||[0,0],pt=point||pivot,r=(p?.rotation||0)*Math.PI/180,scale=Number.isFinite(p?.scale)?p.scale:1,x=(pt[0]-pivot[0])*scale,y=(pt[1]-pivot[1])*scale;return [(p?.at?.[0]||0)+x*Math.cos(r)-y*Math.sin(r),(p?.at?.[1]||0)+x*Math.sin(r)+y*Math.cos(r)];}
export function transitionWindow(sample){if(!sample?.nextFrame||(sample.nextFrame.atlas===sample.frame?.atlas&&sample.nextFrame.cell===sample.frame?.cell))return 0;const d=sample.duration||0,w=Math.min(600,d*.7),x=d>0?Math.max(0,Math.min(1,(sample.progress*d-(d-w))/w)):0;return x*x*(3-2*x);}
export function poseMeshPoint(point,from,to,geometry,amount,targetGeometry=geometry){
 const a=geometry.frames?.[from.cell]||geometry.frames?.[0]||{crop:[0,0,100,100]},b=targetGeometry.frames?.[to.cell]||targetGeometry.frames?.[0]||{crop:[0,0,100,100]},base=poseWorld(from,point);
 const sole=f=>f.anchor||(f.crop?[f.crop[0]+f.crop[2]*.5,f.crop[1]+f.crop[3]]:[0,0]);
 const pairs=[[from.head,to.head],[a.hip||from.pivot,b.hip||to.pivot],[sole(a),sole(b)]].filter(p=>p[0]&&p[1]&&Array.isArray(p[0])&&Array.isArray(p[1]));
 let total=0,dx=0,dy=0;const aW=a.crop?.[2]||100,aH=a.crop?.[3]||100;
 for(const [s,t]of pairs){const distance=Math.hypot((point[0]-s[0])/aW,(point[1]-s[1])/aH),weight=1/Math.max(.002,distance**3),u=poseWorld(from,s),v=poseWorld(to,t);total+=weight;dx+=(v[0]-u[0])*weight;dy+=(v[1]-u[1])*weight;}
 return total>0?[base[0]+amount*dx/total,base[1]+amount*dy/total]:base;
}
