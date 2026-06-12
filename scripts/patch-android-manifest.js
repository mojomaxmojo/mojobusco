/**
 * Patcht die AndroidManifest.xml nach npx cap sync/android
 *
 * Fügt wichtige Berechtigungen ein, die von Capacitor-Plugins
 * nicht automatisch deklariert werden:
 *   - ACCESS_MEDIA_LOCATION (GPS-EXIF, Android 10+)
 *   - READ_EXTERNAL_STORAGE, READ_MEDIA_IMAGES
 *   - NIP-55 Signer Queries (Amber: com.greenart7c3.nostrsigner)
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

// ── NIP-55 Queries für Amber ────────────────────────────────────────────────
// Android 11+ (API 30+) verlangt explizite <queries> für Package-Visibility.
// Ohne diese kann MojoBus Amber nicht erkennen oder per Intent öffnen.
const NIP55_QUERIES_BLOCK = `
    <!-- NIP-55: Amber Nostr Signer (com.greenart7c3.nostrsigner) -->
    <queries>
      <package android:name="com.greenart7c3.nostrsigner" />
      <intent>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="nostrsigner" />
      </intent>
    </queries>`;

function patchManifest() {
  if (!existsSync(manifestPath)) {
    console.error(`❌ AndroidManifest.xml nicht gefunden: ${manifestPath}`);
    console.error('   Stelle sicher dass npx cap sync android ausgeführt wurde.');
    process.exit(1);
  }

  let content = readFileSync(manifestPath, 'utf-8');
  let changes = 0;

  // 1. Berechtigungen einfügen
  for (const permission of REQUIRED_PERMISSIONS) {
    if (!content.includes(permission)) {
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

  // 2. NIP-55 Queries für Amber einfügen
  if (!content.includes('com.greenart7c3.nostrsigner')) {
    // Vor </manifest> einfügen, aber VOR dem <application>-Tag
    // denn queries müssen auf Manifest-Level sein
    content = content.replace(
      '<application',
      `${NIP55_QUERIES_BLOCK}\n    <application`
    );
    changes++;
    console.log('  ✅ NIP-55 Signer Queries (Amber)');
  } else {
    console.log('  ✓ NIP-55 Signer Queries (bereits vorhanden)');
  }

  writeFileSync(manifestPath, content, 'utf-8');

  if (changes > 0) {
    console.log(`\n✅ ${changes} Änderungen in AndroidManifest.xml vorgenommen`);
  } else {
    console.log('\n✓ Alle Berechtigungen und Queries bereits vorhanden.');
  }
}

patchManifest();
