/**
 * setup-remotion.js — Einmaliges Setup-Script für Remotion auf dem VPS
 *
 * Ausführen: node setup-remotion.js
 *
 * Was es macht:
 * 1. Prüft ob Remotion bereits installiert ist
 * 2. Falls nicht: fügt alle Packages zu package.json hinzu
 * 3. Führt npm install aus
 * 4. Verifiziert die Installation
 *
 * Nach erfolgreichem Setup nie mehr nötig — pm2 restart reicht.
 */

import { execSync, spawnSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_PATH = path.join(__dirname, 'package.json');

const REMOTION_VERSION = '4.0.451'; // Aktuelle stabile Version

const REMOTION_PACKAGES = {
  'remotion': REMOTION_VERSION,
  '@remotion/bundler': REMOTION_VERSION,
  '@remotion/renderer': REMOTION_VERSION,
  '@remotion/google-fonts': REMOTION_VERSION,
  '@remotion/motion-blur': REMOTION_VERSION,
  '@remotion/captions': REMOTION_VERSION,
  'react': '18.3.1',
  'react-dom': '18.3.1',
  '@types/react': '18.3.0',
  '@types/react-dom': '18.3.0',
};

// ── Farben für Terminal-Output ───────────────────────────────────────────
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const CYAN   = '\x1b[36m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

function log(emoji, msg, color = '') {
  console.log(`${color}${emoji} ${msg}${RESET}`);
}

// ── Prüfen ob Remotion bereits installiert ───────────────────────────────
function isRemotionInstalled() {
  try {
    const rendererPath = path.join(__dirname, 'node_modules/@remotion/renderer/package.json');
    if (!existsSync(rendererPath)) return false;
    const pkg = JSON.parse(readFileSync(rendererPath, 'utf8'));
    return pkg.version?.startsWith('4.');
  } catch {
    return false;
  }
}

function getInstalledVersion(packageName) {
  try {
    const pkgPath = path.join(__dirname, `node_modules/${packageName}/package.json`);
    if (!existsSync(pkgPath)) return null;
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version;
  } catch {
    return null;
  }
}

// ── package.json updaten ─────────────────────────────────────────────────
function updatePackageJson() {
  const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf8'));

  if (!pkg.dependencies) pkg.dependencies = {};

  let changed = false;
  for (const [name, version] of Object.entries(REMOTION_PACKAGES)) {
    if (!pkg.dependencies[name]) {
      pkg.dependencies[name] = version;
      changed = true;
    }
  }

  if (changed) {
    writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');
    log('📝', 'package.json aktualisiert', CYAN);
  } else {
    log('✓', 'package.json bereits korrekt', GREEN);
  }

  return changed;
}

// ── npm install ausführen ────────────────────────────────────────────────
function runNpmInstall() {
  log('📦', 'Installiere Remotion Packages (kann 2-3 Minuten dauern)...', CYAN);
  log('', `  ${Object.keys(REMOTION_PACKAGES).join('\n  ')}`, YELLOW);

  const result = spawnSync('npm', ['install', '--save'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    log('❌', 'npm install fehlgeschlagen!', RED);
    process.exit(1);
  }
}

// ── Verification ─────────────────────────────────────────────────────────
function verify() {
  log('🔍', 'Verifiziere Installation...', CYAN);

  const results = [];
  for (const name of Object.keys(REMOTION_PACKAGES)) {
    const version = getInstalledVersion(name);
    if (version) {
      results.push({ name, version, ok: true });
    } else {
      results.push({ name, version: 'FEHLT', ok: false });
    }
  }

  const allOk = results.every(r => r.ok);

  console.log('');
  console.log(`${BOLD}Installierte Packages:${RESET}`);
  for (const { name, version, ok } of results) {
    const icon = ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    console.log(`  ${icon} ${name.padEnd(30)} ${ok ? GREEN : RED}${version}${RESET}`);
  }

  console.log('');
  if (allOk) {
    log('✅', `${BOLD}Remotion erfolgreich installiert!${RESET}`, GREEN);
    console.log('');
    log('→', 'Server neu starten:', CYAN);
    console.log(`   ${YELLOW}pm2 restart mojobus-server${RESET}`);
    console.log(`   ${YELLOW}# oder: systemctl restart mojobus-server${RESET}`);
  } else {
    log('❌', 'Einige Packages fehlen — npm install nochmal ausführen', RED);
    process.exit(1);
  }
}

// ── FFmpeg prüfen ─────────────────────────────────────────────────────────
function checkFfmpeg() {
  const ffmpegPath = process.env.FFMPEG_PATH || '/opt/bin/ffmpeg';
  try {
    const result = execSync(`${ffmpegPath} -version 2>&1`, { encoding: 'utf8' });
    const match = result.match(/ffmpeg version ([^\s]+)/);
    log('✓', `FFmpeg gefunden: ${match?.[1] || 'Version unbekannt'} (${ffmpegPath})`, GREEN);
    return true;
  } catch {
    log('⚠️', `FFmpeg nicht gefunden unter ${ffmpegPath}`, YELLOW);
    log('', '  Setze FFMPEG_PATH in deiner .env Datei', YELLOW);
    return false;
  }
}

// ── Haupt-Flow ────────────────────────────────────────────────────────────
console.log('');
console.log(`${BOLD}${CYAN}╔════════════════════════════════════════╗${RESET}`);
console.log(`${BOLD}${CYAN}║   MojoBus Remotion Setup               ║${RESET}`);
console.log(`${BOLD}${CYAN}║   Remotion v${REMOTION_VERSION}                   ║${RESET}`);
console.log(`${BOLD}${CYAN}╚════════════════════════════════════════╝${RESET}`);
console.log('');

// FFmpeg prüfen
checkFfmpeg();
console.log('');

// Bereits installiert?
if (isRemotionInstalled()) {
  const version = getInstalledVersion('@remotion/renderer');
  log('✅', `Remotion bereits installiert (v${version})`, GREEN);
  console.log('');
  log('→', 'Nichts zu tun. Server läuft bereits korrekt.', CYAN);
  log('→', `Falls Fehler auftreten: ${YELLOW}node setup-remotion.js --force${RESET}`, CYAN);

  // --force Flag: Neuinstallation erzwingen
  if (!process.argv.includes('--force')) {
    process.exit(0);
  }
  log('🔄', '--force: Erzwinge Neuinstallation...', YELLOW);
  console.log('');
}

// package.json updaten
updatePackageJson();

// npm install
runNpmInstall();

// Verifizieren
console.log('');
verify();
