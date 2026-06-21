/**
 * edge.js — Microsoft Edge TTS Wrapper
 *
 * Ersetzt Piper TTS durch Edge TTS (natürlichere Stimmen, kein API-Key).
 * Nutzt das NPM-Paket 'edge-tts' (Node.js-Port von Microsoft Edge TTS).
 *
 * 🔥 WICHTIG: KEIN statischer Import! Nur dynamisches import() innerhalb der Funktion.
 * Dadurch wird der Modul-Import von render.js nicht zerstört, falls edge-tts
 * mal wieder Probleme macht.
 *
 * Verfügbare deutsche Stimmen (Edge):
 *   de-DE-SeraphinaMultilingualNeural  – weiblich, beste Qualität ⭐
 *   de-DE-FlorianMultilingualNeural    – männlich, klar
 *   de-DE-AmalaNeural                  – weiblich, freundlich
 *   de-DE-KatjaNeural                  – weiblich, modern
 *   de-DE-ConradNeural                 – männlich, tief
 *
 * Standard: AUS — Nur wenn voiceoverText explizit übergeben wird + voiceoverEngine='edge'.
 *
 * Aufruf:      generateEdgeVoiceover(text, 'de-DE-SeraphinaMultilingualNeural', 0.8)
 * Ergebnis:    /tmp/edge-XXXXXX/voiceover.mp3
 */

import { mkdtempSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';

// ── Verfügbare Edge-Stimmen (deutsch) ──────────────────────────────────
export const AVAILABLE_EDGE_VOICES = {
  'de-DE-SeraphinaMultilingualNeural': {
    name: 'Seraphina',
    gender: 'female',
    quality: 'high',
    language: 'de',
    description: 'Beste Qualität, weiblich',
  },
  'de-DE-FlorianMultilingualNeural': {
    name: 'Florian',
    gender: 'male',
    quality: 'high',
    language: 'de',
    description: 'Klar, männlich',
  },
  'de-DE-AmalaNeural': {
    name: 'Amala',
    gender: 'female',
    quality: 'high',
    language: 'de',
    description: 'Freundlich, weiblich',
  },
  'de-DE-KatjaNeural': {
    name: 'Katja',
    gender: 'female',
    quality: 'high',
    language: 'de',
    description: 'Modern, weiblich',
  },
  'de-DE-ConradNeural': {
    name: 'Conrad',
    gender: 'male',
    quality: 'high',
    language: 'de',
    description: 'Tief, männlich',
  },
};

// ── Hilfsfunktion: Stimme auf Gültigkeit prüfen ────────────────────────
export function isValidEdgeVoice(voiceModel) {
  return !!AVAILABLE_EDGE_VOICES[voiceModel];
}

/**
 * Prüft ob das edge-tts Paket verfügbar und importierbar ist.
 * Nutzt dynamischen import() – zerstört NICHT den render.js Import.
 *
 * @returns {Promise<boolean>}
 */
export async function isEdgeTtsAvailable() {
  try {
    // Dynamischer Import – schlägt fehl wenn Paket nicht installiert
    const edgeModule = await import('edge-tts');
    return !!(edgeModule.EdgeTTS || edgeModule.default?.EdgeTTS);
  } catch (err) {
    console.warn('[EdgeTTS] Paket nicht verfügbar:', err.message);
    return false;
  }
}

/**
 * Generiert eine Sprachaufnahme aus Text via Microsoft Edge TTS.
 *
 * 🔥 Dynamischer Import von 'edge-tts' – zerstört NICHT den render.js Import.
 *
 * @param {string} text          – Der Text der vorgelesen werden soll
 * @param {string} voiceModel    – Stimm-Modell (z.B. 'de-DE-SeraphinaMultilingualNeural')
 * @param {number} speed         – Sprechgeschwindigkeit (0.5=langsam, 1.0=normal, 1.5=schnell). Default: 0.8
 * @returns {Promise<string>}    – Pfad zur generierten MP3-Datei
 */
export async function generateEdgeVoiceover(text, voiceModel = 'de-DE-SeraphinaMultilingualNeural', speed = 0.8) {
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
  // Zerstört NICHT den render.js Import, weil dieser import erst
  // beim Funktionsaufruf ausgeführt wird, nicht beim Laden der Datei.
  let EdgeTTS;
  try {
    const edgeModule = await import('edge-tts');
    EdgeTTS = edgeModule.EdgeTTS;
  } catch (importErr) {
    throw new Error(
      'edge-tts Paket konnte nicht geladen werden: ' + importErr.message + '. ' +
      'Installiere: npm install edge-tts'
    );
  }

  if (!EdgeTTS) {
    throw new Error('EdgeTTS-Klasse nicht gefunden im edge-tts Paket');
  }

  // Geschwindigkeit in Prozent umrechnen (edge-tts erwartet +X% oder -X%)
  // 1.0 = 0%, 0.8 = -20%, 1.2 = +20%
  const ratePercent = Math.round((speed - 1.0) * 100);
  const rateStr = ratePercent >= 0 ? '+' + ratePercent + '%' : ratePercent + '%';

  console.log(`[EdgeTTS] Generiere: "${text.slice(0, 60)}..." (${voiceModel}, rate=${rateStr})`);

  try {
    const tts = new EdgeTTS();
    const result = await tts.synthesize(text, {
      voice: voiceModel,
      rate: rateStr,
      pitch: '+0Hz',
      output: mp3Path,
    });

    // Prüfen ob Datei erstellt wurde
    if (!existsSync(mp3Path)) {
      throw new Error('Keine Ausgabedatei erstellt (unbekannter Fehler)');
    }

    const sizeKB = (await import('fs')).statSync(mp3Path).size / 1024;
    console.log(`[EdgeTTS] ✅ MP3 generiert: ${mp3Path} (${sizeKB.toFixed(0)}KB)`);

    return mp3Path;
  } catch (synthErr) {
    // Aufräumen falls Datei doch existiert
    try {
      if (existsSync(mp3Path)) {
        await import('fs/promises').then(f => f.rm(mp3Path, { force: true }));
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