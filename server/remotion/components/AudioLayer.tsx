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
    // Fade-In
    if (frame < fadeInFrames) {
      // Cubic ease-in für sanfteres Einblenden
      const t = frame / fadeInFrames;
      return volume * (t * t * t);
    }
    // Fade-Out
    const fadeOutStart = durationInFrames - fadeOutFrames;
    if (frame >= fadeOutStart) {
      const t = (frame - fadeOutStart) / fadeOutFrames;
      // Cubic ease-out für sanfteres Ausblenden
      return volume * Math.max(0, 1 - (t * t * t));
    }
    return volume;
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
