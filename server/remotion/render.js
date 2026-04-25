/**
 * render.js — Remotion Render-Engine
 *
 * Bilder werden VOR dem Render auf den VPS heruntergeladen (file:// URLs).
 * Cleanup erst NACH vollständigem Render + Datei-Existenz-Check.
 */

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition, ensureBrowser } from '@remotion/renderer';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FFMPEG_PATH  = process.env.FFMPEG_PATH  || '/opt/bin/ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/opt/bin/ffprobe';

const OUTPUT_DIR = path.join(os.tmpdir(), 'remotion-renders');
const IMAGES_DIR = path.join(os.tmpdir(), 'remotion-images');

for (const dir of [OUTPUT_DIR, IMAGES_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Chrome finden + Rechte setzen ────────────────────────────────────────

function findAndFixChrome() {
  const serverDir = path.join(__dirname, '..');
  const candidates = [
    path.join(serverDir, 'node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell'),
    path.join(serverDir, 'node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell'),
    '/home/nginx/domains/mojobus.co/public/server/node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell',
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try { fs.chmodSync(p, 0o755); } catch (e) {}
      console.log(`[Remotion] Chrome: ${p}`);
      return p;
    }
  }

  // Wildcard-Suche
  try {
    const remotionDir = path.join(serverDir, 'node_modules/.remotion');
    if (fs.existsSync(remotionDir)) {
      const found = execSync(
        `find "${remotionDir}" -name "chrome-headless-shell" -type f 2>/dev/null | head -1`,
        { encoding: 'utf8', timeout: 5000 }
      ).trim();
      if (found) {
        try { fs.chmodSync(found, 0o755); } catch (e) {}
        console.log(`[Remotion] Chrome (find): ${found}`);
        return found;
      }
    }
  } catch (e) {}

  return null;
}

let CHROME_PATH = null;
try { CHROME_PATH = findAndFixChrome(); } catch (e) {}

const CHROMIUM_OPTIONS = {
  gl: 'swiftshader',
  chromiumFlags: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--single-process',
    '--no-zygote',
  ],
};

// Chrome beim Modul-Start vorbereiten (non-blocking)
async function ensureChromeBinary() {
  try {
    await ensureBrowser({ browserExecutable: CHROME_PATH || undefined });
    if (!CHROME_PATH) CHROME_PATH = findAndFixChrome();
    // chmod -R 755 auf gesamten .remotion Ordner
    const remotionDir = path.join(__dirname, '../node_modules/.remotion');
    if (fs.existsSync(remotionDir)) {
      try { execSync(`chmod -R 755 "${remotionDir}"`, { timeout: 10000 }); } catch (e) {}
    }
    console.log(`[Remotion] Chrome bereit: ${CHROME_PATH || 'auto'}`);
  } catch (e) {
    console.warn('[Remotion] ensureBrowser:', e.message);
  }
}
ensureChromeBinary().catch(() => {});

// ── Bundle Cache ──────────────────────────────────────────────────────────

let bundleCache = null;
let isBundling  = false;
let bundleQueue = [];

async function getBundledEntry() {
  if (bundleCache) return bundleCache;
  if (isBundling) {
    return new Promise((resolve, reject) => bundleQueue.push({ resolve, reject }));
  }
  isBundling = true;
  console.log('[Remotion] Bundling...');
  const t = Date.now();
  try {
    const bundled = await bundle({
      entryPoint: path.join(__dirname, 'index.tsx'),
      webpackOverride: (c) => c,
    });
    bundleCache = bundled;
    console.log(`[Remotion] Bundle fertig in ${((Date.now() - t) / 1000).toFixed(1)}s`);
    bundleQueue.forEach(({ resolve }) => resolve(bundled));
    bundleQueue = [];
    return bundled;
  } catch (err) {
    isBundling = false;
    bundleQueue.forEach(({ reject }) => reject(err));
    bundleQueue = [];
    throw err;
  } finally {
    isBundling = false;
  }
}

// ── Bild-Download ─────────────────────────────────────────────────────────

function getImageExtension(url, contentType) {
  // 1. Content-Type Header
  if (contentType) {
    const ct = contentType.toLowerCase().split(';')[0].trim();
    const map = {
      'image/jpeg': '.jpg', 'image/jpg': '.jpg',
      'image/png': '.png', 'image/webp': '.webp',
      'image/gif': '.gif', 'image/avif': '.avif',
      'image/heic': '.jpg', 'image/tiff': '.jpg',
    };
    if (map[ct]) return map[ct];
  }
  // 2. URL-Pfad
  const m = url.split('?')[0].split('#')[0].match(/\.(jpe?g|jpg|png|webp|gif|avif)$/i);
  if (m) return '.' + m[1].toLowerCase().replace('jpeg', 'jpg');
  // 3. Fallback
  return '.jpg';
}

function downloadFileWithType(url, destPath, attempt = 1) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, {
      timeout: 45000,
      headers: {
        'User-Agent': 'MojoBus-Remotion/1.0',
        'Accept': 'image/webp,image/jpeg,image/png,image/*,*/*',
      },
    }, (res) => {
      // Redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location;
        if (!loc) return reject(new Error(`Redirect ohne Location: ${url}`));
        const next = loc.startsWith('http') ? loc : new URL(loc, url).toString();
        res.resume();
        return downloadFileWithType(next, destPath, attempt).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}: ${url.slice(-60)}`));
      }
      const contentType = res.headers['content-type'] || '';
      // Sicherstellen dass Zielordner existiert
      const dir = path.dirname(destPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(() => {
        const size = fs.statSync(destPath).size;
        if (size < 500) {
          try { fs.unlinkSync(destPath); } catch (e) {}
          return reject(new Error(`Datei zu klein (${size}B): ${url.slice(-60)}`));
        }
        resolve({ filePath: destPath, contentType });
      }));
      file.on('error', (e) => {
        try { fs.unlinkSync(destPath); } catch (_) {}
        reject(e);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout: ${url.slice(-60)}`)); });
  }).catch(async (err) => {
    if (attempt < 3) {
      console.warn(`[Remotion] Retry ${attempt}/3: ${err.message}`);
      await new Promise(r => setTimeout(r, attempt * 2000));
      return downloadFileWithType(url, destPath, attempt + 1);
    }
    throw new Error(`Download fehlgeschlagen: ${err.message}`);
  });
}

/**
 * Lädt alle Bilder herunter — gibt lokale Pfade zurück.
 * Bilder bleiben bis nach dem Render bestehen (kein vorzeitiger Cleanup!).
 */
async function downloadAllImages(imageUrls, sessionDir) {
  // Ordner anlegen mit expliziten Rechten
  fs.mkdirSync(sessionDir, { recursive: true });
  fs.chmodSync(sessionDir, 0o755);

  console.log(`[Remotion] Download: ${imageUrls.length} Bilder nach ${sessionDir}`);
  const t = Date.now();

  // Sequenziell herunterladen (stabiler als parallel auf VPS)
  const localPaths = [];
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const tempPath = path.join(sessionDir, `img-${String(i).padStart(3, '0')}.tmp`);

    try {
      const { filePath, contentType } = await downloadFileWithType(url, tempPath);
      const ext = getImageExtension(url, contentType);
      const finalPath = path.join(sessionDir, `img-${String(i).padStart(3, '0')}${ext}`);

      fs.renameSync(filePath, finalPath);
      fs.chmodSync(finalPath, 0o644); // lesbar für Chrome

      const sizeKB = (fs.statSync(finalPath).size / 1024).toFixed(0);
      console.log(`[Remotion] ✓ Bild ${i + 1}/${imageUrls.length}: ${ext} ${sizeKB}KB`);
      localPaths.push(`file://${finalPath}`);
    } catch (err) {
      console.error(`[Remotion] ✗ Bild ${i + 1} fehlgeschlagen: ${err.message}`);
      // Fallback: erstes erfolgreiches Bild wiederverwenden
      if (localPaths.length > 0) {
        console.log(`[Remotion]   → Fallback auf Bild 1`);
        localPaths.push(localPaths[0]);
      } else {
        localPaths.push(null);
      }
    }
  }

  const valid = localPaths.filter(Boolean);
  if (valid.length === 0) {
    throw new Error('Kein Bild heruntergeladen. Prüfe die Blossom-URLs und VPS-Netzwerk.');
  }

  // null-Einträge ersetzen
  const result = localPaths.map(p => p ?? valid[0]);

  console.log(`[Remotion] ${valid.length}/${imageUrls.length} Bilder bereit in ${((Date.now() - t) / 1000).toFixed(1)}s`);

  // Verzeichnis-Inhalt loggen zur Diagnose
  try {
    const files = fs.readdirSync(sessionDir);
    console.log(`[Remotion] Dateien in ${sessionDir}: ${files.join(', ')}`);
  } catch (e) {}

  return result;
}

// ── Haupt-Render-Funktion ─────────────────────────────────────────────────

export async function renderMojoBusVideo(params) {
  const {
    imageUrls,
    title = 'MojoBus Video',
    summary,
    location,
    country,
    lifestyle = 'mojobus',
    musicUrl,
    secondsPerImage = 5,
    aspectRatio = '16:9',
    colorGrade,
    filmGrain = 'fine',
    captions = [],
    captionStyle = 'tiktok',
    websiteUrl = 'mojobus.co',
    handle = '@mojobus',
    accentColor = '#F59E0B',
    motionBlurStrength = 1,
    onProgress,
  } = params;

  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('Keine Bild-URLs übergeben');
  }

  const compositionId = COMPOSITION_IDS[aspectRatio] || COMPOSITION_IDS['16:9'];
  const sessionId     = crypto.randomBytes(8).toString('hex');
  const sessionDir    = path.join(IMAGES_DIR, sessionId);
  const outputPath    = path.join(OUTPUT_DIR, `mojobus-${sessionId}.mp4`);

  console.log(`[Remotion] ── Start ──────────────────────────────────`);
  console.log(`[Remotion] Composition: ${compositionId}`);
  console.log(`[Remotion] Bilder: ${imageUrls.length} | ${aspectRatio} | ${lifestyle}`);

  // SCHRITT 1: Bilder herunterladen
  let localImageUrls;
  try {
    localImageUrls = await downloadAllImages(imageUrls, sessionDir);
  } catch (err) {
    // Cleanup bei Download-Fehler
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
    throw new Error(`Bild-Download fehlgeschlagen: ${err.message}`);
  }

  // SCHRITT 2: Bundle + Render
  // WICHTIG: Cleanup erst NACH erfolgreichem Render (nicht in finally!)
  let renderError = null;
  let renderResult = null;

  try {
    const bundleLocation = await getBundledEntry();

    const inputProps = {
      imageUrls: localImageUrls,
      title, summary, location, country, lifestyle, musicUrl,
      secondsPerImage, aspectRatio, colorGrade, filmGrain,
      captions, captionStyle, websiteUrl, handle, accentColor, motionBlurStrength,
    };

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
    });

    console.log(`[Remotion] ${composition.durationInFrames} Frames @ ${composition.fps}fps = ${(composition.durationInFrames / composition.fps).toFixed(1)}s`);

    const startTime = Date.now();
    let lastPct = -1;

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      ffmpegExecutable:  FFMPEG_PATH,
      ffprobeExecutable: FFPROBE_PATH,
      crf: 20,
      concurrency: 1,
      ...(CHROME_PATH ? { browserExecutable: CHROME_PATH } : {}),
      chromiumOptions: CHROMIUM_OPTIONS,
      onBrowserLog: ({ type, text }) => {
        if (type === 'error') console.warn(`[Chrome] ${text}`);
      },
      onProgress: ({ progress }) => {
        const pct = Math.round(progress * 100);
        if (onProgress) onProgress(pct);
        if (Math.floor(pct / 5) > Math.floor(lastPct / 5)) {
          console.log(`[Remotion] ${pct}% — ${((Date.now() - startTime) / 1000).toFixed(0)}s`);
          lastPct = pct;
        }
      },
      verbose: false,
    });

    const renderDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    const fileSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
    console.log(`[Remotion] ✅ Fertig: ${fileSizeMB}MB in ${renderDuration}s`);

    renderResult = {
      outputPath,
      fileSizeMB,
      renderDurationSec: renderDuration,
      frames: composition.durationInFrames,
      fps: composition.fps,
      videoDurationSec: (composition.durationInFrames / composition.fps).toFixed(1),
    };

  } catch (err) {
    renderError = err;
  }

  // CLEANUP: Immer nach Render — aber erst wenn Render abgeschlossen ist
  // (nicht in finally, damit Chrome Zeit hat alle Frames zu lesen)
  setTimeout(() => {
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
  }, 5000); // 5 Sekunden Puffer nach Render

  if (renderError) throw renderError;
  return renderResult;
}

// ── Exports ───────────────────────────────────────────────────────────────

export function invalidateBundleCache() {
  bundleCache = null;
  isBundling  = false;
  bundleQueue = [];
  console.log('[Remotion] Bundle-Cache invalidiert');
}

export function cleanupRender(outputPath) {
  try {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
      console.log(`[Remotion] Cleanup: ${outputPath}`);
    }
  } catch (err) {
    console.warn('[Remotion] Cleanup:', err.message);
  }
}

export function cleanupOldRenders(maxAgeMs = 60 * 60 * 1000) {
  try {
    const now = Date.now();
    for (const dir of [OUTPUT_DIR, IMAGES_DIR]) {
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir)) {
        const p = path.join(dir, f);
        try {
          if (now - fs.statSync(p).mtimeMs > maxAgeMs) {
            fs.rmSync(p, { recursive: true, force: true });
          }
        } catch (e) {}
      }
    }
  } catch (e) {}
}
