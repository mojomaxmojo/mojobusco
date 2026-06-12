/**
 * Kopiert das NIP-55 Signer Plugin in das Android-Projekt
 * und registriert es in der MainActivity.
 *
 * Wird nach npx cap sync android ausgeführt.
 *
 * Aufruf: node scripts/copy-nip55-plugin.js
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PLUGIN_SRC = join(__dirname, '..', 'plugins', 'nip55-signer', 'Nip55SignerPlugin.java');
const ANDROID_APP_DIR = join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'co', 'mojobus', 'plugins');
const MAIN_ACTIVITY_PATH = join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'co', 'mojobus', 'app', 'MainActivity.java');

function copyPlugin() {
  if (!existsSync(PLUGIN_SRC)) {
    console.error(`❌ Plugin-Quelle nicht gefunden: ${PLUGIN_SRC}`);
    process.exit(1);
  }

  if (!existsSync(join(__dirname, '..', 'android'))) {
    console.error('❌ Android-Verzeichnis nicht gefunden. npx cap sync android ausführen.');
    process.exit(1);
  }

  // 1. Plugin kopieren
  mkdirSync(ANDROID_APP_DIR, { recursive: true });
  const destPath = join(ANDROID_APP_DIR, 'Nip55SignerPlugin.java');
  copyFileSync(PLUGIN_SRC, destPath);
  console.log(`✅ Plugin kopiert → ${destPath}`);

  // 2. MainActivity patchen – Plugin registrieren
  if (!existsSync(MAIN_ACTIVITY_PATH)) {
    console.log('⚠ MainActivity.java nicht gefunden – überspringe Registrierung.');
    return;
  }

  let content = readFileSync(MAIN_ACTIVITY_PATH, 'utf-8');

  // Import hinzufügen
  if (!content.includes('import co.mojobus.plugins.Nip55SignerPlugin;')) {
    content = content.replace(
      'public class MainActivity',
      'import co.mojobus.plugins.Nip55SignerPlugin;\n\npublic class MainActivity'
    );
    console.log('✅ Import hinzugefügt');
  }

  // Plugin-Registrierung in onCreate() einfügen
  if (!content.includes('registerPlugin(Nip55SignerPlugin.class)')) {
    // Suche super.onCreate(savedInstanceState);
    if (content.includes('super.onCreate(savedInstanceState)')) {
      content = content.replace(
        'super.onCreate(savedInstanceState)',
        'super.onCreate(savedInstanceState);\n        registerPlugin(Nip55SignerPlugin.class);'
      );
      // Entferne das doppelte Semikolon falls nötig
      content = content.replace(
        'super.onCreate(savedInstanceState);;\n        registerPlugin',
        'super.onCreate(savedInstanceState);\n        registerPlugin'
      );
      console.log('✅ Plugin-Registrierung in onCreate() eingefügt');
    } else if (content.includes('load()')) {
      // Bridge.load() pattern (Capacitor 8)
      content = content.replace(
        'load()',
        'load();\n        registerPlugin(Nip55SignerPlugin.class);'
      );
      console.log('✅ Plugin-Registrierung nach load() eingefügt');
    } else {
      console.log('⚠ Konnte onCreate() nicht finden – manuelle Registrierung nötig.');
    }
  }

  writeFileSync(MAIN_ACTIVITY_PATH, content, 'utf-8');
  console.log('✅ MainActivity.java aktualisiert');
  console.log('\n✅ NIP-55 Signer Plugin erfolgreich installiert!');
}

copyPlugin();
