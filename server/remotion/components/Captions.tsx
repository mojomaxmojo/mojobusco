
/**
 * Captions.tsx — @remotion/captions Integration
 *
 * 85% der Social-Media-Videos werden OHNE TON geschaut.
 * → Untertitel = massiv mehr Engagement.
 *
 * Cache-Buster: 2026-04-28 21:15 UTC
 */

import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { FONT_FAMILY, FONT_FAMILY_REGULAR, FONT_WEIGHT, TEXT_STYLES } from './Fonts';

// ... (rest des Codes bleibt gleich)

export interface CaptionWord {
  text: string;
  startInSeconds: number;
  endInSeconds: number;
}

export type CaptionStyle = 'word-highlight' | 'full-line' | 'tiktok' | 'minimal';

// ... (rest des Codes bleibt gleich)

/**
 * Text in Wörter aufteilen mit gleichmäßigem Timing (ROBUSTE VERSION)
 */
export function textToTimedWords(
  text: string,
  startSec: number,
  endSec: number
): CaptionWord[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const duration = endSec - startSec;
  // SICHERHEITSPRÜFUNG: Verhindert Division durch Null, falls es keine Wörter gibt.
  const perWord = duration > 0 && words.length > 0 ? duration / words.length : 0;

  return words.map((word, i) => ({
    text: word,
    startInSeconds: startSec + i * perWord,
    endInSeconds: startSec + (i + 1) * perWord,
  }));
}

// ... (rest der Datei bleibt wie im Original)

