import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';import {pathToFileURL,fileURLToPath} from 'node:url';
const slash=p=>p.replaceAll('\\','/');
async function walk(root,base=''){const out=[];for(const d of await fs.readdir(path.join(root,base),{withFileTypes:true})){if(['.git','node_modules','.liuli-backups','qa'].includes(d.name))continue;const p=slash(path.join(base,d.name));if(d.isDirectory())out.push(...await walk(root,p));else if(d.isFile())out.push(p);}return out;}
export async function auditPackage(root){
 root=path.resolve(root);const files=await walk(root),available=new Set(files),reasons=new Map(),unresolved=[],queue=[];
 const add=(file,reason)=>{file=slash(path.normalize(file)).replace(/^\.\//,'');if(file.startsWith('../')||path.isAbsolute(file)){unresolved.push({file,reason:'outside package: '+reason});return;}if(!available.has(file)){unresolved.push({file,reason});return;}if(!reasons.has(file)){reasons.set(file,new Set());queue.push(file);}reasons.get(file).add(reason);};
 const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
 const exports=[];const collect=x=>{if(typeof x==='string')exports.push(x);else if(x&&typeof x==='object')Object.values(x).forEach(collect);};collect(pkg.exports);for(const p of [pkg.main,...exports,'package.json',pkg.dsh?.bundle?.patch].filter(Boolean))add(p,'package entry/export');
 for(const p of ['client.template.js','assets/wardrobe-v1/catalog.json'])add(p,'dynamic dependency declaration');
 for(const p of ['README.md','LICENSE','THIRD_PARTY_NOTICES.md','assets/SOURCES.md','client.template.js','assets/wardrobe-v1/catalog.json'])if(available.has(p))add(p,'documentation or dynamic dependency declaration');
 const scanChunks=async file=>{if(!available.has(file))return;const text=await fs.readFile(path.join(root,file),'utf8');const ids=JSON.parse(await fs.readFile(path.join(root,'assets/wardrobe-v1/catalog.json'),'utf8')).map(x=>x.id);
  for(const m of text.matchAll(/require\.async\(([^)]*)\)/g)){const expr=m[1].trim(),literal=expr.match(/^['"]\.\/([^'"]+)['"]$/),dynamic=expr.match(/^['"]\.\/([^'"]+)['"]\s*\+\s*id\s*\+\s*['"]([^'"]+)['"]$/);if(literal)add('lib/'+literal[1],file+' lazy import');else if(dynamic)for(const id of ids)add('lib/'+dynamic[1]+id+dynamic[2],file+' outfit '+id);else if(expr==="'.' + chunkName"||expr==="'./' + chunkName"){for(const f of (available.has('lib/room-asset-manifest.json')?['client.island-map-v1.js']:['client.room-art-v12.js','client.room-life-v20.js','client.island-map-v1.js']))if(available.has('lib/'+f))add('lib/'+f,file+' dynamic chunk');if(!available.has('lib/room-asset-manifest.json'))for(const id of ids)if(available.has('lib/client.wardrobe-'+id+'-v20.js'))add('lib/client.wardrobe-'+id+'-v20.js',file+' outfit '+id);}else unresolved.push({file,reason:'unrecognized lazy import '+expr});}
 };
 await scanChunks('client.template.js');await scanChunks('lib/client.js');
 if(available.has('lib/room-module-manifest.json')){
  add('lib/room-module-manifest.json','versioned optional UI modules');
  const manifest=JSON.parse(await fs.readFile(path.join(root,'lib/room-module-manifest.json'),'utf8'));
  for(const record of Object.values(manifest))add('lib/'+record.chunk,'optional UI module manifest');
 }
 if(available.has('lib/room-asset-manifest.json')){
  add('lib/room-asset-manifest.json','versioned image metadata');
  const manifest=JSON.parse(await fs.readFile(path.join(root,'lib/room-asset-manifest.json'),'utf8'));
  for(const record of Object.values(manifest.modules))add('lib/'+record.chunk,'image metadata module');
  for(const record of manifest.images)add(record.file,'immutable image route');
 }
 // The asset handler exports the same URL map used to serve requests. There
 // is no second guessed list of backend image dependencies.
 if(available.has('src/action-assets.mjs')){try{const m=await import(pathToFileURL(path.join(root,'src/action-assets.mjs')).href+'?audit='+Date.now());if(!Array.isArray(m.ACTION_ASSET_FILES))throw Error('handler must export ACTION_ASSET_FILES');for(const url of m.ACTION_ASSET_FILES)add(path.relative(root,fileURLToPath(url)),'backend action image route');}catch(e){unresolved.push({file:'src/action-assets.mjs',reason:e.message});}}
 // Original resident frames remain available for the portable pet route.
 if(available.has('assets/room-pet/manifest.json')){add('assets/room-pet/manifest.json','original character manifest');const m=JSON.parse(await fs.readFile(path.join(root,'assets/room-pet/manifest.json'),'utf8'));for(const clip of Object.values(m.clips||{}))for(const p of clip.frames||[])add('assets/room-pet/'+p,'original frame manifest');}
 const scanned=new Set();while(queue.length){const file=queue.shift();if(scanned.has(file)||!/[.](m?js|html|css)$/.test(file)||file.startsWith('lib/client.'))continue;scanned.add(file);const source=await fs.readFile(path.join(root,file),'utf8');
  for(const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)['"](\.[^'"]+)['"]/g))add(path.join(path.dirname(file),m[1]),file+' imports');
  for(const m of source.matchAll(/new URL\(\s*['"](\.[^'"]+)['"]\s*,\s*import.meta.url/g))add(path.join(path.dirname(file),m[1]),file+' resource URL');
  if(/\.(html|css)$/.test(file))for(const pattern of [/\b(?:src|href)\s*=\s*['"]([^'"]+)['"]/g,/url\(\s*['"]?([^\s)'";]+)['"]?\s*\)/g])for(const m of source.matchAll(pattern)){const ref=m[1].split(/[?#]/)[0];if(!ref||/^(?:[a-z]+:|\/\/|\/plugins\/)/i.test(ref))continue;add(ref.startsWith('/')?ref.slice(1):path.join(path.dirname(file),ref),file+' static resource');}
 }
 const runtimeFiles=[...reasons.keys()].sort(),legacyChunks=files.filter(p=>/^lib\/client\.(room-(art|life)|wardrobe-).+\.js$/.test(p)&&!reasons.has(p)),buildOnlyFiles=files.filter(p=>!reasons.has(p)&&!legacyChunks.includes(p)),records=[];let total=0,runtime=0,legacy=0;
 for(const file of files){const buffer=await fs.readFile(path.join(root,file)),bytes=buffer.length;total+=bytes;if(reasons.has(file))runtime+=bytes;if(legacyChunks.includes(file))legacy+=bytes;records.push({file,bytes,sha256:createHash('sha256').update(buffer).digest('hex'),keepReasons:[...(reasons.get(file)||[])],classification:reasons.has(file)?'runtime':legacyChunks.includes(file)?'unreferenced build chunk':'source/build input'});}
 return {runtimeFiles,buildOnlyFiles,legacyChunks,unresolved,sizes:{total,runtime,legacy},records};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const result=await auditPackage(process.argv[2]||'.');if(process.argv[3])await fs.writeFile(process.argv[3],JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({sizes:result.sizes,runtime:result.runtimeFiles.length,legacy:result.legacyChunks.length,unresolved:result.unresolved},null,2));if(result.unresolved.length)process.exitCode=1;}
