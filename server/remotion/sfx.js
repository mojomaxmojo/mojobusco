/**
 * sfx.js – Sound-Effekt Generator (Whoosh / Ding / Impact)
 *
 * Analog zu ambient.js: erzeugt kurze (~0,3–0,6s) WAV-Dateien per
 * FFmpeg-lavfi. Kein externes Audio-Asset nötig, gleiche Technik wie die
 * bestehenden Atmo-Sounds (siehe ambient.js).
 *
 * Fundament für Schritt 4 (Sound-SFX-Layer), siehe FEATURE-PLAN.md.
 * Wird aktuell von niemandem importiert – keine Wirkung auf bestehendes
 * Verhalten.
 *
 * FFmpeg-Pfad wird automatisch erkannt (identische Logik wie ambient.js /
 * render.js) – Priorität: FFMPEG_PATH > /opt/bin/ > /usr/local/bin/ >
 * /usr/bin/ > command -v
 */

import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';

// ── Binary-Pfad automatisch erkennen (identische Logik wie ambient.js) ────
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
 * FFmpeg lavfi-Filter für die drei SFX-Typen. Kurze, synthetische
 * One-Shot-Sounds – kein externes Asset nötig.
 */
const SFX_FILTERS = {
  whoosh: {
    desc: 'Whoosh (Rauschen mit Bandpass-Sweep)',
    duration: 0.5,
    // Weißes Rauschen + wandernder Bandpass simuliert das "Vorbeirauschen"
    filter:
      'anoisesrc=d=0.5:color=white:seed=21:a=0.9,bandpass=f=1200:w=1800,volume=6dB,afade=t=out:st=0.3:d=0.2',
  },
  ding: {
    desc: 'Ding (Sinuston mit schnellem Decay)',
    duration: 0.4,
    // Sinuston mit exponentiellem Ausklang
    filter:
      'sine=frequency=1400:duration=0.4,volume=5dB,afade=t=out:st=0.05:d=0.35',
  },
  impact: {
    desc: 'Impact (kurzer Noise-Burst mit Lowpass)',
    duration: 0.3,
    // Brown noise, kurzer Burst mit tiefem Lowpass für dumpfen "Schlag"
    filter:
      'anoisesrc=d=0.3:color=brown:seed=5:a=1.0,lowpass=f=300,volume=8dB,afade=t=out:st=0.1:d=0.2',
  },
};

export const SFX_TYPES = Object.keys(SFX_FILTERS);

/**
 * Generiert eine kurze SFX-WAV-Datei per FFmpeg-lavfi.
 *
 * @param {string} type       – SFX-Typ: 'whoosh' | 'ding' | 'impact'
 * @param {string} outputPath – Zieldatei (z.B. /tmp/.../sfx-whoosh.wav)
 */
export async function generateSfx(type, outputPath) {
  const config = SFX_FILTERS[type];
  if (!config) {
    throw new Error(
      'Unbekannter SFX-Typ: ' + type + '. Verfügbar: ' + Object.keys(SFX_FILTERS).join(', ')
    );
  }
  if (!existsSync(findFfmpeg())) {
    throw new Error('FFmpeg nicht gefunden: ' + findFfmpeg());
  }

  return new Promise(function (resolve, reject) {
    console.log('[SFX] 🔊 Generiere: ' + config.desc);
    const args = [
      '-f', 'lavfi',
      '-i', config.filter,
      '-t', String(config.duration),
      '-ar', '44100',
      '-ac', '2',
      '-y',
      outputPath,
    ];
    const proc = spawn(findFfmpeg(), args);
    let stderr = '';
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
