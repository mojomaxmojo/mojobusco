/**
 * audioNormalize.js – Zwei-Pass ffmpeg-loudnorm Audio-Normalisierung
 *
 * Normalisiert die Lautstärke eines fertig gerenderten MP4-Videos auf
 * −14,5 LUFS integrated / −1 dBTP True Peak (konfigurierbar über src/config/audio.js).
 *
 * Ablauf:
 *   1️⃣ measureLoudness()  – Pass 1: Analyse der aktuellen Loudness (ffmpeg loudnorm print_format=json)
 *   2️⃣ applyLoudnorm()    – Pass 2: Anwenden der Normalisierung (ffmpeg loudnorm mit measured_Werten)
 *   3️⃣ normalizeRenderedVideo() – Orchestrierung mit Timeout + Fallback
 *
 * Wichtig:
 *   - Video-Stream wird NICHT neu encodiert (`-c:v copy`) → keine Qualitätsverluste
 *   - Beide ffmpeg-Pfade werden von render.js übergeben (kein eigenes Binary-Discovery)
 *   - Bei Fehlern wird das Originalvideo unverändert gelassen (graceful degradation)
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  AUDIO_LOUDNESS_CONFIG,
  LOUDNESS_TARGET_I,
  LOUDNESS_TARGET_TP,
  LOUDNESS_TARGET_LRA,
  LOUDNESS_OUTPUT_SAMPLE_RATE,
  LOUDNESS_OUTPUT_AUDIO_CODEC,
  LOUDNESS_OUTPUT_AUDIO_BITRATE_KBPS,
  LOUDNESS_PASS_TIMEOUT_MS_PER_SEC,
} from '../../src/config/audio.js';

// ── Pass 1: Loudness messen ──────────────────────────────────────────────

/**
 * Führt den ersten ffmpeg-loudnorm-Pass durch (Analyse ohne Output).
 *
 * @param {string} inputPath – Pfad zur MP4-Datei
 * @param {string} ffmpegPath – Pfad zum ffmpeg-Binary
 * @param {object} targetConfig – Loudness-Zielwerte (optional, default aus config)
 * @returns {Promise<{measured_I: number, measured_TP: number, measured_LRA: number, measured_thresh: number, offset: number}>}
 */
export function measureLoudness(inputPath, ffmpegPath, targetConfig) {
  return new Promise((resolve, reject) => {
    const cfg = targetConfig || AUDIO_LOUDNESS_CONFIG;
    const args = [
      '-i', inputPath,
      '-af', `loudnorm=I=${cfg.targetI}:TP=${cfg.targetTP}:LRA=${cfg.targetLRA}:print_format=json`,
      '-f', 'null',
      '-',
    ];

    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg loudnorm-Pass 1 exit code ${code}`));
      }

      // loudnorm schreibt das JSON als letzten Block nach stderr
      const jsonMatch = stderr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return reject(new Error('Konnte loudnorm-JSON in stderr nicht finden'));
      }

      try {
        const parsed = JSON.parse(jsonMatch[0]);
        resolve({
          measured_I: parseFloat(parsed.input_i) || 0,
          measured_TP: parseFloat(parsed.input_tp) || 0,
          measured_LRA: parseFloat(parsed.input_lra) || 0,
          measured_thresh: parseFloat(parsed.input_thresh) || 0,
          offset: parseFloat(parsed.target_offset) || 0,
        });
      } catch (err) {
        reject(new Error(`loudnorm-JSON-Parse fehlgeschlagen: ${err.message}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`ffmpeg konnte nicht gestartet werden: ${err.message}`));
    });
  });
}

// ── Pass 2: Loudness normalisieren ───────────────────────────────────────

/**
 * Wendet die gemessenen Werte aus Pass 1 im zweiten Pass an (eigentliche Normalisierung).
 *
 * @param {string} inputPath – Pfad zur MP4-Datei
 * @param {string} outputPath – Pfad für die normalisierte Ausgabe
 * @param {object} measured – Gemessene Werte aus measureLoudness()
 * @param {string} ffmpegPath – Pfad zum ffmpeg-Binary
 * @param {object} targetConfig – Loudness-Zielwerte (optional, default aus config)
 * @returns {Promise<void>}
 */
export function applyLoudnorm(inputPath, outputPath, measured, ffmpegPath, targetConfig) {
  return new Promise((resolve, reject) => {
    const cfg = targetConfig || AUDIO_LOUDNESS_CONFIG;

    const loudnormFilter = [
      `loudnorm=I=${cfg.targetI}`,
      `TP=${cfg.targetTP}`,
      `LRA=${cfg.targetLRA}`,
      `measured_I=${measured.measured_I}`,
      `measured_TP=${measured.measured_TP}`,
      `measured_LRA=${measured.measured_LRA}`,
      `measured_thresh=${measured.measured_thresh}`,
      `offset=${measured.offset}`,
      'linear=true',
      'print_format=summary',
    ].join(':');

    const args = [
      '-y',
      '-i', inputPath,
      '-c:v', 'copy',                          // ← Video bit-identisch kopieren
      '-af', loudnormFilter,
      '-ar', String(cfg.outputSampleRate),
      '-c:a', cfg.outputAudioCodec,
      '-b:a', `${cfg.outputAudioBitrateKbps}k`,
      '-movflags', '+faststart',               // ← Metadaten an den Dateianfang (Streaming)
      outputPath,
    ];

    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        // Bei Fehler: stderr für Debugging loggen
        const errorLines = stderr.split('\n').filter(l => l.includes('Error') || l.includes('error')).slice(-5).join('; ');
        return reject(new Error(`ffmpeg loudnorm-Pass 2 exit code ${code}: ${errorLines}`));
      }

      // Bei linear=true und drohenden True-Peak-Überschreitungen wechselt ffmpeg
      // automatisch auf dynamische Normalisierung – das ist normales Verhalten.
      if (stderr.includes('linear')) {
        const linearInfo = stderr.split('\n').filter(l => l.includes('linear')).join('; ');
        if (linearInfo) console.log(`[Remotion] 🔊 loudnorm linear-Hinweis: ${linearInfo}`);
      }

      resolve();
    });

    proc.on('error', (err) => {
      reject(new Error(`ffmpeg konnte nicht gestartet werden: ${err.message}`));
    });
  });
}

// ── Orchestrierung: Beide Pässe mit Timeout + Fallback ──────────────────

/**
 * Normalisiert ein fertig gerendertes Video auf die Ziel-Loudness.
 *
 * @param {string} outputPath – Pfad zum fertigen MP4
 * @param {string} sessionDir – Temporäres Session-Verzeichnis (für normalized.mp4)
 * @param {string} ffmpegPath – Pfad zum ffmpeg-Binary
 * @param {string} ffprobePath – Pfad zum ffprobe-Binary (aktuell ungenutzt, für Erweiterungen)
 * @param {number} videoDurationSec – Dauer des Videos in Sekunden
 * @returns {Promise<{normalized: boolean, targetI: number, targetTP: number, measuredI?: number, measuredTP?: number, reason?: string}>}
 */
export async function normalizeRenderedVideo(outputPath, sessionDir, ffmpegPath, ffprobePath, videoDurationSec) {
  const timeoutMs = Math.max(30000, videoDurationSec * LOUDNESS_PASS_TIMEOUT_MS_PER_SEC);
  const tempPath = path.join(sessionDir, 'normalized.mp4');
  const cfg = AUDIO_LOUDNESS_CONFIG;

  console.log(`[Remotion] 🔊 Starte Loudness-Normalisierung (Ziel: ${cfg.targetI} LUFS / ${cfg.targetTP} dBTP, ${videoDurationSec}s, Timeout ${(timeoutMs / 1000).toFixed(0)}s)`);

  try {
    // ── Pass 1: Messen ──────────────────────────────────────────────────
    const measured = await withTimeout(
      measureLoudness(outputPath, ffmpegPath, cfg),
      timeoutMs,
      'loudnorm-Pass 1 (Messung)'
    );

    console.log(`[Remotion] 🔊 Gemessen: I=${measured.measured_I.toFixed(2)} LUFS, TP=${measured.measured_TP.toFixed(2)} dBTP, LRA=${measured.measured_LRA.toFixed(1)}, offset=${measured.offset.toFixed(2)}`);

    // Falls bereits im Zielbereich: überspringen
    if (measured.measured_I >= -15 && measured.measured_I <= -14 && measured.measured_TP <= -0.5) {
      console.log(`[Remotion] 🔊 Bereits im Zielbereich (${measured.measured_I.toFixed(1)} LUFS) – Überspringe Normalisierung`);
      return {
        normalized: false,
        targetI: cfg.targetI,
        targetTP: cfg.targetTP,
        measuredI: measured.measured_I,
        measuredTP: measured.measured_TP,
        reason: 'bereits im Zielbereich',
      };
    }

    // ── Pass 2: Normalisieren ───────────────────────────────────────────
    await withTimeout(
      applyLoudnorm(outputPath, tempPath, measured, ffmpegPath, cfg),
      timeoutMs,
      'loudnorm-Pass 2 (Normalisierung)'
    );

    // Prüfen ob Temp-Datei existiert und nicht leer ist
    if (!fs.existsSync(tempPath) || fs.statSync(tempPath).size === 0) {
      throw new Error('Normalisierte Ausgabedatei ist leer oder nicht vorhanden');
    }

    // Original durch normalisierte Version ersetzen
    fs.renameSync(tempPath, outputPath);

    // Dateigröße nach Normalisierung loggen
    const newSizeMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
    console.log(`[Remotion] ✅ Loudness normalisiert: ${newSizeMB}MB, ${cfg.targetI} LUFS / ${cfg.targetTP} dBTP (gemessen: ${measured.measured_I.toFixed(1)} → ${cfg.targetI} LUFS)`);

    return {
      normalized: true,
      targetI: cfg.targetI,
      targetTP: cfg.targetTP,
      measuredI: measured.measured_I,
      measuredTP: measured.measured_TP,
    };

  } catch (err) {
    // Temp-Datei aufräumen falls vorhanden
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}

    console.warn(`[Remotion] ⚠️ Loudness-Normalisierung fehlgeschlagen: ${err.message}`);
    console.warn(`[Remotion] ⚠️ Original-Video bleibt unverändert (kein Qualitätsverlust)`);

    return {
      normalized: false,
      targetI: cfg.targetI,
      targetTP: cfg.targetTP,
      reason: err.message,
    };
  }
}

// ── Hilfsfunktion: Promise mit Timeout ───────────────────────────────────

/**
 * Wrappt ein Promise mit einem Timeout.
 * Schlägt das Promise fehl, wird der Fehler weitergereicht (kein Abbruch des ffmpeg-Prozesses,
 * aber der Aufrufer erhält eine Zeitüberschreitung).
 *
 * @param {Promise} promise
 * @param {number} ms – Timeout in Millisekunden
 * @param {string} label – Bezeichnung für die Fehlermeldung
 * @returns {Promise}
 */
function withTimeout(promise, ms, label) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} nach ${(ms / 1000).toFixed(0)}s abgebrochen (Timeout)`)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}