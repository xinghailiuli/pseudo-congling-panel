import { readFile } from 'node:fs/promises';import {join} from 'node:path';
import { check, HttpError, redact, scopeKey } from './errors.mjs';
export const BRIDGE_ROUTES={
 status:['GET','/api/status'],roles:['GET','/api/roles'],persona:['GET','/api/roles/content'],personaSave:['POST','/api/roles/update'],
 config:['GET','/api/socialV2/config'],configSave:['POST','/api/socialV2/config'],model:['GET','/api/dsh/model'],admins:['GET','/api/whitelist'],
 sessions:['GET','/api/socialV2/states'],state:['GET','/api/socialV2/state'],unread:['GET','/api/socialV2/unread'],recent:['GET','/api/socialV2/recent'],
 wake:['POST','/api/socialV2/wake'],wakeConfig:['POST','/api/socialV2/wake-config'],activity:['GET','/api/socialV2/activity'],activitySave:['POST','/api/socialV2/activity'],
 memory:['GET','/api/socialV2/memory'],poke:['POST','/api/socialV2/send-poke'],prompt:['GET','/api/socialV2/prompt'],
};
export function fileConfig(root){return async()=>JSON.parse(await readFile(join(root,'config.json'),'utf8'));}
export class BridgeApi {
 constructor({root,config=root&&fileConfig(root),token,fetch:fetcher=fetch,timeoutMs=12000}){this.config=config;this.token=token||async function(){const c=await config();return c.consoleToken||String(await readFile(join(root,'state/console-token'),'utf8')).trim();};this.fetch=fetcher;this.timeoutMs=timeoutMs;}
 async request(action,args={}){
  check(Object.hasOwn(BRIDGE_ROUTES,action),'INVALID_ACTION','未知的桥接操作');
  const [method,path]=BRIDGE_ROUTES[action];if('key' in args)scopeKey(args.key);
  const config=await this.config();const port=config.consolePort||3100;check(Number.isInteger(port)&&port>0&&port<65536,'BRIDGE_CONFIG','QQ 管理端口无效',503);
  const url=new URL(`http://127.0.0.1:${port}${path}`);if(method==='GET')for(const [k,v] of Object.entries(args))if(v!==undefined)url.searchParams.set(k,String(v));
  let response;
  try{response=await this.fetch(url,{method,redirect:'error',headers:{'x-console-token':await this.token(),...(method==='POST'?{'content-type':'application/json'}:{})},body:method==='POST'?JSON.stringify(args):undefined,signal:AbortSignal.timeout(this.timeoutMs)});}
  catch{throw new HttpError(502,method==='POST'?'UPSTREAM_UNKNOWN':'BRIDGE_OFFLINE',method==='POST'?'请求中断，结果未确认。请先查看实际状态，勿重复提交。':'QQ 桥接无法连接');}
  let result;try{result=await response.json();}catch{throw new HttpError(502,'BRIDGE_FORMAT','QQ 桥接返回格式不正确');}
  if(!response.ok||result.ok===false)throw new HttpError(response.status>=400?response.status:502,'BRIDGE_REJECTED',`QQ 桥接拒绝操作：${redact(String(result.error||'未说明原因'))}`);
  return redact(result);
 }
}
