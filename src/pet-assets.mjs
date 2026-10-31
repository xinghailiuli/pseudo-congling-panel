import {readFile} from 'node:fs/promises';

const manifest=JSON.parse(await readFile(new URL('../assets/room-pet/manifest.json',import.meta.url),'utf8'));
const frames=new Set(Object.values(manifest.clips).flatMap(clip=>clip.frames));
export const PET_ASSET_PATH='/plugins/dsh-whale-status/pet/frame';

export function createPetAssetHandler({connection}) {
 const cache=new Map();
 return async(req,res)=>{
  const rejection=connection?.requestRejection(req);
  if(!connection||rejection!==undefined){res.writeHead(rejection||403);res.end();return;}
  const url=new URL(req.url,'http://localhost'),frame=url.searchParams.get('frame');
  if(url.pathname!==PET_ASSET_PATH||!frames.has(frame)){res.writeHead(404);res.end();return;}
  if(req.method!=='GET'){res.writeHead(405,{Allow:'GET'});res.end();return;}
  try {
   if(!cache.has(frame))cache.set(frame,await readFile(new URL('../assets/room-pet/'+frame,import.meta.url)));
   res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'private, max-age=86400','X-Content-Type-Options':'nosniff'});res.end(cache.get(frame));
  } catch {res.writeHead(503);res.end();}
 };
}
