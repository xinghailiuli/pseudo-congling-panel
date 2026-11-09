import {readFile} from 'node:fs/promises';
import path from 'node:path';

export async function readRoomStyles(root,file,parents=[]) {
  const absolute=path.resolve(root,file);
  if(parents.includes(absolute))throw Error('Cyclic room stylesheet: '+file);
  if(!absolute.startsWith(path.resolve(root)+path.sep))throw Error('Room stylesheet outside candidate: '+file);
  const source=await readFile(absolute,'utf8'),imports=[...source.matchAll(/@import\s+['"]([^'"]+)['"]\s*;\r?\n?/g)];
  let result='',offset=0;
  for(const match of imports){result+=source.slice(offset,match.index);result+=await readRoomStyles(root,path.relative(root,path.resolve(path.dirname(absolute),match[1])),[...parents,absolute]);offset=match.index+match[0].length;}
  return result+source.slice(offset);
}
