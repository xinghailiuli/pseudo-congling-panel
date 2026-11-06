import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import vm from 'node:vm';
import { createRoomWorkspace } from '../src/room-workspace.mjs';
import { createRoomBookReader } from '../src/room-book-reader.mjs';
import { createRoomRestoreGate } from '../src/room-diagnostics.mjs';
import { createDocument, Element, descendants, settle } from './helpers/workspace-dom.mjs';

test('room inventory edits retain the inventory response revision when activity reads return newer revisions', async () => {
  const document = createDocument();
  const requests = [], listeners = {}, timers = new Map(), selected = [];
  let sceneOptions;
  let timerId = 0;
  const parent = { postMessage(message) { requests.push(message); } };
  const context = {
    createRoomWorkspace,
    createRoomBookReader,
    createRoomRestoreGate: options => createRoomRestoreGate({ ...options, schedule: () => 0, cancel: () => {} }),
    document, parent, Node: Element, structuredClone, crypto: webcrypto,
    DAFEIYU_CLIPS: {}, ROOM_ACTIONS: {},
    WARDROBE_CATALOG: JSON.parse(await readFile(new URL('../assets/wardrobe-v1/catalog.json', import.meta.url), 'utf8')),
    window: { addEventListener(type, listener) { listeners[type] = listener; } },
    setTimeout(callback, delay) { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    createBlockRoom(room, options) {
      sceneOptions = options;
      const scene = document.createElement('svg');
      scene.roomActions = [['read', '书架翻书'], ['enchant', '附魔练习'], ['garden', '照料小麦'], ['rest', '露台歇脚']];
      scene.setRoomActivity = patch => {
        if (patch.preview !== undefined) {
          selected.push(patch.preview);
          options.onActivity({ mode: patch.preview, preview: patch.preview, label: '活动', source: 'preview' });
        }
      };
      return scene;
    },
  };
  vm.runInNewContext(await readFile(new URL('../panel.js', import.meta.url), 'utf8'), context, { filename: 'panel.js' });

  const reply = (action, data, revision) => {
    const request = requests.find(message => message.action === action);
    assert.ok(request, `${action} must be requested on direct Whale House startup`);
    listeners.message({
      source: parent,
      data: {
        channel: 'liuli-companion', type: 'response', id: request.id, payload: { data, revision },
      },
    });
  };
  reply('/room', {
    lamp: false, curtain: true, description: 'Original room',
    items: [{ id: 'bed', name: '床', state: '' }], interactions: [],
  }, 10);
  reply('/night/state', { sleeping: false }, 13);
  reply('/jobs', { items: [] }, 13);
  await settle();

  const actionButtons = descendants(document.getElementById('content')).filter(element => element.tagName === 'BUTTON');
  const actions = [['read', '书架翻书'], ['enchant', '附魔练习'], ['garden', '照料小麦'], ['rest', '露台歇脚']];
  for (const [mode, label] of actions) {
    const button = actionButtons.find(element => element.textContent === label);
    assert.ok(button, `${label} must be offered by the real panel`);
    await button.fire('click');
    assert.equal(selected.at(-1), mode);
    assert.equal(button.getAttribute('aria-pressed'), 'true');
  }
  sceneOptions.onActivity({ mode: 'read', preview: 'read', label: '阅读', source: 'preview' });
  assert.equal(actionButtons.find(b => b.textContent === '书架翻书').getAttribute('aria-pressed'), 'true');
  assert.equal(actionButtons.find(b => b.textContent === '露台歇脚').getAttribute('aria-pressed'), 'false');
  sceneOptions.onActivity({ mode: 'walk', preview: 'auto', label: '散步', source: 'leisure', availableActions: ['enchant', 'garden', 'rest'] });
  assert.equal(actionButtons.find(b => b.textContent === '书架翻书').disabled, true);
  assert.equal(actionButtons.find(b => b.textContent === '照料小麦').disabled, false);
  assert.equal(requests.some(message => message.action === '/room/save'), false, 'local actions must not write room state');

  // Open Workbench -> Cabin & Items (舱室与物品) to add an item
  const workbenchBtn = actionButtons.find(b => b.textContent === '工坊台 · 工具与系统');
  assert.ok(workbenchBtn, 'workbench furniture button must be rendered');
  const openWorkbench = workbenchBtn.fire('click');
  await settle();
  const toolsReq = requests.find(m => m.action === '/tools');
  if (toolsReq) {
    listeners.message({ source: parent, data: { channel: 'liuli-companion', type: 'response', id: toolsReq.id, payload: { data: { tools: [] }, revision: 15 } } });
  }
  await settle();
  await openWorkbench;

  const decorTab = descendants(document.body).find(e => e.tagName === 'BUTTON' && (e.textContent.includes('舱室与物品') || e.getAttribute('aria-label') === '舱室与物品'));
  assert.ok(decorTab, 'decor tab must be offered inside workbench');
  await decorTab.fire('click');
  await settle();

  const addCard = descendants(document.body).find(element =>
    element.tagName === 'SECTION' && element.children.some(child => child.textContent === '添一件物品'));
  assert.ok(addCard, 'the real room inventory form must be rendered inside workbench decor');
  const inputs = descendants(addCard);
  inputs.find(element => element.name === 'name').value = '椅子';
  inputs.find(element => element.name === 'state').value = '窗边';
  const addButton = inputs.find(element => element.tagName === 'BUTTON' && element.textContent === '放进房间');
  assert.ok(addButton);
  void addButton.fire('click');
  await settle();

  const save = requests.find(message => message.action === '/room/save');
  assert.ok(save, 'clicking the real add button must submit the inventory patch');
  assert.equal(save.body.patch.items[0].id, 'bed');
  assert.equal(save.body.patch.items[1].name, '椅子');
  assert.equal(save.revision, 10, 'unrelated activity or tools reads must not upgrade the revision of older inventory data');
});
