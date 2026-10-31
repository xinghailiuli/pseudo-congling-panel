import {readFile,writeFile} from 'node:fs/promises';import {join,isAbsolute} from 'node:path';import {homedir} from 'node:os';import {randomBytes,randomUUID} from 'node:crypto';
import {CompanionStore,logEvent} from './store.mjs';import {BridgeApi,fileConfig} from './bridge-api.mjs';import {BasicMemory} from './basic-memory.mjs';import {Diary} from './diary.mjs';import {Model} from './model.mjs';import {QQ} from './qq.mjs';import {ToolCatalog} from './tools.mjs';import {CompanionService} from './service.mjs';import {createHandler,API_PATHS} from './routes.mjs';import {check,publicError} from './errors.mjs';
import {SAFE_TESTS} from './tools.mjs';
import {createActionAssetHandler,ACTION_ASSET_PATHS} from './action-assets.mjs';
import {createPetAssetHandler,PET_ASSET_PATH} from './pet-assets.mjs';
import {selectRoleText} from './role-card.js';

export async function startHost(ctx,options={}){
 const stateRoot=options.stateRoot||process.env.LIULI_DATA_DIR||join(process.env.DSH_HOME||join(homedir(),'.dsh'),'data','dsh-whale-status');
 const bridgeRoot=options.bridgeRoot||process.env.LIULI_BRIDGE_ROOT||null;
 const diaryFile=options.diaryFile||process.env.LIULI_DIARY_FILE||join(stateRoot,'diary.jsonl');
 for(const [name,path]of Object.entries({stateRoot,bridgeRoot,diaryFile}))check(path===null||typeof path==='string'&&isAbsolute(path),'HOST_CONFIG',`${name} 必须是绝对路径`,503);
 const store=await CompanionStore.open(stateRoot);let timer,stopped=false,running=Promise.resolve();const releases=[];
 try{
  let runtimeToken;const tokenPath=join(stateRoot,'runtime-token');
  try{runtimeToken=(await readFile(tokenPath,'utf8')).trim();}catch(e){if(e.code!=='ENOENT')throw e;runtimeToken=randomBytes(32).toString('hex');await writeFile(tokenPath,runtimeToken,{flag:'wx',mode:0o600});}
  check(/^[a-f0-9]{64}$/.test(runtimeToken),'RUNTIME_TOKEN','运行时凭据文件损坏',503);
  const config=async()=>{check(bridgeRoot,'BRIDGE_NOT_CONFIGURED','尚未配置 QQ 桥接。小屋可独立使用；其他服务请参阅接入说明。',503);try{return await fileConfig(bridgeRoot)();}catch(e){if(e.code==='ENOENT')check(false,'BRIDGE_CONFIG','指定目录缺少 QQ 桥接 config.json，请检查 bridgeRoot。',503);throw e;}};
  const bridge=new BridgeApi({root:bridgeRoot,config});
  const call=async(name,args)=>{
   check(SAFE_TESTS.has(name)||/^(?:mcp__basic_memory__(?:read_note|write_note|search_notes|list_directory)|mcp__diary__diary_write)$/.test(name),'TOOL_DENIED','该工具未列入陪伴中心权限',403);
   check(ctx.tools?.get?.(name),'TOOL_UNAVAILABLE',`工具当前未加载：${name}`,503);
   const result=await ctx.tools.execute({name,arguments:args,callId:`liuli-${randomUUID()}`,signal:AbortSignal.timeout(60000)});
   const writing=name==='mcp__diary__diary_write'||name==='mcp__basic_memory__write_note';
   check(result&&!result.isError&&!result.error,writing?'UPSTREAM_UNKNOWN':'TOOL_FAILED',`工具操作${writing?'结果未确认':'失败'}：${name}`,502);return result.value??result;
  };
  const model=new Model({llm:()=>ctx.llm,target:async()=>{const c=bridgeRoot?await config():{};return {provider:options.provider||c.dsh?.provider||'deepseek-official',model:options.model||c.dsh?.model||'deepseek-flash'};}});
  const tools=new ToolCatalog({list:async()=>(ctx.tools?.schemas?.()||[]).filter(x=>x.name!=='run_code').map(x=>({name:x.name,description:x.description})),call,model});
  const memory=new BasicMemory(call,{project:options.memoryProject||'personal'}),diary=new Diary(diaryFile,call),qq=new QQ({config});
  const service=new CompanionService({store,bridge,memory,diary,model,qq,tools,previewPersona:content=>selectRoleText(content,'v2'),runtimeInfo:()=>({version:'1.1.0',product:'伪从绫开始的面板 1.1',host:'DSH native',bridgeConfigured:Boolean(bridgeRoot),toolMode:ctx.tools?.modeFor?.(),memoryTools:['read_note','write_note','search_notes','list_directory'].map(n=>({name:n,loaded:Boolean(ctx.tools?.get?.(`mcp__basic_memory__${n}`))})),diaryTool:Boolean(ctx.tools?.get?.('mcp__diary__diary_write'))})});
  await service.recover();
  const handler=createHandler({connection:ctx.connection,service,runtimeToken});
  for(const path of API_PATHS)releases.push(ctx.webServer.register({kind:'exact',path,handler}));
  const artwork=createActionAssetHandler({connection:ctx.connection});
  for(const path of ACTION_ASSET_PATHS)releases.push(ctx.webServer.register({kind:'exact',path,handler:artwork}));
  releases.push(ctx.webServer.register({kind:'exact',path:PET_ASSET_PATH,handler:createPetAssetHandler({connection:ctx.connection})}));
  const loop=()=>{if(stopped)return;running=service.tick().catch(async e=>{if(!stopped)await store.update(null,s=>logEvent(s,'runtime-error',publicError(e)));}).finally(()=>{if(!stopped){timer=setTimeout(loop,30000);timer.unref?.();}});};timer=setTimeout(loop,1000);timer.unref?.();
  return {service,async close(){if(stopped)return;stopped=true;clearTimeout(timer);for(const release of releases)release();await running;await service.close();await store.close();}};
 }catch(e){clearTimeout(timer);for(const release of releases)release();await store.close();throw e;}
}
