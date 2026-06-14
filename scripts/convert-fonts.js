#!/usr/bin/env node
/**
 * Converts all .ttf font files to .woff2 format
 * Run: node scripts/convert-fonts.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ttf2woff2 = require('ttf2woff2');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.join(__dirname, '..', 'public', 'fonts');

const files = fs.readdirSync(fontsDir).filter(f => f.endsWith('.ttf'));

let totalTTF = 0;
let totalWOFF2 = 0;

for (const f of files) {
  const name = f.replace('.ttf', '');
  const woff2Path = path.join(fontsDir, name + '.woff2');
  const ttfPath = path.join(fontsDir, f);

  if (fs.existsSync(woff2Path)) {
    console.log(`⏭  ${name}.woff2 existiert bereits`);
    const ttfSize = fs.statSync(ttfPath).size;
    const woff2Size = fs.statSync(woff2Path).size;
    totalTTF += ttfSize;
    totalWOFF2 += woff2Size;
    continue;
  }

  const ttf = fs.readFileSync(ttfPath);
  const woff2 = ttf2woff2(ttf);
  fs.writeFileSync(woff2Path, woff2);

  const ttfSize = ttf.length;
  const woff2Size = woff2.length;
  const saved = ((1 - woff2Size / ttfSize) * 100).toFixed(0);

  totalTTF += ttfSize;
  totalWOFF2 += woff2Size;

  console.log(`✅ ${name}.woff2  (${(ttfSize/1024).toFixed(0)}KB → ${(woff2Size/1024).toFixed(0)}KB, -${saved}%)`);
}

console.log(`\n📊 Gesamt: ${(totalTTF/1024).toFixed(0)}KB → ${(totalWOFF2/1024).toFixed(0)}KB (-${((1-totalWOFF2/totalTTF)*100).toFixed(0)}%)`);