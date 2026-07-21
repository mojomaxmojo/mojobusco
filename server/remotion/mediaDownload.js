/**
 * mediaDownload.js — Download-/Faststart-Logik für Remotion-Render
 *
 * Stellt alle Download- und Medien-Vorverarbeitungs-Funktionen bereit:
 * - Bilder, Audio, Karten von HTTP/HTTPS/lokal herunterladen
 * - HEVC→H.264 Re-Encode + Faststart-Remux für Chrome-Kompatibilität
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { FFMPEG_PATH, FFPROBE_PATH } from './binaries.js';
import { FASTSTART_EXTENSIONS } from './constants.js';

const execFileAsync = promisify(execFile);

// ── Bild-Download ─────────────────────────────────────────────────────────

function getImageExtension(url, contentType) {
  if (contentType) {
    const ct = contentType.toLowerCase().split(';')[0].trim();
    const map = {
      'image/jpeg': '.jpg', 'image/jpg': '.jpg',
      'image/png': '.png',  'image/webp': '.webp',
      'image/gif': '.gif',  'image/avif': '.avif',
      'image/heic': '.jpg', 'image/tiff': '.jpg',
      // Video-MIME-Types
      'video/mp4': '.mp4',  'video/webm': '.webm',
      'video/quicktime': '.mov',
      'video/x-msvideo': '.avi',
      'video/x-matroska': '.mkv',
    };
    if (map[ct]) return map[ct];
  }
  // Extension direkt aus URL ermitteln (Bild + Video)
  const m = url.split('?')[0].split('#')[0].match(/\.(jpe?g|jpg|png|webp|gif|avif|mp4|webm|mov|avi|mkv)$/i);
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
        'Accept': 'image/webp,image/jpeg,image/png,image/*,video/mp4,video/webm,video/quicktime,video/*,*/*',
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

// Extensions, deren Container ein moov/mdat-Atom nutzt (MP4/MOV) und somit
// von einem Faststart-Remux profitieren. WebM/MKV/AVI nutzen andere Container
// und brauchen das nicht.


/**
 * Bereitet eine MP4/MOV-Datei für Chrome-Headless-Rendering vor:
 *
 * 1️⃣ Codec-Check via ffprobe: Handy-Uploads (v.a. Android/iOS) sind oft
 *    HEVC/H.265 (evtl. mit Rotations-Metadaten für Hochkant-Aufnahmen).
 *    Chrome-Headless (SwiftShader-Software-Rendering) kann HEVC NICHT
 *    decodieren — und wirft dabei WEDER einen Error NOCH ein 'loadeddata'-
 *    Event, wodurch <Video> im delayRender() für immer hängt (AGENTS.md #13:
 *    niemals HEVC/H.265/VP9 ausliefern, Chromium kann es nicht decodieren).
 *    → nicht-H.264-Videos werden mit libx264/aac re-encoded (ffmpeg wendet
 *    die Rotations-Metadaten dabei automatisch an, Hochkant bleibt korrekt).
 *
 * 2️⃣ Ist der Codec bereits H.264: nur `-c copy` + `-movflags +faststart`,
 *    damit das moov-Atom (Metadaten: Dauer, Spuren, Keyframe-Index) am
 *    Dateianfang statt am Ende liegt. Ohne Faststart muss Chrome beim Laden
 *    von <Video> erst einen Suffix-Range-Request (die letzten Bytes) an
 *    unseren lokalen Bild-Server schicken, um das moov-Atom zu finden — bei
 *    großen Uploads (>~25MB) führte das (kombiniert mit dem Range-Parser-
 *    Bug) zum delayRender()-Timeout. `-c copy` dauert auch bei 100MB nur
 *    Sekundenbruchteile und verändert die Bildqualität nicht.
 *
 * Schlägt die Verarbeitung fehl, bleibt die Originaldatei unverändert
 * (graceful degradation) — der Suffix-Range-Fix im HTTP-Server greift dann
 * zumindest bei H.264-Videos als Netz.
 */
async function ensureFaststart(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!FASTSTART_EXTENSIONS.has(ext)) return;

  let codec = null;
  try {
    const { stdout } = await execFileAsync(FFPROBE_PATH, [
      '-v', 'error', '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_name',
      '-of', 'csv=p=0', filePath,
    ], { timeout: 15000 });
    codec = stdout.trim();
  } catch (err) {
    console.warn(`[Remotion] ⚠️ ffprobe-Codec-Check fehlgeschlagen (${path.basename(filePath)}): ${err.message}`);
  }

  const isH264 = codec === 'h264';
  // WICHTIG: Ausgabedatei muss auf eine von ffmpeg erkennbare Endung enden
  // (mov,mp4,m4a Muxer wird über die Extension erkannt) — sonst schlägt
  // ffmpeg mit "Unable to choose an output format" fehl.
  const outPath = filePath + '.tmp' + ext;

  const ffmpegArgs = isH264
    ? ['-y', '-i', filePath, '-c', 'copy', '-movflags', '+faststart', outPath]
    : [
        '-y', '-i', filePath,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-c:a', 'aac', '-b:a', '128k',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        outPath,
      ];

  try {
    // Re-Encoding (HEVC→H.264) braucht deutlich mehr Zeit als reiner Remux.
    await execFileAsync(FFMPEG_PATH, ffmpegArgs, { timeout: isH264 ? 120000 : 300000 });
    fs.renameSync(outPath, filePath);
    if (isH264) {
      console.log(`[Remotion] ✓ Faststart-Remux: ${path.basename(filePath)}`);
    } else {
      console.log(`[Remotion] ✓ ${codec || 'unbekannt'}→H.264 Re-Encode (Chrome kann HEVC/VP9 nicht decodieren): ${path.basename(filePath)}`);
    }
  } catch (err) {
    try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (e) {}
    console.warn(`[Remotion] ⚠️ ${isH264 ? 'Faststart-Remux' : 'H.264-Re-Encode'} fehlgeschlagen (${path.basename(filePath)}): ${err.message}`);
  }
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

      await ensureFaststart(finalPath);
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
async function downloadAudioFile(url, sessionDir, localMusicDir, outputName = 'audio') {
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
      const destPath = path.join(sessionDir, `${outputName}${ext}`);
      fs.copyFileSync(localPath, destPath);
      try { fs.chmodSync(destPath, 0o644); } catch (e) {}
      const sizeKB = (fs.statSync(destPath).size / 1024).toFixed(0);
      console.log(`[Remotion] ✓ Audio (lokal kopiert): ${outputName}${ext} ${sizeKB}KB`);
      return `${outputName}${ext}`;
    }
    console.warn(`[Remotion] ✗ Lokale Audio-Datei nicht gefunden: ${localPath}`);
    return null;
  }

  // Fall 1.5: /api/music/ relativer Pfad → aus localMusicDir kopieren
  const apiMusicMatch = url.match(/^\/api\/music\/([^?#]+)/);
  if (apiMusicMatch && localMusicDir) {
    const filename = decodeURIComponent(apiMusicMatch[1]);
    const localPath = path.join(localMusicDir, filename);
    if (fs.existsSync(localPath)) {
      const ext = path.extname(filename) || guessExt;
      const destPath = path.join(sessionDir, `${outputName}${ext}`);
      fs.copyFileSync(localPath, destPath);
      try { fs.chmodSync(destPath, 0o644); } catch (e) {}
      const sizeKB = (fs.statSync(destPath).size / 1024).toFixed(0);
      console.log(`[Remotion] ✓ Audio (api/music→lokal): ${outputName}${ext} ${sizeKB}KB`);
      return `${outputName}${ext}`;
    }
    console.warn(`[Remotion] ✗ Musik-Datei im music/-Ordner nicht gefunden: ${filename}`);
  }

  // Fall 2: localhost-URL → Dateiname extrahieren + aus localMusicDir kopieren
  const localhostMatch = url.match(/localhost:[0-9]+\/api\/music\/([^?#]+)/);
  if (localhostMatch && localMusicDir) {
    const filename = decodeURIComponent(localhostMatch[1]);
    const localPath = path.join(localMusicDir, filename);
    if (fs.existsSync(localPath)) {
      const ext = path.extname(filename) || guessExt;
      const destPath = path.join(sessionDir, `${outputName}${ext}`);
      fs.copyFileSync(localPath, destPath);
      try { fs.chmodSync(destPath, 0o644); } catch (e) {}
      const sizeKB = (fs.statSync(destPath).size / 1024).toFixed(0);
      console.log(`[Remotion] ✓ Audio (localhost→lokal): ${outputName}${ext} ${sizeKB}KB`);
      return `${outputName}${ext}`;
    }
    console.warn(`[Remotion] ✗ Musik-Datei im music/-Ordner nicht gefunden: ${filename}`);
  }

  // Fall 3: Externe HTTP(S)-URL → herunterladen
  const tempPath = path.join(sessionDir, `${outputName}.tmp`);
  try {
    const { contentType } = await downloadFileWithType(url, tempPath);
    const ext = (contentType && AUDIO_MIME_MAP[contentType.toLowerCase().split(';')[0].trim()]) || guessExt;
    const finalPath = path.join(sessionDir, `${outputName}${ext}`);
    fs.renameSync(tempPath, finalPath);
    try { fs.chmodSync(finalPath, 0o644); } catch (e) {}
    const sizeKB = (fs.statSync(finalPath).size / 1024).toFixed(0);
    console.log(`[Remotion] ✓ Audio (HTTP): ${outputName}${ext} ${sizeKB}KB`);
    return `${outputName}${ext}`;
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

export {
  getImageExtension,
  downloadFileWithType,
  ensureFaststart,
  downloadAllImages,
  downloadAudioFile,
  downloadMapImage,
};