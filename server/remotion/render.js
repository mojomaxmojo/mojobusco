/**
 * render.js — Remotion Render-Engine
 *
 * FIX: "No Promise in Promise.any was resolved"
 * → Bilder werden VOR dem Render auf den VPS heruntergeladen
 * → Remotion bekommt lokale file:// URLs statt externe http:// URLs
 * → Kein CORS, kein Timeout, kein Netzwerkfehler mehr beim Render
 */

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';
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
function downloadFile(url, destPath, attempt = 1) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'MojoBus-Remotion-Renderer/1.0',
        'Accept': 'image/*,*/*',
      },
    }, (response) => {
      // Redirect folgen
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) return reject(new Error(`Redirect ohne Location-Header: ${url}`));
        console.log(`[Remotion] Redirect: ${url} → ${redirectUrl}`);
        return downloadFile(redirectUrl, destPath, attempt).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        return reject(new Error(`HTTP ${response.statusCode} für: ${url}`));
      }

      const file = fs.createWriteStream(destPath);
      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          const size = fs.statSync(destPath).size;
          if (size < 100) {
            fs.unlinkSync(destPath);
            return reject(new Error(`Datei zu klein (${size} bytes): ${url}`));
          }
          resolve(destPath);
        });
      });

      file.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error(`Timeout beim Download: ${url}`));
    });
  }).catch(async (err) => {
    if (attempt < 3) {
      const delay = attempt * 2000; // 2s, 4s
      console.warn(`[Remotion] Download-Versuch ${attempt} fehlgeschlagen, retry in ${delay}ms: ${url}`);
      await new Promise(r => setTimeout(r, delay));
      return downloadFile(url, destPath, attempt + 1);
    }
    throw new Error(`Download fehlgeschlagen nach 3 Versuchen: ${url} — ${err.message}`);
  });
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
      // Dateiendung aus URL extrahieren
      const ext = (url.split('?')[0].match(/\.(jpe?g|png|webp|gif)$/i) || ['', '.jpg'])[1];
      const filename = `img-${String(i).padStart(3, '0')}${ext || '.jpg'}`;
      const destPath = path.join(sessionDir, filename);

      // Bereits gecacht?
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 100) {
        return destPath;
      }

      await downloadFile(url, destPath);
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
      // Qualität: 18 = hochwertig, 23 = default
      crf: 20,
      // Concurrency: max 2 parallel um RAM zu schonen (8GB VPS)
      concurrency: Math.min(2, Math.max(1, Math.floor(os.cpus().length / 2))),
      // Bild-Download durch Remotion deaktivieren — wir haben bereits lokale Dateien
      onBrowserLog: (log) => {
        if (log.type === 'error') {
          console.warn(`[Remotion Browser] ${log.text}`);
        }
      },
      onProgress: ({ progress }) => {
        const percent = Math.round(progress * 100);
        if (onProgress) onProgress(percent);
        // Nur alle 5% loggen
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
