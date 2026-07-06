/**
 * ambient.js – Atmo-Geräusche Generator
 *
 * Hybrid-Modus:
 *   1) Echte MP3-Datei aus ambient-sounds/ wird bevorzugt (realistischer)
 *   2) Fallback: FFmpeg-lavfi (synthetisch)
 *
 * Ablage: server/remotion/ambient-sounds/{type}.mp3
 *
 * Quellen (alle CC0 / Public Domain):
 *   - BigSoundBank (https://bigsoundbank.com) von Joseph SARDIN
 *   - Weitere CC0-Sounds bei Bedarf
 *
 * FFmpeg-Pfad wird automatisch erkannt (siehe findBinary() unten) –
 * env var FFMPEG_PATH > command -v > /usr/bin/ > /usr/local/bin/ > /opt/bin/
 */

import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AMBIENT_SOUNDS_DIR = path.join(__dirname, 'ambient-sounds');

// ── Binary-Pfad automatisch erkennen (identische Logik wie render.js) ─────
// sucht zuerst FFMPEG_PATH env var, dann via command -v (POSIX PATH),
// dann /usr/bin/, dann /usr/local/bin/, zuletzt /opt/bin/ (CentminMod)
function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try {
    const found = execSync('command -v ffmpeg 2>/dev/null').toString().trim();
    if (found) return found;
  } catch {}
  if (existsSync('/usr/bin/ffmpeg')) return '/usr/bin/ffmpeg';
  if (existsSync('/usr/local/bin/ffmpeg')) return '/usr/local/bin/ffmpeg';
  if (existsSync('/opt/bin/ffmpeg')) return '/opt/bin/ffmpeg';
  return '/usr/bin/ffmpeg'; // letzter Fallback
}

/**
 * FFmpeg lavfi-Filter für verschiedene Atmo-Typen (Fallback, wenn keine
 * echte MP3 in ambient-sounds/ existiert).
 */
const AMBIENT_FILTERS = {
  ocean: {
    desc: 'Meeresrauschen',
    filter: 'anoisesrc=d=60:color=pink:seed=123:a=0.5,lowpass=f=400',
  },
  rain: {
    desc: 'Regen',
    filter: 'anoisesrc=d=60:color=pink:seed=42:a=0.5,lowpass=f=2000',
  },
  wind: {
    desc: 'Wind',
    filter: 'anoisesrc=d=60:color=brown:seed=7:a=0.5,lowpass=f=500',
  },
  fire: {
    desc: 'Lagerfeuer',
    filter: 'anoisesrc=d=60:color=brown:seed=13:a=0.4,bandpass=f=300:w=800',
  },
  forest: {
    desc: 'Vogelgezwitscher',
    filter: 'anoisesrc=d=60:color=pink:seed=99:a=0.5,bandpass=f=3000:w=2000',
  },
};

export const AMBIENT_TYPES = Object.keys(AMBIENT_FILTERS);

/**
 * Gibt Info zu einem Atmo-Typ zurück.
 *
 * @param {string} type
 * @returns {object|null}
 */
export function getAmbientInfo(type) {
  var info = AMBIENT_FILTERS[type];
  if (!info) return null;
  var hasRealFile = existsSync(path.join(AMBIENT_SOUNDS_DIR, type + '.mp3'));
  return { desc: info.desc, hasRealFile: hasRealFile };
}

/**
 * Generiert eine Atmo-WAV-Datei.
 *
 * Prio 1: Echte MP3 aus ambient-sounds/ wird verwendet (wenn vorhanden)
 * Prio 2: FFmpeg-lavfi Fallback (bisherige synthetische Generierung)
 *
 * @param {string} type       – Atmo-Typ: 'ocean' | 'rain' | 'wind' | 'fire' | 'forest'
 * @param {string} outputPath – Zieldatei (z.B. /tmp/.../ambient.wav)
 * @param {number} duration   – Dauer in Sekunden (default: 60)
 */
export async function generateAmbient(type, outputPath, duration) {
  if (!duration) duration = 60;

  // ── Prio 1: Echte MP3 aus ambient-sounds/ → WAV konvertieren ─────────
  var realMp3 = path.join(AMBIENT_SOUNDS_DIR, type + '.mp3');
  if (existsSync(realMp3)) {
    console.log('[Ambient] ✅ Echte MP3 gefunden: ' + realMp3 + ' → WAV konvertieren');
    return new Promise(function (resolve, reject) {
      var args = [
        '-y',
        '-i', realMp3,
        '-t', String(duration),
        '-ar', '44100',
        '-ac', '2',
        outputPath,
      ];
      var proc = spawn(findFfmpeg(), args);
      var stderr = '';
      proc.stderr.on('data', function (chunk) { stderr += chunk.toString(); });
      proc.on('close', function (code) {
        if (code === 0) {
          console.log('[Ambient] ✅ MP3→WAV konvertiert: ' + outputPath);
          resolve();
        } else {
          console.warn('[Ambient] ⚠️ MP3→WAV Fehler (exit ' + code + '), Fallback auf FFmpeg-lavfi');
          resolveFallback(type, outputPath, duration).then(resolve).catch(reject);
        }
      });
      proc.on('error', function () {
        resolveFallback(type, outputPath, duration).then(resolve).catch(reject);
      });
    });
  }

  // ── Prio 2: FFmpeg-lavfi Fallback ────────────────────────────────────
  return resolveFallback(type, outputPath, duration);
}

/**
 * FFmpeg-lavfi Fallback: synthetische Geräusche via anoisesrc
 */
function resolveFallback(type, outputPath, duration) {
  if (!existsSync(findFfmpeg())) {
    throw new Error('FFmpeg nicht gefunden: ' + findFfmpeg());
  }
  return new Promise(function (resolve, reject) {
    var config = AMBIENT_FILTERS[type];
    if (!config) {
      throw new Error(
        'Unbekannter Atmo-Typ: ' + type + '. Verfügbar: ' + Object.keys(AMBIENT_FILTERS).join(', ')
      );
    }
    console.log('[Ambient] 🔉 FFmpeg-Fallback: ' + config.desc);
    var args = [
      '-f', 'lavfi',
      '-i', config.filter,
      '-t', String(duration),
      '-ar', '44100',
      '-ac', '2',
      '-y',
      outputPath,
    ];
    var proc = spawn(findFfmpeg(), args);
    var stderr = '';
    proc.stderr.on('data', function (chunk) { stderr += chunk.toString(); });
    proc.on('close', function (code) {
      if (code === 0) resolve();
      else reject(new Error('FFmpeg exit ' + code + ': ' + stderr.slice(-200)));
    });
    proc.on('error', function (err) {
      reject(new Error('FFmpeg Fehler: ' + err.message));
    });
  });
}

export default { generateAmbient, getAmbientInfo, AMBIENT_TYPES };