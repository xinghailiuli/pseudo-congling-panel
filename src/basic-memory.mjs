import { HttpError, check } from './errors.mjs';
// All note bodies remain in the existing Basic Memory project. Companion state
// holds identifiers and relationship/retention metadata, never a second vault.
export class BasicMemory {
  constructor(call,{project='personal'}={}){this.call=call;this.project=project;}
  async invoke(name,args){
    const raw=await this.call(`mcp__basic_memory__${name}`,{...args,project:this.project});
    check(raw&&!raw.isError,'MEMORY_UNAVAILABLE','Basic Memory 当前不可用',503);
    let value=raw.structuredContent??raw.value??raw;if(value&&Object.hasOwn(value,'result'))value=value.result;
    check(value&&typeof value==='object'&&!value.error,'MEMORY_ERROR','Basic Memory 操作未完成',502);
    if(value.content&&Array.isArray(value.content)){
      const t=value.content.filter(x=>x.type==='text').map(x=>x.text).join('\n');
      try{return JSON.parse(t);}catch{if(name==='read_note')return {content:t};throw new HttpError(502,'MEMORY_FORMAT','Basic Memory 返回格式不正确');}
    }
    check(!value.error,'MEMORY_ERROR','Basic Memory 操作未完成',502);return value;
  }
  async write(record){
    const content=`---\nliuli_id: ${JSON.stringify(record.id)}\nscope: ${JSON.stringify(record.scope)}\nsubject: ${JSON.stringify(record.subject)}\nsource_id: ${JSON.stringify(record.sourceId)}\n---\n\n${record.content}\n\n## 来源证据\n${record.evidence}`;
    const directory=`liuli/${record.scope.replace(':','-')}`,identifier=`${directory}/liuli-${record.id}`;
    try{const result=await this.invoke('write_note',{title:`liuli-${record.id}`,directory,content,tags:['liuli-companion'],output_format:'json'});check(typeof result.permalink==='string','MEMORY_FORMAT','Basic Memory 未返回笔记标识',502);return result.permalink;}
    catch(error){try{const existing=await this.invoke('read_note',{identifier,include_content:true,include_frontmatter:true,output_format:'json'});const body=v=>String(v||'').replace(/\r\n/g,'\n').replace(/^---\n[\s\S]*?\n---\n/,'').trim(),meta=existing.frontmatter;const matches=meta?String(meta.liuli_id)===record.id&&String(meta.scope)===record.scope&&String(meta.subject)===record.subject&&String(meta.source_id)===record.sourceId:existing.content?.trim()===content.trim();if(matches&&body(existing.content)===body(content))return existing.permalink||identifier;}catch{}throw new HttpError(502,'UPSTREAM_UNKNOWN','记忆写入结果未确认，已保留任务，请核对 Basic Memory 中的对应笔记');}
  }
  async read(ref){const r=await this.invoke('read_note',{identifier:ref,include_content:true,include_frontmatter:true,output_format:'json'});check(typeof r.content==='string','MEMORY_FORMAT','笔记内容不可读取',502);return r.content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/,'').split('\n## 来源证据')[0].trim();}
  async search(query,page=1){return this.invoke('search_notes',{query,page,page_size:50,output_format:'json'});}
  async list(page=1){return this.invoke('list_directory',{dir_name:'/',depth:5,page,page_size:100,output_format:'json'});}
  async hydrate(records){return Promise.all(records.map(async r=>({...r,content:r.sourceRef?await this.read(r.sourceRef):r.content||''})));}
}
