/**
 * Patcht die AndroidManifest.xml nach npx cap sync/android
 *
 * Fügt wichtige Berechtigungen ein, die von Capacitor-Plugins
 * nicht automatisch deklariert werden (z.B. ACCESS_MEDIA_LOCATION).
 *
 * Aufruf: node scripts/patch-android-manifest.js
 * (Wird automatisch nach npx cap sync android ausgeführt)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

// Berechtigungen die sichergestellt werden müssen
const REQUIRED_PERMISSIONS = [
  // Zugriff auf Standort-Metadaten in Fotos (Android 10+)
  // Ohne diese Permission kann @capacitor-community/exif kein GPS lesen
  '<uses-permission android:name="android.permission.ACCESS_MEDIA_LOCATION" />',

  // Speicherzugriff (ältere Android-Versionen)
  '<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />',

  // Medienzugriff (Android 13+)
  '<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />',
];

function patchManifest() {
  if (!existsSync(manifestPath)) {
    console.error(`❌ AndroidManifest.xml nicht gefunden: ${manifestPath}`);
    console.error('   Stelle sicher dass npx cap sync android ausgeführt wurde.');
    process.exit(1);
  }

  let content = readFileSync(manifestPath, 'utf-8');
  let changes = 0;

  for (const permission of REQUIRED_PERMISSIONS) {
    if (!content.includes(permission)) {
      // Permission vor dem <application>-Tag einfügen
      content = content.replace(
        '<application',
        `    ${permission}\n    <application`
      );
      changes++;
      console.log(`  ✅ ${permission.split('"')[1]}`);
    } else {
      console.log(`  ✓ ${permission.split('"')[1]} (bereits vorhanden)`);
    }
  }

  writeFileSync(manifestPath, content, 'utf-8');

  if (changes > 0) {
    console.log(`\n✅ ${changes} Berechtigung(en) hinzugefügt: ${manifestPath}`);
  } else {
    console.log('\n✓ Alle Berechtigungen bereits vorhanden.');
  }
}

patchManifest();
