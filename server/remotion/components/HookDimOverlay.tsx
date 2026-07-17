import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';

export const HookDimOverlay: React.FC<{ opacity: number; fps: number; hookFrames: number }> = ({ opacity, fps, hookFrames }) => {
  const frame = useCurrentFrame();
  const fadeInFrames  = Math.round(fps * 0.4);
  const fadeOutFrames = Math.round(fps * 0.5);

  let alpha: number;
  if (frame < fadeInFrames) {
    alpha = (frame / fadeInFrames) * opacity;
  } else if (frame > hookFrames - fadeOutFrames) {
    alpha = Math.max(0, ((hookFrames - frame) / fadeOutFrames) * opacity);
  } else {
    alpha = opacity;
  }

  return (
    <AbsoluteFill style={{ background: `rgba(0,0,0,${alpha.toFixed(3)})`, pointerEvents: 'none' }} />
  );
};
