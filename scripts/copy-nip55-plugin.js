/**
 * Kopiert das NIP-55 Signer Plugin in das Android-Projekt
 * und registriert es in der MainActivity.
 *
 * Behandelt verschiedene MainActivity-Formate (Capacitor 3-8).
 *
 * Aufruf: node scripts/copy-nip55-plugin.js
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PLUGIN_SRC = join(__dirname, '..', 'plugins', 'nip55-signer', 'Nip55SignerPlugin.java');
const MAIN_ACTIVITY = join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'co', 'mojobus', 'app', 'MainActivity.java');
const PLUGIN_DEST_DIR = join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'co', 'mojobus', 'plugins');

function copyPlugin() {
  if (!existsSync(PLUGIN_SRC)) {
    console.error(`Plugin-Quelle nicht gefunden: ${PLUGIN_SRC}`);
    process.exit(1);
  }
  if (!existsSync(join(__dirname, '..', 'android'))) {
    console.error('Android-Verzeichnis nicht gefunden. npx cap sync android ausfuhren.');
    process.exit(1);
  }

  // 1. Plugin kopieren
  mkdirSync(PLUGIN_DEST_DIR, { recursive: true });
  const dest = join(PLUGIN_DEST_DIR, 'Nip55SignerPlugin.java');
  copyFileSync(PLUGIN_SRC, dest);
  console.log('Plugin kopiert -> ' + dest);

  // 2. MainActivity finden
  if (!existsSync(MAIN_ACTIVITY)) {
    console.log('MainActivity.java nicht gefunden, uberspringe Registrierung.');
    return;
  }

  let content = readFileSync(MAIN_ACTIVITY, 'utf-8');
  const hadImport = content.includes('import co.mojobus.plugins.Nip55SignerPlugin;');
  const hadRegister = content.includes('registerPlugin(Nip55SignerPlugin.class)');

  if (hadImport && hadRegister) {
    console.log('Plugin bereits registriert.');
    return;
  }

  // --- IMPORT ---
  if (!hadImport) {
    const imports = [];
    if (!content.includes('import android.os.Bundle;')) imports.push('import android.os.Bundle;');
    imports.push('import co.mojobus.plugins.Nip55SignerPlugin;');
    
    if (content.includes('package ')) {
      content = content.replace(
        /(package .+;\n)/,
        '$1' + imports.join('\n') + '\n\n'
      );
    } else {
      content = imports.join('\n') + '\n\n' + content;
    }
    console.log('Imports hinzugefugt: ' + imports.join(', '));
  }

  // --- REGISTERPLUGIN ---
  if (!hadRegister) {
    // Fall 1: onCreate mit super.onCreate()
    if (content.match(/super\.onCreate\(savedInstanceState\)/)) {
      content = content.replace(
        'super.onCreate(savedInstanceState)',
        'super.onCreate(savedInstanceState);\n        registerPlugin(Nip55SignerPlugin.class);'
      ).replace(');;\n', ');\n');
      console.log('✅ Plugin in onCreate() registriert');
    }
    // Fall 2: load()
    else if (content.match(/load\(/)) {
      content = content.replace(
        /load\(/,
        'registerPlugin(Nip55SignerPlugin.class);\n        load('
      );
      console.log('✅ Plugin vor load() registriert');
    }
    // Fall 3: Leere Klasse -> komplettes onCreate erstellen
    else if (content.match(/class MainActivity[^{]*\{/)) {
      content = content.replace(
        /class MainActivity[^{]*\{/,
        'class MainActivity extends BridgeActivity {\n' +
        '    @Override\n' +
        '    public void onCreate(Bundle savedInstanceState) {\n' +
        '        super.onCreate(savedInstanceState);\n' +
        '        registerPlugin(Nip55SignerPlugin.class);\n' +
        '    }\n'
      );
      // Bundle-Import sicherstellen (falls nicht schon da)
      if (!content.includes('import android.os.Bundle;')) {
        content = content.replace(
          /(import co\.mojobus\.plugins\.Nip55SignerPlugin;\n)/,
          'import android.os.Bundle;\n$1'
        );
      }
      console.log('✅ onCreate mit Plugin-Registrierung erstellt');
    }
    // Fall 4: init() - Capacitor 8
    else if (content.includes('init(')) {
      content = content.replace(
        /init\(/,
        'registerPlugin(Nip55SignerPlugin.class);\n        init('
      );
      console.log('✅ Plugin vor init() registriert');
    }
    // Fall 5: Kein bekannter Hook - vor dem letzten } einfugen
    else {
      const lastBrace = content.lastIndexOf('}');
      if (lastBrace > 0) {
        const before = content.substring(0, lastBrace);
        const after = content.substring(lastBrace);
        content = before +
          '\n    @Override\n' +
          '    public void onCreate(Bundle savedInstanceState) {\n' +
          '        super.onCreate(savedInstanceState);\n' +
          '        registerPlugin(Nip55SignerPlugin.class);\n' +
          '    }\n' +
          after;
        if (!content.includes('import android.os.Bundle;')) {
          content = content.replace(
            /(import co\.mojobus\.plugins\.Nip55SignerPlugin;\n)/,
            'import android.os.Bundle;\n$1'
          );
        }
        console.log('✅ onCreate-Methode mit Registrierung eingefugt');
      } else {
        console.log('⚠ Konnte keine Stelle fur registerPlugin finden.');
      }
    }
  }

  writeFileSync(MAIN_ACTIVITY, content, 'utf-8');
  console.log('MainActivity.java aktualisiert');
  console.log('');
  console.log('NIP-55 Signer Plugin installiert!');
}

copyPlugin();
