import test from 'node:test';import assert from 'node:assert/strict';
import {createDocument,descendants} from './helpers/workspace-dom.mjs';
const reader=await import('../src/room-book-reader.mjs').catch(()=>({}));
const storage=await import('../src/room-book-storage.mjs').catch(()=>({}));
test('book reader saves page progress, closes and continues in a new instance',async()=>{
 assert.equal(typeof reader.createRoomBookReader,'function');
 const doc=createDocument(),marks=new Map(),book={id:'import-test',title:'纸上的海',content:'潮声。'.repeat(600),source:'import'};
 const request=async(op,value)=>{if(op==='load')return {books:[book],marks:[...marks.values()]};if(op==='mark'){marks.set(value.id,value);return value;}};
 const a=reader.createRoomBookReader({document:doc,request});await a.open();
 const click=async text=>{const el=descendants(doc.body).find(e=>e.tagName==='BUTTON'&&e.textContent===text);assert.ok(el,text);await el.fire('click');};
 await click('纸上的海');await click('下一页');assert.ok(marks.get(book.id).offset>0);
 a.destroy();const b=reader.createRoomBookReader({document:doc,request});await b.open();await click('纸上的海');
 assert.ok(descendants(doc.body).some(e=>e.textContent==='第 2 / 3 页'));b.destroy();
});
test('parent bookshelf rejects unexpected fields, huge books and invalid bookmarks',()=>{
 assert.equal(typeof storage.validateBookMessage,'function');
 assert.equal(storage.validateBookMessage('put',{id:'import-a',title:'A',content:'abc',source:'import',addedAt:1}),true);
 assert.equal(storage.validateBookMessage('put',{id:'../../other',title:'A',content:'abc',source:'import'}),false);
 assert.equal(storage.validateBookMessage('mark',{id:'original-a',offset:-1,updatedAt:2,finished:false}),false);
 assert.equal(storage.validateBookMessage('erase-all',{}),false);
});

async function openReader(){
 const doc=createDocument(),marks=new Map(),book={id:'import-focus',title:'潮声',content:'海。'.repeat(900),source:'import'};
 const launcher=doc.createElement('button');doc.body.append(launcher);launcher.focus();
 const request=async(op,value)=>op==='load'?{books:[book],marks:[...marks.values()]}:marks.set(value.id,value);
 const instance=reader.createRoomBookReader({document:doc,request});await instance.open();
 const find=text=>descendants(doc.body).find(e=>e.tagName==='BUTTON'&&e.textContent===text);
 const click=async text=>{const b=find(text);assert.ok(b,text);b.focus();await b.fire('click');};
 await click(book.title);
 return {doc,marks,book,launcher,instance,find,click,dialog:descendants(doc.body).find(e=>e.tagName==='DIALOG')};
}

test('reader keeps focus on the replacement paging control and falls back to the page at the end',async()=>{
 const {doc,instance,find,click}=await openReader();
 assert.equal(doc.activeElement.tagName,'ARTICLE');
 await click('下一页');assert.ok(doc.activeElement===find('下一页'));assert.ok(doc.activeElement.isConnected);
 await click('下一页');assert.equal(find('下一页').disabled,true);assert.equal(doc.activeElement.tagName,'ARTICLE');assert.ok(doc.activeElement.isConnected);
 await click('上一页');assert.ok(doc.activeElement===find('上一页'));instance.destroy();
});

test('reader arrow keys turn and save pages without stealing editable or modified keystrokes',async()=>{
 const {doc,instance,dialog,marks,book}=await openReader();let prevented=0;
 const key=(key,extra={})=>dialog.fire('keydown',{key,target:doc.activeElement,preventDefault(){prevented++;},...extra});
 await key('ArrowRight');assert.ok(marks.get(book.id).offset>0);assert.equal(doc.activeElement.tagName,'ARTICLE');
 const offset=marks.get(book.id).offset,input=doc.createElement('input');
 for(const extra of [{target:input},{target:{isContentEditable:true}},{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true},{isComposing:true}])await key('ArrowLeft',extra);
 assert.equal(marks.get(book.id).offset,offset);assert.equal(prevented,1);
 await key('ArrowLeft');assert.equal(marks.get(book.id).offset,0);
 await key('ArrowLeft');assert.equal(marks.get(book.id).offset,0);instance.destroy();
});

test('returning to the shelf restores the chosen book and closing restores the original launcher',async()=>{
 const {doc,instance,find,click,book,launcher}=await openReader();
 await click('下一页');await click('返回书架');assert.ok(doc.activeElement===find(book.title));assert.ok(doc.activeElement.isConnected);
 instance.destroy();assert.ok(doc.activeElement===launcher);
});
