/**
 * sfx.js – Sound-Effekt Generator (Whoosh/Ding/Impact)
 *
 * Erzeugt kurze (~0,3–0,6s) WAV-Dateien per FFmpeg-lavfi.
 * Gleiche Technik wie ambient.js, kein externes Audio-Asset nötig.
 *
 * Typen:
 *   - whoosh: Rauschen mit Bandpass-Sweep (aufsteigend)
 *   - ding:   Sinuston mit schnellem Decay
 *   - impact: Kurzer Noise-Burst mit Lowpass
 *
 * FFmpeg-Pfad wird automatisch erkannt (siehe findFfmpeg() unten) –
 * Priorität: FFMPEG_PATH > /opt/bin/ > /usr/local/bin/ > /usr/bin/ > command -v
 */

import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';

// ── Binary-Pfad automatisch erkennen (identische Logik wie ambient.js) ─────
function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  if (existsSync('/opt/bin/ffmpeg')) return '/opt/bin/ffmpeg';
  if (existsSync('/usr/local/bin/ffmpeg')) return '/usr/local/bin/ffmpeg';
  if (existsSync('/usr/bin/ffmpeg')) return '/usr/bin/ffmpeg';
  try {
    const found = execSync('command -v ffmpeg 2>/dev/null').toString().trim();
    if (found) return found;
  } catch {}
  return '/usr/bin/ffmpeg';
}

/**
 * FFmpeg lavfi-Filter für die verschiedenen SFX-Typen.
 * Kurze Dauer (0,3–0,6s), optimiert für Cue-Effekte auf Bildschnitten.
 */
const SFX_FILTERS = {
  whoosh: {
    desc: 'Whoosh (Rauschen mit Bandpass-Sweep)',
    // Pink noise + Bandpass-Sweep von tief nach hoch (500→5000Hz)
    // volume=8dB für hörbaren Effekt
    duration: 0.5,
    filter:
      'anoisesrc=d=0.5:color=pink:seed=42:a=0.8,' +
      'aevalsrc=exprs=500+4500*t/t*0.5:duration=0.5:nb_samples=22050[sweep],' +
      'amerge=inputs=2,bandpass=f=500:w=1500:csg=1,volume=8dB',
  },
  ding: {
    desc: 'Ding (Sinuston mit Decay)',
    // 880Hz Sinus (A5) mit exponentiellem Decay → kurzer, klarer Ton
    duration: 0.4,
    filter:
      'aevalsrc=exprs=sin(880*2*PI*t)*exp(-8*t):duration=0.4:rate=44100:nb_samples=17640,volume=8dB',
  },
  impact: {
    desc: 'Impact (Noise-Burst mit Lowpass)',
    // Kurzer weißer Rausch-Burst + Lowpass → dumpfer Schlag
    duration: 0.3,
    filter:
      'aevalsrc=exprs=random(42)*exp(-15*t):duration=0.3:rate=44100:nb_samples=13230,' +
      'lowpass=f=800,volume=10dB',
  },
};

export const SFX_TYPES = Object.keys(SFX_FILTERS);

/**
 * Generiert eine SFX-WAV-Datei per FFmpeg-lavfi.
 *
 * @param {string} type       – SFX-Typ: 'whoosh' | 'ding' | 'impact'
 * @param {string} outputPath – Zieldatei (z.B. /tmp/.../sfx-whoosh.wav)
 */
export async function generateSfx(type, outputPath) {
  var config = SFX_FILTERS[type];
  if (!config) {
    throw new Error(
      'Unbekannter SFX-Typ: ' + type + '. Verfügbar: ' + SFX_TYPES.join(', ')
    );
  }

  if (!existsSync(findFfmpeg())) {
    throw new Error('FFmpeg nicht gefunden: ' + findFfmpeg());
  }

  return new Promise(function (resolve, reject) {
    console.log('[SFX] 🔉 Generiere: ' + config.desc);
    var args = [
      '-f', 'lavfi',
      '-i', config.filter,
      '-t', String(config.duration),
      '-ar', '44100',
      '-ac', '2',
      '-y',
      outputPath,
    ];
    var proc = spawn(findFfmpeg(), args);
    var stderr = '';
    proc.stderr.on('data', function (chunk) { stderr += chunk.toString(); });
    proc.on('close', function (code) {
      if (code === 0) {
        console.log('[SFX] ✅ ' + type + ' erzeugt: ' + outputPath);
        resolve();
      } else {
        reject(new Error('FFmpeg exit ' + code + ': ' + stderr.slice(-200)));
      }
    });
    proc.on('error', function (err) {
      reject(new Error('FFmpeg Fehler: ' + err.message));
    });
  });
}

export default { generateSfx, SFX_TYPES };