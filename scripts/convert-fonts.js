#!/usr/bin/env node
/**
 * Converts all .ttf font files to .woff2 format
 *
 * Verwendung:
 *   node scripts/convert-fonts.js          # Konvertiert via ttf2woff2 (falls installiert)
 *   node scripts/convert-fonts.js --manual  # Zeigt Anleitung für manuelle Konvertierung
 *
 * Manuelle Konvertierung (empfohlen):
 *   1. TTF-Dateien aus public/fonts/ auf https://transfonter.org hochladen
 *   2. WOFF2-Format auswählen, konvertieren
 *   3. WOFF2-Dateien herunterladen und in public/fonts/ ablegen
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fontsDir = path.join(__dirname, '..', 'public', 'fonts');

// ── Manuelle Anleitung ────────────────────────────────────────────────────
const showManualInstructions = () => {
  const ttfFiles = fs.readdirSync(fontsDir).filter(f => f.endsWith('.ttf'));

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  🔧 Manuelle TTF → WOFF2 Konvertierung');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`  ${ttfFiles.length} TTF-Dateien in ${fontsDir}:\n`);

  for (const f of ttfFiles) {
    const stat = fs.statSync(path.join(fontsDir, f));
    console.log(`  • ${f}  (${(stat.size / 1024).toFixed(0)} KB)`);
  }

  console.log('\n  ⚡ Auf https://transfonter.org/ konvertieren:');
  console.log('     1. Alle TTF-Dateien hochladen');
  console.log('     2. Nur "WOFF2" als Format auswählen');
  console.log('     3. Konvertieren und herunterladen');
  console.log('     4. .woff2-Dateien in public/fonts/ ablegen\n');
};

// ── Automatische Konvertierung ────────────────────────────────────────────
const autoConvert = async () => {
  let ttf2woff2;
  try {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    ttf2woff2 = require('ttf2woff2');
  } catch {
    console.log('⚠️  ttf2woff2 nicht installiert – verwende manuelle Methode.\n');
    showManualInstructions();

    console.log('  📦 Alternativ: npm install --save-dev ttf2woff2 && node scripts/convert-fonts.js\n');
    return;
  }

  const files = fs.readdirSync(fontsDir).filter(f => f.endsWith('.ttf'));
  let totalTTF = 0;
  let totalWOFF2 = 0;

  for (const f of files) {
    const name = f.replace('.ttf', '');
    const woff2Path = path.join(fontsDir, name + '.woff2');
    const ttfPath = path.join(fontsDir, f);

    if (fs.existsSync(woff2Path)) {
      console.log(`⏭  ${name}.woff2 existiert bereits`);
      totalTTF += fs.statSync(ttfPath).size;
      totalWOFF2 += fs.statSync(woff2Path).size;
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
};

// ── Main ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

if (args.includes('--manual')) {
  showManualInstructions();
} else {
  await autoConvert();
}