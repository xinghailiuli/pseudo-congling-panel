import test from 'node:test';
import assert from 'node:assert/strict';
import { probeNumenStatus, loadNumenToken, NUMEN_COMPANION_UUID } from '../src/numen.mjs';

test('Numen status returns offline when connection refused or port closed', async () => {
  const result = await probeNumenStatus({
    fetchImpl: async () => {
      const err = new Error('connect ECONNREFUSED 127.0.0.1:39002');
      err.code = 'ECONNREFUSED';
      throw err;
    }
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, '未启动 / 离线');
  assert.equal(result.code, 'ECONNREFUSED');
  assert.equal(result.source, 'Numen HTTP Bridge (127.0.0.1:39002)');
});

test('Numen status returns online with companion data when world is loaded', async () => {
  const mockPayload = {
    ok: true,
    worldLoaded: true,
    levelName: 'QA_QQtest',
    numenPlayers: [
      {
        uuid: NUMEN_COMPANION_UUID,
        dimension: 'minecraft:overworld',
        x: 120.5,
        y: 65,
        z: -340.2,
        health: 20
      }
    ]
  };

  const result = await probeNumenStatus({
    token: 'test-token',
    fetchImpl: async (url, init) => {
      assert.equal(url, 'http://127.0.0.1:39002/status');
      assert.equal(init.headers['X-Numen-Token'], 'test-token');
      return new Response(JSON.stringify(mockPayload), { status: 200 });
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, '在线');
  assert.equal(result.world, 'QA_QQtest');
  assert.equal(result.companion.uuid, NUMEN_COMPANION_UUID);
  assert.equal(result.companion.x, 120.5);
  assert.equal(result.companion.health, 20);
});

test('Numen status reports offline when world is not loaded yet', async () => {
  const result = await probeNumenStatus({
    fetchImpl: async () => {
      return new Response(JSON.stringify({ ok: true, worldLoaded: false }), { status: 200 });
    }
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, '未启动 / 离线');
  assert.equal(result.reason, 'world_not_loaded');
});

test('Numen status simulates disconnect and recovery cycle', async () => {
  let isConnected = true;
  const mockFetch = async () => {
    if (!isConnected) {
      const err = new Error('connect ECONNREFUSED 127.0.0.1:39002');
      err.code = 'ECONNREFUSED';
      throw err;
    }
    return new Response(JSON.stringify({
      ok: true,
      worldLoaded: true,
      levelName: 'QA_QQtest',
      numenPlayers: [{ uuid: NUMEN_COMPANION_UUID, x: 0, y: 64, z: 0, health: 20 }]
    }), { status: 200 });
  };

  // Phase 1: Online
  const r1 = await probeNumenStatus({ fetchImpl: mockFetch });
  assert.equal(r1.ok, true);
  assert.equal(r1.status, '在线');

  // Phase 2: Disconnect
  isConnected = false;
  const r2 = await probeNumenStatus({ fetchImpl: mockFetch });
  assert.equal(r2.ok, false);
  assert.equal(r2.status, '未启动 / 离线');

  // Phase 3: Recovery
  isConnected = true;
  const r3 = await probeNumenStatus({ fetchImpl: mockFetch });
  assert.equal(r3.ok, true);
  assert.equal(r3.status, '在线');
});

test('Numen status handles HTTP 403 Forbidden without throwing', async () => {
  const result = await probeNumenStatus({
    fetchImpl: async () => new Response('Forbidden', { status: 403 })
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, '未启动 / 离线');
  assert.equal(result.code, 'HTTP_403');
});

test('Numen token loader safely reads real config when present', () => {
  const token = loadNumenToken();
  if (token) {
    assert.equal(typeof token, 'string');
    assert.ok(token.length >= 16);
  }
});
