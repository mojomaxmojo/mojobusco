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

import fs from 'fs';
import path from 'path';
import os from 'os';
import { mkdtempSync } from 'fs';

// ── Verfügbare Stimmen ────────────────────────────────────────────────────
export const AVAILABLE_VOICES = {
  'de-DE-SeraphinaMultilingualNeural': {
    name: 'Seraphina',
    gender: 'female',
    quality: 'high',
    language: 'de',
    desc: 'Weiblich · natürlichste deutsche Stimme ⭐',
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
  if (edgeTtsAvailable !== null) return edgeTtsAvailable;
  try {
    // Dynamischer Import um Fehler beim Start zu vermeiden
    import.resolve('edge-tts');
    edgeTtsAvailable = true;
  } catch {
    edgeTtsAvailable = false;
  }
  return edgeTtsAvailable;
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
  // Tempo in Edge-Format: '+XX%' oder '-XX%'
  const ratePercent = Math.round((speed - 1.0) * 100);
  const rateStr = ratePercent >= 0 ? '+' + ratePercent + '%' : ratePercent + '%';

  // Temporäres Verzeichnis
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'edge-tts-'));
  const outputPath = path.join(tmpDir, 'voiceover.mp3');

  try {
    // edge-tts Paket dynamisch laden
    const { EdgeTTS } = await import('edge-tts');

    const tts = new EdgeTTS({
      voice: voiceModel,
      lang: 'de-DE',
      rate: rateStr,
      outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
    });

    await tts.ttsPromise(text, outputPath).catch(async () => {
      // Fallback: toFile API versuchen
      // Einige edge-tts Versionen nutzen andere API
      await tts.toFile(outputPath, text).catch(() => {
        throw new Error('Edge TTS API nicht kompatibel');
      });
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error('Edge TTS hat keine Datei erzeugt');
    }

    const sizeKB = (fs.statSync(outputPath).size / 1024).toFixed(0);
    console.log(`[EdgeTTS] ✅ Voiceover: ${path.basename(outputPath)} (${sizeKB}KB, ${rateStr})`);
    return outputPath;

  } catch (err) {
    // Aufräumen
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    throw new Error('Edge TTS fehlgeschlagen: ' + (err.message || err));
  }
}

export default {
  generateEdgeVoiceover,
  isEdgeTtsAvailable,
  AVAILABLE_VOICES,
};