/**
 * render.js — Remotion Render-Engine (Node.js, CommonJS-kompatibel)
 * 
 * Wird von server.js aufgerufen für /api/render-remotion
 * Nutzt das bestehende FFmpeg auf /opt/bin/ffmpeg
 */

import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// FFmpeg Pfad aus Umgebungsvariable (gleich wie server.js)
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/opt/bin/ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/opt/bin/ffprobe';

// Output-Verzeichnis
const OUTPUT_DIR = path.join(os.tmpdir(), 'remotion-renders');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Aspect Ratio → Composition ID Mapping
const COMPOSITION_IDS = {
  '16:9': 'MojoBusVideo-16-9',
  '9:16': 'MojoBusVideo-9-16',
  '1:1': 'MojoBusVideo-1-1',
};

// Bundle wird gecacht (einmalig pro Server-Start)
let bundleCache = null;
let isBundling = false;
let bundleQueue = [];

/**
 * Gibt den Pfad zum gebundletn Entry-File zurück (gecacht)
 */
async function getBundledEntry() {
  if (bundleCache) return bundleCache;

  // Wenn bereits am bundeln → warten
  if (isBundling) {
    return new Promise((resolve, reject) => {
      bundleQueue.push({ resolve, reject });
    });
  }

  isBundling = true;
  console.log('[Remotion] Bundling Remotion compositions (einmalig beim ersten Render)...');
  const start = Date.now();

  try {
    const entryPoint = path.join(__dirname, 'index.ts');
    const bundled = await bundle({
      entryPoint,
      // Webpack Override für esbuild-Optimierung
      webpackOverride: (config) => config,
    });

    bundleCache = bundled;
    const duration = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[Remotion] Bundle fertig in ${duration}s`);

    // Warteschlange abarbeiten
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

/**
 * Haupt-Render-Funktion
 * @param {Object} params
 * @param {string[]} params.imageUrls
 * @param {string} params.title
 * @param {string} [params.summary]
 * @param {string} [params.location]
 * @param {string} [params.country]
 * @param {string} [params.lifestyle]
 * @param {string} [params.musicUrl]
 * @param {number} [params.secondsPerImage]
 * @param {'16:9'|'9:16'|'1:1'} [params.aspectRatio]
 * @param {string} [params.colorGrade]
 * @param {string[]} [params.captions]
 * @param {string} [params.websiteUrl]
 * @param {string} [params.handle]
 * @param {string} [params.accentColor]
 * @param {Function} [params.onProgress] Callback: (progress: number) => void
 * @returns {Promise<string>} Pfad zur fertigen MP4-Datei
 */
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

  // Output-Datei
  const jobId = crypto.randomBytes(8).toString('hex');
  const outputPath = path.join(OUTPUT_DIR, `mojobus-${jobId}.mp4`);

  console.log(`[Remotion] Render gestartet: ${compositionId} | ${imageUrls.length} Bilder | ${aspectRatio} | Lifestyle: ${lifestyle}`);

  // Bundle holen (gecacht)
  const bundleLocation = await getBundledEntry();

  // Input Props für Composition
  const inputProps = {
    imageUrls,
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

  // Composition auswählen (mit calculateMetadata für dynamische Länge)
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
  });

  console.log(`[Remotion] Composition: ${composition.durationInFrames} Frames @ ${composition.fps}fps → ${(composition.durationInFrames / composition.fps).toFixed(1)}s`);

  const startTime = Date.now();

  // Rendern
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    // Eigenes FFmpeg verwenden
    ffmpegExecutable: FFMPEG_PATH,
    ffprobeExecutable: FFPROBE_PATH,
    // Qualität
    crf: 18, // 0=lossless, 23=default, 18=hochwertig
    videoBitrate: undefined, // CRF hat Vorrang
    // Performance
    concurrency: Math.max(1, Math.floor(os.cpus().length * 0.75)),
    // Progress-Callback
    onProgress: ({ progress }) => {
      const percent = Math.round(progress * 100);
      if (onProgress) onProgress(percent);
      if (percent % 10 === 0) {
        console.log(`[Remotion] Progress: ${percent}%`);
      }
    },
    // Logging minimieren
    verbose: false,
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const fileSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);

  console.log(`[Remotion] Render fertig: ${outputPath} (${fileSizeMB}MB) in ${duration}s`);

  return {
    outputPath,
    fileSizeMB,
    renderDurationSec: duration,
    frames: composition.durationInFrames,
    fps: composition.fps,
    videoDurationSec: (composition.durationInFrames / composition.fps).toFixed(1),
  };
}

/**
 * Aufräumen: Output-Datei nach dem Upload löschen
 */
export function cleanupRender(outputPath) {
  try {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
      console.log(`[Remotion] Cleanup: ${outputPath} gelöscht`);
    }
  } catch (err) {
    console.warn(`[Remotion] Cleanup Fehler:`, err.message);
  }
}

/**
 * Gibt alle alten Render-Dateien frei (älter als 30 Min)
 */
export function cleanupOldRenders(maxAgeMs = 30 * 60 * 1000) {
  try {
    const files = fs.readdirSync(OUTPUT_DIR);
    const now = Date.now();
    let deleted = 0;
    files.forEach((file) => {
      const fullPath = path.join(OUTPUT_DIR, file);
      const stat = fs.statSync(fullPath);
      if (now - stat.mtimeMs > maxAgeMs) {
        fs.unlinkSync(fullPath);
        deleted++;
      }
    });
    if (deleted > 0) {
      console.log(`[Remotion] ${deleted} alte Render-Dateien gelöscht`);
    }
  } catch (err) {
    // ignorieren
  }
}
