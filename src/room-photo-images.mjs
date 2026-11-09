// Photos embed pixels only on explicit export; normal loading keeps URLs small.
export function encodeRoomPhotoPng(canvas){
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG 编码失败')),'image/png'));
}
export async function loadRoomPhotoSvg(xml,{ImageClass=Image,BlobClass=Blob,makeUrl=blob=>URL.createObjectURL(blob),revokeUrl=url=>URL.revokeObjectURL(url)}={}){
 const url=makeUrl(new BlobClass([xml],{type:'image/svg+xml;charset=utf-8'})),image=new ImageClass();
 try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('矢量图层栅格化失败'));image.src=url;});return image;}finally{revokeUrl(url);}
}
export async function encodeRoomPhotoImages(urls,{allowed,fetcher=fetch,encode=btoa}={}){
 if(!Array.isArray(urls)||urls.length>80||urls.some(url=>!allowed.has(url)))throw Error('Invalid photo image source');
 const out={},unique=[...new Set(urls)];let next=0,failure=null;
 const worker=async()=>{while(!failure&&next<unique.length){const url=unique[next++];try{
  const response=await fetcher(new URL(url).pathname);if(!response.ok)throw Error('Photo image unavailable');const mime=response.headers.get('content-type')?.split(';')[0];
  if(!['image/png','image/webp','image/svg+xml','image/jpeg'].includes(mime))throw Error('Invalid photo image type');
  const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>12*1024*1024)throw Error('Photo image too large');
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));out[url]='data:'+mime+';base64,'+encode(binary);
 }catch(error){failure??=error;}}};await Promise.all(Array.from({length:Math.min(3,unique.length)},worker));if(failure)throw failure;return out;
}

let photoImageSerial=0;
// A floor texture can occur in several masks and scenery layers. Embed its
// pixels once, while leaving each use's transform, clipping and ID intact.
export function internRoomPhotoImages(svg){
 const groups=new Map();
 for(const image of svg.querySelectorAll('image')){
  const href=image.getAttribute('href');if(!href)continue;
  const key=JSON.stringify([href,...['width','height','preserveAspectRatio'].map(k=>image.getAttribute(k)||'')]);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(image);
 }
 const repeated=[...groups.values()].filter(group=>group.length>1);if(!repeated.length)return;
 const doc=svg.ownerDocument,ns='http://www.w3.org/2000/svg',defs=doc.createElementNS(ns,'defs'),prefix='room-photo-shared-'+(++photoImageSerial)+'-';
 for(const [index,images]of repeated.entries()){
  const shared=doc.createElementNS(ns,'image'),id=prefix+index,first=images[0];shared.setAttribute('id',id);shared.setAttribute('href',first.getAttribute('href'));
  for(const key of ['width','height','preserveAspectRatio'])if(first.getAttribute(key)!=null)shared.setAttribute(key,first.getAttribute(key));
  defs.append(shared);
  for(const image of images){const use=doc.createElementNS(ns,'use');for(const key of image.getAttributeNames())if(key!=='href'&&key!=='xlink:href')use.setAttribute(key,image.getAttribute(key));use.setAttribute('href','#'+id);image.replaceWith(use);}
 }
 svg.append(defs);
}

export function createRoomPhotoImages({win,parent,uid,timeoutMs=30000}){
 const pending=new Map();let disposed=false;
 const receive=event=>{const d=event.data;if(event.source!==parent||d?.channel!=='liuli-companion'||d.type!=='room-photo-images')return;const job=pending.get(d.requestId);if(!job)return;pending.delete(d.requestId);clearTimeout(job.timer);d.error?job.reject(Error(d.error)):job.resolve(d.images);};
 win.addEventListener('message',receive);
 return {async prepare(source,extras=[]){if(disposed)throw Error('Photo view closed');const svg=source.cloneNode(true);
  const bounds=source.viewBox?.baseVal;
  if(bounds?.width>0&&bounds?.height>0){svg.setAttribute('width',bounds.width);svg.setAttribute('height',bounds.height);svg.style.width=bounds.width+'px';svg.style.height=bounds.height+'px';}
  // Inactive poses and the other floor do not belong in this frozen view.
  for(const node of svg.querySelectorAll('[display="none"],[visibility="hidden"]'))if(!node.closest('defs'))node.remove();
  // Interaction labels depend on page CSS and do not belong in a photo.
  // Keep environment artwork (curtains/lamp) and resident effects intact.
  for(const node of svg.querySelectorAll('[data-room-hotspot],[data-room-furniture],[data-room-control]'))node.remove();
  internRoomPhotoImages(svg);
  const pictures=[...svg.querySelectorAll('image')],isExternal=url=>typeof url==='string'&&(url.startsWith('http://127.0.0.1:')||url.startsWith('dsh-app://app/'))&&url.includes('/plugins/dsh-whale-status/assets/');
  const urls=[...new Set([...pictures.map(pic=>pic.getAttribute('href')), ...extras].filter(isExternal))];let images={};
  if(urls.length)images=await new Promise((resolve,reject)=>{const requestId=uid(),timer=setTimeout(()=>{pending.delete(requestId);reject(Error('照片素材读取超时'));},timeoutMs);pending.set(requestId,{resolve,reject,timer});parent.postMessage({channel:'liuli-companion',type:'room-photo-image-request',requestId,urls},'*');});
  if(disposed)throw Error('Photo view closed');for(const pic of pictures){const url=pic.getAttribute('href');if(isExternal(url)){if(!/^data:image\/(png|webp|svg\+xml|jpeg);base64,[A-Za-z0-9+/=]+$/.test(images[url]||''))throw Error('照片素材不完整');pic.setAttribute('href',images[url]);}}
  return {svg,url:value=>images[value]||value};
 },dispose(){if(disposed)return;disposed=true;win.removeEventListener('message',receive);for(const job of pending.values()){clearTimeout(job.timer);job.reject(Error('Photo view closed'));}pending.clear();}};
}
