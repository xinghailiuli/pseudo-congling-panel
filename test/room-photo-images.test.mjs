import test from 'node:test';import assert from 'node:assert/strict';import {createDocument} from './helpers/workspace-dom.mjs';

test('photo copy interns repeated image pixels while preserving their placement and references',async()=>{
 const {internRoomPhotoImages}=await import('../src/room-photo-images.mjs');assert.equal(typeof internRoomPhotoImages,'function');
 const doc=createDocument(),svg=doc.createElement('svg'),group=doc.createElement('g'),url='data:image/png;base64,AQID';svg.append(group);
 const a=doc.createElement('image'),b=doc.createElement('image'),c=doc.createElement('image');
 for(const n of [a,b,c]){n.setAttribute('href',url);n.setAttribute('width',100);n.setAttribute('height',200);n.getAttributeNames=()=>Object.keys(n.attributes);n.replaceWith=replacement=>{const parent=n.parentNode,index=parent.children.indexOf(n);n.parentNode=null;parent.children[index]=replacement;replacement.parentNode=parent;};}
 a.setAttribute('id','existing-ref');a.setAttribute('x',10);b.setAttribute('transform','rotate(4)');b.setAttribute('clip-path','url(#clip)');c.setAttribute('width',120);group.append(a,b,c);
 svg.querySelectorAll=selector=>selector==='image'?[a,b,c]:[];
 internRoomPhotoImages(svg);
 assert.equal(group.children[0].tagName,'USE');assert.equal(group.children[1].tagName,'USE');assert.equal(group.children[2],c,'different source dimensions stay separate');
 assert.equal(group.children[0].getAttribute('id'),'existing-ref');assert.equal(group.children[0].getAttribute('x'),'10');assert.equal(group.children[1].getAttribute('transform'),'rotate(4)');assert.equal(group.children[1].getAttribute('clip-path'),'url(#clip)');
 assert.equal(group.children[0].getAttribute('href'),group.children[1].getAttribute('href'));
 const shared=svg.children.find(n=>n.tagName==='DEFS').children[0];assert.equal(shared.getAttribute('href'),url);assert.equal(shared.getAttribute('width'),'100');
});

test('photo image reads overlap with bounded concurrency and retain whitelist checks',async()=>{
 const {encodeRoomPhotoImages}=await import('../src/room-photo-images.mjs'),urls=Array.from({length:7},(_,i)=>'dsh-app://app/plugins/dsh-whale-status/assets/'+'a'.repeat(64)+'/p'+i+'.png');let active=0,peak=0,unblock;
 const gate=new Promise(r=>unblock=r),job=encodeRoomPhotoImages(urls,{allowed:new Set(urls),fetcher:async()=>{active++;peak=Math.max(peak,active);await gate;active--;return {ok:true,headers:{get:()=> 'image/png'},arrayBuffer:async()=>new Uint8Array([1,2]).buffer};}});
 try{await Promise.resolve();assert.equal(peak,3,'three reads should start before the first one completes');}finally{unblock();await job;}
 assert.equal(active,0);assert.ok(peak<=3);
});

test('failed photo stops queued image reads and settles its workers before allowing a retry',async()=>{
 const {encodeRoomPhotoImages}=await import('../src/room-photo-images.mjs'),urls=Array.from({length:7},(_,i)=>'dsh-app://app/plugins/dsh-whale-status/assets/'+'a'.repeat(64)+'/p'+i+'.png'),started=[];let release,settled=false;
 const gate=new Promise(resolve=>release=resolve);
 const job=encodeRoomPhotoImages(urls,{allowed:new Set(urls),fetcher:async path=>{started.push(path);if(path.endsWith('/p0.png'))throw Error('broken image');await gate;return {ok:true,headers:{get:()=> 'image/png'},arrayBuffer:async()=>new ArrayBuffer(2)};}}).then(()=>{settled=true;},error=>{settled=true;return error;});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false,'failed job must drain its in-flight workers before reporting failure');release();const error=await job;
 assert.match(error.message,/broken image/);assert.equal(started.length,3,'no queued reads should start after the first failure');
});
test('SVG photo rasterization uses a temporary blob and releases it after load and error',async()=>{
 const {loadRoomPhotoSvg}=await import('../src/room-photo-images.mjs');const revoked=[];let mime;
 class Picture{set src(value){assert.equal(value,'blob:photo');queueMicrotask(()=>this.onload());}}
 const options={ImageClass:Picture,makeUrl:blob=>{mime=blob.type;return 'blob:photo';},revokeUrl:url=>revoked.push(url)};
 await loadRoomPhotoSvg('<svg/>',options);assert.equal(mime,'image/svg+xml;charset=utf-8');assert.deepEqual(revoked,['blob:photo']);
 class Broken{set src(value){queueMicrotask(()=>this.onerror());}}await assert.rejects(()=>loadRoomPhotoSvg('<svg/>',{...options,ImageClass:Broken}),/栅格化/);assert.equal(revoked.length,2);
});

test('PNG encoding is asynchronous and fails cleanly when the canvas cannot encode',async()=>{
 const {encodeRoomPhotoPng}=await import('../src/room-photo-images.mjs');assert.equal(typeof encodeRoomPhotoPng,'function');let complete;
 const result=encodeRoomPhotoPng({toBlob(fn,mime){assert.equal(mime,'image/png');complete=fn;},toDataURL(){assert.fail('must not synchronously encode a large base64 PNG');}});
 const blob=new Blob(['pixels'],{type:'image/png'});complete(blob);assert.equal(await result,blob);
 await assert.rejects(()=>encodeRoomPhotoPng({toBlob:fn=>fn(null)}),/PNG/);
});
test('photo export embeds only whitelisted immutable images on explicit request',async()=>{
 const {encodeRoomPhotoImages}=await import('../src/room-photo-images.mjs');const url='http://127.0.0.1:18406/plugins/dsh-whale-status/assets/'+'a'.repeat(64)+'/source.png';let requests=0;
 const options={allowed:new Set([url]),fetcher:async path=>{assert.ok(path.startsWith('/plugins/dsh-whale-status/assets/'),'native photo fetch must use the parent application routing');requests++;return {ok:true,headers:{get:()=> 'image/png'},arrayBuffer:async()=>Uint8Array.from([1,2,3]).buffer};},encode:s=>Buffer.from(s,'binary').toString('base64')};
 const result=await encodeRoomPhotoImages([url,url],options);assert.equal(requests,1);assert.equal(result[url],'data:image/png;base64,AQID');
 await assert.rejects(()=>encodeRoomPhotoImages(['http://example.com/private'],options),/image source/i);assert.equal(requests,1);
});
test('photo client makes a self-contained clone without changing the live room',async()=>{
 const {createRoomPhotoImages}=await import('../src/room-photo-images.mjs');const document=createDocument(),svg=document.createElement('svg'),pic=document.createElement('image'),url='http://127.0.0.1:18406/plugins/dsh-whale-status/assets/'+'a'.repeat(64)+'/source.png';pic.setAttribute('href',url);svg.append(pic);let receive;const parent={postMessage(m){queueMicrotask(()=>receive({source:parent,data:{channel:'liuli-companion',type:'room-photo-images',requestId:m.requestId,images:{[url]:'data:image/png;base64,AQID'}}}));}},win={addEventListener(type,fn){receive=fn;},removeEventListener(){}};
 let frozenControls=[];
 svg.cloneNode=()=>{const copy=document.createElement('svg'),image=document.createElement('image'),hidden=document.createElement('g'),hiddenImage=document.createElement('image');hidden.setAttribute('display','none');hidden.closest=()=>null;hiddenImage.setAttribute('href',url.replace('source.png','unused.png'));hidden.append(hiddenImage);image.setAttribute('href',pic.getAttribute('href'));frozenControls=['data-room-hotspot','data-room-furniture','data-room-control'].map(key=>{const node=document.createElement('g');node.setAttribute(key,'read');return node;});copy.append(image,hidden,...frozenControls);copy.querySelectorAll=selector=>selector==='image'?[image,...(hidden.parentNode?[hiddenImage]:[])]:selector.includes('data-room-hotspot')?frozenControls:selector.includes('display=')?[hidden]:[];copy.querySelector=()=>image;return copy;};
 svg.viewBox={baseVal:{width:1536,height:2104}};
 const client=createRoomPhotoImages({win,parent,uid:()=> 'photo-one'});try{const result=await client.prepare(svg);assert.equal(result.svg.querySelector('image').getAttribute('href'),'data:image/png;base64,AQID');assert.equal(pic.getAttribute('href'),url);assert.equal(result.svg.getAttribute('width'),'1536');assert.equal(result.svg.getAttribute('height'),'2104');assert.equal(result.svg.style.width,'1536px');assert.ok(frozenControls.every(node=>!node.parentNode),'export must omit clickable room controls and captions');}finally{client.dispose();}
});
