/**
 * AudioLayer — Musik mit Fade-In/Out
 * Unterstützt: lokale Musik-Dateien vom VPS
 */

import { Audio, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface AudioLayerProps {
  src: string;
  volume?: number;
  /** Fade-In Dauer in Frames */
  fadeInFrames?: number;
  /** Fade-Out Dauer in Frames (vom Ende) */
  fadeOutFrames?: number;
  /** Start-Offset im Audio-File in Sekunden */
  startFrom?: number;
}

export const AudioLayer: React.FC<AudioLayerProps> = ({
  src,
  volume = 0.75,
  fadeInFrames = 30,
  fadeOutFrames = 45,
  startFrom = 0,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Fade-In: 0→1 in den ersten fadeInFrames
  const fadeIn = interpolate(frame, [0, fadeInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade-Out: 1→0 in den letzten fadeOutFrames
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fadeOutFrames, durationInFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const finalVolume = volume * Math.min(fadeIn, fadeOut);

  return (
    <Audio
      src={src}
      volume={finalVolume}
      startFrom={Math.round(startFrom * 30)} // 30fps Basis
      loop
    />
  );
};
