/**
 * ambient.js – Atmo-Geräusche Generator
 *
 * Hybrid-Modus (3 Stufen):
 *   1) ⭐ WAV-Datei aus ambient-sounds/ → direkt kopieren (kein Decoding!)
 *   2) MP3-Datei → FFmpeg-WAV-Konvertierung (exit 69 auf CentminMod FFmpeg)
 *   3) FFmpeg-lavfi synthetischer Fallback (optimierte Filter)
 *
 * Ablage: server/remotion/ambient-sounds/{type}.wav (priorisiert) oder .mp3
 *
 * CentminMod FFmpeg git-Build hat defekten mp3float-Decoder (exit 69).
 * WAV-Dateien werden direkt kopiert – keine Dekodierung nötig.
 *
 * Quellen (alle CC0 / Public Domain / Pixabay License):
 *   - Pixabay Sound Effects: https://pixabay.com/sound-effects/
 *   - BigSoundBank: https://bigsoundbank.com (Joseph SARDIN)
 *
 * FFmpeg-Pfad wird automatisch erkannt (siehe findFfmpeg() unten) –
 * Priorität: FFMPEG_PATH > /opt/bin/ > /usr/local/bin/ > /usr/bin/ > command -v
 */

import { spawn, execSync } from 'child_process';
import { existsSync, copyFileSync, chmodSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AMBIENT_SOUNDS_DIR = path.join(__dirname, 'ambient-sounds');

// ── Binary-Pfad automatisch erkennen (identische Logik wie render.js) ─────
// sucht zuerst FFMPEG_PATH env var, dann statische Pfade (CentminMod),
// dann via command -v (POSIX PATH)
function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  // Statische Pfade zuerst (CentminMod: /opt/bin/ hat libmp3lame)
  if (existsSync('/opt/bin/ffmpeg')) return '/opt/bin/ffmpeg';
  if (existsSync('/usr/local/bin/ffmpeg')) return '/usr/local/bin/ffmpeg';
  if (existsSync('/usr/bin/ffmpeg')) return '/usr/bin/ffmpeg';
  // PATH-Fallback
  try {
    const found = execSync('command -v ffmpeg 2>/dev/null').toString().trim();
    if (found) return found;
  } catch {}
  return '/usr/bin/ffmpeg';
}

/**
 * FFmpeg lavfi-Filter für verschiedene Atmo-Typen (Fallback, wenn keine
 * echte MP3 in ambient-sounds/ existiert oder Dekodierung fehlschlägt).
 *
 * Optimiert für CentminMod FFmpeg (mp3float-Decoder defekt).
 * Höhere Amplituden + Volume-Boost + Equalizer für realistischeren Klang.
 */
const AMBIENT_FILTERS = {
  ocean: {
    desc: 'Meeresrauschen',
    // Pink noise + lowpass → tiefes Wellenrauschen, + EQ für Tiefenbetonung
    filter: 'anoisesrc=d=60:color=pink:seed=123:a=0.9,lowpass=f=400,equalizer=f=100:width_type=o:width=1:g=4,volume=4dB',
  },
  rain: {
    desc: 'Regen',
    // Pink noise + high-frequency boost + moderate lowpass
    filter: 'anoisesrc=d=60:color=pink:seed=42:a=0.9,lowpass=f=5000,equalizer=f=3000:width_type=o:width=1.5:g=3,volume=3dB',
  },
  wind: {
    desc: 'Wind',
    // Brown noise + tiefes lowpass für Windböen-Charakter
    filter: 'anoisesrc=d=60:color=brown:seed=7:a=0.9,lowpass=f=600,equalizer=f=150:width_type=o:width=1:g=5,volume=4dB',
  },
  fire: {
    desc: 'Lagerfeuer',
    // Brown noise + bandpass (mittlere Frequenzen = Knistern) + Höhen-Boost
    filter: 'anoisesrc=d=60:color=brown:seed=13:a=0.8,bandpass=f=250:w=600,equalizer=f=1500:width_type=o:width=2:g=2,volume=4dB',
  },
  forest: {
    desc: 'Vogelgezwitscher',
    // Pink noise + bandpass (Vogel-Frequenzen) + tremolo für Zwitscher-Effekt
    filter: 'anoisesrc=d=60:color=pink:seed=99:a=0.9,bandpass=f=3000:w=2500,equalizer=f=4000:width_type=o:width=2:g=2,tremolo=f=5:d=0.5,volume=4dB',
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
  var hasWav = existsSync(path.join(AMBIENT_SOUNDS_DIR, type + '.wav'));
  var hasMp3 = existsSync(path.join(AMBIENT_SOUNDS_DIR, type + '.mp3'));
  return { desc: info.desc, hasRealFile: hasWav || hasMp3, hasWav: hasWav };
}

/**
 * Generiert eine Atmo-WAV-Datei.
 *
 * Prio 1: WAV-Datei aus ambient-sounds/ → direkt kopieren (kein Decoding)
 * Prio 2: MP3-Datei → FFmpeg-WAV-Konvertierung
 * Prio 3: FFmpeg-lavfi synthetischer Fallback
 *
 * @param {string} type       – Atmo-Typ: 'ocean' | 'rain' | 'wind' | 'fire' | 'forest'
 * @param {string} outputPath – Zieldatei (z.B. /tmp/.../ambient.wav)
 * @param {number} duration   – Dauer in Sekunden (default: 60)
 */
export async function generateAmbient(type, outputPath, duration) {
  if (!duration) duration = 60;

  // ── Prio 1: WAV-Datei → direkt kopieren ────────────────────────────
  var realWav = path.join(AMBIENT_SOUNDS_DIR, type + '.wav');
  if (existsSync(realWav)) {
    console.log('[Ambient] ✅ WAV gefunden: ' + realWav + ' → kopieren');
    try {
      copyFileSync(realWav, outputPath);
      chmodSync(outputPath, 0o644);
      var sizeKB = (statSync(outputPath).size / 1024).toFixed(0);
      console.log('[Ambient] ✅ WAV kopiert (' + sizeKB + 'KB)');
      return Promise.resolve();
    } catch (err) {
      console.warn('[Ambient] ⚠️ WAV-Kopie fehlgeschlagen: ' + err.message + ', Fallback');
    }
  }

  // ── Prio 2: MP3 → WAV-Konvertierung ────────────────────────────────
  var realMp3 = path.join(AMBIENT_SOUNDS_DIR, type + '.mp3');
  if (existsSync(realMp3)) {
    console.log('[Ambient] ✅ MP3 gefunden: ' + realMp3 + ' → WAV konvertieren');
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

  // ── Prio 3: FFmpeg-lavfi synthetischer Fallback ────────────────────
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