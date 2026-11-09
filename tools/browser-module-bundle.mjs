import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {Script} from 'node:vm';

// Restricted to this project's named-import ES modules. Unknown syntax fails the
// build rather than silently falling back to a shared global binding.
export async function bundleBrowserModules(root,entries) {
  const modules=new Map(),slash=value=>value.replaceAll('\\','/');
  const resolve=(from,spec)=>{
    if(!spec.startsWith('.'))throw Error('Browser module must be local: '+spec);
    const file=slash(path.posix.normalize(path.posix.join(path.posix.dirname(from),spec)));
    if(file.startsWith('../')||path.isAbsolute(file))throw Error('Browser import outside candidate: '+spec);
    return file;
  };
  const names=text=>text.split(',').map(x=>x.trim()).filter(Boolean).map(x=>{
    const pair=x.split(/\s+as\s+/);if(!pair.every(v=>/^[A-Za-z_$][\w$]*$/.test(v)))throw Error('Unsupported named binding: '+x);
    return {from:pair[0],to:pair[1]||pair[0]};
  });
  async function visit(file){
    file=slash(file).replace(/^\.\//,'');if(modules.has(file))return;
    let source=await readFile(path.join(root,file),'utf8');
    const record={file,imports:[],exports:new Map(),code:''};modules.set(file,record);
    source=source.replace(/\bexport\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g,(_,list,spec)=>{
      const dep=resolve(file,spec),local='__reexport'+record.imports.length,bindings=names(list);
      record.imports.push({dep,bindings:bindings.map(x=>({from:x.from,to:x.from}))});
      for(const binding of bindings)record.exports.set(binding.to,local+'.'+binding.from);
      return 'const '+local+'=__require('+JSON.stringify(dep)+');';
    });
    source=source.replace(/\bimport\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]\s*;?/g,(_,list,spec)=>{
      const dep=resolve(file,spec),bindings=names(list);record.imports.push({dep,bindings});
      return 'const {'+bindings.map(x=>x.from===x.to?x.from:x.from+':'+x.to).join(',')+'}=__require('+JSON.stringify(dep)+');';
    });
    source=source.replace(/\bexport\s+(async\s+)?(function|class|const)\s+([A-Za-z_$][\w$]*)/g,(_,async,kind,name)=>{
      record.exports.set(name,name);return (async||'')+kind+' '+name;
    });
    source=source.replace(/\bexport\s*\{([^}]+)\}\s*;?/g,(_,list)=>{
      for(const binding of names(list))record.exports.set(binding.to,binding.from);return '';
    });
    try{new Script('(function(__require){"use strict";\n'+source+'\n})',{filename:file});}
    catch(error){throw Error('Unsupported browser module syntax in '+file+': '+error.message);}
    record.code=source;
    for(const imported of record.imports)await visit(imported.dep);
  }
  for(const entry of entries)await visit(entry);
  for(const record of modules.values())for(const {dep,bindings}of record.imports)for(const binding of bindings){
    if(!modules.get(dep).exports.has(binding.from))throw Error(record.file+' imports missing export '+binding.from+' from '+dep);
  }
  const factories=[...modules.values()].map(record=>JSON.stringify(record.file)+':function(__require,__exports){"use strict";\n'+record.code+'\nObject.defineProperties(__exports,{'+[...record.exports].map(([name,value])=>JSON.stringify(name)+':{enumerable:true,get:()=>'+value+'}').join(',')+'});\n}').join(',\n');
  const code='(()=>{const __factories={'+factories+'},__cache=Object.create(null),__loading=new Set();\nfunction __require(id){if(__loading.has(id))throw Error("Cyclic room module: "+id);if(__cache[id])return __cache[id];if(!__factories[id])throw Error("Missing room module: "+id);const value={};__loading.add(id);try{__factories[id](__require,value);__cache[id]=value;return value;}finally{__loading.delete(id);}}\nreturn {'+entries.map(file=>JSON.stringify(slash(file).replace(/^\.\//,''))+':__require('+JSON.stringify(slash(file).replace(/^\.\//,''))+')').join(',')+'};})()';
  new Script(code,{filename:'room-modules.js'});
  return {code,files:[...modules.keys()],exports:Object.fromEntries([...modules].map(([file,record])=>[file,[...record.exports.keys()]]))};
}
