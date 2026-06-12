/**
 * Patcht die MainActivity.java nach npx cap sync/android
 *
 * Fügt fehlende Import-Anweisungen hinzu (z.B. android.os.Bundle),
 * die von Capacitor 8 nicht immer korrekt generiert werden.
 *
 * Aufruf: node scripts/patch-main-activity.js
 * (Wird automatisch nach npx cap sync android ausgeführt)
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const activityPath = join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'co', 'mojobus', 'app', 'MainActivity.java');

function patchMainActivity() {
  if (!existsSync(activityPath)) {
    console.error(`❌ MainActivity.java nicht gefunden: ${activityPath}`);
    console.error('   Stelle sicher dass npx cap sync android ausgeführt wurde.');
    process.exit(1);
  }

  let content = readFileSync(activityPath, 'utf-8');
  let changes = 0;

  // Fehlende Imports hinzufügen
  const REQUIRED_IMPORTS = [
    'import android.os.Bundle;',
  ];

  for (const imp of REQUIRED_IMPORTS) {
    if (!content.includes(imp)) {
      // Import nach dem package-Statement einfügen
      const packageEnd = content.indexOf('import com.getcapacitor.BridgeActivity;');
      if (packageEnd !== -1) {
        content = content.replace(
          'import com.getcapacitor.BridgeActivity;',
          `${imp}\nimport com.getcapacitor.BridgeActivity;`
        );
        changes++;
        console.log(`  ✅ ${imp} (hinzugefügt)`);
      } else {
        // Fallback: nach package-Zeile einfügen
        content = content.replace(
          'package co.mojobus.app;',
          `package co.mojobus.app;\n\n${imp}`
        );
        changes++;
        console.log(`  ✅ ${imp} (hinzugefügt via Fallback)`);
      }
    } else {
      console.log(`  ✓ ${imp} (bereits vorhanden)`);
    }
  }

  writeFileSync(activityPath, content, 'utf-8');

  if (changes > 0) {
    console.log(`\n✅ ${changes} Import(s) hinzugefügt: ${activityPath}`);
  } else {
    console.log('\n✓ Alle Imports bereits vorhanden.');
  }
}

patchMainActivity();
