/**
 * edge.js — Microsoft Edge TTS Wrapper
 *
 * Nutzt Microsoft Edge's Online-TTS-Dienst (kostenlos, keine API-Keys).
 * Klingt natürlicher als Piper – echte Betonung, flüssige Sprache.
 *
 * Deutsche Stimmen:
 *   de-DE-SeraphinaMultilingualNeural  – weiblich, natürlich (⭐ empfohlen)
 *   de-DE-FlorianMultilingualNeural    – männlich
 *   de-DE-AmalaNeural                  – weiblich
 *   de-DE-KatjaNeural                  – weiblich
 *   de-DE-ConradNeural                 – männlich
 *
 * Standard: AUS — Nur wenn voiceoverEngine='edge' gesetzt ist.
 */

import fs, { mkdtempSync } from 'fs';
import path from 'path';
import os from 'os';

// ── Verfügbare Stimmen ────────────────────────────────────────────────────
export const AVAILABLE_VOICES = {
  'de-DE-SeraphinaMultilingualNeural': {
    name: 'Seraphina',
    gender: 'female',
    quality: 'high',
    language: 'de',
    desc: 'Weiblich, beste Qualitat',
  },
  'de-DE-FlorianMultilingualNeural': {
    name: 'Florian',
    gender: 'male',
    quality: 'high',
    language: 'de',
    desc: 'Männlich · klar und angenehm',
  },
  'de-DE-AmalaNeural': {
    name: 'Amala',
    gender: 'female',
    quality: 'medium',
    language: 'de',
    desc: 'Weiblich · freundlich',
  },
  'de-DE-KatjaNeural': {
    name: 'Katja',
    gender: 'female',
    quality: 'medium',
    language: 'de',
    desc: 'Weiblich · warme Stimme',
  },
  'de-DE-ConradNeural': {
    name: 'Conrad',
    gender: 'male',
    quality: 'medium',
    language: 'de',
    desc: 'Männlich · tiefe Stimme',
  },
};

const DEFAULT_VOICE = 'de-DE-SeraphinaMultilingualNeural';

/**
 * Prüft ob edge-tts Paket verfügbar ist.
 */
let edgeTtsAvailable = null;
export function isEdgeTtsAvailable() {
  return edgeTtsAvailable !== false; // wird erst bei Nutzung getestet
}

/**
 * Generiert eine Sprachaufnahme via Microsoft Edge TTS.
 *
 * @param {string} text      – Der Text der vorgelesen werden soll
 * @param {string} voiceModel – Stimm-Modell (z.B. 'de-DE-SeraphinaMultilingualNeural')
 * @param {number} speed     – Sprechgeschwindigkeit (0.5=langsam, 1.0=normal, 1.5=schnell). Default: 0.8
 * @returns {Promise<string>} – Pfad zur generierten MP3-Datei
 */
export async function generateEdgeVoiceover(text, voiceModel = DEFAULT_VOICE, speed = 0.8) {
  const ratePercent = Math.round((speed - 1.0) * 100);
  const rateStr = ratePercent >= 0 ? '+' + ratePercent + '%' : ratePercent + '%';
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'edge-tts-'));
  const outputPath = path.join(tmpDir, 'voiceover.mp3');

  try {
    // Verschiedene edge-tts Package-APIs versuchen
    let EdgeTTS;
    try {
      EdgeTTS = (await import('edge-tts')).EdgeTTS;
    } catch {
      try {
        EdgeTTS = (await import('node-edge-tts')).EdgeTTS;
      } catch {
        EdgeTTS = (await import('@travisvn/edge-tts')).EdgeTTS;
      }
    }

    // API Pattern 1: tts.ttsPromise(text, filePath)
    const tts = new EdgeTTS();
    if (typeof tts.ttsPromise === 'function') {
      await tts.ttsPromise(text, outputPath);
    }
    // API Pattern 2: tts.toFile(filePath, text)
    else if (typeof tts.toFile === 'function') {
      await tts.toFile(outputPath, text);
    }
    // API Pattern 3: new EdgeTTS(text, voice, opts).synthesize()
    else {
      // @travisvn/edge-tts style or universal
      const instance = new EdgeTTS(text, voiceModel, { rate: rateStr });
      const result = await instance.synthesize();
      const audioBuffer = Buffer.from(await result.audio.arrayBuffer());
      fs.writeFileSync(outputPath, audioBuffer);
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error('Keine Ausgabedatei erzeugt');
    }

    const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(0);
    console.log(`[EdgeTTS] ✅ Voiceover (${sizeKB}KB, ${rateStr}): "${text.slice(0, 40)}..."`);
    return outputPath;

  } catch (err) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    throw new Error('Edge TTS: ' + (err.message || err));
  }
}

export default {
  generateEdgeVoiceover,
  isEdgeTtsAvailable,
  AVAILABLE_VOICES,
};