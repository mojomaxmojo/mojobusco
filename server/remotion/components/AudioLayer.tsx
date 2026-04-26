/**
 * AudioLayer — Musik mit smoothem Fade-In/Out
 *
 * Wichtig: volume als Callback-Funktion statt direkter Zahl übergeben.
 * Remotion rendert Audio nur stabil wenn volume(frame) eine Funktion ist —
 * bei einem direkten Wert der sich per Frame ändert entstehen Artefakte/Hackeln.
 */

import { Audio, useVideoConfig } from 'remotion';

interface AudioLayerProps {
  src: string;
  /** Master-Lautstärke 0–1 */
  volume?: number;
  /** Fade-In Dauer in Sekunden */
  fadeInSec?: number;
  /** Fade-Out Dauer in Sekunden */
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

  /**
   * volume als Funktion — Remotion berechnet die Lautstärke pro Frame
   * ohne dass die Komponente neu gerendert werden muss.
   * Das ist der korrekte Weg für smooth Fades ohne Audio-Glitches.
   */
  const volumeFn = (frame: number): number => {
    // Fade-In: 0 → 1
    if (frame < fadeInFrames) {
      return volume * (frame / fadeInFrames);
    }
    // Fade-Out: 1 → 0
    const fadeOutStart = durationInFrames - fadeOutFrames;
    if (frame >= fadeOutStart) {
      return volume * Math.max(0, 1 - (frame - fadeOutStart) / fadeOutFrames);
    }
    // Mitte: volle Lautstärke
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
