import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function createRoomImageCatalog({root,origin='dsh-app://app'}){
 const images=new Map(),replacements=new Map(),modules={},used=new Set();
 let deliveryMap;
 const loadDeliveryMap=()=>deliveryMap??=(fs.readFile(path.join(root,'assets/room-delivery-v52/lossless-map.json'),'utf8').then(JSON.parse).catch(error=>{if(error.code==='ENOENT')return {};throw error;}));
 const safe=file=>{const p=path.resolve(root,file),rel=path.relative(root,p).replaceAll('\\','/');if(!rel.startsWith('assets/')||rel.split('/').includes('..'))throw Error('Invalid asset path');return {p,rel};};
 async function inline(file){const {p,rel}=safe(file),bytes=await fs.readFile(p),ext=path.extname(rel).slice(1),mime=({png:'image/png',webp:'image/webp',svg:'image/svg+xml',jpg:'image/jpeg'})[ext];if(!mime)throw Error('Unsupported image');
  const sourceSha256=hash(bytes),entry=(await loadDeliveryMap())[rel];let delivered=bytes,deliveredFile=rel,deliveredMime=mime;
  if(entry){
   if(entry.sourceSha256!==sourceSha256)throw Error('Stale lossless source hash: '+rel);
   const alternative=safe(entry.file);if(!alternative.rel.endsWith('.webp'))throw Error('Invalid lossless image format');
   delivered=await fs.readFile(alternative.p);if(hash(delivered)!==entry.sha256)throw Error('Lossless output hash mismatch: '+rel);
   deliveredFile=alternative.rel;deliveredMime='image/webp';
  }
  const sha256=hash(delivered),url=origin+'/plugins/dsh-whale-status/assets/'+sha256+'/'+path.basename(deliveredFile),data='data:'+mime+';base64,'+bytes.toString('base64');
  images.set(url,{url,file:deliveredFile,sha256,bytes:delivered.length,mime:deliveredMime});replacements.set(data,url);return data;
 }
 const externalize=value=>{if(typeof value==='string'){const url=replacements.get(value);if(url)used.add(url);return url||value;}return Array.isArray(value)?value.map(externalize):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,externalize(v)])):value;};
 return {inline,externalize,async writePayload(id,chunk,assets){const body=externalize(assets);if(JSON.stringify(body).includes('data:image/'))throw Error('Unregistered image in '+id);const revision=hash(JSON.stringify(body));await fs.mkdir(path.join(root,'lib'),{recursive:true});await fs.writeFile(path.join(root,'lib',chunk),JSON.stringify({id,revision,assets:body}));modules[id]={id,chunk,revision};},async writeManifest(){const manifest={version:1,modules,images:[...images.values()].filter(r=>used.has(r.url))};await fs.writeFile(path.join(root,'lib/room-asset-manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;}};
}
