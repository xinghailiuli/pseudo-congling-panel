import {getRoomActionGroups,checkRoomActionAvailability} from '../areas/area-registry.mjs';
import {roomDom} from './room-dom.mjs';

export function mountRoomUi(root,context) {
  const {document}=context,{node,div,svg}=roomDom(document);let disposed=false;
  const icon=name=>context.icon?.(name)||svg(['m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z'],'hud-menu-icon');
  const button=(label,fn,cls)=>{const b=node('button',label,cls);b.type='button';b.addEventListener('click',()=>{if(!disposed)return fn();});return b;};
  const card=(label,name,fn,meta='')=>{const b=button('',fn,'hud-menu-card');b.append(icon(name),node('span',label,'hud-card-label'));if(meta)b.append(node('small',meta,'hud-card-meta'));return b;};
  const tabs=div('hud-menu-tabs'),stage=div('hud-menu-content');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','陪伴分类');
  const definitions=[['life','生活动作','walk'],['furniture','家具互动','chair'],['cabin','小屋视角','home'],['help','帮助 / 提示','info']],controls=[];
  function select(id){
    if(disposed)return;
    for(const item of controls){item.b.setAttribute('aria-selected',String(item.id===id));item.b.tabIndex=item.id===id?0:-1;}
    stage.replaceChildren();stage.setAttribute('role','tabpanel');stage.setAttribute('aria-label',definitions.find(t=>t[0]===id)[1]);
    if(id==='life'){
      const grid=div('hud-menu-grid popover-all-actions-list');
      for(const group of getRoomActionGroups())for(const item of group.actions||[]){
        const available=()=>checkRoomActionAvailability(item.id,{room:context.getRoom(),availableActions:context.getAvailableActions(),hasScene:Boolean(context.getScene())});
        const availability=available(),icons={auto:'star',pat:'hand',walk:'walk',lounge:'chair',write:'pen',type:'computer',sleep:'bed',read:'book',enchant:'star',garden:'leaf',rest:'leaf'};
        const floor=item.floor&&!['any','current'].includes(item.floor)?item.floor+'F':'';
        const b=card(item.label,icons[item.id]||'star',()=>{const a=available();if(!a.available){context.notify?.(a.reason,true);return;}return context.dispatchAction(item.id);},floor);
        b.dataset.actionId=item.id;b.setAttribute('aria-disabled',String(!availability.available));b.title=availability.available?item.description:availability.reason;grid.append(b);
      }
      stage.append(grid,node('p','11 项生活动作 · 点击后她会前往对应位置','hud-menu-footnote'));
    }else if(id==='furniture'){
      const grid=div('hud-menu-grid');
      for(const [key,label,name]of[['computer','电脑与记忆','computer'],['enchant','日记与手记','book'],['bed','作息与梦境','bed'],['mirror','全息试衣镜','mirror'],['comms','通讯与近况','chat'],['workbench','工坊与物品','tools']])grid.append(card(label,name,()=>{context.close();return context.openFurniture(key);}));
      stage.append(grid);
    }else if(id==='cabin'){
      const grid=div('hud-menu-grid');
      for(const [value,label]of[['1','一楼起居室'],['2','二楼卧室'],['all','双层总览']])grid.append(card(label,'home',()=>{context.setFloor(value);context.close();}));
      grid.append(card('人物特写','focus',()=>{context.toggleDetail();context.close();}));stage.append(grid);
    }else{
      stage.append(div('hud-help-grid',div('hud-help-card',icon('walk'),node('h3','自然到达'),node('p','选中动作后，她会走到家具旁再开始互动。')),div('hud-help-card',icon('chair'),node('h3','随时切换'),node('p','新动作会等当前拿放物品、起身等必要步骤结束后接续。')),div('hud-help-card',icon('heart'),node('h3','状态会变化'),node('p','精力按真实作息进度更新；心率为随角色活动变化的模拟值。'))));
    }
    context.reposition();
  }
  for(const [id,label,name]of definitions){const b=button('',()=>select(id),'hud-menu-tab');b.append(icon(name),node('span',label));b.setAttribute('role','tab');b.addEventListener('keydown',e=>{if(disposed)return;const index=controls.findIndex(c=>c.id===id),target=e.key==='ArrowRight'?(index+1)%4:e.key==='ArrowLeft'?(index+3)%4:e.key==='Home'?0:e.key==='End'?3:null;if(target!==null){e.preventDefault();select(controls[target].id);controls[target].b.focus();}});controls.push({id,b});tabs.append(b);}
  root.append(tabs,stage);select('life');
  return {update(){const active=controls.find(c=>c.b.getAttribute('aria-selected')==='true');select(active?.id||'life');},dispose(){if(disposed)return;disposed=true;tabs.remove();stage.remove();}};
}
