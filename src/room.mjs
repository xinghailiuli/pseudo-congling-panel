import { check, text } from './errors.mjs';
export function updateRoom(room, patch, now = Date.now()) {
  check(patch && typeof patch === 'object' && !Array.isArray(patch), 'INVALID_INPUT', '房间设置应为对象');
  for (const key of Object.keys(patch)) check(['lamp','curtain','description','items'].includes(key), 'INVALID_INPUT', '未知房间设置');
  for (const k of ['lamp','curtain']) if (k in patch) check(typeof patch[k] === 'boolean','INVALID_INPUT',`${k}必须为开关`);
  if ('description' in patch) text(patch.description,'房间描述',8000,true);
  if ('items' in patch) {
    check(Array.isArray(patch.items) && patch.items.length <= 100,'INVALID_INPUT','最多 100 件物品');
    const ids=new Set();
    for(const item of patch.items){text(item.id,'物品 ID',80);text(item.name,'物品名称',100);text(item.state,'物品状态',1000,true);check(!ids.has(item.id),'INVALID_INPUT','物品 ID 重复');ids.add(item.id);}
  }
  Object.assign(room, structuredClone(patch));
  room.interactions.push({at:now,changes:structuredClone(patch)});room.interactions=room.interactions.slice(-200);
  return room;
}
export function roomContext(room) { return `房间：${room.description}\n台灯${room.lamp?'亮着':'关着'}，窗帘${room.curtain?'拉开':'合上'}。${room.items.map(x=>`${x.name}：${x.state}`).join('；')}`; }
