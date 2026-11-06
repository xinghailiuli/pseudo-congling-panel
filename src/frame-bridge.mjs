export function attachFrameBridge(win,getFrame,actions,fetcher=fetch){
 const pending=new Map(),queue=[],queuedIds=new Set();let disposed=false;
 const run=async(frame,m)=>{
  const controller=new AbortController();pending.set(m.id,controller);const timer=setTimeout(()=>controller.abort(),70000);
  let payload;
  try{const response=await fetcher('/api/liuli/command',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:m.action,body:m.body||{},revision:m.revision,requestId:m.id}),signal:controller.signal});payload=await response.json();if(!response.ok&&!payload.error)payload={error:{code:'HTTP_ERROR',message:`服务返回 HTTP ${response.status}`}};}
  catch{payload={error:{code:'CONNECTION_ERROR',message:'连接中断或请求超时。写入结果可能尚未确认，请先刷新实际状态。'}};}
  finally{clearTimeout(timer);pending.delete(m.id);while(!disposed&&pending.size<8&&queue.length){const next=queue.shift();queuedIds.delete(next.m.id);if(getFrame()===next.frame)void run(next.frame,next.m);}}
  if(!disposed&&getFrame()===frame)frame.postMessage({channel:'liuli-companion',type:'response',id:m.id,payload},'*');
 };
 const listener=event=>{
  const frame=getFrame(),m=event.data;if(disposed||!frame||event.source!==frame||!m||m.channel!=='liuli-companion'||m.type!=='request')return;
  if(typeof m.id!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(m.id)||!actions.has(m.action)||pending.has(m.id)||queuedIds.has(m.id))return;
  if(pending.size>=8){if(queue.length<64){queuedIds.add(m.id);queue.push({frame,m});}return;}
  return run(frame,m);
 };
 win.addEventListener('message',listener);
 return()=>{disposed=true;win.removeEventListener('message',listener);queue.length=0;queuedIds.clear();for(const c of pending.values())c.abort();pending.clear();};
}
