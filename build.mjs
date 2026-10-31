import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { CompanionService } from './src/service.mjs';
import { Script } from 'node:vm';
const read = file => readFile(new URL(file, import.meta.url), 'utf8');
const css = await read('./panel.css');
const petManifest = JSON.parse(await read('./assets/room-pet/manifest.json'));
const actionAssets = JSON.parse(await read('./assets/room-actions/manifest.json'));
// A native, revisioned client chunk keeps the entry small and can update
// artwork without restarting the host while an unrelated session is running.
const inlineRoomAsset=async file=>'data:image/png;base64,'+(await readFile(new URL('./assets/room-house/'+file,import.meta.url))).toString('base64');
const roomImages={};for(const [name,file] of Object.entries({'floor-one':'floor-one-v6.png','floor-two':'floor-two-v7.png',garden:'upstairs-garden-v7.png'}))roomImages[name]=await inlineRoomAsset(file);
const petClips = {};
for (const [name,clip] of Object.entries(petManifest.clips)) {
  petClips[name] = { frameMs:clip.frameMs, frames:clip.frames.map(file => '/plugins/dsh-whale-status/pet/frame?frame='+encodeURIComponent(file)) };
}
const life = (await read('./src/room-life.mjs')).replaceAll('export function ', 'function ');
const journey = (await read('./src/room-journey.mjs')).replaceAll('export function ', 'function ');
const navigation = (await read('./src/room-navigation.mjs')).replaceAll('export function ', 'function ');
const house = (await read('./src/room-house.mjs')).replaceAll('export function ', 'function ');
const art=(await read('./src/room-art.mjs')).replace(/^import .*;\r?\n/gm, '').replaceAll('export function ', 'function ');
const scene = life + '\n' + journey + '\n' + navigation + '\n' + house + '\n' + art + '\n' + (await read('./src/room-scene.mjs')).replace(/^import .*;\r?\n/gm, '').replaceAll('export function ', 'function ');
const js = ('const DAFEIYU_CLIPS='+JSON.stringify(petClips)+';\nconst ROOM_ACTIONS='+JSON.stringify(actionAssets)+';\n'+scene + '\n' + await read('./panel.js')).replace(/<\/script/gi, '<\\/script');
new Script(js, { filename: 'panel.js' });
const html = (await read('./panel.html')).replace('__PANEL_CSS__', () => css).replace('__PANEL_JS__', () => js);
const template = await readFile(new URL('./client.template.js', import.meta.url), 'utf8');
await mkdir(new URL('./lib/', import.meta.url), { recursive: true });
await writeFile(new URL('./lib/client.room-art-v7.js',import.meta.url),'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.room-art-v7.js",factory:()=>('+JSON.stringify(roomImages)+')});\n');
const bridge = (await read('./src/frame-bridge.mjs')).replace('export function ', 'function ');
const actions = Object.keys(new CompanionService({}).handlers);
const built = template.replace('__PANEL_HTML__', () => JSON.stringify(html)).replace('__ALLOWED_ACTIONS__', () => JSON.stringify(actions)).replace('__FRAME_BRIDGE__', () => bridge);
await writeFile(new URL('./lib/client.js', import.meta.url), built, 'utf8');
await writeFile(new URL('./lib/panel-built.html', import.meta.url), html, 'utf8');
console.log('Built DSH client: lib/client.js');
