/**
 * render.js — Remotion Render-Engine
 *
 * FIX: "No Promise in Promise.any was resolved"
 * → Bilder werden VOR dem Render auf den VPS heruntergeladen
 * → Remotion bekommt lokale file:// URLs statt externe http:// URLs
 * → Kein CORS, kein Timeout, kein Netzwerkfehler mehr beim Render
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

// ── Chrome Executable finden und Rechte setzen ───────────────────────────
// Remotion lädt Chrome selbst herunter nach node_modules/.remotion/
// Das Binary braucht Execute-Rechte (EACCES wenn nginx-User sie nicht hat)

function findAndFixChrome() {
  // Mögliche Chrome-Pfade die Remotion nutzt
  const candidates = [
    path.join(__dirname, '../node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell'),
    path.join(__dirname, '../node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell'),
    path.join(__dirname, '../../node_modules/.remotion/chrome-headless-shell/linux64/chrome-headless-shell-linux64/chrome-headless-shell'),
  ];

  for (const chromePath of candidates) {
    if (fs.existsSync(chromePath)) {
      try {
        // Execute-Rechte setzen (chmod +x)
        fs.chmodSync(chromePath, 0o755);
        console.log(`[Remotion] Chrome gefunden + chmod 755: ${chromePath}`);
        return chromePath;
      } catch (e) {
        console.warn(`[Remotion] chmod fehlgeschlagen für ${chromePath}: ${e.message}`);
        // Trotzdem versuchen zu nutzen
        return chromePath;
      }
    }
  }

  // Wildcard-Suche im node_modules
  try {
    const result = execSync(
      'find /home/nginx/domains/mojobus.co/public/server/node_modules/.remotion -name "chrome-headless-shell" -type f 2>/dev/null | head -1',
      { encoding: 'utf8', timeout: 5000 }
    ).trim();
    if (result) {
      try { fs.chmodSync(result, 0o755); } catch (e) { /* ignorieren */ }
      console.log(`[Remotion] Chrome via find: ${result}`);
      return result;
    }
  } catch (e) { /* ignorieren */ }

  console.warn('[Remotion] Chrome-Binary nicht gefunden — Remotion sucht selbst');
  return null;
}

// Beim Modulstart Chrome finden
let CHROME_PATH = null;
try {
  CHROME_PATH = findAndFixChrome();
} catch (e) {
  console.warn('[Remotion] Chrome-Suche fehlgeschlagen:', e.message);
}

// ── Chrome beim Start herunterladen + Rechte setzen ──────────────────────
// ensureBrowser() lädt Chrome falls noch nicht vorhanden
// Danach nochmal chmod damit nginx-User es ausführen kann
async function ensureChromeBinary() {
  try {
    console.log('[Remotion] Stelle sicher dass Chrome-Binary vorhanden...');
    await ensureBrowser({ browserExecutable: CHROME_PATH || undefined });

    // Nach Download nochmal suchen + chmod
    if (!CHROME_PATH) {
      CHROME_PATH = findAndFixChrome();
    } else {
      // Nochmal chmod sicherheitshalber
      try { fs.chmodSync(CHROME_PATH, 0o755); } catch (e) { /* ignorieren */ }
    }

    // Auch den ganzen .remotion Ordner recursive chmod
    const remotionDir = path.join(__dirname, '../node_modules/.remotion');
    if (fs.existsSync(remotionDir)) {
      try {
        execSync(`chmod -R 755 "${remotionDir}"`, { timeout: 10000 });
        console.log('[Remotion] chmod -R 755 auf .remotion/ gesetzt');
      } catch (e) {
        console.warn('[Remotion] chmod -R fehlgeschlagen:', e.message);
      }
    }

    console.log(`[Remotion] Chrome bereit: ${CHROME_PATH || 'auto-detect'}`);
  } catch (e) {
    console.warn('[Remotion] ensureBrowser fehlgeschlagen:', e.message);
  }
}

// Einmalig beim Modul-Import ausführen (async, blockiert nicht)
ensureChromeBinary().catch(() => {});

// ── Chromium Optionen für nginx/root-User auf CentminMod ─────────────────
const CHROMIUM_OPTIONS = {
  // --no-sandbox ist nötig wenn als root oder nginx ohne sandbox-Rechte
  disableWebSecurity: false,
  // Wichtig für VPS ohne GPU
  gl: 'swiftshader',
  // Weitere Flags für stabilen Betrieb auf AlmaLinux
  chromiumFlags: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',   // /dev/shm oft zu klein auf VPS
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--single-process',          // weniger RAM, stabiler auf VPS
    '--no-zygote',
  ],
};

const COMPOSITION_IDS = {
  '16:9': 'MojoBusVideo-16-9',
  '9:16': 'MojoBusVideo-9-16',
  '1:1':  'MojoBusVideo-1-1',
};

// ── Bundle Cache ──────────────────────────────────────────────────────────
let bundleCache  = null;
let isBundling   = false;
let bundleQueue  = [];

async function getBundledEntry() {
  if (bundleCache) return bundleCache;

  if (isBundling) {
    return new Promise((resolve, reject) => {
      bundleQueue.push({ resolve, reject });
    });
  }

  isBundling = true;
  console.log('[Remotion] Bundling... (einmalig beim ersten Render)');
  const start = Date.now();

  try {
    const entryPoint = path.join(__dirname, 'index.tsx');
    const bundled = await bundle({
      entryPoint,
      webpackOverride: (config) => config,
    });

    bundleCache = bundled;
    console.log(`[Remotion] Bundle fertig in ${((Date.now() - start) / 1000).toFixed(1)}s`);
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

/**
 * Lädt eine einzelne URL herunter und speichert sie als Datei.
 * Retry-Logik: 3 Versuche mit exponentiellem Backoff.
 */
/**
 * Lädt eine Datei herunter und gibt Pfad + Content-Type zurück.
 */
function downloadFileWithType(url, destPath, attempt = 1) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'MojoBus-Remotion-Renderer/1.0',
        'Accept': 'image/webp,image/jpeg,image/png,image/*,*/*',
      },
    }, (response) => {
      // Redirects folgen (bis zu 5)
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) return reject(new Error(`Redirect ohne Location: ${url}`));
        // Relative Redirects auflösen
        const absoluteRedirect = redirectUrl.startsWith('http')
          ? redirectUrl
          : new URL(redirectUrl, url).toString();
        return downloadFileWithType(absoluteRedirect, destPath, attempt)
          .then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        response.resume(); // Response-Body verwerfen
        return reject(new Error(`HTTP ${response.statusCode}: ${url}`));
      }

      const contentType = response.headers['content-type'] || '';
      const file = fs.createWriteStream(destPath);
      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          const size = fs.statSync(destPath).size;
          if (size < 100) {
            try { fs.unlinkSync(destPath); } catch (e) {}
            return reject(new Error(`Datei zu klein (${size}B): ${url}`));
          }
          resolve({ filePath: destPath, contentType });
        });
      });

      file.on('error', (err) => {
        try { fs.unlinkSync(destPath); } catch (e) {}
        reject(err);
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error(`Timeout: ${url}`));
    });
  }).catch(async (err) => {
    if (attempt < 3) {
      const delay = attempt * 2000;
      console.warn(`[Remotion] Retry ${attempt}/3: ${url.slice(-50)} — ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
      return downloadFileWithType(url, destPath, attempt + 1);
    }
    throw new Error(`Download fehlgeschlagen (3 Versuche): ${err.message} — ${url}`);
  });
}

/**
 * Ermittelt die korrekte Dateiendung aus einer URL oder einem Content-Type Header.
 * Blossom-URLs haben oft keinen Punkt vor der Extension oder Hash-basierte Namen.
 */
function getImageExtension(url, contentType) {
  // 1. Aus Content-Type Header (zuverlässigste Methode)
  if (contentType) {
    const ct = contentType.toLowerCase().split(';')[0].trim();
    const ctMap = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/avif': '.avif',
      'image/heic': '.jpg', // HEIC als JPEG speichern
      'image/tiff': '.jpg', // TIFF als JPEG speichern
    };
    if (ctMap[ct]) return ctMap[ct];
  }

  // 2. Aus URL-Pfad — mit korrektem Regex der den Punkt einschließt
  const urlPath = url.split('?')[0].split('#')[0];
  const extMatch = urlPath.match(/\.(jpe?g|jpg|png|webp|gif|avif)$/i);
  if (extMatch) {
    return '.' + extMatch[1].toLowerCase().replace('jpeg', 'jpg');
  }

  // 3. Fallback: immer .jpg (JPEG ist universell kompatibel)
  return '.jpg';
}

/**
 * Lädt alle Bild-URLs herunter und gibt lokale file:// Pfade zurück.
 * Gibt bei Fehler einen Placeholder zurück statt den ganzen Render zu stoppen.
 */
async function downloadAllImages(imageUrls, sessionId) {
  const sessionDir = path.join(IMAGES_DIR, sessionId);
  fs.mkdirSync(sessionDir, { recursive: true });

  console.log(`[Remotion] Lade ${imageUrls.length} Bilder herunter...`);
  const start = Date.now();

  const results = await Promise.allSettled(
    imageUrls.map(async (url, i) => {
      // Vorläufiger Pfad ohne Extension — wird nach Download mit Content-Type korrigiert
      const tempPath = path.join(sessionDir, `img-${String(i).padStart(3, '0')}.tmp`);
      let destPath = path.join(sessionDir, `img-${String(i).padStart(3, '0')}.jpg`); // Fallback

      // Bereits gecacht? (prüfe alle möglichen Extensions)
      for (const ext of ['.jpg', '.jpeg', '.png', '.webp', '.gif']) {
        const cached = path.join(sessionDir, `img-${String(i).padStart(3, '0')}${ext}`);
        if (fs.existsSync(cached) && fs.statSync(cached).size > 100) {
          return cached;
        }
      }

      // Download mit Content-Type Erkennung
      const { filePath: downloaded, contentType } = await downloadFileWithType(url, tempPath);

      // Korrekte Extension bestimmen
      const ext = getImageExtension(url, contentType);
      destPath = path.join(sessionDir, `img-${String(i).padStart(3, '0')}${ext}`);

      // temp → finale Datei umbenennen
      fs.renameSync(downloaded, destPath);
      console.log(`[Remotion] Bild ${i + 1}: ${ext} (${(fs.statSync(destPath).size / 1024).toFixed(0)}KB) — ${url.slice(-40)}`);
      return destPath;
    })
  );

  const localPaths = [];
  let failed = 0;

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      // file:// URL für Remotion
      localPaths.push(`file://${result.value}`);
    } else {
      failed++;
      console.error(`[Remotion] ⚠ Bild ${i + 1} Download fehlgeschlagen: ${result.reason?.message}`);
      // Placeholder: erstes erfolgreiches Bild wiederholen statt Fehler
      const firstOk = results.find(r => r.status === 'fulfilled');
      if (firstOk) {
        localPaths.push(`file://${firstOk.value}`);
        console.log(`[Remotion]   → Verwende Bild 1 als Fallback für Bild ${i + 1}`);
      } else {
        // Kein Bild verfügbar → später abfangen
        localPaths.push(null);
      }
    }
  });

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  const successCount = results.filter(r => r.status === 'fulfilled').length;
  console.log(`[Remotion] ${successCount}/${imageUrls.length} Bilder heruntergeladen in ${duration}s` + (failed > 0 ? ` (${failed} Fehler mit Fallback)` : ''));

  // Wenn gar kein Bild erfolgreich → Fehler werfen
  const validPaths = localPaths.filter(Boolean);
  if (validPaths.length === 0) {
    throw new Error('Kein einziges Bild konnte heruntergeladen werden. Prüfe die Blossom-URLs.');
  }

  // null-Einträge durch erstes gültiges Bild ersetzen
  return localPaths.map(p => p ?? validPaths[0]);
}

/**
 * Löscht den temporären Bild-Ordner einer Session.
 */
function cleanupSessionImages(sessionId) {
  const sessionDir = path.join(IMAGES_DIR, sessionId);
  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  } catch (e) {
    console.warn(`[Remotion] Cleanup images fehlgeschlagen: ${e.message}`);
  }
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
  const outputPath    = path.join(OUTPUT_DIR, `mojobus-${sessionId}.mp4`);

  console.log(`[Remotion] ──────────────────────────────────────────`);
  console.log(`[Remotion] Render: ${compositionId}`);
  console.log(`[Remotion] Bilder: ${imageUrls.length} | Format: ${aspectRatio} | Lifestyle: ${lifestyle}`);
  console.log(`[Remotion] ──────────────────────────────────────────`);

  // SCHRITT 1: Bilder vorab herunterladen → keine Netzwerkfehler beim Render
  let localImageUrls;
  try {
    localImageUrls = await downloadAllImages(imageUrls, sessionId);
  } catch (err) {
    cleanupSessionImages(sessionId);
    throw new Error(`Bild-Download fehlgeschlagen: ${err.message}`);
  }

  try {
    // SCHRITT 2: Bundle holen (gecacht)
    const bundleLocation = await getBundledEntry();

    // SCHRITT 3: Input Props — mit lokalen file:// URLs
    const inputProps = {
      imageUrls: localImageUrls,  // ← lokale Pfade statt externe URLs!
      title,
      summary,
      location,
      country,
      lifestyle,
      musicUrl,
      secondsPerImage,
      aspectRatio,
      colorGrade,
      filmGrain,
      captions,
      captionStyle,
      websiteUrl,
      handle,
      accentColor,
      motionBlurStrength,
    };

    // SCHRITT 4: Composition auswählen
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: compositionId,
      inputProps,
    });

    console.log(`[Remotion] Composition: ${composition.durationInFrames} Frames @ ${composition.fps}fps = ${(composition.durationInFrames / composition.fps).toFixed(1)}s`);

    const startTime = Date.now();
    let lastLoggedPercent = -1;

    // SCHRITT 5: Rendern
    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps,
      ffmpegExecutable:  FFMPEG_PATH,
      ffprobeExecutable: FFPROBE_PATH,
      // Qualität
      crf: 20,
      // Concurrency: 1 auf VPS (stabiler, weniger RAM)
      concurrency: 1,
      // Chrome explizit angeben wenn gefunden (vermeidet Pfad-Probleme)
      ...(CHROME_PATH ? { browserExecutable: CHROME_PATH } : {}),
      // Chromium Flags für nginx-User auf AlmaLinux (kein sandbox, kein GPU)
      chromiumOptions: CHROMIUM_OPTIONS,
      onBrowserLog: (log) => {
        if (log.type === 'error') {
          console.warn(`[Remotion Browser] ${log.text}`);
        }
      },
      onProgress: ({ progress }) => {
        const percent = Math.round(progress * 100);
        if (onProgress) onProgress(percent);
        if (Math.floor(percent / 5) > Math.floor(lastLoggedPercent / 5)) {
          console.log(`[Remotion] ${percent}% | ${((Date.now() - startTime) / 1000).toFixed(0)}s`);
          lastLoggedPercent = percent;
        }
      },
      verbose: false,
    });

    const renderDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    const fileSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);

    console.log(`[Remotion] ✅ Fertig: ${fileSizeMB}MB in ${renderDuration}s`);

    return {
      outputPath,
      fileSizeMB,
      renderDurationSec: renderDuration,
      frames: composition.durationInFrames,
      fps: composition.fps,
      videoDurationSec: (composition.durationInFrames / composition.fps).toFixed(1),
    };

  } finally {
    // Bilder aufräumen (immer, auch bei Fehler)
    cleanupSessionImages(sessionId);
  }
}

// ── Cache / Cleanup Exports ───────────────────────────────────────────────

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
    console.warn(`[Remotion] Cleanup Fehler: ${err.message}`);
  }
}

export function cleanupOldRenders(maxAgeMs = 30 * 60 * 1000) {
  try {
    const now = Date.now();
    let deleted = 0;
    for (const dir of [OUTPUT_DIR, IMAGES_DIR]) {
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (now - stat.mtimeMs > maxAgeMs) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            deleted++;
          }
        } catch (e) { /* ignorieren */ }
      }
    }
    if (deleted > 0) console.log(`[Remotion] ${deleted} alte Dateien/Ordner gelöscht`);
  } catch (err) { /* ignorieren */ }
}
