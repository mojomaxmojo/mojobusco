/**
 * audio.js – Loudness-Zielwerte für die Audio-Normalisierung
 *
 * Single Source of Truth: alle ffmpeg-loudnorm-Parameter zentral definiert.
 * Von server/remotion/audioNormalize.js per ESM-import geladen (Node, kein Build-Step).
 *
 * Zielkorridor: −14 bis −15 LUFS integrated (YouTube/TikTok/Instagram-Standard ≈ −14 LUFS)
 * True-Peak-Limit: −1 dBTP (branchenüblicher Sicherheitsabstand)
 *
 * TABU: Werte niemals direkt in render.js oder audioNormalize.js hartcodieren!
 */

// ── Primäre Zielwerte ───────────────────────────────────────────────────────

/** Loudness-Ziel in LUFS integrated (Mitte des Korridors −14 … −15) */
export const LOUDNESS_TARGET_I = -14.5;

/** True-Peak-Limit in dBTP */
export const LOUDNESS_TARGET_TP = -1.0;

/** Loudness Range – ffmpeg-loudnorm-Standard, geeignet für Voiceover+Musik-Mix */
export const LOUDNESS_TARGET_LRA = 11;

// ── Output-Format ───────────────────────────────────────────────────────────

/** Sample-Rate des normalisierten Audio-Streams (Hz) */
export const LOUDNESS_OUTPUT_SAMPLE_RATE = 48000;

/** Audio-Codec für das normalisierte MP4 */
export const LOUDNESS_OUTPUT_AUDIO_CODEC = 'aac';

/** Audio-Bitrate in kbps */
export const LOUDNESS_OUTPUT_AUDIO_BITRATE_KBPS = 192;

// ── Timeout ─────────────────────────────────────────────────────────────────

/**
 * Timeout-Faktor pro ffmpeg-Pass (ms pro Sekunde Video).
 * Da -c:v copy sehr schnell ist, reicht i.d.R. ein Bruchteil der Echtzeit.
 * Faktor 4× deckt langsame VPS-I/O zuverlässig ab.
 * Formel: timeout = max(30000, videoDurationSec * LOUDNESS_PASS_TIMEOUT_MS_PER_SEC)
 */
export const LOUDNESS_PASS_TIMEOUT_MS_PER_SEC = 4000;

// ── Gebündelter Export (für beide Import-Varianten) ─────────────────────────

export const AUDIO_LOUDNESS_CONFIG = {
  targetI: LOUDNESS_TARGET_I,
  targetTP: LOUDNESS_TARGET_TP,
  targetLRA: LOUDNESS_TARGET_LRA,
  outputSampleRate: LOUDNESS_OUTPUT_SAMPLE_RATE,
  outputAudioCodec: LOUDNESS_OUTPUT_AUDIO_CODEC,
  outputAudioBitrateKbps: LOUDNESS_OUTPUT_AUDIO_BITRATE_KBPS,
  passTimeoutMsPerSec: LOUDNESS_PASS_TIMEOUT_MS_PER_SEC,
};