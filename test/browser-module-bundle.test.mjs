import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('browser bundles isolate private bindings and preserve imports, aliases and re-exports',async()=>{
  const compiler=await import('../tools/browser-module-bundle.mjs').catch(()=>null);
  assert.ok(compiler,'an explicit module compiler must replace shared global concatenation');
  const root=await mkdtemp(join(tmpdir(),'room-module-'));
  await writeFile(join(root,'a.mjs'),'const privateValue=3; export function value(){return privateValue;}');
  await writeFile(join(root,'b.mjs'),"import {value as readValue} from './a.mjs'; const privateValue=9; export const total=()=>readValue()+privateValue;");
  await writeFile(join(root,'entry.mjs'),"export {total as result} from './b.mjs';");
  const bundle=await compiler.bundleBrowserModules(root,['entry.mjs']);
  const modules=vm.runInNewContext(bundle.code);assert.equal(modules['entry.mjs'].result(),12);
  assert.equal(modules['entry.mjs'].privateValue,undefined);
});

test('browser compiler reports missing exports and never silently turns an import into a global',async()=>{
  const compiler=await import('../tools/browser-module-bundle.mjs').catch(()=>null);assert.ok(compiler);
  const root=await mkdtemp(join(tmpdir(),'room-module-missing-'));
  await writeFile(join(root,'a.mjs'),'export const other=1;');
  await writeFile(join(root,'entry.mjs'),"import {missing} from './a.mjs'; export const value=missing;");
  await assert.rejects(compiler.bundleBrowserModules(root,['entry.mjs']),/missing.*export|export.*missing/i);
});
