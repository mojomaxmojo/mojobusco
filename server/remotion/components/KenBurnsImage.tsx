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
  | 'noise'
  | 'breathing'
  | 'focus-in'
  | 'handheld';

export type GammaFade = 'none' | 'warm-in' | 'cool-in' | 'dark-in';

interface KenBurnsImageProps {
  src: string;
  direction?: Direction;
  /** Intensität 0–1, default 0.10 */
  intensity?: number;
  objectPosition?: string;
  motionBlurStrength?: number;
  /** Seed für deterministischen Noise (default: 0) */
  noiseSeed?: number;
  /** Gamma-Fade beim Einblenden (separat von Direction) */
  gammaFade?: GammaFade;
}

/** Deterministisch — rotiert durch alle Richtungen inkl. neuer Effekte */
export function pickDirection(index: number): Direction {
  const options: Direction[] = [
    'noise',     // 0  organisch
    'breathing', // 1  lebendig
    'zoom-in',   // 2  klassisch
    'handheld',  // 3  authentisch
    'noise',     // 4  organisch
    'focus-in',  // 5  cinematic
    'zoom-out',  // 6  enthüllend
    'breathing', // 7  lebendig
    'noise',     // 8  organisch
    'handheld',  // 9  authentisch
    'diagonal-br',//10 diagonal
    'focus-in',  // 11 cinematic
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
  const t = frame / durationInFrames;
  const timeScale = 0.8;
  const nx = noise2D(`kb-x-${seed}`, t * timeScale, 0);
  const ny = noise2D(`kb-y-${seed}`, 0, t * timeScale);
  const nz = noise2D(`kb-z-${seed}`, t * timeScale * 0.5, t * timeScale * 0.5);
  const envelope = Math.sin(t * Math.PI);
  const scale = 1 + intensity * (0.5 + (nz * 0.5 + 0.5) * 0.5);
  const translateX = nx * intensity * 8 * envelope;
  const translateY = ny * intensity * 5 * envelope;
  return { scale, translateX, translateY };
}

// ── Atmender Zoom (breathing) ────────────────────────────────────────────
// Noise-Pan + sinusförmiger Scale-Puls wie Atem (2 Zyklen pro Slide)

function getBreathingTransform(
  frame: number,
  durationInFrames: number,
  intensity: number,
  seed: number
): { scale: number; translateX: number; translateY: number } {
  const t = frame / durationInFrames;
  const nx = noise2D(`br-x-${seed}`, t * 0.6, 0);
  const ny = noise2D(`br-y-${seed}`, 0, t * 0.6);
  const breath = Math.sin(t * Math.PI * 2 * 2); // 2 Atemzüge
  const scale = 1 + intensity * (0.3 + breath * 0.25);
  const envelope = Math.sin(t * Math.PI);
  const translateX = nx * intensity * 6 * envelope;
  const translateY = ny * intensity * 4 * envelope;
  return { scale, translateX, translateY };
}

// ── Handkamera-Wobble (handheld) ─────────────────────────────────────────
// Hohe Frequenz, geringe Amplitude – wie echte Handkamera

function getHandheldTransform(
  frame: number,
  durationInFrames: number,
  intensity: number,
  seed: number
): { scale: number; translateX: number; translateY: number } {
  const t = frame / durationInFrames;
  const timeScale = 2.5; // höhere Frequenz = Wobble
  const nx = noise2D(`hh-x-${seed}`, t * timeScale, 0);
  const ny = noise2D(`hh-y-${seed}`, 0, t * timeScale);
  const nz = noise2D(`hh-z-${seed}`, t * timeScale * 0.4, t * timeScale * 0.4);
  const envelope = Math.sin(t * Math.PI);
  const scale = 1 + intensity * 0.15 * (nz * 0.5 + 0.5);
  const translateX = nx * intensity * 2.5 * envelope; // sehr sanft
  const translateY = ny * intensity * 1.5 * envelope;
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
  gammaFade = 'none',
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Transform je nach Direction
  let scale = 1, translateX = 0, translateY = 0;

  if (direction === 'noise') {
    const r = getNoisedTransform(frame, durationInFrames, intensity, noiseSeed);
    scale = r.scale; translateX = r.translateX; translateY = r.translateY;
  } else if (direction === 'breathing') {
    const r = getBreathingTransform(frame, durationInFrames, intensity, noiseSeed);
    scale = r.scale; translateX = r.translateX; translateY = r.translateY;
  } else if (direction === 'handheld') {
    const r = getHandheldTransform(frame, durationInFrames, intensity, noiseSeed);
    scale = r.scale; translateX = r.translateX; translateY = r.translateY;
  } else if (direction === 'focus-in') {
    // Focus-In: Zoom + Blau→Scharf
    scale = interpolate(progress, [0, 1], [1, 1 + intensity * 0.8]);
    translateX = 0;
    translateY = 0;
  } else {
    const r = getLinearTransform(progress, direction, intensity);
    scale = r.scale; translateX = r.translateX; translateY = r.translateY;
  }

  // Motion Blur (nur bei Bewegung, nicht bei Focus-In)
  const velocity = direction !== 'focus-in'
    ? Math.abs(translateX) / durationInFrames + Math.abs(scale - 1) / durationInFrames
    : 0;
  const motionBlur = motionBlurStrength > 0
    ? Math.min(velocity * motionBlurStrength * 60, 1.2)
    : 0;

  // Focus-In Blur (überschreibt motion blur)
  const focusBlur = direction === 'focus-in'
    ? interpolate(Math.min(1, progress * 3), [0, 1], [4, 0])
    : 0;
  const effectiveBlur = Math.max(motionBlur, focusBlur);

  // Gamma-Fade Overlay
  const gammaFadeVisible = gammaFade !== 'none';
  const gammaFadeOpacity = gammaFadeVisible
    ? interpolate(frame, [0, Math.round(fps * 0.4)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    : 0;
  const gammaFadeColor = gammaFade === 'warm-in' ? 'rgba(255,180,50,0.18)'
    : gammaFade === 'cool-in' ? 'rgba(50,120,255,0.14)'
    : gammaFade === 'dark-in' ? 'rgba(0,0,0,0.25)'
    : 'transparent';

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
          filter: effectiveBlur > 0.1 ? `blur(${effectiveBlur.toFixed(2)}px)` : undefined,
        }}
      />
      {/* Gamma-Fade Overlay: Farb-/Dunkelstich der sich auflöst */}
      {gammaFadeOpacity > 0 && (
        <AbsoluteFill
          style={{
            backgroundColor: gammaFadeColor,
            opacity: gammaFadeOpacity,
            pointerEvents: 'none',
          }}
        />
      )}
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
