export function roomDom(document) {
  const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text!=null)el.textContent=String(text);if(cls)el.className=cls;return el;};
  const div=(cls,...children)=>{const el=node('div',null,cls);el.append(...children.flat().filter(c=>c!=null));return el;};
  const svg=(paths,cls='hud-vector-icon')=>{const el=document.createElementNS?.('http://www.w3.org/2000/svg','svg');if(!el)return null;el.setAttribute('viewBox','0 0 24 24');el.setAttribute('class',cls);el.setAttribute('aria-hidden','true');for(const d of paths){const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);el.append(p);}return el;};
  return {node,div,svg};
}
