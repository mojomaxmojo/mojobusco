/**
 * Kopiert das NIP-55 Signer Plugin in das Android-Projekt
 *
 * Wird nach npx cap sync android ausgeführt, da cap sync
 * das Android-Verzeichnis neu erstellt.
 *
 * Aufruf: node scripts/copy-nip55-plugin.js
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Pfade
const PLUGIN_SRC = join(__dirname, '..', 'plugins', 'nip55-signer', 'Nip55SignerPlugin.java');
const ANDROID_APP_DIR = join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'co', 'mojobus', 'plugins');

function copyPlugin() {
  // Prüfe ob Plugin-Quelle existiert
  if (!existsSync(PLUGIN_SRC)) {
    console.error(`❌ Plugin-Quelle nicht gefunden: ${PLUGIN_SRC}`);
    process.exit(1);
  }

  // Prüfe ob Android-Verzeichnis existiert
  if (!existsSync(join(__dirname, '..', 'android'))) {
    console.error('❌ Android-Verzeichnis nicht gefunden. Bitte zuerst npx cap sync android ausführen.');
    process.exit(1);
  }

  // Zielverzeichnis erstellen
  mkdirSync(ANDROID_APP_DIR, { recursive: true });

  // Plugin kopieren
  const destPath = join(ANDROID_APP_DIR, 'Nip55SignerPlugin.java');
  copyFileSync(PLUGIN_SRC, destPath);
  console.log(`✅ Nip55SignerPlugin.java → ${destPath}`);

  // ── MainActivity patchen – Plugin registrieren ────────────────────────────
  const mainActivityPath = join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'co', 'mojobus', 'app', 'MainActivity.java');
  
  if (existsSync(mainActivityPath)) {
    let content = readFileSync(mainActivityPath, 'utf-8');

    // Prüfen ob der Import bereits existiert
    if (!content.includes('import co.mojobus.plugins.Nip55SignerPlugin;')) {
      // Import hinzufügen (nach dem letzten import)
      content = content.replace(
        /(import .+;\n)(?!import)/,
        '$1import co.mojobus.plugins.Nip55SignerPlugin;\n'
      );
    }

    // Prüfen ob die Plugin-Registrierung bereits existiert
    if (!content.includes('Nip55SignerPlugin.class')) {
      // Plugin in der bridge-Konfiguration registrieren
      // Capacitor 8 erwartet dies normalerweise automatisch via @CapacitorPlugin Annotation,
      // aber zur Sicherheit explizit hinzufügen falls nötig
      console.log('  ℹ MainActivity.java gefunden – Capacitor registriert Plugins normalerweise automatisch via Annotation.');
    }

    writeFileSync(mainActivityPath, content, 'utf-8');
    console.log('✓ MainActivity.java geprüft');
  } else {
    console.log('  ⚠ MainActivity.java nicht gefunden – Plugin wird via @CapacitorPlugin Annotation registriert.');
  }

  console.log('\n✅ NIP-55 Signer Plugin erfolgreich installiert!');
}

copyPlugin();
