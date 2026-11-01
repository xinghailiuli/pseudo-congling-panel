// Public isolated-preview support. Only reads the built, allowlisted artwork chunks.
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const catalog=JSON.parse(await readFile(new URL('../assets/wardrobe-v1/catalog.json',import.meta.url)));
const allowed=new Set(['client.room-art-v12.js','client.room-life-v19.js',...catalog.map(o=>'client.wardrobe-'+o.id+'-v19.js')]);
const cache=new Map();
export async function fixtureAssetReply(req,res){
 const url=new URL(req.url,'http://localhost');
 if(!url.pathname.startsWith('/fixture-assets/'))return false;
 const file=url.pathname.slice('/fixture-assets/'.length);
 if(req.method!=='GET'||!allowed.has(file)){res.writeHead(404);res.end();return true;}
 if(!cache.has(file)){
  let definition;vm.runInNewContext(await readFile(new URL('../lib/'+file,import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:value=>{definition=value;}}}});
  cache.set(file,JSON.stringify(definition.factory()));
 }
 res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(cache.get(file));return true;
}
export function fixtureAssetBridge(frame){
 // In-memory selection belongs to this isolated preview only.
 let selected='original';
 const load=async name=>{const r=await fetch('/fixture-assets/'+name);if(!r.ok)throw Error('Preview artwork unavailable');return r.json();};
 const send=data=>frame.contentWindow?.postMessage({channel:'liuli-companion',...data},'*');
 frame.addEventListener('load',async()=>{send({type:'room-assets',assets:await load('client.room-art-v12.js')});});
 window.addEventListener('message',async event=>{
  const d=event.data;if(event.source!==frame.contentWindow||d?.channel!=='liuli-companion')return;
  if(d.type==='wardrobe-selected'){selected=d.id;return;}
  if(d.type==='room-life-request'){send({type:'room-life-assets',assets:await load('client.room-life-v19.js')});return;}
  if(d.type!=='wardrobe-request')return;
  const id=d.id??selected;
  try{if(!/^[a-z-]+$/.test(id))throw Error('Invalid outfit');send({type:'wardrobe-assets',requestId:d.requestId,id,assets:id==='original'?null:await load('client.wardrobe-'+id+'-v19.js')});}
  catch{send({type:'wardrobe-error',requestId:d.requestId});}
 });
}
