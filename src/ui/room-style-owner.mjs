const stylesByDocument=new WeakMap();

export function attachRoomStyles({document,owner,revision,cssText}) {
  let styles=stylesByDocument.get(document);if(!styles){styles=new Map();stylesByDocument.set(document,styles);}
  const key=owner+'@'+revision;let record=styles.get(key);
  if(!record){
    const element=document.createElement('style');
    element.setAttribute('data-plugin','dsh-whale-status');
    element.setAttribute('data-plugin-css',owner);element.setAttribute('data-room-revision',revision);
    element.textContent=cssText;(document.head||document.body).append(element);
    record={element,refs:0};styles.set(key,record);
  }else if(record.element.textContent!==cssText)throw Error('Room style revision mismatch: '+owner);
  record.refs++;let released=false;
  return ()=>{if(released)return;released=true;if(--record.refs===0){record.element.remove();styles.delete(key);}};
}
