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

// Cache für Health-Check-Ergebnis (60s gültig)
let healthCache = { available: null, timestamp: 0 };
const HEALTH_CACHE_TTL_MS = 60000;

/**
 * Prüft ob das node-edge-tts Paket verfügbar und importierbar ist.
 * Führt optional einen echten Health-Check (1-Wort-Synthese) durch.
 * Nutzt dynamischen import() – zerstört NICHT den render.js Import.
 *
 * @param {boolean} quickCheck – true (Default): nur Import-Check. false: echter Health-Check mit Cache.
 * @returns {Promise<boolean>}
 */
export async function isEdgeTtsAvailable(quickCheck = true) {
  try {
    const edgeModule = await import('node-edge-tts');
    if (!edgeModule.EdgeTTS) return false;

    // Nur Import-Check, wenn quickCheck=true (Standard)
    if (quickCheck) return true;

    // ── Echter Health-Check ────────────────────────────────────────────
    // Cache prüfen
    const now = Date.now();
    if (healthCache.available !== null && (now - healthCache.timestamp) < HEALTH_CACHE_TTL_MS) {
      return healthCache.available;
    }

    // Mini-Test: 1-Wort-Synthese mit kurzem Timeout
    const { EdgeTTS } = edgeModule;
    const { mkdtempSync, existsSync } = await import('fs');
    const { join } = await import('path');
    const os = await import('os');
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'edge-health-'));
    const testPath = join(tmpDir, 'test.mp3');

    try {
      const tts = new EdgeTTS({
        voice: 'de-DE-SeraphinaMultilingualNeural',
        lang: 'de-DE',
        timeout: 5000,
        outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
        rate: '+0%',
        pitch: 'default',
        volume: 'default',
      });
      await tts.ttsPromise('Test', testPath);
      const ok = existsSync(testPath);

      healthCache = { available: ok, timestamp: Date.now() };

      try {
        const { rm } = await import('fs/promises');
        await rm(tmpDir, { recursive: true, force: true });
      } catch {}

      return ok;
    } catch (err) {
      healthCache = { available: false, timestamp: Date.now() };
      console.warn('[EdgeTTS] Health-Check fehlgeschlagen:', err.message);
      try {
        const { rm } = await import('fs/promises');
        await rm(tmpDir, { recursive: true, force: true });
      } catch {}
      return false;
    }
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

  // Text normalisieren (Stufe 2+3)
  const cleanText = normalizeTextForTTS(text);

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

  console.log(`[EdgeTTS] Generiere: "${cleanText.slice(0, 60)}..." (${voiceModel}, speed=${speed})`);

  // ── Diagnose-Logging (Stufe 5) ────────────────────────────────────────
  if (process.env.TTS_DEBUG === '1') {
    const buf = Buffer.from(cleanText, 'utf8');
    console.log('[EdgeTTS] UTF-8 Bytes (erste 100):', buf.slice(0, 100).toString('hex'));
    console.log('[EdgeTTS] Codepoints:', [...cleanText.slice(0, 30)].map(c => c.codePointAt(0).toString(16)));
    console.log('[EdgeTTS] NFC-normalisiert:', cleanText.normalize('NFC') === cleanText);
    console.log('[EdgeTTS] Länge original:', text.length, 'Länge clean:', cleanText.length);
  }

  // ── Retry-Logik (Stufe 7 + 7b) ────────────────────────────────────────
  const MAX_RETRIES = 2;
  const RETRY_DELAY_MS = 1000;
  const TIMEOUT_MS = 30000;        // ← Stufe 7b: 60000 → 30000

  const ratePercent = Math.round((speed - 1.0) * 100);
  const rateStr = ratePercent >= 0 ? '+' + ratePercent + '%' : ratePercent + '%';

  let lastErr;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const tts = new EdgeTTS({
        voice: voiceModel,
        lang: 'de-DE',
        outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
        rate: rateStr,
        pitch: 'default',
        volume: 'default',
        timeout: TIMEOUT_MS,
      });

      await tts.ttsPromise(cleanText, mp3Path);

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

    } catch (err) {
      lastErr = err;
      console.warn(`[EdgeTTS] ⚠️ Versuch ${attempt}/${MAX_RETRIES} fehlgeschlagen: ${err.message}`);

      // Aufräumen falls Datei doch existiert
      try {
        if (existsSync(mp3Path)) {
          const rm = await import('fs/promises').then(m => m.rm);
          await rm(mp3Path, { force: true });
        }
      } catch (_) {}

      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * attempt; // 1s, dann 2s
        console.log(`[EdgeTTS] ⏳ Nächster Versuch in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw new Error('Edge TTS Synthese fehlgeschlagen nach ' + MAX_RETRIES + ' Versuchen: ' + lastErr.message);
}

export default {
  generateEdgeVoiceover,
  isEdgeTtsAvailable,
  isValidEdgeVoice,
  normalizeTextForTTS,
  AVAILABLE_EDGE_VOICES,
};