/**
 * AudioLayer — Musik mit smoothem Fade-In/Out (Ruckler-freie Version)
 *
 * WICHTIG für stabiles Audio beim Remotion-Render:
 *  - Audio-Datei wird VOR dem Render lokal gecacht (render.js) → kein Netzwerk-Latency
 *  - volume als Callback-Funktion → Remotion interpoliert Frame-genau
 *  - loop=false + startFrom=0 → verhindert Audio-Glitches bei Loop-Punkten
 *  - Kein Wrapping in <Sequence> → Audio läuft im globalen Frame-Kontext
 *
 * numberOfSharedAudioTags=3 in render.js verhindert Audio-Tag-Reallokierung
 * bei jedem Sequence-Wechsel (die Haupt-Ursache für Ruckler).
 */

import React from 'react';
import { Audio, useVideoConfig } from 'remotion';

interface AudioLayerProps {
  src: string;
  volume?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  duckWindows?: { startFrame: number; endFrame: number }[];
  duckFadeFrames?: number;
}

export const AudioLayer: React.FC<AudioLayerProps> = ({
  src,
  volume = 0.75,
  fadeInSec = 2,
  fadeOutSec = 3,
  duckWindows,
  duckFadeFrames,
}) => {
  const { durationInFrames, fps } = useVideoConfig();

  const fadeInFrames  = Math.round(fadeInSec  * fps);
  const fadeOutFrames = Math.round(fadeOutSec * fps);
  const duckFadeFramesActual = duckFadeFrames ?? Math.round(fps * 0.4);

  const getDuckFactor = (frame: number): number => {
    if (!duckWindows || duckWindows.length === 0) return 1;

    for (const w of duckWindows) {
      const rampStart = w.startFrame - duckFadeFramesActual;
      const rampEnd   = w.endFrame   + duckFadeFramesActual;

      if (frame < rampStart) continue;

      // Ramp-in (1 → 0) vor dem Duck-Fenster
      if (frame < w.startFrame) {
        const t = (frame - rampStart) / duckFadeFramesActual;
        return 1 - (t * t * t);
      }

      // Innerhalb des Duck-Fensters → stumm
      if (frame <= w.endFrame) {
        return 0;
      }

      // Ramp-out (0 → 1) nach dem Duck-Fenster
      if (frame <= rampEnd) {
        const t = (frame - w.endFrame) / duckFadeFramesActual;
        return t * t * t;
      }
    }

    return 1;
  };

  const volumeFn = (frame: number): number => {
    const duck = getDuckFactor(frame);

    // Fade-In
    if (frame < fadeInFrames) {
      // Cubic ease-in für sanfteres Einblenden
      const t = frame / fadeInFrames;
      return volume * (t * t * t) * duck;
    }
    // Fade-Out
    const fadeOutStart = durationInFrames - fadeOutFrames;
    if (frame >= fadeOutStart) {
      const t = (frame - fadeOutStart) / fadeOutFrames;
      // Cubic ease-out für sanfteres Ausblenden
      return volume * Math.max(0, 1 - (t * t * t)) * duck;
    }
    return volume * duck;
  };

  return (
    <Audio
      src={src}
      volume={volumeFn}
      // loop=false: Audio-Track ist typischerweise 2-4 Min, Videos ~60-120s.
      // Loop-Punkt verursacht oft einen kurzen Glitch → besser vermeiden.
      // Falls Track kürzer als Video: Stille am Ende ist besser als Glitch.
      loop={false}
      // startFrom=0: explizit von Anfang starten (keine Offset-Verwirrung)
      startFrom={0}
    />
  );
};
