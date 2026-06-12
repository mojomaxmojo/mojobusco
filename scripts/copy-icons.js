/**
 * Kopiert Icons aus public/ in Android Resource-Ordner für die APK.
 *
 * Löscht ALLE alten Icons (auch adaptive XML) vorher, damit kein
 * blaues Capacitor-Default-Icon übrig bleibt.
 *
 * Aufruf: node scripts/copy-icons.js
 * (Wird automatisch im apk-Befehl nach npx cap sync android ausgeführt)
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const androidResDir = join(rootDir, 'android', 'app', 'src', 'main', 'res');

// Mapping: Icon-Größe → Android mipmap density
const SIZE_TO_DENSITY = {
  48: 'mdpi',
  72: 'hdpi',
  96: 'xhdpi',
  144: 'xxhdpi',
  192: 'xxxhdpi',
};

function copyIcons() {
  if (!existsSync(androidResDir)) {
    console.error('❌ Android res nicht gefunden:', androidResDir);
    console.error('   Stelle sicher dass npx cap sync android ausgeführt wurde.');
    process.exit(1);
  }

  if (!existsSync(publicDir)) {
    console.error('❌ public/ nicht gefunden.');
    process.exit(1);
  }

  // ================================================================
  // 1. ALLE alten Icons in ALLEN mipmap-Ordnern löschen
  // ================================================================
  let deleted = 0;
  let deletedDirs = 0;
  const mipmapDirs = readdirSync(androidResDir).filter(d => d.startsWith('mipmap-'));
  for (const mipDir of mipmapDirs) {
    const fullPath = join(androidResDir, mipDir);
    const files = readdirSync(fullPath);
    for (const file of files) {
      if (file.startsWith('ic_launcher')) {
        unlinkSync(join(fullPath, file));
        deleted++;
      }
    }
  }

  // Auch mipmap-anydpi-v26 Ordner leeren (adaptive icons)
  const anydpiDirs = readdirSync(androidResDir).filter(d => d.startsWith('mipmap-anydpi'));
  for (const adDir of anydpiDirs) {
    const fullPath = join(androidResDir, adDir);
    const files = readdirSync(fullPath);
    for (const file of files) {
      if (file.startsWith('ic_launcher')) {
        unlinkSync(join(fullPath, file));
        deleted++;
      }
    }
  }
  if (deleted > 0) console.log(`  🗑️ ${deleted} alte Icon-Dateien gelöscht`);
  if (deletedDirs > 0) console.log(`  🗑️ ${deletedDirs} alte Icon-Ordner gelöscht`);

  // ================================================================
  // 2. Neue Icons aus public/ in Android mipmap-Ordner kopieren
  // ================================================================
  let copied = 0;
  let warned = false;

  for (const [sizeStr, density] of Object.entries(SIZE_TO_DENSITY)) {
    const size = parseInt(sizeStr);
    const srcFile = join(publicDir, `icon-${size}x${size}.png`);

    if (!existsSync(srcFile)) {
      if (!warned) {
        console.warn(`  ⚠️ ${srcFile} nicht gefunden – überspringe`);
        warned = true;
      }
      continue;
    }

    const mipmapDir = join(androidResDir, `mipmap-${density}`);
    if (!existsSync(mipmapDir)) {
      mkdirSync(mipmapDir, { recursive: true });
    }

    // Normales Icon + Round Icon (gleiches Bild)
    const targets = ['ic_launcher.png', 'ic_launcher_round.png'];
    for (const target of targets) {
      const destFile = join(mipmapDir, target);
      copyFileSync(srcFile, destFile);
      copied++;
    }

    console.log(`  ✅ ${size}x${size} → mipmap-${density}/`);
  }

  if (copied > 0) {
    console.log(`\n✅ ${copied} Icon(s) kopiert nach ${androidResDir}`);
  } else {
    console.log('\n⚠️ Keine Icons gefunden. Prüfe ob public/icon-192x192.png existiert.');
  }
}

copyIcons();