import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {check,HttpError} from './errors.mjs';
export class Diary {
 constructor(file,call){this.file=file;this.call=call;}
 async list(){
  let raw;try{raw=await readFile(this.file,'utf8');}catch(e){if(e.code==='ENOENT')return [];throw new HttpError(503,'DIARY_UNAVAILABLE','日记主文件无法读取');}
  return raw.split(/\r?\n/).map((line,index)=>({line,index})).filter(x=>x.line.trim()).map(({line,index})=>{
   let data;try{data=JSON.parse(line);}catch{data={content:line,malformed:true};}
   return {...data,id:createHash('sha256').update(`${index}|${line}`).digest('hex').slice(0,24),line:index+1};
  }).reverse();
 }
 async write({content,mood=''}){
  check(typeof content==='string'&&content.trim(),'INVALID_INPUT','日记内容不能为空');
  check(typeof mood==='string','INVALID_INPUT','心情应为文本');
  const previous=new Set((await this.list()).map(d=>d.id));
  try{const result=await this.call('mcp__diary__diary_write',{content,mood});check(result&&!result.isError,'DIARY_WRITE','原日记服务未完成写入',502);}
  catch{try{const committed=(await this.list()).find(x=>!previous.has(x.id)&&x.content===content.trim());if(committed)return committed;}catch{}throw new HttpError(502,'UPSTREAM_UNKNOWN','日记写入结果未确认，已保留正文，请核对原日记后处理');}
  let entries;try{entries=await this.list();}catch{throw new HttpError(502,'UPSTREAM_UNKNOWN','日记写入后回查失败，结果待核对');}const entry=entries.find(x=>x.content===content.trim());
  check(entry,'UPSTREAM_UNKNOWN','日记服务返回后未在主文件中读到内容，请检查服务状态',502);return entry;
 }
}
