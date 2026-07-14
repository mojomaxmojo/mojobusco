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
 *
 * WICHTIG: Kein `duration`, `rate` oder `nb_samples` in den Filtern!
 * Diese Parameter werden über die Kommandozeilen-Flags `-t` und `-ar`
 * gesteuert (siehe generateSfx unten). Manche FFmpeg-Builds (z.B.
 * CentminMod git-Builds) akzeptieren diese Parameter in `aevalsrc`
 * oder `anoisesrc` nicht und brechen mit "Option not found" ab.
 */
const SFX_FILTERS = {
  whoosh: {
    desc: 'Whoosh (Rauschen mit Bandpass-Sweep)',
    // Pink noise + Bandpass (tiefe→mittlere Frequenzen) → aufsteigender
    // Whoosh-Charakter ohne aevalsrc (nicht auf allen FFmpeg-Builds stabil)
    duration: 0.5,
    filter: 'anoisesrc=color=pink:seed=42:a=0.8,lowpass=f=1500,volume=8dB',
  },
  ding: {
    desc: 'Ding (Sinuston mit Decay)',
    // 880Hz Sinus (A5) mit exponentiellem Decay → kurzer, klarer Ton
    // NUR exprs-Parameter – duration/rate/nb_samples werden von -t/-ar gesteuert
    duration: 0.4,
    filter: 'aevalsrc=exprs=sin(880*2*PI*t)*exp(-8*t),volume=8dB',
  },
  impact: {
    desc: 'Impact (Noise-Burst mit Lowpass)',
    // Weißes Rauschen + Lowpass → dumpfer Schlag (kein aevalsrc nötig)
    duration: 0.3,
    filter: 'anoisesrc=color=white:seed=42:a=0.8,lowpass=f=800,volume=10dB',
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