/**
 * TransitionSlideshow — @remotion/transitions Integration
 *
 * Ersetzt / ergänzt das einfache CrossDissolve in MojoBusVideo.
 * Acht Transitions nach Priorität:
 *   1. wipe       — Wischer von links nach rechts (Reels-typisch)
 *   2. clockWipe  — Uhrzeiger-Wischer (dramatisch)
 *   3. fade       — Klassisches Cross-Dissolve (dezent)
 *   4. slide      — Schiebeübergang (modern)
 *   5. morph      — Fließender Übergang zwischen ähnlichen Landschaften
 *   6. zoomRelay  — Fokusübergang für Details in Städten oder Natur
 *   7. glitch     — Moderner, digitaler Übergang für urbane Impressionen
 *   8. pagePeel   — Storytelling-Übergang mit Blättereffekt
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

export type TransitionType = 'wipe' | 'clockWipe' | 'fade' | 'slide' | 'morph' | 'zoomRelay' | 'glitch' | 'pagePeel' | 'auto';

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
    'wipe', 'fade', 'clockWipe', 'slide', 'morph', 'zoomRelay', 
    'glitch', 'pagePeel', 'fade', 'wipe'
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

    case 'morph':
      return (
        <MorphTransition durationFrames={durationFrames}>
          {children}
        </MorphTransition>
      );

    case 'zoomRelay':
      // Fokus-Punkt basierend auf Bildinhalt bestimmen (vereinfacht)
      const focusPoint = {
        x: 20 + (imageIndex % 3) * 30,
        y: 30 + (imageIndex % 2) * 40
      };
      return (
        <ZoomRelayTransition 
          durationFrames={durationFrames} 
          focusPoint={focusPoint}
        >
          {children}
        </ZoomRelayTransition>
      );

    case 'glitch':
      return (
        <GlitchTransition durationFrames={durationFrames}>
          {children}
        </GlitchTransition>
      );

    case 'pagePeel':
      return (
        <PagePeelTransition durationFrames={durationFrames}>
          {children}
        </PagePeelTransition>
      );

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
 * MorphTransition — Fließender Übergang zwischen ähnlichen Landschaften
 * Verwendet SVG-Filter für organische Formverzerrungen
 */
const MorphTransition: React.FC<{
  durationFrames: number;
  children: React.ReactNode;
}> = ({ durationFrames, children }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  
  const progress = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  
  // Organische Verzerrung mit Perlin-Rauschen-ähnlichem Ansatz
  const distortion = Math.sin(progress * Math.PI * 2) * 0.05;
  const scale = 1 + distortion;
  const rotation = distortion * 10;
  
  // Farbverschiebung für sanften Übergang
  const hueRotation = progress * 30;
  
  return (
    <AbsoluteFill style={{
      transform: `scale(${scale}) rotate(${rotation}deg)`,
      filter: `hue-rotate(${hueRotation}deg)`,
      transformOrigin: 'center center',
    }}>
      <svg
        width={width}
        height={height}
        style={{ position: 'absolute', top: 0, left: 0 }}
      >
        <defs>
          <filter id={`morph-blur-${frame}`}>
            <feTurbulence 
              type="turbulence" 
              baseFrequency={0.01 + progress * 0.02} 
              numOctaves="2" 
              result="turbulence"
            />
            <feDisplacementMap 
              in2="turbulence" 
              in="SourceGraphic" 
              scale={progress * 30} 
              xChannelSelector="R" 
              yChannelSelector="G"
            />
          </filter>
        </defs>
        <g filter={`url(#morph-blur-${frame})`}>
          {children}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

/**
 * ZoomRelayTransition — Fokusübergang für Details in Städten oder Natur
 * Zoomt auf einen Punkt des ersten Bildes und zeigt dann das zweite Bild
 */
const ZoomRelayTransition: React.FC<{
  durationFrames: number;
  focusPoint?: { x: number; y: number };
  children: React.ReactNode;
}> = ({ durationFrames, focusPoint = { x: 50, y: 50 }, children }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  
  const progress = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  
  // Zwei Phasen: Zoom im ersten Bild, dann Übergang zum zweiten
  const zoomProgress = progress < 0.5 
    ? interpolate(progress, [0, 0.5], [0, 1]) 
    : 1;
  const fadeProgress = progress < 0.5 
    ? 0 
    : interpolate(progress, [0.5, 1], [0, 1]);
  
  const scale = 1 + zoomProgress * 7; // Maximal 8-facher Zoom
  const opacity = interpolate(fadeProgress, [0, 0.5, 1], [1, 1, 0]);
  
  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        transform: `scale(${scale})`,
        transformOrigin: `${focusPoint.x}% ${focusPoint.y}%`,
        opacity,
        filter: `blur(${fadeProgress * 3}px)`,
      }}>
        {children}
      </div>
      {fadeProgress > 0 && (
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          opacity: fadeProgress,
        }}>
          {children}
        </div>
      )}
    </AbsoluteFill>
  );
};

/**
 * GlitchTransition — Moderner, digitaler Übergang für urbane Impressionen
 * Mit Farbverschiebungen und digitalem Rauschen
 */
const GlitchTransition: React.FC<{
  durationFrames: number;
  children: React.ReactNode;
}> = ({ durationFrames, children }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  
  const progress = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  
  // Zufällige Glitch-Intensität
  const glitchIntensity = Math.sin(progress * Math.PI * 4) * 0.3 + 0.3;
  const glitchOffset = Math.sin(progress * Math.PI * 8) * 10;
  
  // Farbebenenverschiebung
  const redOffset = glitchIntensity * 15;
  const blueOffset = glitchIntensity * -15;
  
  return (
    <AbsoluteFill>
      {/* Rote Ebene */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        transform: `translateX(${redOffset}px)`,
        filter: 'saturate(1.5) contrast(1.2)',
        clipPath: `inset(0 ${Math.max(0, 100 - progress * 200)}% 0 0)`,
      }}>
        <div style={{ 
          width: '100%', 
          height: '100%',
          filter: 'sepia(1) hue-rotate(0deg) saturate(3)'
        }}>
          {children}
        </div>
      </div>
      
      {/* Blaue Ebene */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        transform: `translateX(${blueOffset}px)`,
        filter: 'saturate(1.5) contrast(1.2)',
        clipPath: `inset(0 0 0 ${Math.max(0, 100 - progress * 200)}%)`,
      }}>
        <div style={{ 
          width: '100%', 
          height: '100%',
          filter: 'sepia(1) hue-rotate(180deg) saturate(3)'
        }}>
          {children}
        </div>
      </div>
      
      {/* Hauptebene mit Scanlines */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        opacity: 0.95,
      }}>
        {children}
        <svg
          width={width}
          height={height}
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          <defs>
            <pattern id="scanlines" x="0" y="0" width="100%" height="4">
              <rect x="0" y="0" width="100%" height="2" fill="rgba(0,0,0,0.1)" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#scanlines)" />
        </svg>
      </div>
      
      {/* Zufällige Glitch-Balken */}
      {glitchIntensity > 0.2 && (
        <div style={{
          position: 'absolute',
          left: `${Math.random() * 80}%`,
          top: `${Math.random() * 80}%`,
          width: `${10 + Math.random() * 20}%`,
          height: `${2 + Math.random() * 5}%`,
          backgroundColor: `rgba(255, ${Math.floor(Math.random() * 255)}, 0, 0.7)`,
          transform: `translateX(${glitchOffset}px)`,
          mixBlendMode: 'screen',
        }} />
      )}
    </AbsoluteFill>
  );
};

/**
 * PagePeelTransition — Storytelling-Übergang mit Blättereffekt
 * Simuliert das Umblättern einer Seite
 */
const PagePeelTransition: React.FC<{
  durationFrames: number;
  children: React.ReactNode;
}> = ({ durationFrames, children }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  
  const progress = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  
  // Seite faltet sich um die rechte Kante
  const foldAngle = interpolate(progress, [0, 1], [0, -180]);
  const shadowOpacity = interpolate(Math.abs(foldAngle), [0, 180], [0, 0.5]);
  
  // Seite wird kleiner während des Blätterns
  const scale = interpolate(progress, [0, 0.5, 1], [1, 0.95, 1]);
  
  return (
    <AbsoluteFill style={{
      transform: `perspective(1000px) scale(${scale})`,
      transformStyle: 'preserve-3d',
    }}>
      {/* Erste Seite (wegfaltend) */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        transform: `rotateY(${foldAngle}deg)`,
        transformOrigin: 'right center',
        backfaceVisibility: 'hidden',
        zIndex: 2,
      }}>
        {children}
        {/* Schatten auf der falzenden Seite */}
        {progress > 0 && (
          <div style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: '100%',
            height: '100%',
            background: `linear-gradient(90deg, transparent, rgba(0,0,0,${shadowOpacity}))`,
          }} />
        )}
      </div>
      
      {/* Falz-Schatten */}
      {progress > 0 && (
        <div style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '20px',
          height: '100%',
          background: `linear-gradient(90deg, transparent, rgba(0,0,0,${shadowOpacity * 0.7}))`,
          transform: 'translateX(10px)',
          zIndex: 1,
        }} />
      )}
    </AbsoluteFill>
  );
};

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
