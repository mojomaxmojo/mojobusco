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
 * FFmpeg muss installiert sein (/opt/bin/ffmpeg).
 * Standard: AUS – nur wenn explizit gewählt.
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';

const FFMPEG = process.env.FFMPEG_PATH || '/opt/bin/ffmpeg';

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
    filter: 'anoisesrc=d=60:color=pink:seed=99:a=0.25,bandpass=f=3000:w=2000',
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