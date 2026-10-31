export function attachFrameBridge(win,getFrame,actions,fetcher=fetch){
 const pending=new Map();let disposed=false;
 const listener=async event=>{
  const frame=getFrame(),m=event.data;if(disposed||!frame||event.source!==frame||!m||m.channel!=='liuli-companion'||m.type!=='request')return;
  if(typeof m.id!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(m.id)||!actions.has(m.action)||pending.has(m.id)||pending.size>=8)return;
  const controller=new AbortController();pending.set(m.id,controller);const timer=setTimeout(()=>controller.abort(),70000);
  let payload;
  try{const response=await fetcher('/api/liuli/command',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action:m.action,body:m.body||{},revision:m.revision,requestId:m.id}),signal:controller.signal});payload=await response.json();if(!response.ok&&!payload.error)payload={error:{code:'HTTP_ERROR',message:`服务返回 HTTP ${response.status}`}};}
  catch{payload={error:{code:'CONNECTION_ERROR',message:'连接中断或请求超时。写入结果可能尚未确认，请先刷新实际状态。'}};}
  finally{clearTimeout(timer);pending.delete(m.id);}
  if(!disposed&&getFrame()===frame)frame.postMessage({channel:'liuli-companion',type:'response',id:m.id,payload},'*');
 };
 win.addEventListener('message',listener);
 return()=>{disposed=true;win.removeEventListener('message',listener);for(const c of pending.values())c.abort();pending.clear();};
}
