#!/usr/bin/env node
/**
 * Generiert alle PWA-/Favicon-Icons in den korrekten Größen.
 *
 * Ausgangslage:
 *   - public/favicon.ico ist 0 Byte.
 *   - Alle icon-*.png sind identische 152×152-Bilder, auch wenn sie z. B.
 *     icon-512x512.png oder favicon-16x16.png heißen.
 *
 * Dieses Script nimmt das bestehende quadratische Icon (icon-512x512.png)
 * als Quelle, skaliert es sauber auf alle benötigten Größen und erzeugt
 * eine echte favicon.ico mit 16×16, 32×32 und 48×48.
 *
 * Aufruf:
 *   node scripts/generate-icons.js
 *
 * Nach dem Laufen lassen sich die generierten Dateien einchecken.
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Jimp } from 'jimp';
import pngToIco from 'png-to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const tmpDir = join(rootDir, '.tmp-icons');

// Quadratische Quelle. Das aktuelle icon-512x512.png ist in Wahrheit 152×152,
// enthält aber bereits das korrekte quadratische App-Icon.
const SOURCE_FILE = join(publicDir, 'icon-512x512.png');

// Alle PNG-Größen, die generiert werden (passt zu manifest.webmanifest + Nginx).
const PNG_SIZES = [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 256, 384, 512];

// Für favicon.ico werden explizit kleine Varianten verwendet.
const ICO_SIZES = [16, 32, 48];

async function main() {
  if (!existsSync(SOURCE_FILE)) {
    console.error(`❌ Quelldatei nicht gefunden: ${SOURCE_FILE}`);
    process.exit(1);
  }

  console.log('🎨 Lade Quellicon...');
  const source = await Jimp.read(SOURCE_FILE);
  console.log(`   Quelle: ${source.bitmap.width}×${source.bitmap.height}px`);

  // Temporäres Verzeichnis für die Zwischen-PNGs der ICO-Datei
  if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  mkdirSync(tmpDir, { recursive: true });

  // ── 1. PNG-Icons in allen Größen ───────────────────────────────────────────
  console.log('\n📐 Generiere PNG-Icons...');
  for (const size of PNG_SIZES) {
    const targetPath = join(publicDir, `icon-${size}x${size}.png`);

    // Jede Größe aus der Quelle neu berechnen (idempotent).
    const clone = source.clone();
    await clone.resize({ w: size, h: size });
    await clone.write(targetPath);

    console.log(`   ✅ ${size}×${size} → ${targetPath.replace(rootDir + '/', '')}`);
  }

  // ── 2. Apple-Touch-Icon (180×180) ─────────────────────────────────────────
  const appleIconPath = join(publicDir, 'apple-touch-icon.png');
  const appleClone = source.clone();
  await appleClone.resize({ w: 180, h: 180 });
  await appleClone.write(appleIconPath);
  console.log(`   ✅ 180×180 → apple-touch-icon.png`);

  // ── 3. Favicon-PNGs (favicon-16x16.png, favicon-32x32.png) ────────────────
  console.log('\n🖼️  Generiere Favicon-PNGs...');
  for (const size of [16, 32]) {
    const targetPath = join(publicDir, `favicon-${size}x${size}.png`);
    const clone = source.clone();
    await clone.resize({ w: size, h: size });
    await clone.write(targetPath);
    console.log(`   ✅ ${size}×${size} → favicon-${size}x${size}.png`);
  }

  // ── 4. favicon.ico ────────────────────────────────────────────────────────
  console.log('\n🧊 Generiere favicon.ico...');
  const icoPngPaths = [];
  for (const size of ICO_SIZES) {
    const tmpPath = join(tmpDir, `favicon-${size}x${size}.png`);
    const clone = source.clone();
    await clone.resize({ w: size, h: size });
    await clone.write(tmpPath);
    icoPngPaths.push(tmpPath);
  }

  const icoBuffer = await pngToIco(icoPngPaths);
  writeFileSync(join(publicDir, 'favicon.ico'), icoBuffer);
  console.log(`   ✅ favicon.ico (${ICO_SIZES.join(', ')} px)`);

  // Aufräumen
  rmSync(tmpDir, { recursive: true, force: true });

  console.log('\n✨ Fertig. Icons wurden in public/ geschrieben.');
  console.log('   Vergiss nicht, die neuen Dateien mit git zu committen.');
}

main().catch((err) => {
  console.error('\n❌ Fehler beim Generieren der Icons:');
  console.error(err);
  process.exit(1);
});
