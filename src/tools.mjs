import {check,text,HttpError} from './errors.mjs';
export const LOCAL_TOOLS=[
 {name:'companion_status',label:'自身状态',group:'陪伴',readOnly:true},
 {name:'clock',label:'北京时间',group:'生活',readOnly:true},
 {name:'translate',label:'翻译',group:'语言',readOnly:true},
 {name:'summarize',label:'文本摘要',group:'语言',readOnly:true},
 {name:'weather',label:'天气查询',group:'生活',readOnly:true,dependency:'mcp__web-search-safe__web_search'},
 {name:'web_summary',label:'网页摘要',group:'网页',readOnly:true,dependency:'mcp__web-search-safe__web_fetch'},
];
export const SAFE_TESTS=new Set(['mcp__snowluma__qq_status','mcp__snowluma-host__snowluma_status','mcp__web-search-safe__web_search','mcp__web-search-safe__web_fetch']);
export class ToolCatalog {
 constructor({list,call,model}){this.getList=list;this.call=call;this.model=model;}
 async list(){const registered=await this.getList();return [...LOCAL_TOOLS.map(x=>({...x,available:!x.dependency||registered.some(t=>t.name===x.dependency)})),...registered.map(t=>({name:t.name,label:t.description||t.name,group:t.name.split('__')[1]||'DSH',readOnly:SAFE_TESTS.has(t.name),available:true,testable:SAFE_TESTS.has(t.name)}))];}
 async test({name,input},snapshot){
  text(name,'工具名称',180);
  if(name==='clock')return {time:new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'full',timeStyle:'long'}).format(new Date())};
  if(name==='companion_status')return {night:snapshot.night,room:snapshot.room};
  if(name==='translate'||name==='summarize')return {text:await this.model.generate(name,text(input,'输入材料',20000))};
  if(name==='weather')return this.call('mcp__web-search-safe__web_search',{query:`${text(input,'城市或地点',100)} ${new Date().toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'})} 天气 实况 预报 来源`});
  if(name==='web_summary'){const url=text(input,'网页地址',2000);check(/^https?:\/\//i.test(url),'INVALID_INPUT','请输入网页地址');const source=await this.call('mcp__web-search-safe__web_fetch',{url});return {url,text:await this.model.generate('summarize',`来源：${url}\n${JSON.stringify(source).slice(0,50000)}`)};}
  check(SAFE_TESTS.has(name),'TOOL_NOT_TESTABLE','此工具没有只读试运行入口，请通过原会话按已有权限调用',403);
  const args=name.endsWith('web_search')?{query:text(input,'搜索内容',1000)}:name.endsWith('web_fetch')?{url:text(input,'网页地址',2000)}:{};
  return this.call(name,args);
 }
}
