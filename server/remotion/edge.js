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
 * Seraphina (Multilingual) ist Standard – klingt am natürlichsten von allen
 * verfügbaren Stimmen. Hinweis: "MultilingualNeural"-Stimmen erkennen pro
 * Wort/Phrase automatisch die Sprache und können bei Fremdwörtern
 * (z.B. "Camping", "Roadtrip") gelegentlich englisch aussprechen
 * ("denglisch") bzw. Umlaute leicht anders betonen. Falls das störend
 * auffällt, stehen klassische, rein deutsche Neural-Stimmen als
 * Alternative zur Verfügung.
 *
 * Verfügbare deutsche Stimmen (Edge):
 *   de-DE-SeraphinaMultilingualNeural  – weiblich, beste Qualität ⭐ (Standard)
 *   de-DE-FlorianMultilingualNeural    – männlich, sehr natürlich
 *   de-DE-KatjaNeural                  – weiblich, klar, rein Deutsch
 *   de-DE-ConradNeural                 – männlich, tief, rein Deutsch
 *   de-DE-AmalaNeural                  – weiblich, freundlich, rein Deutsch
 *   de-DE-KillianNeural                – männlich, jung, rein Deutsch
 *   de-DE-GiselaNeural                 – weiblich, sanft, rein Deutsch
 *   de-DE-BerndNeural                  – männlich, ruhig, rein Deutsch
 *   de-DE-ElkeNeural                   – weiblich, warm, rein Deutsch
 *   de-DE-RalfNeural                   – männlich, sachlich, rein Deutsch
 *   de-DE-TanjaNeural                  – weiblich, energisch, rein Deutsch
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
// Multilingual-Stimmen zuerst – beste, natürlichste Klangqualität.
// Klassische Stimmen darunter als Alternative (rein deutsche Aussprache).
export const AVAILABLE_EDGE_VOICES = {
  'de-DE-SeraphinaMultilingualNeural': {
    name: 'Seraphina',
    gender: 'female',
    quality: 'high',
    language: 'de',
    multilingual: true,
    description: 'Beste Qualität, weiblich ⭐ Standard',
  },
  'de-DE-FlorianMultilingualNeural': {
    name: 'Florian',
    gender: 'male',
    quality: 'high',
    language: 'de',
    multilingual: true,
    description: 'Sehr natürlich, männlich',
  },
  'de-DE-KatjaNeural': {
    name: 'Katja',
    gender: 'female',
    quality: 'high',
    language: 'de',
    multilingual: false,
    description: 'Klar, weiblich, rein Deutsch',
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
};

// ── Hilfsfunktion: Stimme auf Gültigkeit prüfen ────────────────────────
export function isValidEdgeVoice(voiceModel) {
  return !!AVAILABLE_EDGE_VOICES[voiceModel];
}

/**
 * Bereinigt Text für die TTS-Synthese:
 * - NFC-Normalisierung (Stufe 2)
 * - Em-Dash → En-Dash (konsistent)
 * - Geschützte Leerzeichen → normale Leerzeichen
 * - Hero-Markup-Reste (**fett**) entfernen (Sicherheitsnetz)
 * - Trim
 */
function normalizeTextForTTS(text) {
  return text
    .normalize('NFC')
    .replace(/\u2014/g, '\u2013')      // em dash (—) → en dash (–)
    .replace(/\u00A0/g, ' ')           // non-breaking space → normal space
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **hero** → hero (Sicherheitsnetz)
    .trim();
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

  const cleanText = normalizeTextForTTS(text);

  console.log(`[EdgeTTS] Generiere: "${cleanText.slice(0, 60)}..." (${voiceModel}, speed=${speed})`);

  // ── Diagnose-Logging (nur mit TTS_DEBUG=1) ──────────────────────────
  if (process.env.TTS_DEBUG === '1') {
    const buf = Buffer.from(cleanText, 'utf8');
    console.log('[EdgeTTS] UTF-8 Bytes (erste 100):', buf.slice(0, 100).toString('hex'));
    console.log('[EdgeTTS] Codepoints:', [...cleanText.slice(0, 30)].map(c => c.codePointAt(0).toString(16)));
    console.log('[EdgeTTS] NFC-normalisiert:', cleanText.normalize('NFC') === cleanText);
    console.log('[EdgeTTS] Länge original:', text.length, 'Länge clean:', cleanText.length);
  }

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

    await tts.ttsPromise(cleanText, mp3Path);

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
  normalizeTextForTTS,
  AVAILABLE_EDGE_VOICES,
};