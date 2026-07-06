/**
 * ambient.js – Atmo-Geräusche Generator
 *
 * Erzeugt Umgebungsgeräusche via FFmpeg (lavfi).
 * Keine externen Dateien nötig – FFmpeg generiert alles live.
 *
 * Nutzung:     generateAmbient(type, outputPath)
 *   type:      'ocean' | 'rain' | 'wind' | 'fire' | 'forest'
 *   outputPath: Ziel-Pfad für WAV-Datei
 *
 * FFmpeg-Pfad wird automatisch erkannt (siehe findBinary() unten) – NIEMALS
 * /opt/bin/ffmpeg hartcodieren! Auf dem Produktions-VPS (AlmaLinux/CentminMod)
 * liegt FFmpeg unter /usr/local/bin/ffmpeg (CentminMod-Symlink). Der alte
 * hartcodierte Fallback auf /opt/bin/ffmpeg existierte dort nicht → jeder
 * generateAmbient()-Call schlug mit "FFmpeg nicht gefunden" fehl und wurde
 * in render.js NUR als Warnung geloggt ("Atmo fehlgeschlagen – fahre ohne
 * fort") → das Atmo-Geräusch fehlte im Video, ohne dass ein Fehler auffiel.
 * Standard: AUS – nur wenn explizit gewählt.
 */

import { spawn, execSync } from 'child_process';
import { existsSync } from 'fs';

// ── Binary-Pfad automatisch erkennen (identische Logik wie render.js) ─────
// sucht zuerst via command -v (POSIX PATH), dann /usr/bin/, dann /usr/local/bin/
function findFfmpeg() {
  try {
    const found = execSync('command -v ffmpeg 2>/dev/null').toString().trim();
    if (found) return found;
  } catch {}
  if (existsSync('/usr/bin/ffmpeg')) return '/usr/bin/ffmpeg';
  if (existsSync('/usr/local/bin/ffmpeg')) return '/usr/local/bin/ffmpeg';
  return '/usr/bin/ffmpeg'; // letzter Fallback
}

const FFMPEG = process.env.FFMPEG_PATH || findFfmpeg();

/**
 * FFmpeg lavfi-Filter für verschiedene Atmo-Typen.
 * Jeder Filter generiert eine ~60s WAV-Datei.
 */
const AMBIENT_FILTERS = {
  ocean: {
    desc: 'Meeresrauschen',
    // Pink noise + lowpass → sanftes Rauschen wie Wellen
    filter: 'anoisesrc=d=60:color=pink:seed=123:a=0.35,lowpass=f=400',
  },
  rain: {
    desc: 'Regen',
    filter: 'anoisesrc=d=60:color=pink:seed=42:a=0.5,lowpass=f=2000',
  },
  wind: {
    desc: 'Wind',
    filter: 'anoisesrc=d=60:color=brown:seed=7:a=0.6,lowpass=f=500',
  },
  fire: {
    desc: 'Lagerfeuer',
    // Crackling: brown noise + bandpass
    filter: 'anoisesrc=d=60:color=brown:seed=13:a=0.3,bandpass=f=300:w=800',
  },
  forest: {
    desc: 'Vogelgezwitscher',
    // High-frequency pink noise → Vogelgezwitscher-ähnlich
    filter: 'anoisesrc=d=60:color=pink:seed=99:a=0.6,bandpass=f=3000:w=2000,aresample=44100,asetpts=N/SR/TB,highpass=f=2000,lowpass=f=8000',
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
  return AMBIENT_FILTERS[type] || null;
}

/**
 * Generiert eine Atmo-WAV-Datei via FFmpeg.
 *
 * @param {string} type       – Atmo-Typ: 'ocean' | 'rain' | 'wind' | 'fire' | 'forest'
 * @param {string} outputPath – Zieldatei (z.B. /tmp/.../ambient.wav)
 * @param {number} duration   – Dauer in Sekunden (default: 60)
 */
export async function generateAmbient(type, outputPath, duration) {
  if (!duration) duration = 60;

  if (!existsSync(FFMPEG)) {
    throw new Error('FFmpeg nicht gefunden: ' + FFMPEG);
  }

  var config = AMBIENT_FILTERS[type];
  if (!config) {
    throw new Error(
      'Unbekannter Atmo-Typ: ' + type + '. Verfügbar: ' + Object.keys(AMBIENT_FILTERS).join(', ')
    );
  }

  return new Promise(function(resolve, reject) {
    var args = [
      '-f', 'lavfi',
      '-i', config.filter,
      '-t', String(duration),
      '-ar', '44100',
      '-ac', '2',
      '-y',
      outputPath,
    ];

    var proc = spawn(FFMPEG, args);
    var stderr = '';

    proc.stderr.on('data', function(chunk) { stderr += chunk.toString(); });
    proc.on('close', function(code) {
      if (code === 0) resolve();
      else reject(new Error('FFmpeg exit ' + code + ': ' + stderr.slice(-200)));
    });
    proc.on('error', function(err) {
      reject(new Error('FFmpeg Fehler: ' + err.message));
    });
  });
}

export default { generateAmbient, getAmbientInfo, AMBIENT_TYPES };