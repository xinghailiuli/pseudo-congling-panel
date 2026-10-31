import {check,HttpError,text,redact} from './errors.mjs';
const id=value=>{const s=String(value??'');check(/^[1-9]\d{0,19}$/.test(s),'INVALID_INPUT','QQ 或群号不正确');return s;};
const strip=value=>String(value||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&');
export function imageURL(value){
 text(value,'图片',10*1024*1024);
 if(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value))return 'base64://'+value.split(',')[1];
 let u;try{u=new URL(value);}catch{check(false,'INVALID_IMAGE','请上传 PNG/JPEG/WebP 图片，或使用 QQ 图片地址');}
 check(u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='q.qlogo.cn'||u.hostname.endsWith('.qpic.cn')||u.hostname.endsWith('.qlogo.cn')),'INVALID_IMAGE','头像链接必须来自 QQ 图片域名');return u.href;
}
export function parseQzone(body){
 check(typeof body==='string'&&body.length<=4*1024*1024,'QZONE_FORMAT','空间返回体过大或格式不正确',502);
 let raw=body.trim();if(!raw.startsWith('{')&&/^[\w.]+\s*\(/.test(raw))raw=raw.slice(raw.indexOf('(')+1,raw.lastIndexOf(')'));
 // Qzone feeds embeds unquoted object keys even with format=json. Quote keys
 // outside strings only; never evaluate remote JavaScript or rewrite string data.
 let normalized='';for(let i=0;i<raw.length;i++){
  const c=raw[i];
  if(c==='"'||c==="'"){
   const quote=c;let value='',closed=false;
   while(++i<raw.length){const ch=raw[i];if(ch===quote){closed=true;break;}if(ch==='\\'){const escaped=raw[++i],simple={n:'\n',r:'\r',t:'\t',b:'\b',f:'\f',v:'\v','0':'\0','\\':'\\',"'":"'",'"':'"','/':'/'};if(escaped==='u'||escaped==='x'){const size=escaped==='u'?4:2,hex=raw.slice(i+1,i+1+size);check(new RegExp(`^[0-9a-fA-F]{${size}}$`).test(hex),'QZONE_FORMAT','空间字符串转义无效',502);value+=String.fromCharCode(parseInt(hex,16));i+=size;}else if(Object.hasOwn(simple,escaped))value+=simple[escaped];else check(false,'QZONE_FORMAT','空间字符串转义未识别',502);}else{check(ch!=='\r'&&ch!=='\n','QZONE_FORMAT','空间字符串未正确结束',502);value+=ch;}}
   check(closed,'QZONE_FORMAT','空间字符串未正确结束',502);normalized+=JSON.stringify(value);continue;
  }
  if(/[A-Za-z_$]/.test(c)){const token=raw.slice(i).match(/^[A-Za-z_$][\w$]*/)[0];i+=token.length-1;normalized+=/^\s*:/.test(raw.slice(i+1))?JSON.stringify(token):token==='undefined'?'null':token;}
  else if(c!==','||!/^\s*[}\]]/.test(raw.slice(i+1)))normalized+=c;
 }
 let data;try{data=JSON.parse(normalized);}catch{throw new HttpError(502,'QZONE_FORMAT','空间返回无法解析，登录态可能已失效');}
 check(data&&typeof data==='object'&&!Array.isArray(data),'QZONE_FORMAT','空间返回格式不正确',502);
 check(![data.code,data.subcode,data.ret].some(c=>c!==undefined&&c!==null&&c!==0),'QZONE_REJECTED',`空间拒绝操作：${redact(String(data.message||data.msg||data.code))}`,502);return data;
}
export class QQ {
 constructor({config,fetch:fetcher=fetch}){this.config=config;this.fetch=fetcher;this.auth=null;}
 async call(action,params={},write=false){
  check(['get_login_info','get_status','get_version_info','get_cookies','get_credentials','set_qq_profile','set_self_longnick','set_group_card','set_qq_avatar'].includes(action),'INVALID_ACTION','不支持的 QQ 操作');
  const c=await this.config();const u=new URL(c.snowluma?.httpUrl||'http://127.0.0.1:3000');check(['127.0.0.1','localhost','[::1]'].includes(u.hostname)&&u.protocol==='http:','QQ_CONFIG','QQ 网关需要本机 HTTP 地址',503);
  const url=new URL('/'+action,u);let r;
  try{r=await this.fetch(url,{method:'POST',redirect:'error',headers:{'content-type':'application/json',...(c.snowluma?.accessToken?{authorization:`Bearer ${c.snowluma.accessToken}`}:{})},body:JSON.stringify(params),signal:AbortSignal.timeout(15000)});}catch{throw new HttpError(502,write?'UPSTREAM_UNKNOWN':'QQ_OFFLINE',write?'QQ 操作结果未确认，请先查看实际状态再操作':'QQ 网关无法连接');}
  let j;try{j=await r.json();}catch{throw new HttpError(502,write?'UPSTREAM_UNKNOWN':'QQ_FORMAT',write?'QQ 操作回执无法解析，请先核对实际结果':'QQ 网关返回格式不正确');}
  check(r.ok&&j.status==='ok'&&j.retcode===0,'QQ_REJECTED',`QQ 网关不支持或拒绝此操作（${j.retcode??r.status}）`,502);return j.data;
 }
 status(){return this.call('get_login_info');}
 profile(p){const params={};if('nickname'in p)params.nickname=text(p.nickname,'昵称',100);if('personalNote'in p)params.personal_note=text(p.personalNote,'签名',500,true);check(Object.keys(params).length,'INVALID_INPUT','没有要修改的资料');return this.call('set_qq_profile',params,true);}
 signature(value){return this.call('set_self_longnick',{longNick:text(value,'签名',500,true)},true);}
 card({groupId,userId,card}){return Promise.resolve().then(()=>this.call('set_group_card',{group_id:id(groupId),user_id:id(userId),card:text(card,'群名片',100,true)},true));}
 avatar(value){return Promise.resolve().then(()=>this.call('set_qq_avatar',{file:imageURL(value)},true));}
 async refreshAuth(){
  let raw;try{raw=await this.call('get_cookies',{domain:'qzone.qq.com'});}catch(e){if(e.code==='QQ_REJECTED')raw=await this.call('get_credentials',{domain:'qzone.qq.com'});else throw e;}
  const cookies=typeof raw==='string'?raw:raw?.cookies||raw?.cookie||'';check(typeof cookies==='string'&&!/[\r\n]/.test(cookies),'QZONE_AUTH','网关未返回空间登录态',503);
  const fields=Object.fromEntries(cookies.split(';').map(x=>{const at=x.indexOf('=');return [x.slice(0,at).trim(),x.slice(at+1).trim()];}).filter(x=>x[0]));
  const key=fields.p_skey||fields.skey;const uin=(fields.p_uin||fields.uin||'').replace(/^o0*/,'');check(key&&/^\d+$/.test(uin),'QZONE_AUTH','空间登录态不完整，需要在 QQ 端重新登录空间',503);
  let hash=5381;for(const char of key)hash=(hash+(hash<<5)+char.charCodeAt(0))|0;
  this.auth={cookies,uin,gtk:hash&0x7fffffff,at:Date.now()};return {ready:true,uin,refreshedAt:this.auth.at};
 }
 async qzone(kind,{uin,page=1,content}={}){
  if(!this.auth||Date.now()-this.auth.at>30*60000)await this.refreshAuth();
  check(Number.isInteger(page)&&page>=1&&page<=100,'INVALID_INPUT','页码应为 1–100');
  const auth=this.auth;const target=uin?id(uin):auth.uin;
  const endpoints={feed:'ic2.qzone.qq.com/cgi-bin/feeds/feeds3_html_more',user:'taotao.qq.com/cgi-bin/emotion_cgi_msglist_v6',publish:'taotao.qzone.qq.com/cgi-bin/emotion_cgi_publish_v6'};
  check(Object.hasOwn(endpoints,kind),'INVALID_ACTION','空间操作不正确');const url=new URL('https://user.qzone.qq.com/proxy/domain/'+endpoints[kind]);url.searchParams.set('g_tk',auth.gtk);
  const params=kind==='feed'?{uin:auth.uin,scope:0,view:1,filter:'all',flag:1,applist:'all',pagenum:page,aisortEndTime:0,aisortOffset:0,aisortBeginTime:0,begintime:0,format:'json',useutf8:1,outputhtmlfeed:1}:{uin:target,hostUin:target,pos:(page-1)*20,num:20,replynum:0,callback:'_preloadCallback',code_version:1,format:'json',need_comment:0,need_private_comment:0};
  const write=kind==='publish';const headers={Cookie:auth.cookies,Referer:`https://user.qzone.qq.com/${target}`,Origin:'https://user.qzone.qq.com','User-Agent':'Mozilla/5.0','Accept':'application/json'};
  let body;if(write){text(content,'说说正文',2000);headers['Content-Type']='application/x-www-form-urlencoded';body=new URLSearchParams({syn_tweet_verson:'1',paramstr:'1',who:'1',con:content,feedversion:'1',ver:'1',ugc_right:'1',to_sign:'0',hostuin:auth.uin,code_version:'1',richval:'',issyncweibo:'0',format:'json',qzreferrer:`https://user.qzone.qq.com/${auth.uin}`}).toString();}else for(const[k,v]of Object.entries(params))url.searchParams.set(k,v);
  let response;try{response=await this.fetch(url,{method:write?'POST':'GET',headers,body,redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw new HttpError(502,write?'UPSTREAM_UNKNOWN':'QZONE_OFFLINE',write?'空间发布结果未确认，请先检查空间再重试':'无法连接 QQ 空间');}
  check(response.ok,write&&response.status>=500?'UPSTREAM_UNKNOWN':'QZONE_HTTP',`空间返回 HTTP ${response.status}`,502);let data;try{data=parseQzone(await response.text());}catch(e){if(write&&e.code!=='QZONE_REJECTED')throw new HttpError(502,'UPSTREAM_UNKNOWN','空间发布回执无法确认，请先检查空间再操作');throw e;}
  if(write){const fid=String(data.tid||data.fid||'');check(fid,'UPSTREAM_UNKNOWN','空间没有返回动态编号，请先检查实际发布结果',502);return {ok:true,fid};}
  const rows=kind==='user'?(data.msglist??data.data?.msglist??data.data?.list):Array.isArray(data.data)?data.data:[data.data?.data,data.data?.feeds,data.data?.feedpage,data.data?.main].find(Array.isArray)??(data.data?.main?.hasMoreFeeds===false?[]:undefined);
  check(Array.isArray(rows)||rows===null,'QZONE_FORMAT','空间列表结构未识别',502);
  return {items:(rows||[]).filter(r=>r&&typeof r==='object').slice(0,20).map(r=>({id:String(r.tid||r.fid||r.cellid||''),uin:String(r.uin||''),name:strip(r.name||r.nickname),content:strip(r.content||r.summary||r.html),at:Number(r.created_time||r.createtime||r.abstime||0),comments:Number(r.cmtnum||0),likes:Number(r.likenum||r.like?.cnt||0)})),page};
 }
}
