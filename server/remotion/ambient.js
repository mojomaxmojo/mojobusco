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
    filter: 'aeval=sin(1000*t*exp(-t/10)) + sin(500*t) + noise(0.3)|sin(1000*t*exp(-t/10)) + sin(500*t) + noise(0.3) [a]; aresample=44100',
  },
  rain: {
    desc: 'Regen',
    filter: 'anoisesrc=d=60:color=pink:seed=42:a=0.5|anoisesrc=d=60:color=pink:seed=42:a=0.5,lowpass=f=2000',
  },
  wind: {
    desc: 'Wind',
    filter: 'anoisesrc=d=60:color=brown:seed=7:a=0.6|anoisesrc=d=60:color=brown:seed=7:a=0.6,lowpass=f=500',
  },
  fire: {
    desc: 'Lagerfeuer',
    filter: 'aeval=noise(0.2)*sin(200*t) + noise(0.1)*sin(300*t)|noise(0.2)*sin(200*t) + noise(0.1)*sin(300*t),lowpass=f=4000',
  },
  forest: {
    desc: 'Vogelgezwitscher',
    filter: 'aeval=sin(2000*t + 5*sin(10*t))*exp(-0.1*abs(sin(0.5*t))) + sin(3000*t + 3*sin(8*t))*exp(-0.1*abs(sin(0.3*t))) + noise(0.1)|sin(2000*t + 5*sin(10*t))*exp(-0.1*abs(sin(0.5*t))) + sin(3000*t + 3*sin(8*t))*exp(-0.1*abs(sin(0.3*t))) + noise(0.1),lowpass=f=8000',
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