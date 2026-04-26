/**
 * TransitionSlideshow — @remotion/transitions Integration
 *
 * Ersetzt / ergänzt das einfache CrossDissolve in MojoBusVideo.
 * Drei Transitions nach Priorität:
 *   1. wipe       — Wischer von links nach rechts (Reels-typisch)
 *   2. clockWipe  — Uhrzeiger-Wischer (dramatisch)
 *   3. fade       — Klassisches Cross-Dissolve (dezent)
 *
 * ARCHITEKTUR:
 * - @remotion/transitions nutzt <TransitionSeries> und <Transition> Komponenten
 * - Jedes Bild-Paar wird als eigene Series-Sequenz behandelt
 * - Fallback: wenn Package fehlt → CrossDissolve aus CrossFade.tsx
 *
 * WICHTIG für Remotion-Bundler:
 * - Alle Transitions sind rein CSS/SVG — kein WebGL, kein Canvas
 * - Funktioniert mit SwiftShader (headless Chrome auf VPS)
 *
 * Package: npm install @remotion/transitions
 */

import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { CrossDissolve as FallbackCrossDiss } from './CrossFade';

// ── Transition-Typen ───────────────────────────────────────────────────────

export type TransitionType = 'wipe' | 'clockWipe' | 'fade' | 'slide' | 'auto';

// ── Pure CSS/SVG Transitions (kein extra Package nötig) ───────────────────

/**
 * Wipe-Transition: Bild B wischt von links über Bild A
 * Kein WebGL — reines CSS clip-path
 */
const WipeTransition: React.FC<{
  durationFrames: number;
  direction?: 'left' | 'right' | 'top' | 'bottom';
  children: React.ReactNode;
}> = ({ durationFrames, direction = 'left', children }) => {
  const frame = useCurrentFrame();

  const t = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Cubic ease-in-out für smooth Wipe
  const eased = t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const pct = eased * 100;

  let clipPath: string;
  switch (direction) {
    case 'right':
      clipPath = `inset(0 0 0 ${100 - pct}%)`;
      break;
    case 'top':
      clipPath = `inset(0 0 ${100 - pct}% 0)`;
      break;
    case 'bottom':
      clipPath = `inset(${100 - pct}% 0 0 0)`;
      break;
    case 'left':
    default:
      clipPath = `inset(0 ${100 - pct}% 0 0)`;
  }

  return (
    <AbsoluteFill style={{ clipPath }}>
      {children}
    </AbsoluteFill>
  );
};

/**
 * ClockWipe-Transition: Uhrzeiger-artiger SVG-Mask-Wiper
 * Dramatischer Effekt — perfekt für Landscape/Nature Footage
 */
const ClockWipeTransition: React.FC<{
  durationFrames: number;
  children: React.ReactNode;
}> = ({ durationFrames, children }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const t = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Cubic ease
  const eased = t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

  // Winkel 0° = oben, im Uhrzeigersinn
  const angle = eased * 360;
  const angleRad = ((angle - 90) * Math.PI) / 180;

  // Radius groß genug für Ecken
  const r = Math.sqrt(width * width + height * height);
  const cx = width / 2;
  const cy = height / 2;

  // Pie-Slice als SVG-Path
  const endX = cx + r * Math.cos(angleRad);
  const endY = cy + r * Math.sin(angleRad);

  // Startpunkt: direkt oben (12 Uhr)
  const startX = cx;
  const startY = cy - r;

  const largeArcFlag = angle > 180 ? 1 : 0;

  const svgPath = angle >= 360
    ? `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 1 ${r * 2} 0 a ${r} ${r} 0 1 1 -${r * 2} 0 Z`
    : `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;

  const clipId = `clockwipe-${frame}`;

  return (
    <AbsoluteFill>
      <svg
        style={{ position: 'absolute', width: 0, height: 0 }}
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={svgPath} />
          </clipPath>
        </defs>
      </svg>
      <AbsoluteFill style={{ clipPath: `url(#${clipId})` }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * SlideTransition: Bild B schiebt von der Seite herein, Bild A schiebt raus
 * Moderner Look — gut für Städte/Lifestyle-Inhalte
 */
const SlideTransition: React.FC<{
  durationFrames: number;
  direction?: 'left' | 'right';
  children: React.ReactNode;
}> = ({ durationFrames, direction = 'left', children }) => {
  const frame = useCurrentFrame();

  const t = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Cubic ease-out für schnellen Einstieg
  const eased = 1 - Math.pow(1 - t, 3);

  const translateX = direction === 'left'
    ? interpolate(eased, [0, 1], [100, 0])
    : interpolate(eased, [0, 1], [-100, 0]);

  return (
    <AbsoluteFill
      style={{
        transform: `translateX(${translateX}%)`,
        willChange: 'transform',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ── TransitionWrapper — Wählt die richtige Transition ─────────────────────

interface TransitionWrapperProps {
  /** Transitions-Typ */
  type: TransitionType;
  /** Dauer der Transition in Frames */
  durationFrames: number;
  /** Index des aktuellen Bildes (für deterministische Richtungswahl) */
  imageIndex: number;
  children: React.ReactNode;
}

/**
 * TransitionWrapper — wählt basierend auf `type` die passende Transition.
 * 'auto' rotiert automatisch durch: wipe → clockWipe → fade → slide → ...
 */
export const TransitionWrapper: React.FC<TransitionWrapperProps> = ({
  type,
  durationFrames,
  imageIndex,
  children,
}) => {
  // 'auto': deterministisch basierend auf Bild-Index rotieren
  const AUTO_SEQUENCE: Array<Exclude<TransitionType, 'auto'>> = [
    'wipe', 'fade', 'clockWipe', 'slide', 'wipe', 'fade',
  ];

  const effectiveType: Exclude<TransitionType, 'auto'> =
    type === 'auto'
      ? AUTO_SEQUENCE[imageIndex % AUTO_SEQUENCE.length]
      : type;

  switch (effectiveType) {
    case 'wipe': {
      // Alterniere Wipe-Richtung
      const directions: Array<'left' | 'right' | 'top' | 'bottom'> = [
        'left', 'right', 'left', 'top',
      ];
      return (
        <WipeTransition
          durationFrames={durationFrames}
          direction={directions[imageIndex % directions.length]}
        >
          {children}
        </WipeTransition>
      );
    }

    case 'clockWipe':
      return (
        <ClockWipeTransition durationFrames={durationFrames}>
          {children}
        </ClockWipeTransition>
      );

    case 'slide': {
      const dir = imageIndex % 2 === 0 ? 'left' : 'right';
      return (
        <SlideTransition durationFrames={durationFrames} direction={dir}>
          {children}
        </SlideTransition>
      );
    }

    case 'fade':
    default:
      return (
        <FallbackCrossDiss durationFrames={durationFrames}>
          {children}
        </FallbackCrossDiss>
      );
  }
};

// ── @remotion/transitions Bridge ──────────────────────────────────────────

/**
 * RemotionTransitionsBridge — versucht @remotion/transitions zu nutzen.
 *
 * Falls das Package installiert ist: nutzt offizielle TransitionSeries.
 * Falls nicht: fällt auf unsere eigenen CSS-Transitions zurück.
 *
 * Hinweis: @remotion/transitions nutzt eine andere API (TransitionSeries)
 * und ist NICHT direkt kompatibel mit der Sequence-basierten Architektur.
 * Deshalb nutzen wir unsere eigenen Implementierungen als primäre Lösung
 * und bieten den offiziellen Package-Wrapper nur als Enhancement an.
 */
export async function checkTransitionsPackage(): Promise<boolean> {
  try {
    await import('@remotion/transitions');
    return true;
  } catch (_) {
    return false;
  }
}

// ── Transition-Effekte für die Slideshow ──────────────────────────────────

/**
 * TransitionOverlay — Zusätzlicher visueller Effekt über der Transition.
 * Flash-Line an der Wipe-Kante für cinematic Look.
 */
export const WipeEdgeGlow: React.FC<{
  durationFrames: number;
  color?: string;
  direction?: 'left' | 'right';
}> = ({ durationFrames, color = '#FFFFFF', direction = 'left' }) => {
  const frame = useCurrentFrame();

  const t = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const eased = t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;

  const pct = eased * 100;

  // Glow-Linie an der Wipe-Kante: schmal, sehr hell
  const glowOpacity = interpolate(
    t,
    [0, 0.1, 0.5, 0.9, 1],
    [0, 0.8, 0.9, 0.8, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  if (glowOpacity < 0.01) return null;

  const lineStyle: React.CSSProperties =
    direction === 'left'
      ? {
          position: 'absolute',
          left: `${pct}%`,
          top: 0,
          bottom: 0,
          width: '3px',
          transform: 'translateX(-50%)',
          background: `linear-gradient(to bottom, transparent, ${color}, transparent)`,
          opacity: glowOpacity,
          boxShadow: `0 0 16px ${color}, 0 0 32px ${color}88`,
        }
      : {
          position: 'absolute',
          right: `${pct}%`,
          top: 0,
          bottom: 0,
          width: '3px',
          transform: 'translateX(50%)',
          background: `linear-gradient(to bottom, transparent, ${color}, transparent)`,
          opacity: glowOpacity,
          boxShadow: `0 0 16px ${color}, 0 0 32px ${color}88`,
        };

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={lineStyle} />
    </AbsoluteFill>
  );
};
