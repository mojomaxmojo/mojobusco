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

// NIP-55 Query für Android Signer Apps (Amber, Signet, etc.)
const NIP55_QUERIES = `<queries>
    <intent>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.BROWSABLE" />
        <data android:scheme="nostrsigner" />
    </intent>
</queries>`;

// Deep-Link Intent-Filter für Amber-Callback (mojobus://amber-auth)
const AMBER_DEEP_LINK = `
        <!-- NIP-55 Amber Callback (mojobus://amber-auth?pubkey=...) -->
        <intent-filter>
            <action android:name="android.intent.action.VIEW" />
            <category android:name="android.intent.category.DEFAULT" />
            <category android:name="android.intent.category.BROWSABLE" />
            <data android:scheme="mojobus" android:host="amber-auth" />
        </intent-filter>`;

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

  // NIP-55: <queries> Block für nostrsigner: Scheme hinzufügen
  if (!content.includes('nostrsigner')) {
    content = content.replace(
      '<application',
      `${NIP55_QUERIES}\n    <application`
    );
    changes++;
    console.log('  ✅ NIP-55 nostrsigner query (Amber/Signer)');
  } else {
    console.log('  ✓ NIP-55 nostrsigner query (bereits vorhanden)');
  }

  // Amber Deep-Link Intent-Filter für Callback
  if (!content.includes('mojobus://amber-auth')) {
    content = content.replace(
      '</activity>',
      `</activity>${AMBER_DEEP_LINK}`
    );
    changes++;
    console.log('  ✅ Amber Deep-Link mojobus://amber-auth');
  } else {
    console.log('  ✓ Amber Deep-Link (bereits vorhanden)');
  }

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
