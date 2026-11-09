export class Element {
 constructor(tag,document){this.tagName=tag.toUpperCase();this.ownerDocument=document;this.children=[];this.events={};this.attributes={};this.dataset={};this.style={};this.hidden=false;this.value='';this._text='';this.className='';this.classList={toggle:(key,on)=>{const s=new Set(this.className.split(/\s+/).filter(Boolean));const yes=on??!s.has(key);yes?s.add(key):s.delete(key);this.className=[...s].join(' ');return yes;},add:(key)=>this.classList.toggle(key,true),remove:(key)=>this.classList.toggle(key,false),contains:key=>this.className.split(/\s+/).includes(key)};}
 set textContent(v){this._text=String(v??'');this.children=[];} get textContent(){return this._text+this.children.map(x=>typeof x==='string'?x:x.textContent).join('');}
 append(...nodes){for(const n of nodes){if(typeof n==='object'){n.remove?.();n.parentNode=this;}this.children.push(n);}}
 prepend(...nodes){this.append(...nodes);this.children=[...nodes,...this.children.filter(n=>!nodes.includes(n))];}
 replaceChildren(...nodes){for(const n of this.children)if(typeof n==='object')n.parentNode=null;this.children=[];this._text='';this.append(...nodes);}
 remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}}
 setAttribute(k,v){this.attributes[k]=String(v);if(k==='class')this.className=String(v);} getAttribute(k){return this.attributes[k];}
 addEventListener(k,fn){(this.events[k]??=[]).push(fn);} removeEventListener(k,fn){this.events[k]=(this.events[k]||[]).filter(x=>x!==fn);}
 async fire(k,extra={}){for(const fn of this.events[k]||[])await fn({target:this,preventDefault(){},...extra});}
 focus(){this.ownerDocument.activeElement=this;} showModal(){this.open=true;} close(){this.open=false;}
 reportValidity(){return true;} scrollIntoView(){} get isConnected(){return this===this.ownerDocument.body||!!this.parentNode?.isConnected;}
}
export const descendants=root=>[root,...root.children.flatMap(x=>typeof x==='object'?descendants(x):[])];
export function createDocument(){const elements=new Map(),doc={hidden:false,createElement:tag=>new Element(tag,doc),createElementNS:(_,tag)=>new Element(tag,doc),createTextNode:text=>String(text),getElementById(id){if(!elements.has(id)){const e=new Element('div',doc);elements.set(id,e);doc.body.append(e);}return elements.get(id);}};doc.body=new Element('body',doc);return doc;}
export const settle=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
