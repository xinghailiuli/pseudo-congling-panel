const bookId = value => typeof value === 'string' && /^(original|import)-[a-z0-9-]{1,100}$/.test(value);
export function validateBookMessage(op, value) {
  if (op === 'load') return value == null;
  if (!value || typeof value !== 'object' || Array.isArray(value) || !bookId(value.id)) return false;
  if (op === 'put') return Object.keys(value).every(k=>['id','title','content','source','addedAt'].includes(k)) && value.id.startsWith('import-') && value.source === 'import' && typeof value.title === 'string' && value.title.length > 0 && value.title.length <= 120 && typeof value.content === 'string' && value.content.trim().length > 0 && value.content.length <= 2000000 && Number.isFinite(value.addedAt);
  if (op === 'mark') return Object.keys(value).every(k=>['id','offset','updatedAt','finished'].includes(k)) && Number.isInteger(value.offset) && value.offset >= 0 && value.offset <= 2000000 && Number.isFinite(value.updatedAt) && typeof value.finished === 'boolean';
  return false;
}

// Separate from companion chat, diary and long-term memory. The sandboxed room
// requests this store through its parent; it never gains host-origin access.
export function createRoomBookStorage(indexedDB) {
  let opening;
  const database = () => opening ||= new Promise((resolve,reject)=>{
    const r=indexedDB.open('liuli-room-books-v1',1);
    r.onupgradeneeded=()=>{r.result.createObjectStore('books',{keyPath:'id'});r.result.createObjectStore('marks',{keyPath:'id'});};
    r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();opening=null;};resolve(r.result);};
    r.onblocked=()=>{opening=null;reject(new Error('阅读记录被其他页面占用，请稍后再试。'));};
    r.onerror=()=>{opening=null;reject(new Error('阅读记录暂时无法打开，请稍后再试。'));};
  });
  return async function request(op,value) {
    if(!validateBookMessage(op,value))throw new Error('无效的书架请求。');
    const db=await database();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(['books','marks'],op==='load'?'readonly':'readwrite'),books=tx.objectStore('books'),marks=tx.objectStore('marks');let result;
      tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(new Error('阅读记录未保存，请检查本机存储空间。'));
      if(op==='load'){result={books:[],marks:[]};books.getAll().onsuccess=e=>{result.books=e.target.result;};marks.getAll().onsuccess=e=>{result.marks=e.target.result;};}
      else if(op==='put')books.getAll().onsuccess=e=>{const existing=e.target.result;if(existing.some(b=>b.id===value.id)){result=existing.find(b=>b.id===value.id);return;}if(existing.length>=40||existing.reduce((n,b)=>n+b.content.length,0)+value.content.length>20000000){tx.abort();return;}books.put(value);result=value;};
      else if(value.id.startsWith('original-')){marks.put(value);result=value;}
      else books.get(value.id).onsuccess=e=>{const b=e.target.result;if(!b){tx.abort();return;}const mark={...value,offset:Math.min(value.offset,b.content.length)};marks.put(mark);result=mark;};
    });
  };
}
