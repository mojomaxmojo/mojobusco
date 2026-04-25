/**
 * ProgressBar — Retention-Balken oben im Video
 * Zeigt den Fortschritt des Videos → hält Zuschauer bis zum Ende
 */

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface ProgressBarProps {
  color?: string;
  height?: number;
  position?: 'top' | 'bottom';
  /** Nur den Slideshow-Teil anzeigen (ohne Intro/CTA) */
  startFrame?: number;
  endFrame?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  color = '#F59E0B',
  height = 3,
  position = 'top',
  startFrame = 0,
  endFrame,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const end = endFrame ?? durationInFrames;

  const progress = interpolate(
    frame,
    [startFrame, end],
    [0, 100],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          [position]: 0,
          height: `${height}px`,
          background: 'rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${color}CC, ${color})`,
            boxShadow: `0 0 8px ${color}80`,
            transition: 'width 0.1s linear',
            borderRadius: '0 2px 2px 0',
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
