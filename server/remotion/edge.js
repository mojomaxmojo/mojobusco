/**
 * edge.js — Microsoft Edge TTS Wrapper
 *
 * Ersetzt Piper TTS durch Edge TTS (natürlichere Stimmen, kein API-Key).
 * Nutzt das NPM-Paket 'node-edge-tts' (Node.js-kompatibel, MIT).
 *
 * 🔥 WICHTIG: KEIN statischer Import! Nur dynamisches import() innerhalb der Funktion.
 * Dadurch wird der Modul-Import von render.js nicht zerstört, falls node-edge-tts
 * mal wieder Probleme macht.
 *
 * ⚠️ "MultilingualNeural"-Stimmen (Seraphina, Florian) erkennen pro Wort/Phrase
 * automatisch die Sprache und wechseln dann auf englische/andere Aussprache
 * ("denglisch"). Das führt bei Fremdwörtern (z.B. "Camping", "Roadtrip") und
 * manchmal sogar bei Umlauten zu falscher Betonung. Klassische, rein deutsche
 * Neural-Stimmen (ohne "Multilingual" im Namen) bleiben konsequent bei
 * deutscher Phonetik – deshalb ist Katja der neue Standard.
 *
 * Verfügbare deutsche Stimmen (Edge):
 *   de-DE-KatjaNeural                  – weiblich, klar, rein Deutsch ⭐ (Standard)
 *   de-DE-ConradNeural                 – männlich, tief, rein Deutsch
 *   de-DE-AmalaNeural                  – weiblich, freundlich, rein Deutsch
 *   de-DE-KillianNeural                – männlich, jung, rein Deutsch
 *   de-DE-GiselaNeural                 – weiblich, sanft, rein Deutsch
 *   de-DE-BerndNeural                  – männlich, ruhig, rein Deutsch
 *   de-DE-ElkeNeural                   – weiblich, warm, rein Deutsch
 *   de-DE-RalfNeural                   – männlich, sachlich, rein Deutsch
 *   de-DE-TanjaNeural                  – weiblich, energisch, rein Deutsch
 *   de-DE-SeraphinaMultilingualNeural  – weiblich, sehr natürlich, ⚠️ kann denglisch klingen
 *   de-DE-FlorianMultilingualNeural    – männlich, sehr natürlich, ⚠️ kann denglisch klingen
 *
 * Standard: AUS — Nur wenn voiceoverText explizit übergeben wird + voiceoverEngine='edge'.
 *
 * Aufruf:      generateEdgeVoiceover(text, 'de-DE-KatjaNeural', 0.8)
 * Ergebnis:    /tmp/edge-XXXXXX/voiceover.mp3
 */

import { mkdtempSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

// ── Verfügbare Edge-Stimmen (deutsch) ──────────────────────────────────
// Klassische (nicht-multilinguale) Stimmen zuerst – konsequent deutsche
// Aussprache, kein "Denglisch" bei Fremdwörtern, stabilere Umlaute.
export const AVAILABLE_EDGE_VOICES = {
  'de-DE-KatjaNeural': {
    name: 'Katja',
    gender: 'female',
    quality: 'high',
    language: 'de',
    multilingual: false,
    description: 'Klar, weiblich, rein Deutsch ⭐ Standard',
  },
  'de-DE-ConradNeural': {
    name: 'Conrad',
    gender: 'male',
    quality: 'high',
    language: 'de',
    multilingual: false,
    description: 'Tief, männlich, rein Deutsch',
  },
  'de-DE-AmalaNeural': {
    name: 'Amala',
    gender: 'female',
    quality: 'high',
    language: 'de',
    multilingual: false,
    description: 'Freundlich, weiblich, rein Deutsch',
  },
  'de-DE-KillianNeural': {
    name: 'Killian',
    gender: 'male',
    quality: 'high',
    language: 'de',
    multilingual: false,
    description: 'Jung, männlich, rein Deutsch',
  },
  'de-DE-GiselaNeural': {
    name: 'Gisela',
    gender: 'female',
    quality: 'high',
    language: 'de',
    multilingual: false,
    description: 'Sanft, weiblich, rein Deutsch',
  },
  'de-DE-BerndNeural': {
    name: 'Bernd',
    gender: 'male',
    quality: 'high',
    language: 'de',
    multilingual: false,
    description: 'Ruhig, männlich, rein Deutsch',
  },
  'de-DE-ElkeNeural': {
    name: 'Elke',
    gender: 'female',
    quality: 'high',
    language: 'de',
    multilingual: false,
    description: 'Warm, weiblich, rein Deutsch',
  },
  'de-DE-RalfNeural': {
    name: 'Ralf',
    gender: 'male',
    quality: 'high',
    language: 'de',
    multilingual: false,
    description: 'Sachlich, männlich, rein Deutsch',
  },
  'de-DE-TanjaNeural': {
    name: 'Tanja',
    gender: 'female',
    quality: 'high',
    language: 'de',
    multilingual: false,
    description: 'Energisch, weiblich, rein Deutsch',
  },
  // Multilingual-Stimmen: beste Klangqualität, aber können Fremdwörter
  // englisch aussprechen ("denglisch") und gelegentlich Umlaute verhauen.
  'de-DE-SeraphinaMultilingualNeural': {
    name: 'Seraphina',
    gender: 'female',
    quality: 'high',
    language: 'de',
    multilingual: true,
    description: 'Sehr natürlich, weiblich (kann denglisch klingen)',
  },
  'de-DE-FlorianMultilingualNeural': {
    name: 'Florian',
    gender: 'male',
    quality: 'high',
    language: 'de',
    multilingual: true,
    description: 'Sehr natürlich, männlich (kann denglisch klingen)',
  },
};

// ── Hilfsfunktion: Stimme auf Gültigkeit prüfen ────────────────────────
export function isValidEdgeVoice(voiceModel) {
  return !!AVAILABLE_EDGE_VOICES[voiceModel];
}

/**
 * Prüft ob das node-edge-tts Paket verfügbar und importierbar ist.
 * Nutzt dynamischen import() – zerstört NICHT den render.js Import.
 *
 * @returns {Promise<boolean>}
 */
export async function isEdgeTtsAvailable() {
  try {
    const edgeModule = await import('node-edge-tts');
    return !!(edgeModule.EdgeTTS);
  } catch (err) {
    console.warn('[EdgeTTS] node-edge-tts Paket nicht verfügbar:', err.message);
    return false;
  }
}

/**
 * Generiert eine Sprachaufnahme aus Text via Microsoft Edge TTS.
 *
 * Nutzt 'node-edge-tts' (Node.js-kompatibler Fork, MIT-Lizenz).
 * 🔥 Dynamischer Import – zerstört NICHT den render.js Import.
 *
 * @param {string} text          – Der Text der vorgelesen werden soll
 * @param {string} voiceModel    – Stimm-Modell (z.B. 'de-DE-SeraphinaMultilingualNeural')
 * @param {number} speed         – Sprechgeschwindigkeit (0.5=langsam, 1.0=normal, 1.5=schnell). Default: 0.8
 * @returns {Promise<string>}    – Pfad zur generierten MP3-Datei
 */
export async function generateEdgeVoiceover(text, voiceModel = 'de-DE-KatjaNeural', speed = 0.8) {
  // Stimme validieren
  if (!isValidEdgeVoice(voiceModel)) {
    const available = Object.keys(AVAILABLE_EDGE_VOICES).join(', ');
    throw new Error(
      'Edge-Stimme nicht gefunden: ' + voiceModel + '. ' +
      'Verfügbar: ' + available
    );
  }

  // Temporäres Verzeichnis für die Ausgabe
  const tmpDir = mkdtempSync(join(os.tmpdir(), 'edge-'));
  const mp3Path = join(tmpDir, 'voiceover.mp3');

  // 🔥 Dynamischer Import – nur hier, in der Funktion!
  let EdgeTTS;
  try {
    const edgeModule = await import('node-edge-tts');
    EdgeTTS = edgeModule.EdgeTTS;
  } catch (importErr) {
    throw new Error(
      'node-edge-tts Paket konnte nicht geladen werden: ' + importErr.message + '. ' +
      'Installiere: npm install node-edge-tts'
    );
  }

  if (!EdgeTTS) {
    throw new Error('EdgeTTS-Klasse nicht gefunden im node-edge-tts Paket');
  }

  console.log(`[EdgeTTS] Generiere: "${text.slice(0, 60)}..." (${voiceModel}, speed=${speed})`);

  try {
    // node-edge-tts: Konstruktor mit Optionen, dann ttsPromise(text, outputPath)
    // rate: Prozent-String ('+0%' = normal, '-20%' = langsamer, '+20%' = schneller)
    const ratePercent = Math.round((speed - 1.0) * 100);
    const rateStr = ratePercent >= 0 ? '+' + ratePercent + '%' : ratePercent + '%';

    const tts = new EdgeTTS({
      voice: voiceModel,
      lang: 'de-DE',
      outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
      rate: rateStr,
      pitch: 'default',
      volume: 'default',
      timeout: 60000,
    });

    await tts.ttsPromise(text, mp3Path);

    // Prüfen ob Datei erstellt wurde
    if (!existsSync(mp3Path)) {
      throw new Error('Keine Ausgabedatei erstellt (unbekannter Fehler)');
    }

    const stats = await import('fs').then(f => f.statSync(mp3Path));
    const sizeKB = stats.size / 1024;

    if (sizeKB < 1) {
      throw new Error('Ausgabedatei zu klein (' + sizeKB.toFixed(1) + 'KB)');
    }

    console.log(`[EdgeTTS] ✅ MP3 generiert: ${mp3Path} (${sizeKB.toFixed(0)}KB)`);

    return mp3Path;
  } catch (synthErr) {
    // Aufräumen falls Datei doch existiert
    try {
      if (existsSync(mp3Path)) {
        const rm = await import('fs/promises').then(m => m.rm);
        await rm(mp3Path, { force: true });
      }
    } catch (_) {}
    throw new Error('Edge TTS Synthese fehlgeschlagen: ' + synthErr.message);
  }
}

export default {
  generateEdgeVoiceover,
  isEdgeTtsAvailable,
  isValidEdgeVoice,
  AVAILABLE_EDGE_VOICES,
};