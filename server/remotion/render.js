/**
 * render.js — Remotion Render-Engine
 *
 * Bilder werden VOR dem Render heruntergeladen und über einen
 * lokalen HTTP-Server bereitgestellt (http://127.0.0.1:PORT/img-NNN.ext).
 * Chrome kann file:// URLs nicht laden (Sicherheitsrestriktionen),
 * aber localhost HTTP funktioniert immer.
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
import { createServer } from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FFMPEG_PATH  = process.env.FFMPEG_PATH  || '/opt/bin/ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/opt/bin/ffprobe';

const OUTPUT_DIR = path.join(os.tmpdir(), 'remotion-renders');
const IMAGES_DIR = path.join(os.tmpdir(), 'remotion-images');

for (const dir of [OUTPUT_DIR, IMAGES_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const COMPOSITION_IDS = {
  '16:9': 'MojoBusVideo-16-9',
  '9:16': 'MojoBusVideo-9-16',
  '1:1':  'MojoBusVideo-1-1',
};

// ── Lokaler Bild-HTTP-Server ──────────────────────────────────────────────
// Chrome kann file:// nicht laden → wir servieren die Bilder lokal über HTTP

const MIME_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png',  '.webp': 'image/webp',
  '.gif': 'image/gif',  '.avif': 'image/avif',
};

/**
 * Startet einen temporären HTTP-Server der ein Verzeichnis ausliefert.
 * Gibt { port, close } zurück.
 */
function startImageServer(serveDir) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      // Nur GET, kein Path-Traversal
      const filename = path.basename(req.url.split('?')[0]);
      const filePath = path.join(serveDir, filename);

      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filename).toLowerCase();
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      const stat = fs.statSync(filePath);

      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      });

      fs.createReadStream(filePath).pipe(res);
    });

    // Freien Port automatisch finden (0 = OS wählt)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      console.log(`[Remotion] Bild-Server läuft auf http://127.0.0.1:${port}`);
      resolve({
        port,
        close: () => new Promise(r => server.close(r)),
      });
    });

    server.on('error', reject);
  });
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
    '--allow-file-access-from-files',  // Fallback falls doch file:// genutzt
    '--disable-web-security',           // Erlaubt cross-origin bei localhost
  ],
};

async function ensureChromeBinary() {
  try {
    await ensureBrowser({ browserExecutable: CHROME_PATH || undefined });
    if (!CHROME_PATH) CHROME_PATH = findAndFixChrome();
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

let bundleCache    = null;
let isBundling     = false;
let bundleQueue    = [];
let bundleAttempts = 0;

async function getBundledEntry() {
  if (bundleCache) return bundleCache;

  if (isBundling) {
    return new Promise((resolve, reject) => bundleQueue.push({ resolve, reject }));
  }

  isBundling = true;
  bundleAttempts++;
  console.log(`[Remotion] Bundling... (Versuch ${bundleAttempts})`);
  const t = Date.now();

  try {
    const bundled = await bundle({
      entryPoint: path.join(__dirname, 'index.tsx'),
      webpackOverride: (c) => c,
    });

    bundleCache    = bundled;
    bundleAttempts = 0;
    console.log(`[Remotion] Bundle fertig in ${((Date.now() - t) / 1000).toFixed(1)}s`);
    bundleQueue.forEach(({ resolve }) => resolve(bundled));
    bundleQueue = [];
    return bundled;

  } catch (err) {
    // EPIPE / esbuild-Absturz → Cache leeren und Warteschlange informieren
    bundleCache = null;
    isBundling  = false;
    bundleQueue.forEach(({ reject }) => reject(err));
    bundleQueue = [];

    const isEsbuildCrash = err.message?.includes('EPIPE') ||
                           err.message?.includes('service is no longer running') ||
                           err.message?.includes('The service was stopped');

    if (isEsbuildCrash && bundleAttempts < 3) {
      // esbuild-Prozess neu starten: kurz warten + nochmal versuchen
      const delay = bundleAttempts * 3000; // 3s, 6s
      console.warn(`[Remotion] esbuild abgestürzt (EPIPE), retry in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
      isBundling = false;
      return getBundledEntry(); // rekursiv nochmal
    }

    throw err;
  } finally {
    isBundling = false;
  }
}

// ── Bild-Download ─────────────────────────────────────────────────────────

function getImageExtension(url, contentType) {
  if (contentType) {
    const ct = contentType.toLowerCase().split(';')[0].trim();
    const map = {
      'image/jpeg': '.jpg', 'image/jpg': '.jpg',
      'image/png': '.png',  'image/webp': '.webp',
      'image/gif': '.gif',  'image/avif': '.avif',
      'image/heic': '.jpg', 'image/tiff': '.jpg',
    };
    if (map[ct]) return map[ct];
  }
  const m = url.split('?')[0].split('#')[0].match(/\.(jpe?g|jpg|png|webp|gif|avif)$/i);
  if (m) return '.' + m[1].toLowerCase().replace('jpeg', 'jpg');
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
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        const loc = res.headers.location;
        if (!loc) { res.resume(); return reject(new Error(`Redirect ohne Location: ${url}`)); }
        const next = loc.startsWith('http') ? loc : new URL(loc, url).toString();
        res.resume();
        return downloadFileWithType(next, destPath, attempt).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}: ${url.slice(-60)}`));
      }
      const contentType = res.headers['content-type'] || '';
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

async function downloadAllImages(imageUrls, sessionDir) {
  fs.mkdirSync(sessionDir, { recursive: true });
  try { fs.chmodSync(sessionDir, 0o755); } catch (e) {}

  console.log(`[Remotion] Download: ${imageUrls.length} Bilder`);
  const t = Date.now();
  const localFilenames = []; // nur Dateinamen, Port kommt später

  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const tempPath = path.join(sessionDir, `img-${String(i).padStart(3, '0')}.tmp`);

    try {
      const { filePath, contentType } = await downloadFileWithType(url, tempPath);
      const ext = getImageExtension(url, contentType);
      const filename = `img-${String(i).padStart(3, '0')}${ext}`;
      const finalPath = path.join(sessionDir, filename);

      fs.renameSync(filePath, finalPath);
      try { fs.chmodSync(finalPath, 0o644); } catch (e) {}

      const sizeKB = (fs.statSync(finalPath).size / 1024).toFixed(0);
      console.log(`[Remotion] ✓ Bild ${i + 1}/${imageUrls.length}: ${filename} ${sizeKB}KB`);
      localFilenames.push(filename);
    } catch (err) {
      console.error(`[Remotion] ✗ Bild ${i + 1} fehlgeschlagen: ${err.message}`);
      // Fallback: ersten erfolgreichen Namen nochmal nutzen
      if (localFilenames.length > 0) {
        localFilenames.push(localFilenames[0]);
        console.log(`[Remotion]   → Fallback auf ${localFilenames[0]}`);
      } else {
        localFilenames.push(null);
      }
    }
  }

  const valid = localFilenames.filter(Boolean);
  if (valid.length === 0) {
    throw new Error('Kein Bild heruntergeladen.');
  }

  // null ersetzen
  const result = localFilenames.map(f => f ?? valid[0]);
  console.log(`[Remotion] ${valid.length}/${imageUrls.length} Bilder in ${((Date.now() - t) / 1000).toFixed(1)}s`);

  // Verzeichnis-Inhalt zur Diagnose
  try {
    const files = fs.readdirSync(sessionDir);
    console.log(`[Remotion] Dateien: ${files.join(', ')}`);
  } catch (e) {}

  return result; // Array von Dateinamen (relativ zum sessionDir)
}

// ── Haupt-Render-Funktion ─────────────────────────────────────────────────

export async function renderMojoBusVideo(params) {
  const {
    imageUrls,
    title = 'MojoBus Video',
    summary, location, country,
    lifestyle = 'mojobus',
    musicUrl,
    secondsPerImage = 5,
    aspectRatio = '16:9',
    colorGrade, filmGrain = 'fine',
    captions = [], captionStyle = 'tiktok',
    websiteUrl = 'mojobus.co',
    handle = '@mojobus',
    accentColor = '#F59E0B',
    motionBlurStrength = 1,
    // ── NEU: Beat-Sync ────────────────────────────────────────────────
    beatSyncStrength = 0.6,
    beatThreshold = 0.60,
    showWaveformBar = false,
    // ── NEU: Transitions ─────────────────────────────────────────────
    transitionType = 'auto',
    // ── NEU: Routen-Karte ────────────────────────────────────────────
    showRouteMap = false,
    routeCoords,
    mapImageUrl,
    // ── NEU: Lottie Bus ───────────────────────────────────────────────
    showLottieBus = true,
    onProgress,
  } = params;

  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('Keine Bild-URLs übergeben');
  }

  const compositionId = COMPOSITION_IDS[aspectRatio] || COMPOSITION_IDS['16:9'];
  const sessionId     = crypto.randomBytes(8).toString('hex');
  const sessionDir    = path.join(IMAGES_DIR, sessionId);
  const outputPath    = path.join(OUTPUT_DIR, `mojobus-${sessionId}.mp4`);

  console.log(`[Remotion] ── Start: ${compositionId} | ${imageUrls.length} Bilder | ${aspectRatio}`);

  // SCHRITT 1: Bilder herunterladen (gibt Dateinamen zurück)
  let imageFilenames;
  try {
    imageFilenames = await downloadAllImages(imageUrls, sessionDir);
  } catch (err) {
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
    throw new Error(`Bild-Download fehlgeschlagen: ${err.message}`);
  }

  // SCHRITT 1b: Musik-Dauer auslesen (für Loop-freies Audio)
  let musicDurationSec = null;
  if (musicUrl) {
    // Musik-URL ist eine localhost-URL wie http://localhost:3002/api/music/track.mp3
    // ffprobe kann HTTP-URLs direkt lesen
    try {
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);
      const result = await execFileAsync(FFPROBE_PATH, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        musicUrl,
      ], { timeout: 10000 });
      const info = JSON.parse(result.stdout);
      musicDurationSec = parseFloat(info?.format?.duration || '0') || null;
      if (musicDurationSec) {
        console.log(`[Remotion] Musik-Dauer: ${musicDurationSec.toFixed(1)}s`);
      }
    } catch (e) {
      console.warn(`[Remotion] Musik-Dauer konnte nicht ausgelesen werden: ${e.message}`);
    }
  }

  // SCHRITT 2: Lokalen HTTP-Server für die Bilder starten
  let imageServer = null;
  let httpImageUrls;
  try {
    imageServer = await startImageServer(sessionDir);
    // http://127.0.0.1:PORT/img-000.webp etc.
    httpImageUrls = imageFilenames.map(f => `http://127.0.0.1:${imageServer.port}/${f}`);
    console.log(`[Remotion] Bild-URLs: ${httpImageUrls[0]} ... (${httpImageUrls.length} total)`);
  } catch (err) {
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
    throw new Error(`Bild-Server konnte nicht gestartet werden: ${err.message}`);
  }

  // SCHRITT 3: Bundle + Render
  let renderError = null;
  let renderResult = null;

  try {
    const bundleLocation = await getBundledEntry();

    const inputProps = {
      imageUrls: httpImageUrls, // ← HTTP statt file://
      title, summary, location, country, lifestyle, musicUrl,
      secondsPerImage, aspectRatio, colorGrade, filmGrain,
      captions, captionStyle, websiteUrl, handle, accentColor, motionBlurStrength,
      // ── NEU: Beat-Sync, Transitions, Route, Lottie ────────────────
      beatSyncStrength, beatThreshold, showWaveformBar,
      transitionType,
      showRouteMap, routeCoords, mapImageUrl,
      showLottieBus,
      // ── Musik-Dauer für Loop-freies Audio ─────────────────────────
      musicDurationSec,
    };

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
    });

    console.log(`[Remotion] ${composition.durationInFrames} Frames @ ${composition.fps}fps = ${(composition.durationInFrames / composition.fps).toFixed(1)}s | ${composition.width}×${composition.height} | crf 28`);

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
      // ── Encode-Einstellungen für Social-Media ────────────────────────
      // crf 28: gute Qualität, ~6x kleiner als crf 20
      //   16:9 @ 1280×720 @ 25fps @ 110s → ~8-15MB  ✅
      //   9:16 @ 1080×1920 @ 25fps @ 110s → ~15-25MB ✅
      //   (vorher: 1920×1080 @ 30fps @ crf 20 → 127MB ❌)
      crf: 28,
      // yuv420p: maximale Kompatibilität (iPhone, Android, Browser, Social)
      pixelFormat: 'yuv420p',
      // x264 Preset: 'medium' = gutes Speed/Quality Verhältnis auf VPS
      x264Preset: 'medium',
      // ── Audio-Glitch Fix ──────────────────────────────────────────────
      // Hohe Concurrency (z.B. 6 Tabs) → Chrome rendert Chunks parallel
      // → Audio-Position wird pro Chunk neu berechnet → Ruckler an Chunk-Grenzen
      // Lösung: concurrency=1 eliminiert Chunk-Grenzen komplett.
      // Nachteil: ~3x langsamer. Für Slideshows mit Musik ist das der einzige
      // zuverlässige Weg für glatte Tonspur.
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

    const dur = ((Date.now() - startTime) / 1000).toFixed(1);
    const sizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
    console.log(`[Remotion] ✅ Fertig: ${sizeMB}MB in ${dur}s`);

    renderResult = {
      outputPath, fileSizeMB: sizeMB, renderDurationSec: dur,
      frames: composition.durationInFrames, fps: composition.fps,
      videoDurationSec: (composition.durationInFrames / composition.fps).toFixed(1),
    };

  } catch (err) {
    renderError = err;
  }

  // SCHRITT 4: Server stoppen + Cleanup (nach Render)
  try {
    if (imageServer) await imageServer.close();
  } catch (e) {}

  // Bilder-Verzeichnis nach kurzer Pause löschen
  setTimeout(() => {
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
  }, 3000);

  if (renderError) throw renderError;
  return renderResult;
}

// ── Exports ───────────────────────────────────────────────────────────────

export function invalidateBundleCache() {
  bundleCache = null; isBundling = false; bundleQueue = [];
  console.log('[Remotion] Bundle-Cache invalidiert');
}

export function cleanupRender(outputPath) {
  try {
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
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
