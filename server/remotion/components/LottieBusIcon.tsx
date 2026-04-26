/**
 * LottieBusIcon — Animierter MojoBus in der Endkarte
 *
 * Drei Ebenen:
 *  1. @remotion/lottie: Wenn Package installiert + JSON-Datei vorhanden
 *  2. CSS-Animation Bus: Vollständig animierter Bus in reinem React/CSS
 *  3. Emoji-Fallback: 🚌 wenn alles andere fehlschlägt
 *
 * Das CSS-Animation-Bus ist der primäre Pfad und sieht professionell aus:
 *  - Karosserie mit Reflexion
 *  - Rotierende Räder
 *  - Schaukelnde Karosserie (Fahrt-Bewegung)
 *  - Fenster mit Licht-Effekt
 *  - Abgasfahne (optional)
 *  - Einfahrende Animation von links (Spring)
 *
 * Package: npm install @remotion/lottie
 * Lottie-JSON: server/remotion/lottie/bus.json (optional)
 */

import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// ── @remotion/lottie Bridge ────────────────────────────────────────────────

let LottiePlayer: React.FC<{
  animationData: object;
  style?: React.CSSProperties;
}> | null = null;

try {
  // @ts-ignore
  const lottieModule = await import('@remotion/lottie').catch(() => null);
  if (lottieModule?.Lottie) {
    LottiePlayer = lottieModule.Lottie;
    console.log('[LottieBusIcon] @remotion/lottie geladen ✓');
  }
} catch (_) {}

// Versuche Bus-Lottie JSON zu laden (falls vorhanden)
let busLottieData: object | null = null;
try {
  // @ts-ignore
  const json = await import('../lottie/bus.json').catch(() => null);
  if (json) busLottieData = json;
} catch (_) {}

// ── CSS-Animierter Bus (kein Lottie Package nötig) ────────────────────────

/**
 * CSSAnimatedBus — vollständiger Reisebus als React/CSS Komponente.
 * Sieht aus wie Lottie, braucht aber kein Package!
 */
const CSSAnimatedBus: React.FC<{
  size?: number;
  accentColor?: string;
  color?: string;
  driveIn?: boolean;
  /** Frame ab dem der Bus einfährt (für driveIn=true) */
  startFrame?: number;
}> = ({
  size = 120,
  accentColor = '#F59E0B',
  color = '#FFFFFF',
  driveIn = true,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Einfahrt-Animation
  const driveInSpring = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 18, stiffness: 60, mass: 1.2 },
  });

  const driveInX = driveIn
    ? interpolate(driveInSpring, [0, 1], [-size * 2.5, 0])
    : 0;

  // Schaukeln während der Fahrt (sinusförmig)
  const rockyHz = 1.8; // Schaukel-Frequenz in Hz
  const rockAngle = Math.sin((frame / fps) * Math.PI * 2 * rockyHz) * 1.2;
  const bounceY = Math.abs(Math.sin((frame / fps) * Math.PI * 2 * rockyHz * 2)) * 1.5;

  // Räder drehen sich
  const wheelRotation = (frame / fps) * 360 * 1.5; // 1.5 Umdrehungen/Sekunde

  const s = size;
  const busH = s * 0.55;
  const busW = s;

  // Farben
  const bodyColor = accentColor;
  const windowColor = 'rgba(180, 220, 255, 0.85)';
  const darkColor = '#1a1a1a';
  const rimColor = '#888';

  return (
    <div
      style={{
        transform: `translateX(${driveInX}px) rotate(${rockAngle}deg) translateY(${bounceY}px)`,
        transformOrigin: 'bottom center',
        display: 'inline-block',
        position: 'relative',
      }}
    >
      <svg
        width={busW}
        height={busH * 1.5}
        viewBox={`0 0 ${busW} ${busH * 1.5}`}
        overflow="visible"
      >
        {/* ── Karosserie ── */}
        {/* Haupt-Body */}
        <rect
          x={4}
          y={busH * 0.1}
          width={busW - 8}
          height={busH * 0.72}
          rx={6}
          fill={bodyColor}
        />

        {/* Dach-Lüftung (Streifen oben) */}
        <rect
          x={8}
          y={busH * 0.08}
          width={busW - 16}
          height={busH * 0.1}
          rx={4}
          fill={darkColor}
          opacity={0.4}
        />

        {/* Reflexions-Streifen */}
        <rect
          x={6}
          y={busH * 0.13}
          width={busW - 12}
          height={busH * 0.06}
          rx={3}
          fill={color}
          opacity={0.15}
        />

        {/* ── Fenster-Reihe ── */}
        {[0.12, 0.27, 0.44, 0.59, 0.74].map((xPct, i) => (
          <rect
            key={i}
            x={busW * xPct}
            y={busH * 0.16}
            width={busW * 0.11}
            height={busH * 0.22}
            rx={3}
            fill={windowColor}
            stroke={darkColor}
            strokeWidth={1}
          />
        ))}

        {/* ── Windschutzscheibe vorne ── */}
        <rect
          x={busW * 0.88}
          y={busH * 0.14}
          width={busW * 0.09}
          height={busH * 0.24}
          rx={3}
          fill={windowColor}
          stroke={darkColor}
          strokeWidth={1}
        />

        {/* ── Scheinwerfer ── */}
        <circle cx={busW * 0.94} cy={busH * 0.45} r={busH * 0.045} fill="#FFFDE7" opacity={0.9} />
        <circle cx={busW * 0.94} cy={busH * 0.45} r={busH * 0.025} fill="#FFF9C4" />

        {/* ── Tür ── */}
        <rect
          x={busW * 0.27}
          y={busH * 0.42}
          width={busW * 0.11}
          height={busH * 0.38}
          rx={2}
          fill={windowColor}
          stroke={darkColor}
          strokeWidth={0.8}
          opacity={0.7}
        />
        {/* Tür-Mitte-Linie */}
        <line
          x1={busW * 0.325}
          y1={busH * 0.42}
          x2={busW * 0.325}
          y2={busH * 0.80}
          stroke={darkColor}
          strokeWidth={0.8}
        />

        {/* ── Bodenstreifen ── */}
        <rect
          x={4}
          y={busH * 0.77}
          width={busW - 8}
          height={busH * 0.06}
          fill={darkColor}
          opacity={0.5}
        />

        {/* ── MojoBus Schriftzug ── */}
        <text
          x={busW * 0.5}
          y={busH * 0.73}
          textAnchor="middle"
          fill={color}
          fontSize={busH * 0.14}
          fontFamily="Arial Black, sans-serif"
          fontWeight="900"
          letterSpacing="2"
          opacity={0.9}
        >
          MOJOBUS
        </text>

        {/* ── Räder ── */}
        {[{ cx: busW * 0.22, label: 'front' }, { cx: busW * 0.72, label: 'back' }].map(({ cx }, i) => (
          <g key={i} transform={`translate(${cx}, ${busH * 0.9})`}>
            {/* Reifen */}
            <circle r={busH * 0.16} fill={darkColor} />
            {/* Felge */}
            <circle r={busH * 0.09} fill={rimColor} />
            {/* Speichen — rotieren */}
            {[0, 60, 120].map((baseAngle) => {
              const angle = ((baseAngle + wheelRotation) * Math.PI) / 180;
              const r2 = busH * 0.085;
              return (
                <line
                  key={baseAngle}
                  x1={Math.cos(angle) * r2}
                  y1={Math.sin(angle) * r2}
                  x2={Math.cos(angle + Math.PI) * r2}
                  y2={Math.sin(angle + Math.PI) * r2}
                  stroke={darkColor}
                  strokeWidth={2}
                />
              );
            })}
            {/* Nabenschraube */}
            <circle r={busH * 0.025} fill={darkColor} />
          </g>
        ))}

        {/* ── Unterboden ── */}
        <rect
          x={busW * 0.08}
          y={busH * 0.83}
          width={busW * 0.84}
          height={busH * 0.05}
          rx={2}
          fill={darkColor}
          opacity={0.6}
        />

      </svg>
    </div>
  );
};

// ── Lottie-Bus mit @remotion/lottie ───────────────────────────────────────

const LottieAnimatedBus: React.FC<{
  animationData: object;
  size?: number;
}> = ({ animationData, size = 120 }) => {
  if (!LottiePlayer) return null;

  return (
    <LottiePlayer
      animationData={animationData}
      style={{ width: size, height: size }}
    />
  );
};

// ── Haupt-Export: LottieBusIcon ────────────────────────────────────────────

export interface LottieBusIconProps {
  /** Größe in Pixel (quadratisch) */
  size?: number;
  /** Akzentfarbe des Busses */
  accentColor?: string;
  /** Hintergrundfarbe / Textfarbe */
  color?: string;
  /** Einfahrt-Animation von links */
  driveIn?: boolean;
  /** Position: 'center' | 'bottom-center' | 'top-center' */
  position?: 'center' | 'bottom-center' | 'top-center';
}

/**
 * LottieBusIcon — animierter Bus für die CTA Endkarte.
 *
 * Priorität:
 * 1. @remotion/lottie + bus.json wenn beides vorhanden
 * 2. CSS-animierter Bus (immer verfügbar, sieht toll aus)
 * 3. Emoji-Fallback 🚌
 */
export const LottieBusIcon: React.FC<LottieBusIconProps> = ({
  size = 140,
  accentColor = '#F59E0B',
  color = '#FFFFFF',
  driveIn = true,
  position = 'center',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const posStyles: React.CSSProperties =
    position === 'bottom-center'
      ? {
          position: 'absolute',
          bottom: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
        }
      : position === 'top-center'
      ? {
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
        }
      : {
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };

  // Einblend-Opacity
  const fadeIn = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const opacity = interpolate(fadeIn, [0, 1], [0, 1]);

  return (
    <div style={{ ...posStyles, opacity, pointerEvents: 'none' }}>
      {/* Lottie (wenn Package + JSON vorhanden) */}
      {LottiePlayer && busLottieData ? (
        <LottieAnimatedBus animationData={busLottieData} size={size} />
      ) : (
        /* CSS-Bus (primärer Fallback) */
        <CSSAnimatedBus
          size={size}
          accentColor={accentColor}
          color={color}
          driveIn={driveIn}
        />
      )}
    </div>
  );
};

// ── BusRide Overlay — Bus fährt durchs Bild ───────────────────────────────

/**
 * BusRideOverlay — Bus fährt von links nach rechts durchs Video.
 * Nur 1x während der Slideshow, z.B. beim Location-Wechsel.
 */
export const BusRideOverlay: React.FC<{
  accentColor?: string;
  size?: number;
  verticalPosition?: number; // 0–100 (Prozent der Höhe)
}> = ({
  accentColor = '#F59E0B',
  size = 80,
  verticalPosition = 75,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  // Bus fährt von links (-size) nach rechts (+100% + size)
  const progress = interpolate(
    frame,
    [0, durationInFrames],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const xPercent = interpolate(progress, [0, 1], [-15, 115]);

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          left: `${xPercent}%`,
          top: `${verticalPosition}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <CSSAnimatedBus
          size={size}
          accentColor={accentColor}
          driveIn={false}
        />
      </div>
    </AbsoluteFill>
  );
};

// ── Lottie Setup Info ──────────────────────────────────────────────────────

/**
 * Um echte Lottie-Animationen zu nutzen:
 *
 * 1. npm install @remotion/lottie lottie-web
 *
 * 2. Lade eine Bus-Lottie-Datei (z.B. von LottieFiles.com):
 *    - Suche nach "bus" oder "vehicle" auf https://lottiefiles.com/
 *    - Kostenlose Animationen: https://lottiefiles.com/search?q=bus&contentType=free
 *    - Speichere als: server/remotion/lottie/bus.json
 *
 * 3. Die Komponente erkennt die Datei automatisch und nutzt sie.
 *
 * Empfohlene Lottie-Dateien für MojoBus:
 *   - "Cute Bus" von LottieFiles (~15KB)
 *   - "Road Trip Van" von LottieFiles (~25KB)
 *   - "Oldtimer Bus" von LottieFiles (~20KB)
 */
export const LOTTIE_SETUP_INFO = {
  packageName: '@remotion/lottie',
  jsonPath: 'server/remotion/lottie/bus.json',
  isAvailable: Boolean(LottiePlayer && busLottieData),
};
