/**
 * diagnose-epipe.mjs
 *
 * Führt esbuild auf jede .tsx/.ts Datei im remotion/ Ordner aus
 * und zeigt WELCHE Datei den EPIPE-Crash verursacht.
 *
 * Ausführen auf dem VPS:
 *   cd /home/nginx/domains/mojobus.co/public/server
 *   node remotion/diagnose-epipe.mjs
 */

import { build } from 'esbuild';
import { readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Alle .tsx und .ts Dateien in remotion/ finden
function findTsxFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findTsxFiles(full));
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

const files = findTsxFiles(__dirname);
console.log(`\n🔍 Prüfe ${files.length} Dateien auf esbuild-Kompatibilität...\n`);

let errorCount = 0;

for (const file of files) {
  const shortName = file.replace(__dirname + '/', '');
  try {
    await build({
      entryPoints: [file],
      bundle: false,       // nur die eine Datei transformieren
      write: false,        // nichts auf Disk schreiben
      platform: 'browser', // gleicher Modus wie Remotion-Bundler
      format: 'esm',
      jsx: 'transform',
      loader: { '.tsx': 'tsx', '.ts': 'ts' },
      logLevel: 'silent',
    });
    console.log(`  ✅ ${shortName}`);
  } catch (err) {
    errorCount++;
    console.log(`  ❌ ${shortName}`);
    console.log(`     → ${err.message?.split('\n')[0] || err}`);
    if (err.errors) {
      for (const e of err.errors.slice(0, 3)) {
        console.log(`     Zeile ${e.location?.line}: ${e.text}`);
      }
    }
  }
}

console.log(`\n${errorCount === 0 ? '✅ Alle Dateien OK' : `❌ ${errorCount} Datei(en) mit Fehlern`}\n`);
