import {timingSafeEqual} from 'node:crypto';import {check,HttpError,publicError} from './errors.mjs';
export const API_PATHS=['/api/liuli/state','/api/liuli/command','/api/liuli/runtime'];
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
async function jsonBody(req){
 check(/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''),'CONTENT_TYPE','需要 JSON 请求',415);
 check(!req.headers['content-encoding'],'CONTENT_ENCODING','不接受压缩请求体',415);
 const chunks=[];let bytes=0;for await(const chunk of req){bytes+=chunk.length;check(bytes<=12*1024*1024,'BODY_LIMIT','请求体过大',413);chunks.push(chunk);}
 try{const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));check(data&&typeof data==='object'&&!Array.isArray(data),'BAD_JSON','JSON 应为对象');return data;}catch(e){if(e instanceof HttpError)throw e;throw new HttpError(400,'BAD_JSON','JSON 无法解析');}
}
function send(res,status,data){if(res.writableEnded)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
export function createHandler({connection,service,runtimeToken}){
 return async(req,res)=>{
  try{
   const rejection=connection?.requestRejection(req);check(connection&&rejection===undefined,'AUTH_REQUIRED',rejection===401?'请在 Harness 中登录后使用':'请求未通过 Harness 鉴权',rejection||403);
   const pathname=new URL(req.url,'http://localhost').pathname;check(API_PATHS.includes(pathname),'NOT_FOUND','接口不存在',404);
   if(req.headers.origin){let origin;try{origin=new URL(req.headers.origin);}catch{throw new HttpError(403,'ORIGIN','来源不合法');}check(origin.host===req.headers.host&&['http:','https:'].includes(origin.protocol),'ORIGIN','请求来源不匹配',403);}
   if(req.headers['sec-fetch-site'])check(['same-origin','none'].includes(req.headers['sec-fetch-site']),'ORIGIN','不接受跨站请求',403);
   if(pathname==='/api/liuli/state'){check(req.method==='GET','METHOD','需要 GET',405);send(res,200,await service.dispatch('/overview'));return;}
   check(req.method==='POST','METHOD','需要 POST',405);
   if(pathname==='/api/liuli/runtime')check(same(req.headers['x-liuli-runtime'],runtimeToken),'RUNTIME_AUTH','仅允许现有 QQ 桥接调用此接口',403);
   const body=await jsonBody(req);
   if(pathname==='/api/liuli/command')send(res,200,await service.dispatch(body.action,body.body||{},body.revision,body.requestId));
   else{
    const allowed={ingest:'ingest',beforeWake:'beforeWake',context:'context',delivered:'delivered'};check(Object.hasOwn(allowed,body.action),'INVALID_ACTION','未知运行时操作');
    send(res,200,{data:await service[allowed[body.action]](body.body||{}),revision:service.state().revision});
   }
  }catch(error){send(res,error instanceof HttpError?error.status:500,{error:publicError(error)});}
 };
}
