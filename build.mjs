import {encodeRoomPhotoImages} from './src/room-photo-images.mjs';
import {validateRoomEnergySnapshot} from './src/hud-energy.mjs';
import {createRoomImageCatalog} from './tools/room-image-catalog.mjs';
import {validateRoomModuleManifest} from './src/runtime/room-module-manifest.mjs';
import {fileURLToPath} from 'node:url';
import {readRoomStyles} from './tools/room-style-bundle.mjs';
import {bundleBrowserModules} from './tools/browser-module-bundle.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CompanionService } from './src/service.mjs';
import { Script } from 'node:vm';
const imageCatalog=createRoomImageCatalog({root:fileURLToPath(new URL('.',import.meta.url))});
const read = file => readFile(new URL(file, import.meta.url), 'utf8');
// Both files are required: a stale cached engine without its CSS produced the broken island UI.
const islandCss = await read('./assets/island-map/island.css');
const hudStageSpec = JSON.parse(await read('./assets/star-echo/hud_stage_spec_2560x1440.json'));
const verifyHudAsset = async (filename) => {
  const buf = await readFile(new URL('./assets/star-echo/' + filename, import.meta.url));
  const actualSha = createHash('sha256').update(buf).digest('hex');
  const expectedSha = hudStageSpec.assets?.[filename]?.sha256;
  if (expectedSha && actualSha !== expectedSha) {
    throw new Error(`[build.mjs] Locked HUD asset SHA-256 mismatch for ${filename}: expected ${expectedSha}, got ${actualSha}`);
  }
  return buf;
};
const starEchoFrameBuf = await verifyHudAsset('hud_frame_2560x1440_clean.png');
await verifyHudAsset('starsea_background_2560x1440.png');
const starEchoSvgBuf = await verifyHudAsset('hud_frame_2560x1440.svg');
const v52BackdropBuf = await readFile(new URL('./assets/star-echo/hud_v52_backdrop_2560x1440.png', import.meta.url));
const v52BackdropJpgBuf = await readFile(new URL('./assets/star-echo/hud_v52_backdrop_2560x1440.jpg', import.meta.url));
const v52TitleWhaleBuf = await readFile(new URL('./assets/star-echo/title-whale-v52-approved.png', import.meta.url));
const v52TitleWhaleDataUrl = 'data:image/png;base64,' + v52TitleWhaleBuf.toString('base64');
const v52SvgRaw = (await read('./assets/star-echo/hud_frame_v52_2560x1440.svg'))
  .replace(/__TITLE_WHALE_V52_DATA_URL__/g, () => v52TitleWhaleDataUrl);
const v52SvgBuf = Buffer.from(v52SvgRaw, 'utf8');
const v52CardAvatarBuf = await readFile(new URL('./assets/star-echo/liuli_card_avatar_v52.webp', import.meta.url));
const starEchoFrameB64 = 'data:image/jpeg;base64,' + v52BackdropJpgBuf.toString('base64');
const starEchoFrameLosslessPngB64 = await imageCatalog.inline('assets/star-echo/hud_v52_backdrop_2560x1440.png');
await mkdir(new URL('./assets/room-delivery-v52/',import.meta.url),{recursive:true});
await writeFile(new URL('./assets/room-delivery-v52/hud-border.svg',import.meta.url),v52SvgBuf);
const v52FullBorderDataUrl = await imageCatalog.inline('assets/room-delivery-v52/hud-border.svg');
const v52NavDataUrl = await imageCatalog.inline('assets/star-echo/left-nav-v52-reference.png');
// Bitmap art travels in the existing offline room-art chunk; the entry keeps its vector shell.
const starEchoSvgBorderB64 = 'data:image/svg+xml;base64,' + Buffer.from(v52SvgRaw.replace(/<image\b[^>]*\/>/g, ''), 'utf8').toString('base64');
const liuliCardAvatarB64 = 'data:image/webp;base64,' + v52CardAvatarBuf.toString('base64');
const interactionFrameSvg = await read('./assets/star-echo/interaction-frame-v52.svg');
const css = (await readRoomStyles(fileURLToPath(new URL('.',import.meta.url)),'panel.css'))
  .replace(/__INTERACTION_FRAME_V52__/g, () => 'data:image/svg+xml;base64,' + Buffer.from(interactionFrameSvg).toString('base64'))
  .replace(/__STAR_ECHO_FRAME_BG__/g, () => starEchoFrameB64)
  .replace(/__STAR_ECHO_SVG_BORDER__/g, () => starEchoSvgBorderB64)
;
const petManifest = JSON.parse(await read('./assets/room-pet/manifest.json'));
const actionAssets = JSON.parse(await read('./assets/room-actions/manifest.json'));
const wardrobeCatalog=JSON.parse(await read('./assets/wardrobe-v1/catalog.json'));
// A native, revisioned client chunk keeps the entry small and can update
// artwork without restarting the host while an unrelated session is running.
const inlineRoomAsset=file=>imageCatalog.inline('assets/room-house/'+file);
const roomImages={};for(const [name,file] of Object.entries({'floor-one':'floor-one-v6.png','floor-two':'floor-two-v7.png',garden:'upstairs-garden-v7.png'}))roomImages[name]=await inlineRoomAsset(file);
const petClips = {};
for (const [name,clip] of Object.entries(petManifest.clips)) {
  petClips[name] = { frameMs:clip.frameMs, frames:clip.frames.map(file => '/plugins/dsh-whale-status/pet/frame?frame='+encodeURIComponent(file)) };
}
// Verifiable, safe module syntax transformer for project internal ES modules.
function stripModuleSyntax(source, filename) {
  const code = source
    .replace(/^\s*import\s+(?:['"][^'"]+['"]|[\s\S]*?from\s+['"][^'"]+['"]);?\s*$/gm, '')
    .replace(/^\s*export\s+default\s+async\s+function\b/gm, 'async function')
    .replace(/^\s*export\s+default\s+function\b/gm, 'function')
    .replace(/^\s*export\s+default\s+class\b/gm, 'class')
    .replace(/^\s*export\s+async\s+function\b/gm, 'async function')
    .replace(/^\s*export\s+function\b/gm, 'function')
    .replace(/^\s*export\s+class\b/gm, 'class')
    .replace(/^\s*export\s+(const|let|var)\b/gm, '$1')
    .replace(/^\s*export\s*\{[^}]*\};?\s*$/gm, '');
  try {
    new Script(code, { filename });
  } catch (err) {
    throw new Error(`[build.mjs] Module syntax validation failed for ${filename}: ${err.message}`);
  }
  return code;
}
const bundleModule = async relPath => stripModuleSyntax(await read(relPath), relPath);

const candidateRoot=fileURLToPath(new URL('.',import.meta.url));
const coreBundle=await bundleBrowserModules(candidateRoot,["src/hud-energy.mjs","src/room-photo-images.mjs","src/room-image-source.mjs","src/room-scene.mjs","src/room-art.mjs","src/room-life-art.mjs","src/room-diagnostics.mjs","src/room-panel-controller.mjs","src/room-wardrobe-controller.mjs","src/areas/area-registry.mjs","src/hud-pulse.mjs","src/runtime/room-dressing-assets.mjs","src/runtime/room-module-loader.mjs","src/ui/room-style-owner.mjs","src/ui/room-hud.mjs","src/ui/room-action-tray.mjs","src/ui/room-dressing-panel.mjs","src/ui/room-furniture-panel.mjs","src/ui/room-reader-panel.mjs","src/ui/room-context.mjs","src/runtime/room-session.mjs"]);
const featurePayloads=[];
for(const [id,file,cssFile]of [['reader','src/room-book-reader.mjs','styles/room-reader.css'],['dressing','src/room-dressing.mjs','dressing-room.css'],['workspaces','src/room-workspace.mjs','room-workspace.css']]){
 const feature=await bundleBrowserModules(candidateRoot,[file]);
 const code='(()=>{const modules='+feature.code+';return modules['+JSON.stringify(file)+'];})()';
 let cssText=await read('./'+cssFile);
 if(id==='dressing')cssText+='\nbody.star-echo-theme{--dressing-frame:url("data:image/svg+xml;base64,'+Buffer.from(await read('./assets/star-echo/dressing-frame-v52.svg')).toString('base64')+'")}';
 const revision=createHash('sha256').update(coreBundle.code+code+cssText).digest('hex');
 featurePayloads.push({id,revision,cssText,code});
}
const islandBundleCode=await read('./assets/island-map/island-bundle.min.js');
const islandCode='(()=>{'+islandBundleCode+';return {mountWhaleIsland:window.mountWhaleIsland};})()';
featurePayloads.push({id:'island',revision:createHash('sha256').update(coreBundle.code+islandCode+islandCss).digest('hex'),cssText:islandCss,code:islandCode});
await mkdir(new URL('./lib/',import.meta.url),{recursive:true});
const moduleManifest=validateRoomModuleManifest(featurePayloads.map(p=>({id:p.id,revision:p.revision,chunk:'client.room-ui-'+p.id+'-v52.js',dependencies:[]})));
for(const payload of featurePayloads)await writeFile(new URL('./lib/'+moduleManifest[payload.id].chunk,import.meta.url),JSON.stringify(payload));
await writeFile(new URL('./lib/room-module-manifest.json',import.meta.url),JSON.stringify(moduleManifest,null,2)+'\n');
const scene='const WARDROBE_CATALOG='+JSON.stringify(wardrobeCatalog.map(({id,name})=>({id,name})))+';\nconst ROOM_MODULE_MANIFEST='+JSON.stringify(moduleManifest)+';\nconst ROOM_CORE='+coreBundle.code+';\nconst isRoomImageUrl=ROOM_CORE["src/room-image-source.mjs"].isRoomImageUrl;\nconst createRoomPhotoImages=ROOM_CORE["src/room-photo-images.mjs"].createRoomPhotoImages;\nconst loadRoomPhotoSvg=ROOM_CORE["src/room-photo-images.mjs"].loadRoomPhotoSvg;\n'+"const createBlockRoom=ROOM_CORE[\"src/room-scene.mjs\"][\"createBlockRoom\"];\nconst prewarmRoomLifeAssets=ROOM_CORE[\"src/room-art.mjs\"][\"prewarmRoomLifeAssets\"];\nconst validateRoomLifeAssets=ROOM_CORE[\"src/room-life-art.mjs\"][\"validateRoomLifeAssets\"];\nconst createRoomRestoreGate=ROOM_CORE[\"src/room-diagnostics.mjs\"][\"createRoomRestoreGate\"];\nconst ROOM_PANEL_FURNITURE_GROUPS=ROOM_CORE[\"src/room-panel-controller.mjs\"][\"ROOM_PANEL_FURNITURE_GROUPS\"];\nconst ROOM_PANEL_PAGE_TARGETS=ROOM_CORE[\"src/room-panel-controller.mjs\"][\"ROOM_PANEL_PAGE_TARGETS\"];\nconst VIEW_MODE_STORAGE_KEY=ROOM_CORE[\"src/room-panel-controller.mjs\"][\"VIEW_MODE_STORAGE_KEY\"];\nconst createRoomObserverController=ROOM_CORE[\"src/room-panel-controller.mjs\"][\"createRoomObserverController\"];\nconst createRoomRuntimePersistence=ROOM_CORE[\"src/room-panel-controller.mjs\"][\"createRoomRuntimePersistence\"];\nconst positionFloatingMenu=ROOM_CORE[\"src/room-panel-controller.mjs\"][\"positionFloatingMenu\"];\nconst createRoomActionDispatcher=ROOM_CORE[\"src/room-panel-controller.mjs\"][\"createRoomActionDispatcher\"];\nconst createRoomWardrobeController=ROOM_CORE[\"src/room-wardrobe-controller.mjs\"][\"createRoomWardrobeController\"];\nconst normalizeRoomFurnitureId=ROOM_CORE[\"src/areas/area-registry.mjs\"][\"normalizeRoomFurnitureId\"];\nconst getRoomActionGroups=ROOM_CORE[\"src/areas/area-registry.mjs\"][\"getRoomActionGroups\"];\nconst checkRoomActionAvailability=ROOM_CORE[\"src/areas/area-registry.mjs\"][\"checkRoomActionAvailability\"];\nconst createCompanionPulse=ROOM_CORE[\"src/hud-pulse.mjs\"][\"createCompanionPulse\"];\nconst createDressingAssetClient=ROOM_CORE[\"src/runtime/room-dressing-assets.mjs\"][\"createDressingAssetClient\"];\nconst createRoomModuleLoader=ROOM_CORE[\"src/runtime/room-module-loader.mjs\"][\"createRoomModuleLoader\"];\nconst createRoomModuleClient=ROOM_CORE[\"src/runtime/room-module-loader.mjs\"][\"createRoomModuleClient\"];\nconst evaluateRoomModule=ROOM_CORE[\"src/runtime/room-module-loader.mjs\"][\"evaluateRoomModule\"];\nconst attachRoomStyles=ROOM_CORE[\"src/ui/room-style-owner.mjs\"][\"attachRoomStyles\"];\nconst mountRoomHud=ROOM_CORE[\"src/ui/room-hud.mjs\"][\"mountRoomUi\"];\nconst mountRoomActionTray=ROOM_CORE[\"src/ui/room-action-tray.mjs\"][\"mountRoomUi\"];\nconst mountRoomDressingPanel=ROOM_CORE[\"src/ui/room-dressing-panel.mjs\"][\"mountRoomUi\"];\nconst mountRoomFurniturePanel=ROOM_CORE[\"src/ui/room-furniture-panel.mjs\"][\"mountRoomUi\"];\nconst mountRoomReaderPanel=ROOM_CORE[\"src/ui/room-reader-panel.mjs\"][\"mountRoomUi\"];\nconst createRoomUiContext=ROOM_CORE[\"src/ui/room-context.mjs\"][\"createRoomUiContext\"];\nconst createRoomSession=ROOM_CORE[\"src/runtime/room-session.mjs\"][\"createRoomSession\"];";
const workspace='',books='';
const js = ('let STAR_ECHO_FRAME_DATA_URL="";\nlet STAR_ECHO_SVG_BORDER_DATA_URL=(()=>{try{const el=document.querySelector(".star-echo-stage-frame-overlay");const m=el&&getComputedStyle(el).backgroundImage.match(/url\\(["\']?(data:[^"\')]+)["\']?\\)/);return m?m[1]:"";}catch{return "";}})();\nconst LIULI_CARD_AVATAR_DATA_URL='+JSON.stringify(liuliCardAvatarB64)+';\nconst HUD_STAGE_SPEC_2560='+JSON.stringify(hudStageSpec)+';\nconst DAFEIYU_CLIPS='+JSON.stringify(petClips)+';\nconst ROOM_ACTIONS='+JSON.stringify(actionAssets)+';\n'+scene + '\n' + workspace + '\n' + books + '\n' + await read('./panel.js')).replace(/<\/script/gi, '<\\/script');
new Script(js, { filename: 'panel.js' });
const html = (await read('./panel.html')).replace('__PANEL_CSS__', () => css).replace('__PANEL_JS__', () => js);
const template = (await readFile(new URL('./client.template.js', import.meta.url), 'utf8')).replace('__WARDROBE_IDS__',()=>JSON.stringify(wardrobeCatalog.map(o=>o.id)));
await mkdir(new URL('./lib/', import.meta.url), { recursive: true });
const dressingDataUrl=file=>imageCatalog.inline(file);
const dressingPayload={backdrop:await dressingDataUrl('./assets/star-echo/dressing-stage-v52.png'),original:await dressingDataUrl('./assets/room-pet/idle/idle_001.webp'),thumbnails:Object.fromEntries(await Promise.all(wardrobeCatalog.map(async item=>[item.id,await dressingDataUrl('./assets/wardrobe-v1/references/'+item.reference)])))};
await writeFile(new URL('./lib/client.dressing-room-v52.js',import.meta.url),'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.dressing-room-v52.js",factory:()=>('+JSON.stringify(dressingPayload)+')});\n');

await imageCatalog.writePayload('dressing','client.room-assets-dressing-v21.js',dressingPayload);
const wardrobeGeometry=JSON.parse(await read('./assets/wardrobe-v1/geometry.json'));
const wardrobeDeskGeometry=JSON.parse(await read('./assets/wardrobe-v15/geometry.json'));
const supplementGeometry=JSON.parse(await read('./assets/room-transition-v17/supplement-geometry.json'));
const transitionGeometry=JSON.parse(await read('./assets/room-transition-v17/geometry.json'));
const bedReferenceGeometry=JSON.parse(await read('./assets/room-bed-reference-v19/geometry.json'));
const sleepReferenceGeometry=JSON.parse(await read('./assets/room-bed-reference-v19/sleep-geometry.json'));
const leisureGeometry=Object.fromEntries(await Promise.all(['sofaSocial','sofaBody','idleChair'].map(async key=>[key,JSON.parse(await read('./assets/room-motion-v20/'+key+'-geometry.json'))])));
const bedBodyGeometry=JSON.parse(await read('./assets/room-motion-v20/bed-geometry.json'));
const walkGeometry=JSON.parse(await read('./assets/wardrobe-v16/walk-geometry.json')),bedGeometry=JSON.parse(await read('./assets/wardrobe-v16/bed-geometry.json'));
for(const {id} of wardrobeCatalog){
 const payload={version:1,id,geometry:wardrobeGeometry[id],url:await imageCatalog.inline('./assets/wardrobe-v1/'+id+'.png')};
 await writeFile(new URL('./lib/client.wardrobe-'+id+'-v1.js',import.meta.url),'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.wardrobe-'+id+'-v1.js",factory:()=>('+JSON.stringify(payload)+')});\n');
 payload.desk={geometry:wardrobeDeskGeometry[id],url:await imageCatalog.inline('./assets/wardrobe-v15/'+id+'-desk.png')};
 if(!payload.desk.geometry)throw new Error('Missing desk geometry: '+id);
 await writeFile(new URL('./lib/client.wardrobe-'+id+'-v15.js',import.meta.url),'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.wardrobe-'+id+'-v15.js",factory:()=>('+JSON.stringify(payload)+')});\n');
 for(const kind of ['walk','bed'])payload[kind]={geometry:(kind==='walk'?walkGeometry:bedGeometry)[id],url:await imageCatalog.inline('./assets/wardrobe-v16/'+id+'-'+kind+'.png')};
 await writeFile(new URL('./lib/client.wardrobe-'+id+'-v16.js',import.meta.url),'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.wardrobe-'+id+'-v16.js",factory:()=>('+JSON.stringify(payload)+')});\n');
 payload.transition={geometry:transitionGeometry[id],url:await imageCatalog.inline('./assets/room-transition-v17/'+id+'.png')};
 for(const[kind,key]of [['sleep','sleepMotion'],['desk','deskTransition']])payload[key]={geometry:supplementGeometry[kind][id],url:await imageCatalog.inline('./assets/room-transition-v17/'+id+'-'+kind+'.png')};
 await writeFile(new URL('./lib/client.wardrobe-'+id+'-v17.js',import.meta.url),'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.wardrobe-'+id+'-v17.js",factory:()=>('+JSON.stringify(payload)+')});\n');
 payload.bedReference={geometry:bedReferenceGeometry[id],url:await imageCatalog.inline('./assets/room-bed-reference-v19/'+id+'-fixed.png')};
 payload.sleepReference={geometry:sleepReferenceGeometry[id],url:await imageCatalog.inline('./assets/room-bed-reference-v19/'+id+'-sleep.png')};
 await writeFile(new URL('./lib/client.wardrobe-'+id+'-v19.js',import.meta.url),'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.wardrobe-'+id+'-v19.js",factory:()=>('+JSON.stringify(payload)+')});\n');
 payload.bedBody={geometry:bedBodyGeometry[id],url:await imageCatalog.inline('./assets/room-motion-v20/'+id+'-bed.png')};
 if(!payload.bedBody.geometry)throw Error('Missing bed body geometry: '+id);
 for(const key of ['sofaSocial','sofaBody','idleChair']){if(!leisureGeometry[key][id])throw Error('Missing '+key+' geometry: '+id);payload[key]={geometry:leisureGeometry[key][id],url:await imageCatalog.inline('./assets/room-motion-v20/'+id+'-'+key+'.png')};}
 delete payload.bedReference;delete payload.sleepReference;delete payload.bed;delete payload.sleepMotion;
 await writeFile(new URL('./lib/client.wardrobe-'+id+'-v20.js',import.meta.url),'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.wardrobe-'+id+'-v20.js",factory:()=>('+JSON.stringify(payload)+')});\n');
 await imageCatalog.writePayload('wardrobe:'+id,'client.wardrobe-'+id+'-v21.js',payload);
}
await writeFile(new URL('./lib/client.room-art-v7.js',import.meta.url),'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.room-art-v7.js",factory:()=>('+JSON.stringify(roomImages)+')});\n');
const roomV12={...roomImages,mirror:await inlineRoomAsset('floor-two-mirror-v12.png'),hudFrame:starEchoFrameLosslessPngB64,hudBorder:v52FullBorderDataUrl,hudNavigation:v52NavDataUrl};
await writeFile(new URL('./lib/client.room-art-v12.js',import.meta.url),'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.room-art-v12.js",factory:()=>('+JSON.stringify(roomV12)+')});\n');
await imageCatalog.writePayload('art','client.room-assets-art-v21.js',roomV12);
const lifeGeometry=JSON.parse(await read('./assets/room-life-v11/geometry.json')),lifeAtlases={};
for(const name of Object.keys(lifeGeometry))lifeAtlases[name]=await imageCatalog.inline(name==='walk'?'./assets/room-actions/walk-v3.png':'./assets/'+(name==='sofa-rest'?'room-life-v11/':'room-life-v10/')+name+'.png');
const lifePayload={version:11,geometry:lifeGeometry,atlases:lifeAtlases,greenhouse:await imageCatalog.inline('./assets/room-life-v10/greenhouse.png')};
await writeFile(new URL('./lib/client.room-life-v11.js',import.meta.url),'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.room-life-v11.js",factory:()=>('+JSON.stringify(lifePayload)+')});\n');
lifePayload.geometry={...lifeGeometry,...JSON.parse(await read('./assets/room-life-v16/geometry.json'))};
lifePayload.atlases={...lifeAtlases,'bed-entry':await imageCatalog.inline('./assets/room-life-v16/bed.png')};
lifePayload.revision=16;
lifePayload.bedding=await imageCatalog.inline('./assets/room-life-v16/bedding.png');
await writeFile(new URL('./lib/client.room-life-v16.js',import.meta.url),'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.room-life-v16.js",factory:()=>('+JSON.stringify(lifePayload)+')});\n');
lifePayload.revision=17;lifePayload.geometry={...lifePayload.geometry,transition:transitionGeometry.original};lifePayload.atlases={...lifePayload.atlases,transition:await imageCatalog.inline('./assets/room-transition-v17/original.png')};lifePayload.mattress=await imageCatalog.inline('./assets/room-transition-v17/mattress.png');
lifePayload.geometry.sleepMotion=supplementGeometry.sleep.original;lifePayload.atlases.sleepMotion=await imageCatalog.inline('./assets/room-transition-v17/original-sleep.png');
lifePayload.quilt={url:await imageCatalog.inline('./assets/room-transition-v17/quilt.png'),width:1536,height:1024,crop:[114,91,1339,873]};
await writeFile(new URL('./lib/client.room-life-v17.js',import.meta.url),'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.room-life-v17.js",factory:()=>('+JSON.stringify(lifePayload)+')});\n');
lifePayload.revision=19;lifePayload.geometry.bedReference=bedReferenceGeometry.original;lifePayload.atlases.bedReference=await imageCatalog.inline('./assets/room-bed-reference-v19/original-fixed.png');
lifePayload.geometry.sleepReference=sleepReferenceGeometry.original;lifePayload.atlases.sleepReference=await imageCatalog.inline('./assets/room-bed-reference-v19/original-sleep.png');lifePayload.foldedQuilt=await imageCatalog.inline('./assets/room-bed-reference-v19/folded.png');
await writeFile(new URL('./lib/client.room-life-v19.js',import.meta.url),'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.room-life-v19.js",factory:()=>('+JSON.stringify(lifePayload)+')});\n');
lifePayload.revision=20;lifePayload.geometry.bedBody=bedBodyGeometry.original;lifePayload.atlases.bedBody=await imageCatalog.inline('./assets/room-motion-v20/original-bed.png');
for(const key of ['sofaSocial','sofaBody','idleChair']){lifePayload.geometry[key]=leisureGeometry[key].original;lifePayload.atlases[key]=await imageCatalog.inline('./assets/room-motion-v20/original-'+key+'.png');}
lifePayload.chairCleanplate=await imageCatalog.inline('./assets/room-motion-v20/chair-cleanplate.png');
delete lifePayload.quilt;
for(const name of ['bedReference','sleepReference','sleepMotion','bed-entry']){delete lifePayload.geometry[name];delete lifePayload.atlases[name];}
await writeFile(new URL('./lib/client.room-life-v20.js',import.meta.url),'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.room-life-v20.js",factory:()=>('+JSON.stringify(lifePayload)+')});\n');
await imageCatalog.writePayload('life','client.room-assets-life-v21.js',lifePayload);
const roomAssetManifest=await imageCatalog.writeManifest();
if (islandBundleCode) { await writeFile(new URL('./lib/client.island-map-v1.js', import.meta.url), 'window.__ModuleLoader__.load({id:"dsh-whale-status",chunk:"client.island-map-v1.js",factory:()=>({code:'+JSON.stringify(islandBundleCode)+'})});\n'); }
const bridge = await bundleModule('./src/frame-bridge.mjs');
const actions = Object.keys(new CompanionService({}).handlers);
const bookStorage = await bundleModule('./src/room-book-storage.mjs');
const hudSafeArea = await bundleModule('./src/hud-safe-area.mjs');
const built = template.replace('__ROOM_ENERGY_VALIDATOR__',()=> '('+validateRoomEnergySnapshot.toString()+')').replace('__ROOM_PHOTO_ENCODER__',()=> '('+encodeRoomPhotoImages.toString()+')').replace('__ROOM_ASSET_MANIFEST__',()=>JSON.stringify(roomAssetManifest.modules)).replace('__PANEL_HTML__', () => JSON.stringify(html)).replace('__ALLOWED_ACTIONS__', () => JSON.stringify(actions)).replace('__FRAME_BRIDGE__', () => bridge).replace('__BOOK_STORAGE__', () => bookStorage).replace('__HUD_SAFE_AREA__', () => hudSafeArea).replace('__ROOM_MODULE_MANIFEST__',()=>JSON.stringify(moduleManifest));
await writeFile(new URL('./lib/client.js', import.meta.url), built, 'utf8');
await writeFile(new URL('./lib/panel-built.html', import.meta.url), html, 'utf8');
console.log('Built DSH client: lib/client.js');
