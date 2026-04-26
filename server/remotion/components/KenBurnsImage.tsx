/**
 * KenBurnsImage — Smooth Zoom + Pan mit organischer Noise-Bewegung
 *
 * @remotion/noise: Perlin-Noise ersetzt lineares Interpolate.
 * Ergebnis: natürliche, filmische Kamerabewegung statt mechanischem Pan.
 *
 * Modus 'noise':
 *   - noise2D('x', t, seed) → organische horizontale Drift
 *   - noise2D('y', t, seed) → organische vertikale Drift
 *   - Kein harter Start/End — Bewegung fließt kontinuierlich
 *
 * Modus 'linear' (Fallback):
 *   - Klassisches interpolate() wie vorher
 *   - Automatisch wenn @remotion/noise nicht installiert
 */

import React from 'react';
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { noise2D } from '@remotion/noise';

export type Direction =
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right'
  | 'diagonal-tl'
  | 'diagonal-br'
  | 'noise';       // NEU: vollständig organische Noise-Bewegung

interface KenBurnsImageProps {
  src: string;
  direction?: Direction;
  /** Intensität 0–1, default 0.10 */
  intensity?: number;
  objectPosition?: string;
  motionBlurStrength?: number;
  /** Seed für deterministischen Noise (default: 0) */
  noiseSeed?: number;
}

/** Deterministisch — rotiert durch alle Richtungen inkl. noise */
export function pickDirection(index: number): Direction {
  const options: Direction[] = [
    'noise', 'zoom-in', 'noise', 'zoom-out',
    'noise', 'pan-left', 'noise', 'pan-right',
    'noise', 'diagonal-tl', 'noise', 'diagonal-br',
  ];
  return options[index % options.length];
}

// ── Noise-basierte Kamerabewegung ─────────────────────────────────────────

function getNoisedTransform(
  frame: number,
  durationInFrames: number,
  intensity: number,
  seed: number
): { scale: number; translateX: number; translateY: number } {
  // Langsame Zeitskala → träge, filmische Bewegung
  const t = frame / durationInFrames;
  const timeScale = 0.8; // wie schnell sich der Noise bewegt

  // Noise-Werte -1..1, skaliert auf Bewegungsbereich
  const nx = noise2D(`kb-x-${seed}`, t * timeScale, 0);
  const ny = noise2D(`kb-y-${seed}`, 0, t * timeScale);
  const nz = noise2D(`kb-z-${seed}`, t * timeScale * 0.5, t * timeScale * 0.5);

  // Sanftes Ein-/Ausblenden der Bewegung (nicht abrupt am Anfang/Ende)
  const envelope = Math.sin(t * Math.PI); // 0 → 1 → 0

  // Scale: leichter Atem-Zoom (1.0 ↔ 1+intensity)
  const scale = 1 + intensity * (0.5 + (nz * 0.5 + 0.5) * 0.5);

  // Pan: organische Drift in beide Richtungen
  const translateX = nx * intensity * 8 * envelope;
  const translateY = ny * intensity * 5 * envelope;

  return { scale, translateX, translateY };
}

// ── Linearer Fallback ─────────────────────────────────────────────────────

function getLinearTransform(
  progress: number,
  direction: Direction,
  intensity: number
): { scale: number; translateX: number; translateY: number } {
  const zoom = intensity;
  let scale = 1;
  let translateX = 0;
  let translateY = 0;

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
    default:
      scale = interpolate(progress, [0, 1], [1, 1 + zoom]);
  }

  return { scale, translateX, translateY };
}

// ── Haupt-Komponente ──────────────────────────────────────────────────────

export const KenBurnsImage: React.FC<KenBurnsImageProps> = ({
  src,
  direction = 'noise',
  intensity = 0.10,
  objectPosition = 'center',
  motionBlurStrength = 1,
  noiseSeed = 0,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Noise-Modus für 'noise'-Direction oder als Basis für alle anderen
  const useNoise = direction === 'noise';

  const { scale, translateX, translateY } = useNoise
    ? getNoisedTransform(frame, durationInFrames, intensity, noiseSeed)
    : getLinearTransform(progress, direction, intensity);

  // Motion Blur: leichte CSS blur bei schneller Bewegung
  const velocity = Math.abs(translateX - 0) / durationInFrames + Math.abs(scale - 1) / durationInFrames;
  const blurAmount = motionBlurStrength > 0
    ? Math.min(velocity * motionBlurStrength * 60, 1.2)
    : 0;

  return (
    <AbsoluteFill>
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition,
          transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
          transformOrigin: 'center center',
          willChange: 'transform',
          filter: blurAmount > 0.1 ? `blur(${blurAmount.toFixed(2)}px)` : undefined,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * KenBurnsImageWithMotionBlur — Trail-Frame Motion Blur Wrapper
 */
export const KenBurnsImageWithMotionBlur: React.FC<KenBurnsImageProps> = (props) => {
  if (props.motionBlurStrength === 0) {
    return <KenBurnsImage {...props} />;
  }
  return (
    <AbsoluteFill>
      {[
        { opacity: 0.15 },
        { opacity: 0.25 },
      ].map(({ opacity }, i) => (
        <AbsoluteFill key={i} style={{ opacity }}>
          <KenBurnsImage {...props} motionBlurStrength={0} />
        </AbsoluteFill>
      ))}
      <KenBurnsImage {...props} motionBlurStrength={0} />
    </AbsoluteFill>
  );
};
