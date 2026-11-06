import test from 'node:test';
import assert from 'node:assert/strict';
const books=await import('../src/room-books.mjs').catch(()=>({}));
test('reading preserves every character, including emoji, across page boundaries',()=>{
 assert.equal(typeof books.paginateBook,'function');
 const text='海边的来信。\n\n'+'🌊明天一起看日出。'.repeat(240);const pages=books.paginateBook(text,120);
 assert.equal(pages.join(''),text);assert.ok(pages.every(p=>Array.from(p).length<=120));
});
test('text import uses plain content and stable deduplication identity',async()=>{
 assert.equal(typeof books.importRoomBook,'function');
 const file={name:'小屋.md',size:42,arrayBuffer:async()=>new TextEncoder().encode('# 小屋\n<script>not executed</script>\n你好').buffer};
 const a=await books.importRoomBook(file),b=await books.importRoomBook(file);
 assert.equal(a.title,'小屋');assert.equal(a.id,b.id);assert.ok(a.content.includes('<script>'));assert.equal(a.source,'import');
});
test('empty, oversized and unsupported imports fail without creating records',async()=>{
 assert.equal(typeof books.importRoomBook,'function');
 for(const file of [{name:'a.pdf',size:1},{name:'a.txt',size:20000000},{name:'a.txt',size:0,arrayBuffer:async()=>new ArrayBuffer(0)}])await assert.rejects(()=>books.importRoomBook(file));
});
test('bookmark is clamped to content and stores read progress independently',()=>{
 assert.equal(typeof books.bookmarkFor,'function');
 const mark=books.bookmarkFor({id:'book-a',content:'1234567890'},99,1234);
 assert.deepEqual(mark,{id:'book-a',offset:10,updatedAt:1234,finished:true});
 assert.equal(books.bookmarkFor({id:'book-a',content:'1234'},-3,1234).offset,0);
});
