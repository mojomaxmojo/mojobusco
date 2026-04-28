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
 * - Alle Transitions sind rein CSS-Transform/Clip-Path — kein WebGL, kein Canvas
 * - Kein Math.random() im Render (non-deterministisch → Flimmern)
 * - Kein SVG-Filter mit feTurbulence/feDisplacementMap (löst img.decode-Fehler aus)
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
  /**
   * Aktuelles Bild (wird weggeclipt / ausgeblendet)
   */
  children: React.ReactNode;
  /**
   * Nächstes Bild — NUR für pagePeel benötigt.
   * Alle anderen Transitions nutzen die überlappende Remotion-Sequence darunter.
   * pagePeel hingegen muss das nächste Bild explizit als Hintergrund-Layer
   * rendern, weil die darüber liegende Sequence es verdecken würde.
   */
  nextChildren?: React.ReactNode;
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
  nextChildren,
}) => {
  // 'auto': deterministisch basierend auf Bild-Index rotieren
  // pagePeel aus auto-Rotation entfernt — braucht nextChildren aus MojoBusVideo
  const AUTO_SEQUENCE: Array<Exclude<TransitionType, 'auto'>> = [
    'wipe', 'fade', 'clockWipe', 'slide', 'morph', 'zoomRelay',
    'glitch', 'wipe', 'fade', 'clockWipe'
  ];

  const effectiveType: Exclude<TransitionType, 'auto'> =
    type === 'auto'
      ? AUTO_SEQUENCE[imageIndex % AUTO_SEQUENCE.length]
      : type;

  switch (effectiveType) {
    case 'wipe': {
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

    case 'zoomRelay': {
      const focusPoint = {
        x: 20 + (imageIndex % 3) * 30,
        y: 30 + (imageIndex % 2) * 40,
      };
      return (
        <ZoomRelayTransition
          durationFrames={durationFrames}
          focusPoint={focusPoint}
        >
          {children}
        </ZoomRelayTransition>
      );
    }

    case 'glitch':
      return (
        <GlitchTransition durationFrames={durationFrames}>
          {children}
        </GlitchTransition>
      );

    case 'pagePeel':
      // pagePeel braucht beide Bilder innerhalb einer Komponente.
      // Falls nextChildren fehlt (letztes Bild), auf fade fallback.
      if (!nextChildren) {
        return (
          <FallbackCrossDiss durationFrames={durationFrames}>
            {children}
          </FallbackCrossDiss>
        );
      }
      return (
        <PagePeelTransition
          durationFrames={durationFrames}
          nextChildren={nextChildren}
        >
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
 *
 * FIX: SVG-Filter mit feTurbulence/feDisplacementMap wurden entfernt.
 * Diese Filter riefen intern img.decode() auf (Chromium-Bug in headless-Modus),
 * was zu "current.decode is not a function" führte.
 *
 * Ersatz: reine CSS-Transform + Opacity-Komposition — kein SVG, kein WebGL,
 * kein Canvas → 100% kompatibel mit SwiftShader (VPS headless Chrome).
 */
const MorphTransition: React.FC<{
  durationFrames: number;
  children: React.ReactNode;
}> = ({ durationFrames, children }) => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Sanftes Bell-Curve-Pulsieren in der Mitte der Transition
  const pulse = Math.sin(progress * Math.PI); // 0→1→0

  // Sanfter Zoom-Pulse (max +3%)
  const scale = 1 + pulse * 0.03;

  // Leichte Blur-Spitze in der Mitte (max 2px) — rein CSS, kein SVG
  const blurPx = pulse * 2;

  // Brightness-Dip für organisches „Überblenden"-Gefühl
  const brightness = 1 - pulse * 0.08;

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        filter: `blur(${blurPx.toFixed(2)}px) brightness(${brightness.toFixed(3)})`,
        willChange: 'transform, filter',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * ZoomRelayTransition — Fokusübergang für Details in Städten oder Natur
 *
 * FIX: children wurden doppelt gerendert (Zoom-Ebene + Fade-In-Ebene).
 * Remotions <Img> ruft pro Mount img.decode() auf — zwei gemountete Instanzen
 * desselben Bildes können auf headless Chrome "decode is not a function" auslösen.
 *
 * Ersatz: NUR eine children-Instanz; Zoom + Fade werden über dieselbe Ebene
 * kombiniert (Scale-out + Opacity-Fade am Ende der Transition).
 */
const ZoomRelayTransition: React.FC<{
  durationFrames: number;
  focusPoint?: { x: number; y: number };
  children: React.ReactNode;
}> = ({ durationFrames, focusPoint = { x: 50, y: 50 }, children }) => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Smooth Zoom: 1x → 2.5x (reduziert von 8x — war zu aggressiv)
  const scale = interpolate(progress, [0, 1], [1, 2.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Fade-out in der zweiten Hälfte
  const opacity = interpolate(progress, [0, 0.5, 1], [1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Blur steigt mit Zoom
  const blurPx = interpolate(progress, [0, 0.5, 1], [0, 0, 3], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        transform: `scale(${scale})`,
        transformOrigin: `${focusPoint.x}% ${focusPoint.y}%`,
        opacity,
        filter: blurPx > 0.1 ? `blur(${blurPx.toFixed(2)}px)` : undefined,
        willChange: 'transform, opacity',
      }}>
        {children}
      </div>
    </AbsoluteFill>
  );
};

/**
 * GlitchTransition — Moderner, digitaler Übergang für urbane Impressionen
 *
 * FIX: Math.random() im Render entfernt (non-deterministisch → Flimmern).
 * FIX: SVG-Pattern mit url(#scanlines) entfernt (verursachte decode-Fehler
 *      in headless Chrome wegen Pattern-Image-Auflösung).
 *
 * Ersatz: deterministische Sinus-Funktionen + reine CSS-Transforms.
 * Kein SVG, kein Canvas, kein WebGL → VPS-kompatibel.
 */
const GlitchTransition: React.FC<{
  durationFrames: number;
  children: React.ReactNode;
}> = ({ durationFrames, children }) => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Deterministische Glitch-Werte (kein Math.random!)
  const glitchIntensity = Math.sin(progress * Math.PI * 4) * 0.3 + 0.3;
  const glitchOffset   = Math.sin(progress * Math.PI * 8) * 10;

  // Chromatic-Aberration-ähnliche Verschiebungen
  const redOffset  =  glitchIntensity * 12;
  const blueOffset = -glitchIntensity * 12;

  // Glitch-Balken: Position deterministisch per Sinus (kein Random)
  const barLeft   = (Math.sin(frame * 1.7) * 0.5 + 0.5) * 80;
  const barTop    = (Math.sin(frame * 2.3) * 0.5 + 0.5) * 80;
  const barWidth  = 10 + (Math.sin(frame * 3.1) * 0.5 + 0.5) * 20;
  const barHeight = 2  + (Math.sin(frame * 4.7) * 0.5 + 0.5) * 5;
  const barG      = Math.floor((Math.sin(frame * 1.1) * 0.5 + 0.5) * 255);

  return (
    <AbsoluteFill>
      {/* Rote Chromatic-Aberration-Ebene */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        transform: `translateX(${redOffset}px)`,
        filter: 'saturate(1.5) contrast(1.2)',
        clipPath: `inset(0 ${Math.max(0, 100 - progress * 200)}% 0 0)`,
        opacity: 0.6,
      }}>
        <div style={{ width: '100%', height: '100%', filter: 'sepia(1) hue-rotate(0deg) saturate(3)' }}>
          {children}
        </div>
      </div>

      {/* Blaue Chromatic-Aberration-Ebene */}
      <div style={{
        position: 'absolute',
        width: '100%',
        height: '100%',
        transform: `translateX(${blueOffset}px)`,
        filter: 'saturate(1.5) contrast(1.2)',
        clipPath: `inset(0 0 0 ${Math.max(0, 100 - progress * 200)}%)`,
        opacity: 0.6,
      }}>
        <div style={{ width: '100%', height: '100%', filter: 'sepia(1) hue-rotate(180deg) saturate(3)' }}>
          {children}
        </div>
      </div>

      {/* Hauptebene */}
      <div style={{ position: 'absolute', width: '100%', height: '100%' }}>
        {children}
      </div>

      {/* Deterministische Glitch-Balken (kein SVG, kein Math.random) */}
      {glitchIntensity > 0.2 && (
        <div style={{
          position: 'absolute',
          left: `${barLeft}%`,
          top: `${barTop}%`,
          width: `${barWidth}%`,
          height: `${barHeight}%`,
          backgroundColor: `rgba(255, ${barG}, 0, 0.65)`,
          transform: `translateX(${glitchOffset}px)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }} />
      )}
    </AbsoluteFill>
  );
};

/**
 * PagePeelTransition — Seitenblätter-Übergang (2D clip-path)
 *
 * WARUM nextChildren nötig ist:
 * Remotion stapelt Sequences als AbsoluteFill-Layer. Sequence[i+1] liegt
 * DOM-technisch ÜBER Sequence[i]. Wenn Sequence[i] via clip-path wegclipt,
 * sieht man nicht Sequence[i+1] darunter, sondern den Hintergrund — schwarz.
 * Lösung: nextChildren wird INNERHALB dieser Komponente als Hintergrund-Layer
 * gerendert, direkt hinter dem wegblätternden aktuellen Bild.
 *
 * Aufbau:
 *  Layer 1 (unten): nextChildren — immer vollständig sichtbar
 *  Layer 2 (oben):  children (aktuelles Bild) — via polygon clip-path wegziehen
 *  Layer 3:         Falz-Schatten-Streifen
 *
 * Kein rotateY, kein preserve-3d, kein backfaceVisibility → VPS-sicher.
 */
const PagePeelTransition: React.FC<{
  durationFrames: number;
  children: React.ReactNode;
  nextChildren: React.ReactNode;
}> = ({ durationFrames, children, nextChildren }) => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [0, Math.max(1, durationFrames)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Cubic ease-in-out
  const eased = progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

  // Sichtbarer Anteil des aktuellen Bildes: 100% → 0%
  const visiblePct = (1 - eased) * 100;

  // Leichte Diagonale für organischen Falz-Look (oben etwas früher weg)
  const diagOffset = eased * 8;
  const topPct     = Math.max(0, visiblePct - diagOffset);
  const bottomPct  = Math.min(100, visiblePct + diagOffset);

  const clipPath = `polygon(0% 0%, ${topPct}% 0%, ${bottomPct}% 100%, 0% 100%)`;

  // Falz-Schatten (~4% breit links der Kante)
  const shadowLeft  = Math.max(0, topPct    - 4);
  const shadowRight = Math.max(0, bottomPct - 4);
  const shadowPath  = `polygon(${shadowLeft}% 0%, ${topPct}% 0%, ${bottomPct}% 100%, ${shadowRight}% 100%)`;
  const shadowOpacity = interpolate(eased, [0, 0.05, 0.85, 1], [0, 0.6, 0.6, 0]);

  return (
    <AbsoluteFill>
      {/* Layer 1: Nächstes Bild — immer vollständig sichtbar im Hintergrund */}
      <AbsoluteFill>
        {nextChildren}
      </AbsoluteFill>

      {/* Layer 2: Aktuelles Bild — wird von rechts weggeclippt */}
      {visiblePct > 0 && (
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          clipPath,
          willChange: 'clip-path',
        }}>
          {children}
        </div>
      )}

      {/* Layer 3: Falz-Schatten */}
      {shadowOpacity > 0.01 && visiblePct > 0 && (
        <div style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          clipPath: shadowPath,
          background: 'linear-gradient(90deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.7) 100%)',
          opacity: shadowOpacity,
          pointerEvents: 'none',
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
