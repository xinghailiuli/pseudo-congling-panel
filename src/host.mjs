import {readFile,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import {randomBytes,randomUUID} from 'node:crypto';
import {CompanionStore,logEvent} from './store.mjs';import {BridgeApi,fileConfig} from './bridge-api.mjs';import {BasicMemory} from './basic-memory.mjs';import {Diary} from './diary.mjs';import {Model} from './model.mjs';import {QQ} from './qq.mjs';import {ToolCatalog} from './tools.mjs';import {CompanionService} from './service.mjs';import {createHandler,API_PATHS} from './routes.mjs';import {check,publicError} from './errors.mjs';
import {SAFE_TESTS} from './tools.mjs';
import {createActionAssetHandler,ACTION_ASSET_PATHS} from './action-assets.mjs';

export async function startHost(ctx,{workspace='D:/deepseenhanress',stateRoot=join(workspace,'qq-bot/state/liuli-companion')}={}){
 const store=await CompanionStore.open(stateRoot);let timer,stopped=false,running=Promise.resolve();const releases=[];
 try{
  let runtimeToken;const tokenPath=join(stateRoot,'runtime-token');
  try{runtimeToken=(await readFile(tokenPath,'utf8')).trim();}catch(e){if(e.code!=='ENOENT')throw e;runtimeToken=randomBytes(32).toString('hex');await writeFile(tokenPath,runtimeToken,{flag:'wx',mode:0o600});}
  check(/^[a-f0-9]{64}$/.test(runtimeToken),'RUNTIME_TOKEN','运行时凭据文件损坏',503);
  const bridgeRoot=join(workspace,'qq-bot/qq-bridge'),config=fileConfig(bridgeRoot),bridge=new BridgeApi({root:bridgeRoot,config});
  const call=async(name,args)=>{
   check(SAFE_TESTS.has(name)||/^(?:mcp__basic_memory__(?:read_note|write_note|search_notes|list_directory)|mcp__diary__diary_write)$/.test(name),'TOOL_DENIED','该工具未列入陪伴中心权限',403);
   check(ctx.tools?.get?.(name),'TOOL_UNAVAILABLE',`工具当前未加载：${name}`,503);
   const result=await ctx.tools.execute({name,arguments:args,callId:`liuli-${randomUUID()}`,signal:AbortSignal.timeout(60000)});
   const writing=name==='mcp__diary__diary_write'||name==='mcp__basic_memory__write_note';
   check(result&&!result.isError&&!result.error,writing?'UPSTREAM_UNKNOWN':'TOOL_FAILED',`工具操作${writing?'结果未确认':'失败'}：${name}`,502);return result.value??result;
  };
  const model=new Model({llm:()=>ctx.llm,target:async()=>{const c=await config();return {provider:c.dsh?.provider||'deepseek-official',model:c.dsh?.model||'deepseek-flash'};}});
  const tools=new ToolCatalog({list:async()=>ctx.tools.schemas().filter(x=>x.name!=='run_code').map(x=>({name:x.name,description:x.description})),call,model});
  const memory=new BasicMemory(call),diary=new Diary(join(workspace,'qq-bot/features/日记/diary.jsonl'),call),qq=new QQ({config});
  const role=await import(pathToFileURL(join(bridgeRoot,'src/role-card.js')).href);
  const service=new CompanionService({store,bridge,memory,diary,model,qq,tools,previewPersona:content=>role.selectRoleText(content,'v2'),runtimeInfo:()=>({version:'1.0.0',host:'DSH native',toolMode:ctx.tools.modeFor?.(),memoryTools:['read_note','write_note','search_notes','list_directory'].map(n=>({name:n,loaded:Boolean(ctx.tools.get(`mcp__basic_memory__${n}`))})),diaryTool:Boolean(ctx.tools.get('mcp__diary__diary_write'))})});
  await service.recover();
  const handler=createHandler({connection:ctx.connection,service,runtimeToken});
  for(const path of API_PATHS)releases.push(ctx.webServer.register({kind:'exact',path,handler}));
  const artwork=createActionAssetHandler({connection:ctx.connection});
  for(const path of ACTION_ASSET_PATHS)releases.push(ctx.webServer.register({kind:'exact',path,handler:artwork}));
  const loop=()=>{if(stopped)return;running=service.tick().catch(async e=>{if(!stopped)await store.update(null,s=>logEvent(s,'runtime-error',publicError(e)));}).finally(()=>{if(!stopped){timer=setTimeout(loop,30000);timer.unref?.();}});};timer=setTimeout(loop,1000);timer.unref?.();
  return {service,async close(){stopped=true;clearTimeout(timer);for(const release of releases)release();await running;await service.close();await store.close();}};
 }catch(e){clearTimeout(timer);for(const release of releases)release();await store.close();throw e;}
}
