import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const manifest = JSON.parse(fs.readFileSync('baseline-hashes.json', 'utf8'));

function checkGroup(name, entries, basePath) {
  let passed = 0, failed = 0, missing = 0;
  for (const [relPath, info] of Object.entries(entries)) {
    const fullPath = path.resolve(basePath, relPath);
    if (!fs.existsSync(fullPath)) {
      console.error(`[${name}] MISSING:`, relPath);
      missing++;
      continue;
    }
    const buf = fs.readFileSync(fullPath);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    if (hash !== info.sha256) {
      console.error(`[${name}] MUTATED:`, relPath);
      failed++;
    } else {
      passed++;
    }
  }
  return { name, passed, failed, missing, total: Object.keys(entries).length };
}

const classicRes = checkGroup('classicAssets', manifest.classicAssets, 'D:/deepseenhanress/whale-cottage-classic/assets');
const islandRes = checkGroup('islandFiles', manifest.islandFiles, 'D:/deepseenhanress/whale-island-3d');
const statusRes = checkGroup('statusFiles', manifest.statusFiles, 'D:/deepseenhanress/dsh-whale-status');

console.log(JSON.stringify({ classicRes, islandRes, statusRes }, null, 2));
