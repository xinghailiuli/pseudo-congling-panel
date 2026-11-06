import { createRequire } from 'node:module';
import { fork } from 'node:child_process';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Administrator/AppData/Local/npm-cache/_npx/381cec31605a419a/node_modules/playwright');

async function run() {
  console.log('=== STARTING V4.1 CYCLE AND RESTORATION VERIFICATION ===\n');

  // Start fixture UI server
  const fixture = fork('test/fixture-server.mjs', [], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  await new Promise(resolve => {
    fixture.stdout.on('data', data => {
      if (data.toString().includes('18406')) resolve();
    });
  });
  console.log('✔ Fixture UI server running on http://127.0.0.1:18406');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://127.0.0.1:18406');
  await page.waitForSelector('iframe');
  const frame = page.frameLocator('iframe');

  // Navigate to Room page
  console.log('--- Navigating to Room Page ---');
  await frame.locator('button[data-page="room"]').click();
  await frame.locator('.block-room-heading').waitFor({ state: 'visible', timeout: 5000 });
  console.log('✔ Room page loaded');

  // ----------------------------------------------------
  // TEST 1: Automatic Living Cycle & Dwell Rule (60s~180s)
  // ----------------------------------------------------
  console.log('\n--- TEST 1: Full Auto-Life Transition Cycle & Manual Priority ---');
  // Click '随她生活' (auto mode)
  await frame.locator('.room-life-controls button:text("随她生活")').click();
  await page.waitForTimeout(500);

  const startMode = await frame.locator('.room-scene').getAttribute('data-room-activity');
  console.log(`Auto-life started in mode: [${startMode}]`);
  assert.equal(startMode, 'walk', 'Auto-life initial mode should be walk');

  console.log('Tracking dwell duration in real time (monitoring for 60~65s transition)...');
  const startTime = Date.now();
  let transitionedMode = null;
  let transitionElapsed = 0;

  // Poll until mode changes from walk to next activity
  while (Date.now() - startTime < 80000) {
    const currentMode = await frame.locator('.room-scene').getAttribute('data-room-activity');
    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);

    if (currentMode !== startMode) {
      transitionedMode = currentMode;
      transitionElapsed = Number(elapsedSec);
      console.log(`\n🎉 Natural transition observed! Mode changed from [${startMode}] to [${currentMode}] at ${elapsedSec}s!`);
      break;
    }

    // Progress heartbeats
    if (Math.round(Number(elapsedSec)) % 10 === 0 && Math.round(Number(elapsedSec)) > 0) {
      process.stdout.write(` [${elapsedSec}s: still ${currentMode}] `);
    }
    await page.waitForTimeout(500);
  }

  assert.ok(transitionedMode !== null, 'Activity transition must happen within cycle window');
  console.log(`Actual measured walk dwell: ${transitionElapsed}s`);
  // Must be >= 55s and <= 80s (verifying 60s dwell + variance, NOT the old 20s!)
  assert.ok(transitionElapsed >= 55 && transitionElapsed <= 80, `Walk dwell should be ~60s (bounded within 60~180s rule), measured: ${transitionElapsed}s`);
  console.log('✔ 60~180s Dwell rule verified: Character dwelled for full ~60s before transitioning (not 20s)!');
  assert.equal(transitionedMode, 'lounge', 'Downstairs cycle should transition from walk to lounge');
  console.log('✔ Transitioned to expected next activity in cycle: [lounge]');

  // Test manual takeover during lounging
  console.log('\nTesting manual takeover during auto dwelling:');
  const takeoverStart = Date.now();
  await frame.locator('.room-life-controls button:text("写字")').click();
  await page.waitForTimeout(100);
  const takeoverMode = await frame.locator('.room-scene').getAttribute('data-room-activity');
  const takeoverSource = await frame.locator('.room-scene').getAttribute('data-room-source');
  const takeoverLatency = Date.now() - takeoverStart;
  console.log(`Takeover response: mode=[${takeoverMode}], source=[${takeoverSource}], latency=${takeoverLatency}ms`);
  assert.equal(takeoverMode, 'write', 'Manual action must take effect immediately');
  assert.equal(takeoverSource, 'preview', 'Action source must be preview');
  console.log('✔ User manual operation took over instantly without delay!');

  // ----------------------------------------------------
  // TEST 2: State Recovery Across Navigation, Refresh, Close/Reopen
  // ----------------------------------------------------
  console.log('\n--- TEST 2: State Recovery (Floor, Outfit, Position, Action) ---');

  // Set character to 2F and an action (e.g. read or sleep)
  console.log('Configuring test state on Floor 2:');
  const floor2Btn = frame.locator('.room-floor-controls button:text("二楼")');
  if (await floor2Btn.count() > 0) {
    await floor2Btn.click();
    await page.waitForTimeout(400);
  }
  await frame.locator('.room-life-controls button:text("盖被睡觉")').click();
  await page.waitForTimeout(600);

  // Open holographic mirror and select an outfit (e.g. whale-sweater)
  console.log('Selecting outfit [whale-sweater] in Wardrobe...');
  await frame.locator('button:text("全息镜 · 换装")').click();
  await frame.locator('.room-mirror-wardrobe').waitFor({ state: 'visible', timeout: 3000 });
  const sweaterBtn = frame.locator('.wardrobe-choices button:text("鲸鱼毛衣")');
  assert.ok(await sweaterBtn.count() > 0, 'Must find 鲸鱼毛衣 wardrobe button');
  await sweaterBtn.click();
  await frame.locator('.block-room-shell > .room-scene[data-room-outfit="whale-sweater"]').waitFor({ state: 'attached', timeout: 5000 });
  await frame.locator('button:text("收起换装")').click();
  await page.waitForTimeout(500);

  // Check state before leaving
  const preFloor = await frame.locator('.block-room-shell > .room-scene').getAttribute('data-room-floor');
  const preLevel = await frame.locator('.block-room-shell > .room-scene').getAttribute('data-resident-level');
  const preMode = await frame.locator('.block-room-shell > .room-scene').getAttribute('data-room-activity');
  const preOutfit = await frame.locator('.block-room-shell > .room-scene').getAttribute('data-room-outfit');
  console.log(`Configured state: floor=${preFloor}, residentLevel=${preLevel}, mode=${preMode}, outfit=${preOutfit}`);
  assert.equal(preFloor, '2', 'Floor must be 2');
  assert.equal(preMode, 'sleep', 'Mode must be sleep');
  assert.equal(preOutfit, 'whale-sweater', 'Outfit must be whale-sweater');

  // Part 2A: Navigate away to overview and return
  console.log('\n(2A) Testing Navigation Away and Return:');
  await frame.locator('button[data-page="overview"]').click();
  await page.waitForTimeout(1000);
  console.log('Left room for Overview page. Returning to Room page...');
  await frame.locator('button[data-page="room"]').click();
  await frame.locator('.block-room-heading').waitFor({ state: 'visible', timeout: 5000 });
  await page.waitForTimeout(500);

  const postNavFloor = await frame.locator('.block-room-shell > .room-scene').getAttribute('data-room-floor');
  const postNavLevel = await frame.locator('.block-room-shell > .room-scene').getAttribute('data-resident-level');
  const postNavMode = await frame.locator('.block-room-shell > .room-scene').getAttribute('data-room-activity');
  const postNavOutfit = await frame.locator('.block-room-shell > .room-scene').getAttribute('data-room-outfit');
  console.log(`State after returning: floor=${postNavFloor}, level=${postNavLevel}, mode=${postNavMode}, outfit=${postNavOutfit}`);
  assert.equal(postNavFloor, preFloor, 'Floor must be preserved after returning');
  assert.equal(postNavLevel, preLevel, 'Resident level must be preserved after returning');
  assert.equal(postNavMode, preMode, 'Mode must be preserved after returning');
  assert.equal(postNavOutfit, preOutfit, 'Outfit must be preserved after returning');
  console.log('✔ Navigation away and return state preserved 100%!');

  // Part 2B: Refresh Page
  console.log('\n(2B) Testing Page Reload / Refresh:');
  await page.reload();
  await page.waitForSelector('iframe');
  const reloadedFrame = page.frameLocator('iframe');
  await reloadedFrame.locator('button[data-page="room"]').click();
  await reloadedFrame.locator('.block-room-heading').waitFor({ state: 'visible', timeout: 5000 });
  // Wait for restore to complete and attributes to settle
  await reloadedFrame.locator('.block-room-shell > .room-scene[data-room-floor="2"]').waitFor({ state: 'attached', timeout: 5000 });
  await page.waitForTimeout(1000);

  const postReloadFloor = await reloadedFrame.locator('.block-room-shell > .room-scene').getAttribute('data-room-floor');
  const postReloadLevel = await reloadedFrame.locator('.block-room-shell > .room-scene').getAttribute('data-resident-level');
  const postReloadMode = await reloadedFrame.locator('.block-room-shell > .room-scene').getAttribute('data-room-activity');
  const postReloadOutfit = await reloadedFrame.locator('.block-room-shell > .room-scene').getAttribute('data-room-outfit');
  console.log(`State after reload: floor=${postReloadFloor}, level=${postReloadLevel}, mode=${postReloadMode}, outfit=${postReloadOutfit}`);
  assert.equal(postReloadFloor, preFloor, 'Floor must be preserved after page reload');
  assert.equal(postReloadLevel, preLevel, 'Resident level must be preserved after page reload');
  assert.equal(postReloadMode, preMode, 'Mode must be preserved after page reload');
  assert.equal(postReloadOutfit, preOutfit, 'Outfit must be preserved after page reload');
  console.log('✔ Page reload state restoration verified 100%!');

  // Part 2C: Close context and reopen in new session
  console.log('\n(2C) Testing Close Window and Reopen New Session:');
  await page.close();
  const newPage = await context.newPage();
  await newPage.goto('http://127.0.0.1:18406');
  await newPage.waitForSelector('iframe');
  const newFrame = newPage.frameLocator('iframe');
  await newFrame.locator('button[data-page="room"]').click();
  await newFrame.locator('.block-room-heading').waitFor({ state: 'visible', timeout: 5000 });
  await newFrame.locator('.block-room-shell > .room-scene[data-room-floor="2"]').waitFor({ state: 'attached', timeout: 5000 });
  await newPage.waitForTimeout(1000);

  const postReopenFloor = await newFrame.locator('.block-room-shell > .room-scene').getAttribute('data-room-floor');
  const postReopenLevel = await newFrame.locator('.block-room-shell > .room-scene').getAttribute('data-resident-level');
  const postReopenMode = await newFrame.locator('.block-room-shell > .room-scene').getAttribute('data-room-activity');
  const postReopenOutfit = await newFrame.locator('.block-room-shell > .room-scene').getAttribute('data-room-outfit');
  console.log(`State after reopen: floor=${postReopenFloor}, level=${postReopenLevel}, mode=${postReopenMode}, outfit=${postReopenOutfit}`);
  assert.equal(postReopenFloor, preFloor, 'Floor must be preserved after reopening window');
  assert.equal(postReopenLevel, preLevel, 'Resident level must be preserved after reopening window');
  assert.equal(postReopenMode, preMode, 'Mode must be preserved after reopening window');
  assert.equal(postReopenOutfit, preOutfit, 'Outfit must be preserved after reopening window');
  console.log('✔ Close and reopen session state restoration verified 100%!');

  await newPage.close();
  await browser.close();
  fixture.kill();

  console.log('\n======================================================');
  console.log('🎉 ALL V4.1 STABILITY VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('======================================================\n');
}

run().catch(err => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
