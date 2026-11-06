import {readFile} from 'node:fs/promises';
const files=new Map(['lounge','write','walk'].map(name=>[`/plugins/dsh-whale-status/actions/${name}-v2.png`,new URL(`../assets/room-actions/${name}.png`,import.meta.url)]));
files.set('/plugins/dsh-whale-status/actions/floor-two-v7.png',new URL('../assets/room-house/floor-two-v7.png',import.meta.url));
for(const name of ['floor-one','floor-two','stairs'])files.set(`/plugins/dsh-whale-status/actions/${name}-v6.png`,new URL(`../assets/room-house/${name}-v6.png`,import.meta.url));
files.set('/plugins/dsh-whale-status/actions/walk-v3.png',new URL('../assets/room-actions/walk-v3.png',import.meta.url));
for(const name of ['floor-one','floor-two','desk-type-a','desk-type-b','desk-write-a','desk-write-b','bed-sleep','sofa-lounge'])files.set(`/plugins/dsh-whale-status/actions/${name}-v4.png`,new URL(`../assets/room-house/${name}-v4.png`,import.meta.url));
for(const name of ['read','enchant','garden','rest'])files.set(`/plugins/dsh-whale-status/actions/upstairs-${name}-v5.png`,new URL(`../assets/room-house/upstairs-${name}-v5.png`,import.meta.url));
files.set('/plugins/dsh-whale-status/actions/upstairs-garden-v7.png',new URL('../assets/room-house/upstairs-garden-v7.png',import.meta.url));
export const ACTION_ASSET_FILES=[...files.values()];
export const ACTION_ASSET_PATHS=[...files.keys()];
export function createActionAssetHandler({connection}){
 const cache=new Map();
 return async(req,res)=>{
  const reject=connection?.requestRejection(req);
  const isLoopbackImage=(reject===403)&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress)&&(req.headers?.['sec-fetch-site']==='cross-site'||req.headers?.['sec-fetch-dest']==='image');
  if(!connection||(reject!==undefined&&!isLoopbackImage)){res.writeHead(reject||403);res.end();return;}
  const path=new URL(req.url,'http://localhost').pathname;
  if(!files.has(path)){res.writeHead(404);res.end();return;}
  if(req.method!=='GET'){res.writeHead(405,{Allow:'GET'});res.end();return;}
  try{
   if(!cache.has(path))cache.set(path,await readFile(files.get(path)));
   res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'});res.end(cache.get(path));
  }catch{res.writeHead(503);res.end();}
 };
}
