/**
 * CrossFade — Saubere Transitions ohne Jitter/Hackeln
 *
 * Regeln für hackle-freie Transitions in Remotion:
 * 1. Keine CSS blur() während Bewegung (GPU-Jitter)
 * 2. Opacity-Interpolation muss clamp haben
 * 3. Sequence-Überlappung muss exakt stimmen
 * 4. Easing: cubic ease-out für natürliche Bewegung
 */

import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

// ── Easing Hilfsfunktionen ────────────────────────────────────────────────

/** Cubic ease-out: schnell rein, sanft aus */
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

/** Cubic ease-in-out: sanft rein und raus */
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ── Basis-Komponenten ─────────────────────────────────────────────────────

/** Blendet von opacity 0 → 1 ein */
export const FadeIn: React.FC<{
  durationFrames: number;
  children: React.ReactNode;
}> = ({ durationFrames, children }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = easeOutCubic(t);
  return (
    <AbsoluteFill style={{ opacity }}>
      {children}
    </AbsoluteFill>
  );
};

/** Blendet von opacity 1 → 0 aus (am Ende der Sequence) */
export const FadeOut: React.FC<{
  durationFrames: number;
  totalFrames: number;
  children: React.ReactNode;
}> = ({ durationFrames, totalFrames, children }) => {
  const frame = useCurrentFrame();
  const fadeStart = Math.max(0, totalFrames - durationFrames);
  const t = interpolate(frame, [fadeStart, totalFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = 1 - easeInOutCubic(t);
  return (
    <AbsoluteFill style={{ opacity }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * CrossDissolve — Sauberes Cross-Fade zwischen zwei Bildern.
 * Kein blur, kein scale → kein GPU-Jitter.
 * Das neue Bild blendet über das alte.
 */
export const CrossDissolve: React.FC<{
  durationFrames: number;
  children: React.ReactNode;
}> = ({ durationFrames, children }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = easeInOutCubic(t);
  return (
    <AbsoluteFill style={{ opacity }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * ZoomBlur — Sanfter Zoom-Einblend-Effekt OHNE CSS blur().
 * blur() verursacht GPU-Ruckeln beim Render auf VPS.
 * Stattdessen: nur scale + opacity für glatte Transition.
 */
export const ZoomBlur: React.FC<{
  durationFrames: number;
  children: React.ReactNode;
}> = ({ durationFrames, children }) => {
  const frame = useCurrentFrame();

  const t = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const eased   = easeOutCubic(t);
  const scale   = interpolate(eased, [0, 1], [1.06, 1.0]); // subtiler Zoom-In
  const opacity = interpolate(t,     [0, 0.4], [0, 1], {   // schnelles Einblenden
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        // KEIN filter: blur() — verursacht Jitter!
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * SlideIn — Bild schiebt von einer Seite rein (ohne blur)
 */
export const SlideIn: React.FC<{
  durationFrames: number;
  direction?: 'left' | 'right' | 'up' | 'down';
  children: React.ReactNode;
}> = ({ durationFrames, direction = 'left', children }) => {
  const frame = useCurrentFrame();

  const t = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const eased = easeOutCubic(t);

  let translateX = 0;
  let translateY = 0;

  switch (direction) {
    case 'left':  translateX = interpolate(eased, [0, 1], [100, 0]); break;
    case 'right': translateX = interpolate(eased, [0, 1], [-100, 0]); break;
    case 'up':    translateY = interpolate(eased, [0, 1], [100, 0]); break;
    case 'down':  translateY = interpolate(eased, [0, 1], [-100, 0]); break;
  }

  return (
    <AbsoluteFill style={{ transform: `translate(${translateX}%, ${translateY}%)` }}>
      {children}
    </AbsoluteFill>
  );
};
