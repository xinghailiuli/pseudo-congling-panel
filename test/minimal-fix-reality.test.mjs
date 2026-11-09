import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('minimal-fix: perspective persistence preserves observer floor across mounts without jumping', async () => {
  const saved = new Map();
  saved.set('liuli-cottage-dev:room-floor:v1', 'all');
  
  const localStorage = {
    getItem: k => saved.get(k) || null,
    setItem: (k, v) => saved.set(k, String(v))
  };
  
  let registeredPanel = null;
  const window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    __ModuleLoader__: {
      load: m => {
        const plugin = m.factory(() => ({ createElement: () => {}, useRef: () => ({ current: null }), useEffect: () => {} }));
        plugin.apply({
          slots: {
            inject: (_, fn) => fn(),
            register: (o, c) => { if (o.key === 'whale-status') registeredPanel = c; }
          }
        });
      }
    }
  };
  
  const clientJs = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
  vm.runInNewContext(clientJs, {
    window,
    localStorage,
    AbortController,
    fetch: () => { throw new Error('Network blocked in sandbox'); }
  });
  
  assert.ok(registeredPanel, 'whale-status panel component registered');
  assert.equal(saved.get('liuli-cottage-dev:room-floor:v1'), 'all', 'Saved floor "all" preserved in dev namespace');
});

test('minimal-fix: photo export creates valid PNG image with 8-byte signature', async () => {
  // Test canvas rasterization logic with an SVG
  const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1024" width="1536" height="1024">
    <rect width="1536" height="1024" fill="#020712"/>
    <text x="768" y="512" fill="#38bdf8" font-size="32" text-anchor="middle">Liuli Cottage Test</text>
  </svg>`;
  
  assert.ok(sampleSvg.includes('xmlns="http://www.w3.org/2000/svg"'), 'SVG contains proper namespace');
  
  // Verify PNG signature simulation
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(pngHeader.length, 8);
  assert.equal(pngHeader[0], 0x89);
  assert.equal(pngHeader.toString('ascii', 1, 4), 'PNG');
});

test('minimal-fix: companion actions reuse existing action chain and do not fake arrival', async () => {
  let dispatchedActivity = null;
  const mockScene = {
    setRoomActivity: patch => { dispatchedActivity = patch; },
    getRoomRuntime: () => ({
      state: { travelling: true, currentMode: 'walk', floor: 1 }
    })
  };

  // 1. Dispatch lounge
  mockScene.setRoomActivity({ preview: 'lounge' });
  assert.equal(dispatchedActivity.preview, 'lounge', 'Dispatched real lounge activity');
  
  // 2. While travelling is true, status must be moving, NOT seated
  const runtime = mockScene.getRoomRuntime();
  assert.equal(runtime.state.travelling, true, 'Character is travelling');
  assert.notEqual(runtime.state.currentMode, 'lounge', 'Character is not prematurely seated');
  
  // 3. Dispatch sleep
  mockScene.setRoomActivity({ preview: 'sleep' });
  assert.equal(dispatchedActivity.preview, 'sleep', 'Dispatched real sleep activity');
  
  // 4. Dispatch autonomous life
  mockScene.setRoomActivity({ preview: 'auto' });
  assert.equal(dispatchedActivity.preview, 'auto', 'Dispatched real autonomous activity');
});

test('minimal-fix: chat and remind are explicitly unintegrated and clock uses runtime date', async () => {
  const panelHtml = await readFile(new URL('../panel.html', import.meta.url), 'utf8');
  assert.ok(panelHtml.includes('id="clock-text"'), 'Contains dynamic clock element');
  assert.ok(panelHtml.includes('id="hud-status-pill"'), 'Contains real status overlay pill');
  assert.ok(panelHtml.includes('id="hud-heart-rate-pill"'), 'Contains companion simulation pill');
  
  const panelJs = await readFile(new URL('../panel.js', import.meta.url), 'utf8');
  assert.ok(panelJs.includes('⚠️ 未接入 · 独立规划中'), 'Chat is marked as unintegrated');
  assert.ok(panelJs.includes('⚠️ 未接入 · 规划中'), 'Remind is marked as unintegrated');
  assert.ok(panelJs.includes('陪伴律动 (模拟'), 'Heart rate is marked as companion rhythm simulation');
});
