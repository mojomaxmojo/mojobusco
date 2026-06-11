/**
 * Kopiert PWA-Icons aus public/ in Android Resource-Ordner für die APK.
 *
 * Mapping: public/icon-{size}x{size}.png → android/.../mipmap-{density}/ic_launcher.png
 *
 * Aufruf: node scripts/copy-icons.js
 * (Wird automatisch im apk-Befehl nach npx cap sync android ausgeführt)
 */

import { copyFileSync, existsSync, mkdirSync } from 'fs';
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

  let copied = 0;

  for (const [sizeStr, density] of Object.entries(SIZE_TO_DENSITY)) {
    const size = parseInt(sizeStr);
    const srcFile = join(publicDir, `icon-${size}x${size}.png`);

    if (!existsSync(srcFile)) {
      console.warn(`  ⚠️ ${srcFile} nicht gefunden, überspringe`);
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
    console.log('\n⚠️ Keine Icons kopiert. Prüfe ob public/icon-*.png existiert.');
  }
}

copyIcons();
