import {paginateBook,bookmarkFor,importRoomBook,roomOriginalBooks} from './room-books.mjs';

export function createRoomBookReader({document:doc,request,onRead=()=>{}}) {
  let dialog,content,status,restoreFocus,epoch=0,books=[],marks=new Map(),selected,page=0,pages=[],pageOffsets=[];
  const el=(tag,text,cls)=>{const e=doc.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
  const button=(text,fn)=>{const b=el('button',text);b.type='button';b.addEventListener('click',fn);return b;};
  const message=text=>{if(status)status.textContent=text;};
  async function save(finished=false){const book=selected,offset=finished?book.content.length:(pageOffsets[page]??0),m=bookmarkFor(book,offset),generation=epoch;try{await request('mark',m);marks.set(book.id,m);if(generation===epoch)message('阅读进度已保存');}catch(e){if(generation===epoch)message(e.message||'进度未保存，请重试。');}}
  async function turnPage(delta,focus='page'){
    if(!selected||page+delta<0||page+delta>=pages.length)return;
    page+=delta;showPage(focus);await save();
  }
  function showPage(focus='page'){
    content.replaceChildren();
    const heading=el('h3',selected.title),sheet=el('article',pages[page],'room-book-page');sheet.setAttribute('tabindex','0');
    const progress=el('span',`第 ${page+1} / ${pages.length} 页`);progress.setAttribute('aria-live','polite');
    const prev=button('上一页',()=>turnPage(-1,'prev')),next=button('下一页',()=>turnPage(1,'next'));
    prev.disabled=page===0;next.disabled=page===pages.length-1;
    const controls=el('nav',null,'room-book-controls');
    controls.append(prev,progress,next,button('标记读完',()=>save(true)),button('返回书架',showShelf));
    content.append(heading,sheet,controls);
    const target=focus==='prev'?prev:focus==='next'?next:sheet;(target.disabled?sheet:target).focus();
  }
  async function select(book){selected=book;pages=paginateBook(book.content);pageOffsets=[];let offset=marks.get(book.id)?.offset||0,consumed=0;page=0;for(let n=0;n<pages.length;n++){pageOffsets.push(consumed);if(consumed<=offset)page=n;consumed+=pages[n].length;}showPage();onRead(book);if(!marks.has(book.id))await save();}
  function showShelf(){
    const previous=selected?.id;selected=null;content.replaceChildren();
    const intro=el('p','内置原创短篇，也可以导入自己的 TXT、Markdown 或无加密 EPUB。阅读记录只保存在这台电脑。');
    const list=el('div',null,'room-book-shelf');let returnTarget;
    for(const book of books){
      const card=el('section',null,'room-book-spine'),m=marks.get(book.id),open=button(book.title,()=>select(book));
      if(book.id===previous)returnTarget=open;
      card.append(open,el('small',m?.finished?'已读完':m?.offset?'继续阅读 · '+Math.min(100,Math.round(m.offset/Math.max(1,book.content.length)*100))+'%':book.source==='original'?'原创短篇':'本地导入'));list.append(card);
    }
    const file=el('input');file.type='file';file.accept='.txt,.md,.epub';file.setAttribute('aria-label','导入书籍或文本');
    file.addEventListener('change',async()=>{const f=file.files?.[0],generation=epoch;if(!f)return;file.disabled=true;message('正在读取书籍…');try{const book=await importRoomBook(f);await request('put',book);if(generation!==epoch)return;if(!books.some(b=>b.id===book.id))books.push(book);showShelf();message('书籍已导入，可从书架打开。');}catch(e){if(generation===epoch)message(e.message||'导入失败。');}finally{file.disabled=false;file.value='';}});
    content.append(intro,list,file);returnTarget?.focus();
  }
  function close(){if(!dialog)return;epoch++;const prevFocus=restoreFocus;restoreFocus=null;dialog.close?.();dialog.remove();dialog=null;status=null;prevFocus?.focus?.();}
  function keydown(event){
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation?.();close();}
    else if(selected&&['ArrowLeft','ArrowRight'].includes(event.key)&&!event.isComposing&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.target?.isContentEditable&&!['INPUT','TEXTAREA','SELECT'].includes(event.target?.tagName)){
      event.preventDefault();return turnPage(event.key==='ArrowRight'?1:-1);
    }
    else if(event.key==='Tab'&&dialog?.querySelectorAll){const nodes=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),[tabindex="0"]')],first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}}
  }
  return {async open(){if(dialog)return;restoreFocus=doc.activeElement;const generation=++epoch;dialog=el('dialog',null,'room-book-reader');dialog.setAttribute('aria-label','小屋书架');dialog.addEventListener('keydown',keydown);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});const header=el('header');header.append(el('h2','小屋书架'),button('关闭书架',close));content=el('div');status=el('p','正在打开书架…','room-book-status');status.setAttribute('role','status');dialog.append(header,content,status);doc.body.append(dialog);dialog.showModal?.();try{const data=await request('load');if(generation!==epoch)return;books=[...roomOriginalBooks(),...(data.books||[]).filter(b=>b?.source==='import'&&typeof b.content==='string')];marks=new Map((data.marks||[]).map(m=>[m.id,m]));showShelf();message('');header.children[1]?.focus();}catch(e){if(generation===epoch)message(e.message||'书架暂时无法打开。');}},destroy:close};
}
