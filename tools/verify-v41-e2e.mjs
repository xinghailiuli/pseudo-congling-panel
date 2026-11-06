import { createRequire } from 'node:module';
import { fork } from 'node:child_process';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Administrator/AppData/Local/npm-cache/_npx/381cec31605a419a/node_modules/playwright');

async function main() {
  console.log('--- Starting V4.1 End-to-End Verification ---');

  // Start fixture-server
  const fixture = fork('test/fixture-server.mjs', [], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  await new Promise(resolve => {
    fixture.stdout.on('data', data => {
      if (data.toString().includes('18406')) resolve();
    });
  });
  console.log('✔ Fixture UI server running on http://127.0.0.1:18406');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Track postMessage events
  const messages = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[SAVE]') || text.includes('error')) console.log('[PAGE CONSOLE]', text);
  });

  await page.goto('http://127.0.0.1:18406');
  await page.waitForSelector('iframe');
  const frame = page.frameLocator('iframe');

  // Navigate to 'room' page
  console.log('\n--- Test Item 3: Character Branding Copy ---');
  await frame.locator('button[data-page="room"]').click();
  await frame.locator('.block-room-heading').waitFor({ state: 'visible', timeout: 5000 });

  const kicker = await frame.locator('.block-kicker').textContent();
  const heading = await frame.locator('.block-room-heading h2').textContent();
  console.log('Kicker text:', kicker);
  console.log('Heading text:', heading);
  assert.equal(kicker.trim(), 'LIULI / TWO STOREY HOME', 'Kicker must be LIULI / TWO STOREY HOME');
  assert.equal(heading.trim(), '琉璃的小鲸鱼双层小屋', 'Heading must be 琉璃的小鲸鱼双层小屋');

  const patButton = frame.locator('[aria-label="摸摸小鲸鱼"]');
  assert.ok(await patButton.count() > 0, 'Must have aria-label 摸摸小鲸鱼');
  console.log('✔ Found button with aria-label: 摸摸小鲸鱼');

  const fullHtml = await frame.locator('body').innerHTML();
  assert.ok(!fullHtml.includes('大肥鱼'), 'UI document must not contain legacy 大肥鱼 wording');
  console.log('✔ Verified zero occurrences of "大肥鱼" in Room UI');

  console.log('\n--- Test Item 5: Head Pat Feedback ---');
  await patButton.first().click();
  await page.waitForTimeout(100);
  const residentState = await frame.locator('[data-room-resident]').first().getAttribute('data-pet-state');
  console.log('Pet state after click:', residentState);
  assert.equal(residentState, 'head_pat', 'Resident state must be head_pat');

  // Verify blush and sparkle exist in interaction
  const blushCount = await frame.locator('.room-art-pat ellipse[fill="#ff8fa3"]').count();
  const sparkleCount = await frame.locator('.room-art-pat text:text("✧")').count();
  const heartCount = await frame.locator('.room-art-pat text:text("♥")').count();
  console.log(`Blush elements: ${blushCount}, Sparkles: ${sparkleCount}, Heart: ${heartCount}`);
  assert.equal(blushCount, 2, 'Must have 2 blush cheek elements');
  assert.equal(sparkleCount, 1, 'Must have sparkle element');
  assert.equal(heartCount, 1, 'Must have heart element');
  console.log('✔ Verified subtle blush, sparkle, and heart feedback rendered on head pat');

  console.log('\n--- Test Item 1: Natural Living Pacing & Priority ---');
  // Check auto-life dwell time
  const autoButton = frame.locator('.room-life-controls button:text("随她生活")');
  await autoButton.click();
  const initialMode = await frame.locator('.room-scene').getAttribute('data-room-activity');
  console.log('Initial auto mode:', initialMode);
  // Wait 25 seconds - with previous 20s bug, it would flip at 20s. With natural dwell (60s~150s), it stays steady!
  console.log('Waiting 22 seconds to verify character dwells naturally and does not flip every 20s...');
  await page.waitForTimeout(22000);
  const modeAfter22s = await frame.locator('.room-scene').getAttribute('data-room-activity');
  console.log('Mode after 22 seconds:', modeAfter22s);
  assert.equal(modeAfter22s, initialMode, `Character must dwell naturally in ${initialMode} without rapid 20s flipping`);
  console.log('✔ Character dwelled naturally beyond 20s without premature action thrashing');

  // Test manual command priority
  console.log('Testing manual command priority...');
  const typeButton = frame.locator('.room-life-controls button:text("敲键盘")');
  await typeButton.click();
  await page.waitForTimeout(300);
  const manualMode = await frame.locator('.room-scene').getAttribute('data-room-activity');
  const manualSource = await frame.locator('.room-scene').getAttribute('data-room-source');
  console.log(`Manual mode: ${manualMode}, source: ${manualSource}`);
  assert.equal(manualMode, 'type', 'Manual command must take immediate priority');
  assert.equal(manualSource, 'preview', 'Source must be preview');
  console.log('✔ Manual user instruction immediately overrides with highest priority');

  console.log('\n--- Test Item 2: State Save Optimization ---');
  // Wait for typing chair transition to settle into steady perform state
  await page.waitForTimeout(2500);
  const postMsgCount = await page.evaluate(() => {
    return new Promise(resolve => {
      let count = 0;
      const handler = e => {
        if (e.data?.type === 'room-runtime-save') count++;
      };
      window.addEventListener('message', handler);
      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve(count);
      }, 5000); // sample for 5s while idle
    });
  });
  console.log(`postMessage count over 5 seconds while idle: ${postMsgCount}`);
  // In the old code, it would be 5 messages (1 per second). In our code, 0 messages while idle!
  assert.ok(postMsgCount <= 1, `Expected <= 1 saves during 5s idle period, got ${postMsgCount}`);
  console.log('✔ Verified redundant 1-second postMessage spam eliminated (dirty-check active)');

  console.log('\n--- Test Item 6: Narrow Screen Responsive Adaptation ---');
  // Switch to non-room page (overview) to test desktop standard aside layout
  await frame.locator('button[data-page="overview"]').click();
  await page.waitForTimeout(300);

  // Check desktop first
  const desktopAsideWidth = await frame.locator('aside').evaluate(el => el.getBoundingClientRect().width);
  console.log('Desktop aside width on overview page (1440px viewport):', desktopAsideWidth);
  assert.equal(Math.round(desktopAsideWidth), 187, 'Desktop aside width must be 187px');

  // Switch to narrow viewport (480px width)
  console.log('Resizing viewport to 480x800 (narrow screen < 768px)...');
  await page.setViewportSize({ width: 480, height: 800 });
  await page.waitForTimeout(300);

  const narrowAsideWidth = await frame.locator('aside').evaluate(el => el.getBoundingClientRect().width);
  console.log('Narrow aside width (480px viewport):', narrowAsideWidth);
  assert.equal(Math.round(narrowAsideWidth), 66, 'Narrow screen aside width must collapse to 66px');

  const navButtonLabelDisplay = await frame.locator('nav button b').first().evaluate(el => window.getComputedStyle(el).display);
  console.log('Nav button text label display:', navButtonLabelDisplay);
  assert.equal(navButtonLabelDisplay, 'none', 'Nav button text label must be hidden on narrow screen');

  const navButtonIconDisplay = await frame.locator('nav button span').first().evaluate(el => window.getComputedStyle(el).display);
  console.log('Nav button icon display:', navButtonIconDisplay);
  assert.notEqual(navButtonIconDisplay, 'none', 'Nav button icon must remain visible');

  const brandTextDisplay = await frame.locator('.brand div:nth-child(2)').evaluate(el => window.getComputedStyle(el).display);
  console.log('Brand text display:', brandTextDisplay);
  assert.equal(brandTextDisplay, 'none', 'Brand text must be hidden on narrow screen');

  const mainWidth = await frame.locator('main').evaluate(el => el.getBoundingClientRect().width);
  console.log('Main container width:', mainWidth);
  assert.ok(mainWidth >= 390 && mainWidth <= 420, `Main width should comfortably fit available screen width (~414px), got ${mainWidth}`);

  // Test general page (overview) on narrow screen
  await frame.locator('button[data-page="overview"]').click();
  await page.waitForTimeout(300);
  const heroDirection = await frame.locator('.hero').evaluate(el => window.getComputedStyle(el).flexDirection);
  console.log('Hero flex-direction on narrow screen:', heroDirection);
  assert.equal(heroDirection, 'column', 'Hero card must stack vertically in column');
  console.log('✔ Verified narrow viewport responsive layout adapts smoothly without column distortion');

  // Reset to desktop
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  const restoredAsideWidth = await frame.locator('aside').evaluate(el => el.getBoundingClientRect().width);
  assert.equal(Math.round(restoredAsideWidth), 187, 'Desktop aside must restore to 187px');
  console.log('✔ Verified desktop layout restored completely intact');

  await browser.close();
  fixture.kill();
  console.log('\n=== ALL V4.1 END-TO-END VERIFICATION CHECKS PASSED ===\n');
}

main().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
