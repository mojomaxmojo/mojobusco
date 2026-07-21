/**
 * IntroAudioLayer — Hook-Intro Audio mit benutzerdefiniertem Fade-Out.
 *
 * Wird innerhalb einer <Sequence> verwendet, die den gewünschten Zeitraum
 * abdeckt. Der Volume-Callback arbeitet auf Frame-Basis (lokaler
 * Sequence-Frame), deshalb muss der Aufrufer fadeOutStartFrame und
 * fadeOutDurationFrames korrekt zur Sequence-Passung berechnen.
 *
 * Sting-Modus (Beispiel):
 *   fadeOutStartFrame = 1 * fps
 *   fadeOutDurationFrames = 5 * fps
 *   Sequence-Dauer = 6 * fps
 *   → 0-1 s voll, 1-6 s linear ausblenden.
 *
 * Bed-Modus (Beispiel):
 *   Sequence-Dauer = hookFrames
 *   fadeOutStartFrame = hookFrames - 0.3 * fps
 *   fadeOutDurationFrames = 0.3 * fps
 *   → Während des Hooks voll, letzte 0.3 s ausblenden.
 */

import React from 'react';
import { Audio } from 'remotion';

interface IntroAudioLayerProps {
  src: string;
  volume?: number;
  /** Frame, ab dem der Fade-Out beginnt (lokal zur Sequence). */
  fadeOutStartFrame: number;
  /** Länge des Fade-Outs in Frames (lokal zur Sequence). */
  fadeOutDurationFrames: number;
  /** Ob der Clip wiederholt werden soll, falls die Sequence länger ist. */
  loop?: boolean;
}

export const IntroAudioLayer: React.FC<IntroAudioLayerProps> = ({
  src,
  volume = 1,
  fadeOutStartFrame,
  fadeOutDurationFrames,
  loop = false,
}) => {
  if (fadeOutDurationFrames <= 0) {
    return <Audio src={src} volume={volume} loop={loop} />;
  }

  const volumeFn = (frame: number): number => {
    if (frame < fadeOutStartFrame) {
      return volume;
    }
    const t = (frame - fadeOutStartFrame) / fadeOutDurationFrames;
    return Math.max(0, volume * (1 - t));
  };

  return <Audio src={src} volume={volumeFn} loop={loop} />;
};
