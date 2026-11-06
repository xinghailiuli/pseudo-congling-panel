// Books belong to this device's bookshelf, never to conversation memory.
export function paginateBook(content,size=620){
 const chars=Array.from(String(content)),pages=[];size=Math.max(40,Math.min(2000,Math.floor(size)||620));
 for(let at=0;at<chars.length;){let end=Math.min(chars.length,at+size);if(end<chars.length){for(let i=end-1;i>at+size*.65;i--)if(/[。！？\n]/u.test(chars[i])){end=i+1;break;}}pages.push(chars.slice(at,end).join(''));at=end;}
 return pages.length?pages:[''];
}
export function bookmarkFor(book,offset,now=Date.now()){
 const n=Math.max(0,Math.min(book.content.length,Math.floor(offset)||0));return {id:book.id,offset:n,updatedAt:now,finished:n===book.content.length};
}
export async function importRoomBook(file){
 const ext=String(file.name||'').split('.').at(-1).toLowerCase();
 if(!['txt','md','epub'].includes(ext))throw Error('支持 TXT、Markdown 和无加密 EPUB 文件。');
 if(!Number.isFinite(file.size)||file.size<=0||file.size>10*1024*1024)throw Error('请选择 10 MB 以内的非空书籍。');
 const bytes=new Uint8Array(await file.arrayBuffer());let content,title=String(file.name).replace(/\.[^.]+$/,'').slice(0,120);
 if(ext==='epub'){const book=await readRoomEpub(bytes);content=book.content;title=book.title||title;}
 else {try{content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{content=new TextDecoder(bytes[0]===255&&bytes[1]===254?'utf-16le':bytes[0]===254&&bytes[1]===255?'utf-16be':'gb18030').decode(bytes);}}
 content=content.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').replace(/\0/g,'');
 if(!content.trim()||content.length>2000000)throw Error('书籍为空或超过 200 万字符，请拆分后导入。');
 let hash=14695981039346656037n;for(const c of content)hash=BigInt.asUintN(64,(hash^BigInt(c.codePointAt(0)))*1099511628211n);
 return {id:'import-'+hash.toString(16)+'-'+content.length,title,content,source:'import',addedAt:Date.now()};
}
export async function readRoomEpub(bytes){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error('无法读取 EPUB 目录。');
 const count=view.getUint16(end+10,true),entries=new Map();let cursor=view.getUint32(end+16,true),total=0;
 if(count>512||count===65535)throw Error('EPUB 文件条目过多。');
 const decode=b=>new TextDecoder().decode(b);
 for(let i=0;i<count;i++){
  if(cursor+46>bytes.length||view.getUint32(cursor,true)!==0x02014b50)throw Error('EPUB 目录损坏。');
  const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true),compressed=view.getUint32(cursor+20,true),size=view.getUint32(cursor+24,true),n=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true),offset=view.getUint32(cursor+42,true);
  const name=decode(bytes.subarray(cursor+46,cursor+46+n));total+=size;
  if(flags&1||size>8*1024*1024||total>64*1024*1024||!/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\\]+$/.test(name)||entries.has(name))throw Error('EPUB 加密、体积过大或路径无效。');
  entries.set(name,{method,compressed,size,offset});cursor+=46+n+extra+comment;
 }
 const read=async name=>{
  const e=entries.get(name);if(!e||e.offset+30>bytes.length||view.getUint32(e.offset,true)!==0x04034b50)throw Error('EPUB 缺少章节：'+name);
  const start=e.offset+30+view.getUint16(e.offset+26,true)+view.getUint16(e.offset+28,true);if(start+e.compressed>bytes.length)throw Error('EPUB 数据不完整。');
  let out=bytes.subarray(start,start+e.compressed);
  if(e.method===8){const reader=new Blob([out]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),parts=[];let length=0;try{for(;;){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>e.size||length>8*1024*1024)throw Error('EPUB 解压长度无效。');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}out=new Uint8Array(length);let at=0;for(const part of parts){out.set(part,at);at+=part.length;}}
  else if(e.method!==0)throw Error('不支持此 EPUB 压缩方式。');
  if(out.length!==e.size)throw Error('EPUB 章节长度不一致。');return decode(out);
 };
 const xml=text=>{if(/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(text))throw Error('EPUB 含有不支持的实体声明。');text=text.replace(/<!DOCTYPE[^>]*>/gi,'').replaceAll('&nbsp;','&#160;');const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.querySelector('parsererror'))throw Error('EPUB 章节格式无效。');return doc;};
 if(entries.has('META-INF/encryption.xml'))throw Error('暂不支持加密 EPUB。');
 const container=xml(await read('META-INF/container.xml')),opf=container.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');if(!opf)throw Error('EPUB 缺少主目录。');
 const packageDoc=xml(await read(opf)),base=opf.slice(0,opf.lastIndexOf('/')+1),manifest=new Map([...packageDoc.getElementsByTagName('item')].map(e=>[e.getAttribute('id'),e.getAttribute('href')]));
 const chapters=[];let length=0;
 for(const item of packageDoc.getElementsByTagName('itemref')){
  const href=manifest.get(item.getAttribute('idref'));if(!href||/^[a-z]+:|^\/\//i.test(href))throw Error('EPUB 章节引用无效。');
  const parts=[];for(const p of (base+decodeURIComponent(href.split('#')[0])).split('/')){if(p==='..'){if(!parts.length)throw Error('EPUB 路径越界。');parts.pop();}else if(p&&p!=='.')parts.push(p);}
  const doc=xml(await read(parts.join('/')));for(const n of doc.querySelectorAll('script,style,svg,iframe,object,audio,video'))n.remove();
  for(const n of doc.querySelectorAll('p,h1,h2,h3,h4,li,br'))n.appendChild(doc.createTextNode('\n\n'));
  const text=(doc.getElementsByTagName('body')[0]?.textContent||doc.documentElement.textContent).replace(/[ \t]+/g,' ').replace(/\n[ \t]+/g,'\n').trim();length+=text.length;if(length>2000000)throw Error('EPUB 正文超过 200 万字符。');chapters.push(text);
 }
 return {title:packageDoc.getElementsByTagNameNS('*','title')[0]?.textContent?.slice(0,120),content:chapters.join('\n\n')};
}
export function roomOriginalBooks(){
 return [
  {id:'original-last-train',title:'只在雨天营业的末班车',subtitle:'原创短篇 · 日常奇幻',content:`第一章 · 站牌背面\n\n小镇的末班车总在九点十七分离开，可雨夜的站牌背面，还藏着一个用铅笔写的时间：九点十八分。\n\n琉璃发现它的时候，正把一朵被雨打弯的花扶起来。站牌下的猫甩了甩尾巴，像在提醒她不要迟到。她没有车票，口袋里只有一枚扣子和半张购物清单。\n\n车来得很轻。没有引擎声，车窗里的灯却一盏接一盏亮起来。司机是一位戴旧帽子的婆婆。“今天想去哪里？”婆婆问。\n\n“去一个明天不会那么忙的地方。”琉璃说。婆婆摇头：“那一站还没建好。可以先去你今天来不及停下的地方。”\n\n第二章 · 没有寄出的信\n\n第一站是一家已经打烊的面包店。老板站在门边，手里捏着写了一半的信。他想告诉女儿，自己学会了用手机拍照，可每天拍下的都是模糊的面包。\n\n琉璃教他擦干净镜头，又把桌上的小灯转了一点。照片终于清晰了。老板笑着按下发送。公交车的窗边便多出一小片暖光，像有人把黄油抹在了雨夜上。\n\n第二站是学校的操场。一只纸飞机挂在树枝上。站在树下的女孩说，那是她第一次敢写上名字的作品。琉璃踮脚够不到，便借来婆婆的长伞。纸飞机落下来，机翼上写着：明天也要试试。\n\n第三章 · 九点十九分\n\n最后一站竟然还是她上车的地方。被扶起的小花在路灯下抬着头，站牌旁的小猫已经蜷进干燥的纸箱。\n\n“这一趟多少钱？”琉璃问。婆婆指指她的口袋：“那半张清单就够了。今天没做完的事情，明天还有位置放。”\n\n琉璃把清单交出去，留下了扣子。回家后，她把它缝在总是合不拢的外套上。钟指着九点十九分。\n\n原来，明天不会那么忙的地方，也许并不是某个远方。也许只是今天终于愿意停下来、喝完一杯热水的自己。\n\n窗外最后一滴雨滑过玻璃。她把灯调暗，给明天留了一页空白。`},
  {id:'original-window-sea',title:'二楼窗台上的一小片海',subtitle:'原创短篇 · 温柔日常',content:`第一章 · 拾到的蓝色\n\n琉璃在书架最里面发现一只玻璃瓶。瓶中没有水，只有一张小纸条：请在安静的时候打开。\n\n她等到键盘不再响，茶杯不再冒出急急的白气，才拧开瓶盖。远处传来一声很轻的浪，窗台上浮起一片蓝色。\n\n那片海只有一本书那么大。潮汐绕着铅笔走，白色的小船停在橡皮旁。她拿手指比了比，小船还没有指甲长。船长却认真地摘下帽子，向她问候。\n\n“这里是哪里？”船长问。\n\n“二楼，靠书架的窗台。”\n\n船长把这个长长的地名写进航海日志，又问最近有没有暴风雨。琉璃看看桌上摊开的待办事项：“昨天有一点，今天应该会晴。”\n\n第二章 · 借一颗星\n\n夜里，小船找不到回港的路。船长说，海上的星少了一颗。琉璃翻遍画册，才找到一张没有用完的金色贴纸。她剪出一颗歪歪的星，贴在窗玻璃上。\n\n小船立刻认出了方向。原来它们寻找的并不是最亮的星，而是每次回家都能看见的那一颗。\n\n船长送给她一枚极小的贝壳。她没有把它装进收藏盒，而是放在键盘边。每当事情挤成一团，她就停一停，听里面那声短短的浪。\n\n第三章 · 晴天也可以有海\n\n第二天太阳升起，窗台上的海渐渐变成一层薄薄的雾。琉璃有些着急，想用瓶子把它装回去。\n\n船长在甲板上挥手：“海并没有走。你把窗打开，它就知道你有空了。”\n\n后来，有朋友来小屋做客，说这里总有一点像海边。琉璃没有解释，只给对方倒了一杯水，把窗帘轻轻拉开。\n\n玻璃上的金色星星仍然歪着，却一直没有掉下来。`}
 ].map(book=>({...book,source:'original',addedAt:0}));
}
