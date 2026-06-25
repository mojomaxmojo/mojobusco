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
import { execFile, execSync } from 'child_process';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import { createServer } from 'http';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Binary-Pfade (ffmpeg/ffprobe) automatisch erkennen ────────────────────
// sucht zuerst via command -v (POSIX), dann /usr/bin/, zuletzt /usr/local/bin/
const findBinary = (name) => {
  try {
    const found = execSync(`command -v ${name} 2>/dev/null`).toString().trim();
    if (found) return found;
  } catch {}
  // Fallback-Pfade
  if (fs.existsSync(`/usr/bin/${name}`)) return `/usr/bin/${name}`;
  if (fs.existsSync(`/usr/local/bin/${name}`)) return `/usr/local/bin/${name}`;
  return `/usr/bin/${name}`; // letzter Fallback
};
const FFMPEG_PATH  = process.env.FFMPEG_PATH  || findBinary('ffmpeg');
const FFPROBE_PATH = process.env.FFPROBE_PATH || findBinary('ffprobe');

// ── Per-Segment Voiceover generieren ─────────────────────────────────────
//
// Erzeugt für jeden Satz eine eigene MP3 (statt einer großen).
// Misst die tatsächliche Dauer jeder MP3 via ffprobe.

const FFPROBE = FFPROBE_PATH;

async function generateVoiceoverSegments(segments, voiceoverModel, voiceoverSpeed, effectiveEngine, sessionDir) {
  if (!segments || segments.length === 0) return null;

  const { generateEdgeVoiceover, isEdgeTtsAvailable } = await import('./edge.js');

  const result = []; // [{ filename: 'voiceover_0.mp3', durationSec: 2.1 }, ...]

  for (let i = 0; i < segments.length; i++) {
    const text = segments[i].trim();
    if (!text) continue;

    console.log(`[Remotion] 🎙️ Voiceover Segment ${i + 1}/${segments.length}: "${text.slice(0, 50)}..."`);

    try {
      let mp3Path = null;

      if (effectiveEngine === 'edge') {
        const edgeAvailable = await isEdgeTtsAvailable();
        if (edgeAvailable) {
          mp3Path = await generateEdgeVoiceover(text, voiceoverModel, voiceoverSpeed);
        }
      }

      if (!mp3Path) {
        // Fallback auf Piper
        const { isPiperAvailable: checkPiper } = await import('./tts.js');
        if (checkPiper()) {
          const { generateVoiceover: genPiper } = await import('./tts.js');
          mp3Path = await genPiper(text, 'de_DE-thorsten-medium', voiceoverSpeed);
        }
      }

      if (!mp3Path) {
        console.warn(`[Remotion] ⚠️ Segment ${i + 1}: Kein TTS verfügbar`);
        continue;
      }

      // Prüfen ob MP3 existiert
      if (!fs.existsSync(mp3Path)) {
        console.warn(`[Remotion] ⚠️ Segment ${i + 1}: Datei nicht gefunden`);
        continue;
      }

      // Dauer via ffprobe messen
      let durationSec = 0;
      try {
        const { stdout } = await execFileAsync(FFPROBE, [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_entries', 'format=duration',
          mp3Path,
        ]);
        const info = JSON.parse(stdout);
        durationSec = parseFloat(info?.format?.duration) || 0;
      } catch {
        // ffprobe kann Edge-TTS MP3-Metadaten nicht lesen → Fallback: Dateigröße
        // Edge TTS verwendet 48kbps → duration = (bytes * 8) / 48000
        const bytes = fs.statSync(mp3Path).size;
        durationSec = (bytes * 8) / 48000;
        console.log(`[Remotion] ⚠️ ffprobe für Segment ${i + 1} fehlgeschlagen, Dauer geschätzt: ${durationSec.toFixed(2)}s (${bytes}B)`);
      }

      // Datei ins sessionDir kopieren
      const ext = mp3Path.endsWith('.wav') ? '.wav' : '.mp3';
      const filename = `voiceover_${i}${ext}`;
      const destPath = path.join(sessionDir, filename);
      fs.copyFileSync(mp3Path, destPath);
      try { fs.chmodSync(destPath, 0o644); } catch (e) {}
      try { fs.rmSync(mp3Path, { force: true }); } catch (e) {}

      const sizeKB = (fs.statSync(destPath).size / 1024).toFixed(0);
      console.log(`[Remotion] ✅ Segment ${i + 1}: ${filename} (${durationSec.toFixed(2)}s · ${sizeKB}KB)`);

      result.push({ filename, durationSec, textLen: text.length });
    } catch (err) {
      console.warn(`[Remotion] ⚠️ Segment ${i + 1} fehlgeschlagen: ${err.message}`);
    }
  }

  return result.length > 0 ? result : null;
}

// ── Voiceover-Segmente zu einer Datei concatten mit exakten Offsets ─────
//
// Erzeugt eine einzige voiceover_sync.mp3, bei der jedes Segment genau zu
// seinem Slide-Offset startet. Dazwischen wird Stille (silence) eingefügt.
// Returnt { voiceoverFilename, perSlideArray }.

async function concatVoiceoverSegments(segments, sessionDir, hookDurationSec, secondsPerImage, bridgeDurationSec, muteBodyIndex, routeSlideIndex = -1, routeDuration = 0) {
  if (!segments || segments.length === 0) return null;

  // segments = [{ filename, durationSec }, ...]
  //
  // Altes Format (mit Bridge):  [Hook, Body1, Body2, ..., Bridge]
  // Neues Format (ohne Bridge): [Hook, Body1, Body2, ...]
  //
  // Erkennung: Bridge ist optional. Wenn segments.length === imageCount + 1
  // (Hook + Body), gibt es keine Bridge im Audio – sie wird als Text-Overlay
  // angezeigt aber nicht gesprochen (Edge TTS würde "Mehr auf mojobus.co" als
  // Werbejingle klingen lassen).
  //
  // Heuristik: Wir haben immer mindestens Hook + 1 Body.
  // Wenn das letzte Segment deutlich kürzer als ein Body-Satz ist UND
  // kein bodyText enthält → könnte Bridge sein. Aber das ist fragil.
  //
  // Robustere Lösung: Frontend sendet explizit hasBridge=false (Standardfall).
  // Fallback: wir behandeln ALLE Segmente nach dem Hook als Body-Segmente.
  // Bridge wird separat NICHT im Audio eingebaut – sie hat ihren eigenen Slide
  // im Video mit eigenem Text-Overlay.

  // Alle Segmente sind Body-Segmente. Hook wird NICHT gesprochen.
  // HookTitle ist auf dem Screen sichtbar → kein Audio nötig.
  // AudioLayer in MojoBusVideo startet mit startFrom=hookFrames (4s Offset).
  const hookSeg = null;
  const bodySegments = segments; // alle Segmente = Body
  const bridgeSeg = null;        // Bridge nicht gesprochen – nur Text-Overlay

  // perSlideArray berechnen:
  // - Lesezeit: max(3.5s, textLen / 14 Zeichen/s + 0.5s Atempause)
  // - Voiceover-Dauer + 1s Stille am Ende (damit nächster Slide nicht zu früh kommt)
  // - User-Vorgabe (secondsPerImage)
  const estimateReadingTime = (textLen) => Math.max(3.5, textLen / 14 + 0.5);

  const perSlideArray = bodySegments.map(seg => {
    const readingTime = estimateReadingTime(seg.textLen || 0);
    const audioTime = seg.durationSec || 0;
    return Math.max(secondsPerImage, Math.round(Math.max(readingTime, audioTime + 1) * 10) / 10);
  });

  // RouteMap als extra Slide in der Mitte einfügen (Stille)
  if (routeSlideIndex >= 0 && routeDuration > 0) {
    perSlideArray.splice(routeSlideIndex, 0, routeDuration);
    console.log(`[Remotion] 🗺️ RouteMap-Slide in concat: Position ${routeSlideIndex} (${routeDuration}s Stille)`);
  }

  // concat.txt für ffmpeg bauen
  const concatPath = path.join(sessionDir, 'concat.txt');
  const lines = [];

  // Hook-Segment (0 bis hookDurationSec)
  if (hookSeg) {
    lines.push(`file '${hookSeg.filename}'`);
    lines.push(`duration ${hookDurationSec.toFixed(2)}`);
  }

  // Body-Segmente (eins pro Slide) + RouteMap-Stille dazwischen
  for (let i = 0; i < bodySegments.length; i++) {
    const seg = bodySegments[i];

    // RouteMap-Stille VOR diesem Slide einfügen (extra Slide)
    // WICHTIG: auch hier muss eine duration-Zeile gesetzt werden,
    // damit ffmpeg concat die Stille auf die gewünschte Länge paddet.
    if (routeSlideIndex >= 0 && i === routeSlideIndex) {
      lines.push(`file 'route_silence.mp3'`);
      lines.push(`duration ${routeDuration.toFixed(2)}`); // ← PFLICHT: ohne duration spielt ffmpeg nur 1s
      console.log(`[Remotion] 🗺️ RouteMap Slide ${i + 1} Stille (${routeDuration.toFixed(2)}s)`);
    }

    // Index im erweiterten perSlideArray (RouteMap-Eintrag verschiebt alle ab Position)
    const paIdx = routeSlideIndex >= 0 && i >= routeSlideIndex ? i + 1 : i;
    const slideDur = perSlideArray[paIdx];

    lines.push(`file '${seg.filename}'`);
    lines.push(`duration ${slideDur.toFixed(2)}`);
  }

  // Bridge: wird NICHT mehr gesprochen (kein Segment im Audio).
  // Sie erscheint als Text-Overlay auf dem Bridge-Slide im Video.
  // bridgeSeg ist null seit dem Frontend-Fix (Bridge aus voiceoverSegmentsArray entfernt).

  fs.writeFileSync(concatPath, lines.join('\n') + '\n');
  console.log(`[Remotion] concat.txt:\n${lines.join('\n')}`);

  // Silence-Dateien erzeugen (generische 1s-Stille + ggf. RouteMap mit exakter Länge)
  const silencePath = path.join(sessionDir, 'silence.mp3');
  try {
    execSync(
      `${FFMPEG_PATH} -f lavfi -i anullsrc=r=24000:cl=mono -t 1 -q:a 9 -y "${silencePath}"`,
      { timeout: 10000 }
    );
  } catch (e) {
    console.warn('[Remotion] Silence-Generierung fehlgeschlagen:', e.message);
    fs.writeFileSync(silencePath, '');
  }

  // RouteMap-Silence mit exakter Länge (concat-Padding ist unzuverlässig mit -c copy)
  const routeSilencePath = path.join(sessionDir, 'route_silence.mp3');
  if (routeSlideIndex >= 0 && routeDuration > 0) {
    try {
      execSync(
        `${FFMPEG_PATH} -f lavfi -i anullsrc=r=24000:cl=mono -t ${routeDuration.toFixed(1)} -q:a 9 -y "${routeSilencePath}"`,
        { timeout: 10000 }
      );
    } catch (e) {
      console.warn('[Remotion] RouteMap-Silence fehlgeschlagen:', e.message);
      // Fallback: normale silence.mp3 kopieren
      try { fs.copyFileSync(silencePath, routeSilencePath); } catch (e2) {}
    }
  }

  // Concat
  const outputPath = path.join(sessionDir, 'voiceover_sync.mp3');
  try {
    // WICHTIG: -c:a libmp3lame statt -c copy!
    // Mit -c copy ignoriert ffmpeg die duration-Direktive in der concat-Datei
    // und gibt nur die tatsächliche Dateilänge aus → kein Stille-Padding.
    // Mit -c:a libmp3lame wird re-encodiert und duration wird als harte Grenze
    // behandelt → Stille wird eingefügt wenn das Segment kürzer ist als duration.
    // -q:a 4 = VBR ~165kbps (gut für Sprache, kaum Qualitätsverlust)
    execSync(
      `${FFMPEG_PATH} -f concat -safe 0 -i "${concatPath}" -c:a libmp3lame -q:a 4 -y "${outputPath}"`,
      { timeout: 60000 }
    );
    const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(0);
    console.log(`[Remotion] ✅ voiceover_sync.mp3 (${sizeKB}KB) – ${perSlideArray.length} Slides`);

    // Aufräumen: Einzel-Segmente löschen, silence behalten
    for (const seg of segments) {
      try { fs.unlinkSync(path.join(sessionDir, seg.filename)); } catch (e) {}
    }

    return {
      voiceoverFilename: 'voiceover_sync.mp3',
      perSlideArray,
    };
  } catch (e) {
    console.error('[Remotion] ❌ Concat fehlgeschlagen:', e.message);
    return null;
  }
}
// ── Ambient Sounds (optional) ──────────────────────────────────────────────
import { generateAmbient } from './ambient.js';

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
  '.wav': 'audio/wav',  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',  '.ogg': 'audio/ogg',
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

// ── Audio-Datei herunterladen ─────────────────────────────────────────────

/**
 * Bereitet die Audio-Datei für den Render vor.
 * 
 * Drei Fälle:
 *  1. Lokaler Dateipfad (z.B. /home/nginx/.../music/track.mp3) → direkt kopieren
 *  2. HTTP-URL (z.B. https://blossom.../music.mp3) → herunterladen
 *  3. localhost-URL (z.B. http://localhost:PORT/api/music/...) → Dateipfad extrahieren
 *
 * Gibt den Dateinamen im sessionDir zurück (z.B. "audio.mp3").
 */
async function downloadAudioFile(url, sessionDir, localMusicDir) {
  if (!url) return null;

  const AUDIO_MIME_MAP = {
    'audio/mpeg': '.mp3', 'audio/mp3': '.mp3',
    'audio/ogg': '.ogg',  'audio/wav': '.wav',
    'audio/wave': '.wav', 'audio/x-wav': '.wav',
    'audio/mp4': '.m4a',  'audio/m4a': '.m4a',
    'audio/aac': '.aac',  'audio/opus': '.opus',
    'audio/webm': '.webm',
  };

  const extMatch = url.split('?')[0].match(/\.(mp3|ogg|wav|m4a|aac|opus|webm)$/i);
  const guessExt = extMatch ? `.${extMatch[1].toLowerCase()}` : '.mp3';

  // Fall 1: Lokaler Dateipfad (kein Protokoll oder file:// )
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const localPath = url.replace(/^file:\/\//, '');
    if (fs.existsSync(localPath)) {
      const ext = path.extname(localPath) || guessExt;
      const destPath = path.join(sessionDir, `audio${ext}`);
      fs.copyFileSync(localPath, destPath);
      try { fs.chmodSync(destPath, 0o644); } catch (e) {}
      const sizeKB = (fs.statSync(destPath).size / 1024).toFixed(0);
      console.log(`[Remotion] ✓ Audio (lokal kopiert): audio${ext} ${sizeKB}KB`);
      return `audio${ext}`;
    }
    console.warn(`[Remotion] ✗ Lokale Audio-Datei nicht gefunden: ${localPath}`);
    return null;
  }

  // Fall 2: localhost-URL → Dateiname extrahieren + aus localMusicDir kopieren
  const localhostMatch = url.match(/localhost:[0-9]+\/api\/music\/([^?#]+)/);
  if (localhostMatch && localMusicDir) {
    const filename = decodeURIComponent(localhostMatch[1]);
    const localPath = path.join(localMusicDir, filename);
    if (fs.existsSync(localPath)) {
      const ext = path.extname(filename) || guessExt;
      const destPath = path.join(sessionDir, `audio${ext}`);
      fs.copyFileSync(localPath, destPath);
      try { fs.chmodSync(destPath, 0o644); } catch (e) {}
      const sizeKB = (fs.statSync(destPath).size / 1024).toFixed(0);
      console.log(`[Remotion] ✓ Audio (localhost→lokal): audio${ext} ${sizeKB}KB`);
      return `audio${ext}`;
    }
    console.warn(`[Remotion] ✗ Musik-Datei im music/-Ordner nicht gefunden: ${filename}`);
  }

  // Fall 3: Externe HTTP(S)-URL → herunterladen
  const tempPath = path.join(sessionDir, 'audio.tmp');
  try {
    const { contentType } = await downloadFileWithType(url, tempPath);
    const ext = (contentType && AUDIO_MIME_MAP[contentType.toLowerCase().split(';')[0].trim()]) || guessExt;
    const finalPath = path.join(sessionDir, `audio${ext}`);
    fs.renameSync(tempPath, finalPath);
    try { fs.chmodSync(finalPath, 0o644); } catch (e) {}
    const sizeKB = (fs.statSync(finalPath).size / 1024).toFixed(0);
    console.log(`[Remotion] ✓ Audio (HTTP): audio${ext} ${sizeKB}KB`);
    return `audio${ext}`;
  } catch (err) {
    console.warn(`[Remotion] ✗ Audio-Download fehlgeschlagen (${err.message}) → kein Audio`);
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
    return null;
  }
}

// ── Karten-Bild herunterladen ─────────────────────────────────────────────

async function downloadMapImage(url, sessionDir) {
  if (!url) return null;
  const tempPath = path.join(sessionDir, 'map.tmp');
  try {
    const { filePath, contentType } = await downloadFileWithType(url, tempPath);
    const ext = getImageExtension(url, contentType);
    const finalPath = path.join(sessionDir, `map${ext}`);
    fs.renameSync(tempPath, finalPath);
    try { fs.chmodSync(finalPath, 0o644); } catch (e) {}
    const sizeKB = (fs.statSync(finalPath).size / 1024).toFixed(0);
    console.log(`[Remotion] ✓ Karte: map${ext} ${sizeKB}KB`);
    return `map${ext}`;
  } catch (err) {
    console.warn(`[Remotion] ✗ Karten-Download fehlgeschlagen: ${err.message}`);
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
    return null;
  }
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
    colorGrade,
    captions = [], captionStyle = 'full-line',
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
    // ── NEU: Voiceover-Segmente ─────────────────────────────────────────
    /** Array von Text-Strings – jeder String wird einzeln als MP3 generiert und pro Slide abgespielt */
    voiceoverSegmentsInput,    // Array<string> – ein Satz pro Slide (optional, ersetzt voiceoverText)
    muteVoiceoverSlide = -1, // Slide-Index für Stille (z.B. Routen-Karte)
    // ── ALT (deprecated): Einzel-Text ──────────────────────────────────────
    voiceoverText,             // Text für Sprachausgabe (optional, deprecated)
    voiceoverModel = 'de-DE-SeraphinaMultilingualNeural', // Stimm-Modell
    voiceoverSpeed = 0.8,     // Sprechgeschwindigkeit (0.6-1.2)
    voiceoverEngine,           // 'edge' | 'piper' – wird automatisch aus Modell-Präfix abgeleitet
    voiceoverVolume = 1.0,    // Lautstärke 0-1 (0 = stumm, 1 = volle Lautstärke)
    // ── NEU: Ambient Sound (Atmo) ─────────────────────────────────────────
    ambientType,               // 'ocean' | 'rain' | 'wind' | 'fire' | 'forest' (optional)
    onProgress,
    // ── Interner Parameter: lokaler Musik-Ordner (übergeben von server.js) ──
    localMusicDir,
  } = params;

  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('Keine Bild-URLs übergeben');
  }

  const compositionId = COMPOSITION_IDS[aspectRatio] || COMPOSITION_IDS['16:9'];
  const sessionId     = crypto.randomBytes(8).toString('hex');
  const sessionDir    = path.join(IMAGES_DIR, sessionId);
  const outputPath    = path.join(OUTPUT_DIR, `mojobus-${sessionId}.mp4`);

  fs.mkdirSync(sessionDir, { recursive: true });
  console.log(`[Remotion] ── Start: ${compositionId} | ${imageUrls.length} Bilder | ${aspectRatio}`);

  // SCHRITT 1: Bilder + Audio + Karte parallel herunterladen
  let imageFilenames;
  let audioFilename = null;
  let mapFilename   = null;
  let perSlideArray = null;     // dynamische Slide-Dauern aus Voiceover/Lesezeit
  let voiceoverSyncFilename = null; // Eine fertig getaktete voiceover_sync.mp3

  try {
    [imageFilenames, audioFilename, mapFilename] = await Promise.all([
      downloadAllImages(imageUrls, sessionDir),
      musicUrl  ? downloadAudioFile(musicUrl, sessionDir, localMusicDir) : Promise.resolve(null),
      mapImageUrl ? downloadMapImage(mapImageUrl, sessionDir) : Promise.resolve(null),
    ]);

    // ── perSlideArray IMMER berechnen (auch ohne Voiceover) ──────────────
    // Lesezeit aus Captions, min = secondsPerImage, +1s Transition
    const estimateReadingTime = (textLen) => Math.max(3.5, textLen / 14 + 0.5);
    const bodyTexts = Array.isArray(captions) ? captions : [];
    perSlideArray = [];
    for (let i = 0; i < imageUrls.length; i++) {
      const text = bodyTexts[i] || '';
      const readingTime = estimateReadingTime(text.length);
      perSlideArray.push(Math.max(secondsPerImage, Math.round((readingTime + 1) * 10) / 10));
    }

    // RouteMap als extra Slide in der Mitte einfügen
    if (showRouteMap && imageUrls.length >= 2) {
      const routeIdx = Math.floor(imageUrls.length / 2);
      const routeDur = perSlideArray[routeIdx] || secondsPerImage;
      perSlideArray.splice(routeIdx, 0, routeDur);
    }
    console.log(`[Remotion] ⏱️ Basis-perSlideArray=[${perSlideArray.join(', ')}] (${perSlideArray.length} Slides, ${secondsPerImage}s min, Lesezeit)`);

    // ── Voiceover: Segmente generieren + concatten ─────────────────────────
    const effectiveEngine = voiceoverEngine || (voiceoverModel && voiceoverModel.startsWith('de-DE-') ? 'edge' : 'piper');
    const hasSegments = voiceoverSegmentsInput && voiceoverSegmentsInput.length > 0;
    const hasText = voiceoverText && voiceoverText.trim();

    if (hasSegments || hasText) {
      const segments = hasSegments
        ? voiceoverSegmentsInput.filter(s => s && s.trim())
        : [voiceoverText.trim()];

      console.log(`[Remotion] 🎙️ Generiere ${segments.length} Voiceover-Segmente (${effectiveEngine})`);

      const rawSegments = await generateVoiceoverSegments(
        segments, voiceoverModel, voiceoverSpeed, effectiveEngine, sessionDir
      );

      if (rawSegments && rawSegments.length > 0) {
        // RouteMap-Slide Vorbereitung: wurde als Extra Slide vom Frontend gemeldet
        // RouteMap: Position berechnen (Mitte der Bilder)
        const routeIdx = showRouteMap && imageUrls.length >= 2
          ? Math.floor(imageUrls.length / 2) : -1;

        // routeDur: Dauer des RouteMap-Slides.
        // Wir nehmen den größten Wert aus Basis-perSlideArray an dieser Position
        // (Lesezeit des benachbarten Body-Slides) als Mindest-Dauer.
        // concatVoiceoverSegments überschreibt perSlideArray danach sowieso.
        const routeDur = routeIdx >= 0
          ? Math.max(secondsPerImage, perSlideArray[routeIdx] || secondsPerImage)
          : 0;

        // Concat: perSlideArray wird durch concat überschrieben (inkl. Voiceover-Dauer + RouteMap)
        // muteBodyIndex: RouteMap hat eigene Stille (route_silence.mp3) in concat.txt –
        // muteVoiceoverSlide vom Frontend wird hier NICHT mehr gebraucht und ignoriert.
        const concatResult = await concatVoiceoverSegments(
          rawSegments, sessionDir, 4, secondsPerImage, 6,
          -1, // muteBodyIndex: immer -1 – RouteMap-Stille wird direkt in concat eingebaut
          routeIdx, routeDur
        );

        if (concatResult) {
          voiceoverSyncFilename = concatResult.voiceoverFilename;
          perSlideArray = concatResult.perSlideArray;
          console.log(`[Remotion] ✅ Voiceover-Sync: perSlideArray=[${perSlideArray.join(', ')}]`);
        }
      }
    }

    // Ambient (Atmo) – nur wenn Typ übergeben wurde
    if (ambientType && ambientType.trim()) {
      try {
        const ambientPath = path.join(sessionDir, 'ambient.wav');
        console.log(`[Remotion] 🌊 Atmo generieren: ${ambientType} → ambient.wav`);
        await generateAmbient(ambientType, ambientPath, 60);
        if (fs.existsSync(ambientPath)) {
          try { fs.chmodSync(ambientPath, 0o644); } catch (e) {}
          console.log(`[Remotion] ✅ Atmo: ambient.wav`);
        }
      } catch (atmoErr) {
        console.warn(`[Remotion] ⚠️ Atmo fehlgeschlagen: ${atmoErr.message} – fahre ohne fort`);
      }
    }
  } catch (err) {
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
    throw new Error(`Download fehlgeschlagen: ${err.message}`);
  }

  // SCHRITT 2: Lokalen HTTP-Server für alle lokalen Dateien starten
  let imageServer = null;
  let httpImageUrls;
  let httpMusicUrl;
  let httpMapImageUrl;
  let httpVoiceoverUrl = null;  // Single voiceover_sync.mp3 (concat)
  let httpAmbientUrl = null;

  try {
    imageServer = await startImageServer(sessionDir);
    const base = `http://127.0.0.1:${imageServer.port}`;

    // Bilder-URLs
    httpImageUrls = imageFilenames.map(f => `${base}/${f}`);
    console.log(`[Remotion] Bild-URLs: ${httpImageUrls[0]} ... (${httpImageUrls.length} total)`);

    // Audio-URL: lokal wenn Download OK, sonst Original-URL
    httpMusicUrl = audioFilename
      ? `${base}/${audioFilename}`
      : musicUrl || null;
    if (httpMusicUrl) console.log(`[Remotion] Audio-URL: ${httpMusicUrl}`);

    // Voiceover-URL: Einzel-Datei (concat)
    if (voiceoverSyncFilename) {
      httpVoiceoverUrl = `${base}/${voiceoverSyncFilename}`;
      console.log(`[Remotion] Voiceover-URL: ${httpVoiceoverUrl}`);
    }

    // Ambient-URL: lokal wenn generiert (ambient.wav)
    if (ambientType && fs.existsSync(path.join(sessionDir, 'ambient.wav'))) {
      httpAmbientUrl = `${base}/ambient.wav`;
      console.log(`[Remotion] Ambient-URL: ${httpAmbientUrl}`);
    }

    // Karten-URL: lokal wenn Download OK, sonst Original-URL
    httpMapImageUrl = mapFilename
      ? `${base}/${mapFilename}`
      : mapImageUrl || null;
    if (httpMapImageUrl) console.log(`[Remotion] Karten-URL: ${httpMapImageUrl}`);

  } catch (err) {
    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
    throw new Error(`HTTP-Server konnte nicht gestartet werden: ${err.message}`);
  }

  // SCHRITT 3: Bundle + Render
  let renderError = null;
  let renderResult = null;

  try {
    const bundleLocation = await getBundledEntry();

    const inputProps = {
      imageUrls: httpImageUrls,             // ← HTTP statt file://
      title, summary, location, country, lifestyle,
      musicUrl: httpMusicUrl,               // ← Lokal gecacht!
      voiceoverUrl: httpVoiceoverUrl,       // ← Eine getaktete Datei!
      perSlideArray,                        // ← Dynamische Slide-Dauern
      voiceoverVolume,                      // ← Lautstärke 0-1
      ambientUrl: httpAmbientUrl,           // ← Lokale Atmo-Spur!
      secondsPerImage, aspectRatio, colorGrade,
      captions, captionStyle, websiteUrl, handle, accentColor, motionBlurStrength,
      // ── Kapitel-Marker ────────────────────────────────────────────
      hookCaption: params.hookCaption || '', // ← Hook-Caption für Titelkarte
      ctaText: params.ctaText || '',        // ← CTA-Text für Endkarte
      // ── Beat-Sync, Transitions, Route, Lottie ────────────────────
      beatSyncStrength, beatThreshold, showWaveformBar,
      transitionType,
      showRouteMap, routeCoords,
      mapImageUrl: httpMapImageUrl,         // ← Lokal gecacht!
      showLottieBus,
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
      pixelFormat: 'yuv420p',
      x264Preset: 'medium',
      // 4-Core VPS: 3 parallele Tabs = gutes Verhältnis Speed/RAM
      concurrency: 3,
      // numberOfSharedAudioTags: verhindert Audio-Glitches bei Sequence-Wechseln.
      // Remotion alloziert Audio-Tags vorab statt sie bei jedem Wechsel neu zu erstellen.
      // Wir haben 1 Musik-Track + ggf. BeatSync-Analyse → 3 reicht.
      // WICHTIG: muss >= Anzahl gleichzeitiger Audio-Elemente sein, sonst Ruckler!
      numberOfSharedAudioTags: 3,
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

export function cleanupOldRenders(maxAgeMs = 24 * 60 * 60 * 1000) { // 24h statt 1h
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
