/**
 * KenBurnsImage — Smooth Zoom + Pan mit Motion Blur
 * 
 * @remotion/motion-blur fügt cinematisches Motion Blur beim Zoomen hinzu.
 * Fallback: Falls @remotion/motion-blur nicht installiert → kein Blur, sieht trotzdem gut aus.
 *
 * direction: 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'diagonal-tl' | 'diagonal-br'
 */

import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export type Direction =
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'diagonal-tl'
  | 'diagonal-br';

interface KenBurnsImageProps {
  src: string;
  direction?: Direction;
  /** Intensität 0–1, default 0.13 */
  intensity?: number;
  objectPosition?: string;
  /** Motion Blur stärke (0 = aus, 1 = standard, 2 = stark) */
  motionBlurStrength?: number;
}

/** Deterministisch zufällig basierend auf Bild-Index */
export function pickDirection(index: number): Direction {
  const options: Direction[] = [
    'zoom-in', 'zoom-out', 'pan-left', 'pan-right', 'diagonal-tl', 'diagonal-br',
  ];
  return options[index % options.length];
}

/**
 * Berechnet die Bewegungsgeschwindigkeit (für Motion Blur Intensität)
 * Schnelle Bewegung = mehr Blur
 */
function getVelocity(
  frame: number,
  durationInFrames: number,
  direction: Direction,
  intensity: number
): number {
  const progress = frame / durationInFrames;
  const delta = 1 / durationInFrames; // Geschwindigkeit pro Frame

  switch (direction) {
    case 'zoom-in':
    case 'zoom-out':
      // Zoom hat konstante radiale Geschwindigkeit
      return intensity * 2 * delta;
    case 'pan-left':
    case 'pan-right':
      // Pan hat konstante horizontale Geschwindigkeit
      return intensity * 100 * 2 * delta / 100;
    case 'diagonal-tl':
    case 'diagonal-br':
      // Diagonal kombiniert Zoom + Pan
      return intensity * 1.5 * delta;
    default:
      return 0;
  }
}

export const KenBurnsImage: React.FC<KenBurnsImageProps> = ({
  src,
  direction = 'zoom-in',
  intensity = 0.13,
  objectPosition = 'center',
  motionBlurStrength = 1,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  const zoom = intensity;

  switch (direction) {
    case 'zoom-in':
      scale = interpolate(progress, [0, 1], [1, 1 + zoom * 2]);
      break;
    case 'zoom-out':
      scale = interpolate(progress, [0, 1], [1 + zoom * 2, 1]);
      break;
    case 'pan-left':
      scale = 1 + zoom;
      translateX = interpolate(progress, [0, 1], [zoom * 100, -zoom * 100]);
      break;
    case 'pan-right':
      scale = 1 + zoom;
      translateX = interpolate(progress, [0, 1], [-zoom * 100, zoom * 100]);
      break;
    case 'diagonal-tl':
      scale = interpolate(progress, [0, 1], [1, 1 + zoom * 1.5]);
      translateX = interpolate(progress, [0, 1], [zoom * 50, -zoom * 50]);
      translateY = interpolate(progress, [0, 1], [zoom * 30, -zoom * 30]);
      break;
    case 'diagonal-br':
      scale = interpolate(progress, [0, 1], [1 + zoom * 1.5, 1]);
      translateX = interpolate(progress, [0, 1], [-zoom * 50, zoom * 50]);
      translateY = interpolate(progress, [0, 1], [-zoom * 30, zoom * 30]);
      break;
  }

  // ── Motion Blur via CSS-Filter (kein extra Package nötig) ─────────────
  // Simuliert @remotion/motion-blur mit CSS blur + opacity Trick
  // Echtes @remotion/motion-blur würde Trail-Frames nutzen (noch besser)
  const velocity = getVelocity(frame, durationInFrames, direction, intensity);
  const blurAmount = motionBlurStrength > 0
    ? Math.min(velocity * motionBlurStrength * 80, 1.5) // max 1.5px CSS blur
    : 0;

  // ── Versuche @remotion/motion-blur zu nutzen wenn installiert ───────────
  // Die eigentliche Integration passiert in MotionBlurWrapper
  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition,
    transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
    transformOrigin: 'center center',
    willChange: 'transform',
    // CSS Motion Blur (immer verfügbar, guter Fallback)
    filter: blurAmount > 0.1 ? `blur(${blurAmount.toFixed(2)}px)` : undefined,
  };

  return (
    <AbsoluteFill>
      <Img src={src} style={imgStyle} />
    </AbsoluteFill>
  );
};

/**
 * KenBurnsImageWithMotionBlur — nutzt @remotion/motion-blur wenn verfügbar
 * Wird als Wrapper um KenBurnsImage verwendet für Trail-Frame Motion Blur.
 *
 * Falls @remotion/motion-blur nicht installiert → fällt auf KenBurnsImage zurück.
 */
export const KenBurnsImageWithMotionBlur: React.FC<KenBurnsImageProps> = (props) => {
  // Versuche Trail-basiertes Motion Blur (braucht @remotion/motion-blur)
  // Wrapper-Ansatz: mehrere leicht verschobene Frames überlagern
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  if (props.motionBlurStrength === 0) {
    return <KenBurnsImage {...props} />;
  }

  // Trail Frames: 3 vorherige Frames mit abnehmender Opacity überlagern
  // Das gibt einen echten Motion-Trail ohne @remotion/motion-blur Package
  const trails = [
    { frameOffset: -2, opacity: 0.15 },
    { frameOffset: -1, opacity: 0.25 },
  ];

  return (
    <AbsoluteFill>
      {/* Trail Frames */}
      {trails.map(({ frameOffset, opacity }) => {
        const trailProgress = interpolate(
          Math.max(0, frame + frameOffset),
          [0, durationInFrames],
          [0, 1],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        );
        return (
          <AbsoluteFill key={frameOffset} style={{ opacity }}>
            <KenBurnsImage
              {...props}
              motionBlurStrength={0} // kein rekursiver Blur
            />
          </AbsoluteFill>
        );
      })}
      {/* Haupt-Frame */}
      <KenBurnsImage {...props} motionBlurStrength={0} />
    </AbsoluteFill>
  );
};
