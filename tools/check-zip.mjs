import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const zipPath = 'C:\\Users\\Administrator\\Desktop\\鲸鱼小屋V4交付\\dsh-whale-status-v4-deliverable.zip';
const tmpExtract = 'C:\\Users\\Administrator\\.gemini\\antigravity\\brain\\ae37f740-c256-471e-9000-7a2980e61e0b\\scratch\\v4-zip-check';

fs.mkdirSync(tmpExtract, { recursive: true });

// Extract only a few small text files using tar (which handles zip on Windows 10/11)
try {
  execSync(`tar -xf "${zipPath}" -C "${tmpExtract}" "dsh-whale-status/build.mjs" "dsh-whale-status/panel.js" "dsh-whale-status/panel.css" "dsh-whale-status/src/room-art.mjs"`, { stdio: 'inherit' });
  console.log('Extracted sample files from ZIP.');
  
  for (const f of ['build.mjs', 'panel.js', 'panel.css', 'src/room-art.mjs']) {
    const p = path.join(tmpExtract, 'dsh-whale-status', f);
    if (fs.existsSync(p)) {
      const c = fs.readFileSync(p, 'utf8');
      console.log(`\n--- ${f} ---`);
      console.log('  LIULI branding:', c.includes('LIULI / TWO STOREY HOME'));
      console.log('  stripModuleSyntax:', c.includes('stripModuleSyntax'));
      console.log('  walk:60000:', c.includes('walk:60000') || c.includes('walk: 60000'));
      console.log('  大肥鱼:', c.includes('大肥鱼'));
      console.log('  lastSavedSig (dirty check):', c.includes('lastSavedSig'));
      console.log('  media query max-width 768px:', c.includes('max-width:768px') || c.includes('max-width: 768px'));
    }
  }
} catch (e) {
  console.error('Extraction error:', e.message);
}
