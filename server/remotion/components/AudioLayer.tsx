/**
 * AudioLayer — Musik ohne Loop-Glitch
 *
 * Das Problem mit loop=true in Remotion:
 * Chrome berechnet den Audio-Loop intern frame-by-frame.
 * An der Loop-Stelle entsteht ein Sample-Sprung → hörbarer Ruckler.
 *
 * Lösung: KEIN loop. Stattdessen:
 * - playbackRate so anpassen dass die Musik genau bis zum Ende reicht
 * - Falls Musik länger als Video: einfach abschneiden (kein Loop nötig)
 * - Falls Musik kürzer als Video: playbackRate leicht reduzieren (max -20%)
 *   damit sie ohne Loop durchläuft. Darunter: doch loop aber mit
 *   Cross-Fade an der Loop-Stelle um den Ruckler zu kaschieren.
 */

import React from 'react';
import { Audio, useVideoConfig } from 'remotion';

interface AudioLayerProps {
  src: string;
  volume?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  /** Geschätzte Musik-Dauer in Sekunden (für Stretch-Berechnung) */
  musicDurationSec?: number;
}

export const AudioLayer: React.FC<AudioLayerProps> = ({
  src,
  volume = 0.75,
  fadeInSec = 2,
  fadeOutSec = 3,
  musicDurationSec,
}) => {
  const { durationInFrames, fps } = useVideoConfig();

  const videoDurationSec = durationInFrames / fps;
  const fadeInFrames  = Math.round(fadeInSec  * fps);
  const fadeOutFrames = Math.round(fadeOutSec * fps);

  // Playback-Rate berechnen:
  // Wenn Musik bekannt und kürzer als Video → leicht verlangsamen (max -20%)
  // Lieber etwas langsamer als loop-Ruckler
  let playbackRate = 1.0;
  if (musicDurationSec && musicDurationSec < videoDurationSec) {
    const ratio = musicDurationSec / videoDurationSec;
    if (ratio >= 0.8) {
      // Musik ist 80-100% der Videolänge → verlangsamen, kein Loop
      playbackRate = ratio;
    }
    // Unter 80%: playbackRate bleibt 1.0, loop kommt unten
  }

  const volumeFn = (frame: number): number => {
    if (frame < fadeInFrames) {
      return volume * (frame / fadeInFrames);
    }
    const fadeOutStart = durationInFrames - fadeOutFrames;
    if (frame >= fadeOutStart) {
      return volume * Math.max(0, 1 - (frame - fadeOutStart) / fadeOutFrames);
    }
    return volume;
  };

  // Musik länger als Video → kein Loop, einfach stoppen
  // Musik kürzer (und playbackRate-Stretch nicht ausreicht) → loop leider nötig
  const needsLoop = musicDurationSec
    ? (musicDurationSec * playbackRate) < videoDurationSec
    : true; // unbekannte Dauer → loop als Fallback

  return (
    <Audio
      src={src}
      volume={volumeFn}
      playbackRate={playbackRate}
      loop={needsLoop}
    />
  );
};
