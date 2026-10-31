import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';

class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.events = {};
    this.dataset = {};
    this.attributes = {};
    this.classList = { toggle() {} };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(type, listener) { this.events[type] = listener; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  reportValidity() { return true; }
}

const descendants = root => [root, ...root.children.flatMap(child => child instanceof Element ? descendants(child) : [])];

test('room inventory edits retain the inventory response revision when activity reads return newer revisions', async () => {
  const elements = new Map();
  const document = {
    body: new Element('body'),
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element('div'));
      return elements.get(id);
    },
    createElement: tag => new Element(tag),
    createTextNode: text => text,
  };
  const requests = [], listeners = {}, timers = new Map(), selected = [];
  let sceneOptions;
  let timerId = 0;
  const parent = { postMessage(message) { requests.push(message); } };
  const context = {
    document, parent, crypto: webcrypto, DAFEIYU_CLIPS: {}, ROOM_ACTIONS: {},
    window: { addEventListener(type, listener) { listeners[type] = listener; } },
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    createBlockRoom(room, options) {
      sceneOptions = options;
      const scene = new Element('svg');
      scene.roomActions = [['read','书架翻书'],['enchant','附魔练习'],['garden','照料小麦'],['rest','露台歇脚']];
      scene.setRoomActivity = patch => { selected.push(patch.preview); options.onActivity({mode:patch.preview,preview:patch.preview,label:'活动',source:'preview'}); };
      return scene;
    },
  };
  vm.runInNewContext(await readFile(new URL('../panel.js', import.meta.url), 'utf8'), context, { filename: 'panel.js' });

  const roomButton = document.getElementById('nav').children.find(button => button.dataset.page === 'room');
  assert.ok(roomButton, 'the real panel must register its room navigation button');
  const navigation = roomButton.events.click();
  const reply = (action, data, revision) => {
    const request = requests.find(message => message.action === action);
    assert.ok(request, `${action} must be requested by the room page`);
    listeners.message({ source: parent, data: {
      channel: 'liuli-companion', type: 'response', id: request.id, payload: { data, revision },
    } });
  };
  reply('/room', {
    lamp: false, curtain: true, description: 'Original room',
    items: [{ id: 'bed', name: '床', state: '' }], interactions: [],
  }, 10);
  reply('/night/state', { sleeping: false }, 13);
  reply('/jobs', { items: [] }, 13);
  await navigation;

  const actionButtons = descendants(document.getElementById('content')).filter(element => element.tagName === 'BUTTON');
  const actions = [['read','书架翻书'],['enchant','附魔练习'],['garden','照料小麦'],['rest','露台歇脚']];
  for (const [mode,label] of actions) {
    const button = actionButtons.find(element => element.textContent === label);
    assert.ok(button, `${label} must be offered by the real panel`);
    await button.events.click({preventDefault(){}});
    assert.equal(selected.at(-1),mode);assert.equal(button.attributes['aria-pressed'],'true');
  }
  sceneOptions.onActivity({mode:'read',preview:'read',label:'阅读',source:'preview'});
  assert.equal(actionButtons.find(b=>b.textContent==='书架翻书').attributes['aria-pressed'],'true');
  assert.equal(actionButtons.find(b=>b.textContent==='露台歇脚').attributes['aria-pressed'],'false');
  sceneOptions.onActivity({mode:'walk',preview:'auto',label:'散步',source:'leisure',availableActions:['enchant','garden','rest']});
  assert.equal(actionButtons.find(b=>b.textContent==='书架翻书').disabled,true);
  assert.equal(actionButtons.find(b=>b.textContent==='照料小麦').disabled,false);
  assert.equal(requests.some(message=>message.action==='/room/save'),false,'local actions must not write room state');

  const addCard = descendants(document.getElementById('content')).find(element =>
    element.tagName === 'SECTION' && element.children.some(child => child.textContent === '添一件物品'));
  assert.ok(addCard, 'the real room inventory form must be rendered');
  const inputs = descendants(addCard);
  inputs.find(element => element.name === 'name').value = '椅子';
  inputs.find(element => element.name === 'state').value = '窗边';
  const addButton = inputs.find(element => element.tagName === 'BUTTON' && element.textContent === '放进房间');
  assert.ok(addButton);
  void addButton.events.click({ preventDefault() {} });

  const save = requests.find(message => message.action === '/room/save');
  assert.ok(save, 'clicking the real add button must submit the inventory patch');
  assert.equal(save.body.patch.items[0].id, 'bed');
  assert.equal(save.body.patch.items[1].name, '椅子');
  assert.equal(save.revision, 10, 'unrelated activity reads must not upgrade the revision of older inventory data');
});
