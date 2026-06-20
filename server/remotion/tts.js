/**
 * tts.js — Piper TTS Wrapper
 *
 * Wandelt Text in Sprache um (lokal, keine API-Kosten).
 * Nutzt Piper TTS Binary auf dem VPS (/opt/piper/piper).
 *
 * Verfügbare Stimmen (deutsch):
 *   de_DE-thorsten-medium  – männlich, medium Qualität
 *   de_DE-ramona-low        – weiblich, low Qualität
 *
 * Standard: AUS — Nur wenn voiceoverText explizit übergeben wird.
 *
 * Aufruf:      generateVoiceover(text, 'de_DE-thorsten-medium')
 * Ergebnis:    /tmp/piper-XXXXXX/voiceover.wav
 */

import { spawn } from 'child_process';
import { mkdtempSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

// ── Piper Pfade ────────────────────────────────────────────────────────────
const PIPER_BINARY = process.env.PIPER_PATH || '/opt/piper/piper';
const PIPER_VOICES_DIR = process.env.PIPER_VOICES_DIR || '/opt/piper/voices';

// ── Verfügbare Stimmen ────────────────────────────────────────────────────
export const AVAILABLE_VOICES = {
  'de_DE-thorsten-medium': {
    name: 'Thorsten',
    gender: 'male',
    quality: 'medium',
    language: 'de',
    file: 'de_DE-thorsten-medium.onnx',
  },
  'de_DE-ramona-low': {
    name: 'Ramona',
    gender: 'female',
    quality: 'low',
    language: 'de',
    file: 'de_DE-ramona-low.onnx',
  },
};

/**
 * Prüft ob Piper TTS installiert ist.
 */
export function isPiperAvailable() {
  try {
    return existsSync(PIPER_BINARY);
  } catch {
    return false;
  }
}

/**
 * Generiert eine Sprachaufnahme aus Text.
 *
 * @param {string} text          – Der Text der vorgelesen werden soll
 * @param {string} voiceModel    – Stimm-Modell (z.B. 'de_DE-thorsten-medium')
 * @param {number} speed         – Sprechgeschwindigkeit (0.5=langsam, 1.0=normal, 1.5=schnell). Default: 0.8
 * @returns {Promise<string>}    – Pfad zur generierten WAV-Datei
 */
export async function generateVoiceover(text, voiceModel = 'de_DE-thorsten-medium', speed = 0.8) {
  // Prüfen ob Binary existiert
  if (!existsSync(PIPER_BINARY)) {
    throw new Error(
      'Piper TTS nicht gefunden unter ' + PIPER_BINARY + '. ' +
      'Installiere Piper: https://github.com/rhasspy/piper'
    );
  }

  // Prüfen ob Stimm-Modell existiert
  const voiceFile = join(PIPER_VOICES_DIR, voiceModel + '.onnx');
  if (!existsSync(voiceFile)) {
    throw new Error(
      'Stimm-Modell nicht gefunden: ' + voiceFile + '. ' +
      'Verfügbar: ' + Object.keys(AVAILABLE_VOICES).join(', ')
    );
  }

  // Temporäres Verzeichnis für die Ausgabe
  const tmpDir = mkdtempSync(join(os.tmpdir(), 'piper-'));
  const wavPath = join(tmpDir, 'voiceover.wav');

  return new Promise((resolve, reject) => {
    // Piper Prozess: Text -> raw PCM
    const piper = spawn(PIPER_BINARY, [
      '--model', voiceFile,
      '--output-raw',
    ]);

    // FFmpeg Prozess: raw PCM -> WAV (44100Hz, stereo), ggf. langsamer
    const ffmpegArgs = [
      '-f', 's16le',
      '-ar', '22050',
      '-ac', '1',
      '-i', 'pipe:0',
    ];
    // Geschwindigkeit anpassen (atempo ohne Pitch-Änderung)
    if (speed && speed !== 1.0) {
      ffmpegArgs.push('-filter:a', 'atempo=' + speed.toFixed(2));
    }
    ffmpegArgs.push('-ar', '44100', '-ac', '2', '-y', wavPath);

    const ffmpeg = spawn('/opt/bin/ffmpeg', ffmpegArgs);

    let stderrBuffer = '';

    // Piper stdout -> FFmpeg stdin
    piper.stdout.pipe(ffmpeg.stdin);

    // Fehler erfassen
    piper.stderr.on('data', function(chunk) {
      stderrBuffer += chunk.toString();
    });

    ffmpeg.stderr.on('data', function() {
      // FFmpeg schreibt viel auf stderr - ignorieren
    });

    // Text an Piper senden
    piper.stdin.write(text);
    piper.stdin.end();

    // Auf Fertigstellung warten
    ffmpeg.on('close', function(code) {
      if (code === 0) {
        resolve(wavPath);
      } else {
        const piperErr = stderrBuffer.slice(-200);
        reject(new Error('Piper TTS fehlgeschlagen (ffmpeg exit ' + code + '): ' + piperErr));
      }
    });

    piper.on('error', function(err) {
      reject(new Error('Piper Prozess-Fehler: ' + err.message));
    });

    ffmpeg.on('error', function(err) {
      reject(new Error('FFmpeg Prozess-Fehler: ' + err.message));
    });
  });
}

export default {
  generateVoiceover,
  isPiperAvailable,
  AVAILABLE_VOICES,
};