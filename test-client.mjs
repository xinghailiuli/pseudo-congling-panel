import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

test('DSH sidebar opens a sandboxed, self-contained status page', async () => {
  const source = await readFile(new URL('./lib/client.js', import.meta.url), 'utf8');
  assert.ok(Buffer.byteLength(source) < 1024 * 1024, 'UI entry must stay small; animation frames should load from local asset routes');
  const registrations = [];
  let plugin;
  const React = { createElement: (type, props) => ({ type, props }), useRef: () => ({current:null}), useEffect: () => {} };
  const chunkRequests=[],sent=[];
  const require=name=>{assert.equal(name,'react');return React;};
  require.async=async spec=>{chunkRequests.push(spec);return {stairs:'verified-fixture-data'};};
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load(definition) {
      assert.equal(definition.id, 'dsh-whale-status');
      plugin = definition.factory(require);
    } } },
  });
  plugin.apply({ slots: {
    inject: (_name, mount) => mount(),
    register: (options, component) => { registrations.push({ options, component }); return () => {}; },
  } });
  const entry = registrations.find(row => row.options.name === 'sidebar.panellist');
  const panel = registrations.find(row => row.options.name === 'main');
  assert.equal(entry.options.label, '琉璃陪伴中心');
  assert.equal(entry.options.id, panel.options.key);
  const frame = panel.component();
  assert.equal(frame.type, 'iframe');
  assert.equal(frame.props.sandbox, 'allow-scripts');
  assert.equal(frame.props.src, undefined, 'panel must not depend on a preview server');
  assert.match(frame.props.srcDoc, /琉璃陪伴中心/);
  assert.doesNotMatch(frame.props.srcDoc, /SAMPLE_DATA/);
  assert.match(frame.props.srcDoc, /connect-src 'none'/);
  assert.equal(frame.props.srcDoc, (await readFile(new URL('./lib/panel-built.html', import.meta.url), 'utf8')).replaceAll('__LIULI_ASSET_ORIGIN__','dsh-app://app'));
  frame.props.ref.current={contentWindow:{postMessage:(message,origin)=>sent.push({message,origin})}};
  await frame.props.onLoad();
  assert.equal(chunkRequests.join(','),'./client.room-art-v7.js');
  assert.equal(sent[0].message.type,'room-assets');assert.equal(sent[0].message.assets.stairs,'verified-fixture-data');
  frame.props.ref.current=null;await frame.props.onLoad();assert.equal(sent.length,1,'Unmounted iframe must not receive assets');
});

test('native lazy chunk contains exact PNG bytes without growing the startup entry',async()=>{
 let definition;vm.runInNewContext(await readFile(new URL('./lib/client.room-art-v7.js',import.meta.url),'utf8'),{window:{__ModuleLoader__:{load:d=>definition=d}}});
 assert.equal(definition.id,'dsh-whale-status');assert.equal(definition.chunk,'client.room-art-v7.js');const assets=definition.factory();
 const hash=b=>createHash('sha256').update(b).digest('hex');
 for(const [name,file] of Object.entries({'floor-one':'floor-one-v6.png','floor-two':'floor-two-v7.png',garden:'upstairs-garden-v7.png'})){assert.match(assets[name],/^data:image\/png;base64,/);assert.equal(hash(Buffer.from(assets[name].split(',')[1],'base64')),hash(await readFile(new URL('./assets/room-house/'+file,import.meta.url))));}
});

test('iframe image policy follows the actual host instead of the author local port',async()=>{
 const source=await readFile(new URL('./lib/client.js',import.meta.url),'utf8');
 for(const href of ['dsh-app://app/index.html','http://127.0.0.1:27361/','https://harness.example.invalid/']){
  let plugin,panel;const React={createElement:(type,props)=>({type,props}),useRef:()=>({current:null}),useEffect:()=>{}};
  vm.runInNewContext(source,{URL,window:{location:{href},__ModuleLoader__:{load(d){plugin=d.factory(()=>React);}}}});
  plugin.apply({slots:{inject:(_name,mount)=>mount(),register:(options,component)=>{if(options.name==='main')panel=component;return()=>{};}}});
  const html=panel().props.srcDoc,host=new URL(href);
  assert.ok(html.includes(`${host.protocol}//${host.host}/plugins/dsh-whale-status/`),'own assets must be allowed at this host');
  const policy=html.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  assert.ok(!policy.includes('19387'));assert.ok(!policy.includes('dsh-dafeiyu'));assert.ok(!policy.includes('__LIULI_ASSET_ORIGIN__'));
 }
});
