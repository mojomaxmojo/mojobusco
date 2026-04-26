/**
 * AudioLayer — Musik mit smoothem Fade-In/Out
 *
 * volume als Callback-Funktion — kein direkter Wert.
 * Remotion rendert Audio stabil wenn volume(frame) eine Funktion ist.
 *
 * loop=true: Tracks sind typischerweise 2-4 Min, Videos ~110s.
 * Tracks sind länger als das Video → Loop wird nie getriggert.
 *
 * Audio-Ruckler Fix: numberOfSharedAudioTags=1 in render.js —
 * Remotion alloziert Audio-Tags vorab statt bei Sequence-Wechseln neu.
 */

import React from 'react';
import { Audio, useVideoConfig } from 'remotion';

interface AudioLayerProps {
  src: string;
  volume?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
}

export const AudioLayer: React.FC<AudioLayerProps> = ({
  src,
  volume = 0.75,
  fadeInSec = 2,
  fadeOutSec = 3,
}) => {
  const { durationInFrames, fps } = useVideoConfig();

  const fadeInFrames  = Math.round(fadeInSec  * fps);
  const fadeOutFrames = Math.round(fadeOutSec * fps);

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

  return (
    <Audio
      src={src}
      volume={volumeFn}
      loop
    />
  );
};
