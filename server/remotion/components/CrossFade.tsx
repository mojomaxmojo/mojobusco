/**
 * CrossFade + Slide Transitions zwischen Fotos
 * Unterstützt: crossfade | slide-left | slide-up | zoom-out | wipe
 */

import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

export type TransitionType = 'crossfade' | 'slide-left' | 'slide-up' | 'zoom-out' | 'wipe';

interface TransitionSlideProps {
  /** Total Frames für die Transition */
  durationFrames?: number;
  type?: TransitionType;
  children: React.ReactNode;
}

/**
 * Wrapper für Bild-Slide: blendet von 0→1 ein (outgoing: 1→0)
 * Wird INNERHALB einer Sequence verwendet
 */
export const FadeIn: React.FC<{
  durationFrames: number;
  children: React.ReactNode;
}> = ({ durationFrames, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, durationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const FadeOut: React.FC<{
  durationFrames: number;
  totalFrames: number;
  children: React.ReactNode;
}> = ({ durationFrames, totalFrames, children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [totalFrames - durationFrames, totalFrames],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

/**
 * SlideIn — Bild schiebt von einer Seite rein
 */
export const SlideIn: React.FC<{
  durationFrames: number;
  direction?: 'left' | 'right' | 'up' | 'down';
  children: React.ReactNode;
}> = ({ durationFrames, direction = 'left', children }) => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [0, durationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Eased progress
  const eased = 1 - Math.pow(1 - progress, 3); // cubic ease-out

  let translateX = 0;
  let translateY = 0;

  switch (direction) {
    case 'left':
      translateX = interpolate(eased, [0, 1], [100, 0]);
      break;
    case 'right':
      translateX = interpolate(eased, [0, 1], [-100, 0]);
      break;
    case 'up':
      translateY = interpolate(eased, [0, 1], [100, 0]);
      break;
    case 'down':
      translateY = interpolate(eased, [0, 1], [-100, 0]);
      break;
  }

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${translateX}%, ${translateY}%)`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * ZoomBlur — Zoom + Blur Transition
 */
export const ZoomBlur: React.FC<{
  durationFrames: number;
  children: React.ReactNode;
}> = ({ durationFrames, children }) => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [0, durationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const eased = 1 - Math.pow(1 - progress, 2);
  const scale = interpolate(eased, [0, 1], [1.15, 1]);
  const blur = interpolate(eased, [0, 1], [8, 0]);
  const opacity = interpolate(eased, [0, 0.3], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${scale})`,
        filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
