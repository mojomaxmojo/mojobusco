/**
 * LottieBusIcon — Animierter MojoBus in der Endkarte
 *
 * Lottie-Strategie:
 *  - @remotion/lottie wird über require() geladen
 *  - Der Webpack NullPlugin in render.js gibt {} zurück wenn Package fehlt
 *  - Wir prüfen ob .Lottie im Modul vorhanden ist → sicherer Fallback
 *  - CSS-Animated Bus läuft IMMER (kein Package nötig)
 *
 * Lottie JSON laden:
 *  - bus.json via require() — NullPlugin gibt {} wenn Datei fehlt
 *  - Prüfung ob JSON ein echtes Lottie-Objekt ist (hat .v und .layers)
 */

import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

// ── @remotion/lottie laden (NullPlugin-sicher) ────────────────────────────
// NullPlugin in render.js gibt {} zurück wenn Package fehlt → kein Crash

/* eslint-disable @typescript-eslint/no-var-requires */
const _lottieModule = require('@remotion/lottie');
const LottieComponent = _lottieModule?.Lottie ?? null;

// bus.json laden (NullPlugin gibt {} wenn Datei fehlt)
const _busJson = (() => {
  try {
    const j = require('../lottie/bus.json');
    // Echter Lottie-JSON hat mindestens .v (version) und .layers
    if (j && j.v !== undefined && Array.isArray(j.layers)) return j;
  } catch (_) {}
  return null;
})();
/* eslint-enable @typescript-eslint/no-var-requires */

const HAS_LOTTIE = Boolean(LottieComponent && _busJson);

// ── CSS-Animierter Bus (immer verfügbar) ──────────────────────────────────

const CSSAnimatedBus: React.FC<{
  size?: number;
  accentColor?: string;
  color?: string;
  driveIn?: boolean;
}> = ({
  size = 120,
  accentColor = '#F59E0B',
  color = '#FFFFFF',
  driveIn = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const driveInSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 60, mass: 1.2 },
  });

  const driveInX = driveIn
    ? interpolate(driveInSpring, [0, 1], [-size * 2.5, 0])
    : 0;

  const rockyHz = 1.8;
  const rockAngle = Math.sin((frame / fps) * Math.PI * 2 * rockyHz) * 1.2;
  const bounceY = Math.abs(Math.sin((frame / fps) * Math.PI * 2 * rockyHz * 2)) * 1.5;
  const wheelRotation = (frame / fps) * 360 * 1.5;

  const busH = size * 0.55;
  const busW = size;
  const windowColor = 'rgba(180, 220, 255, 0.85)';
  const darkColor = '#1a1a1a';
  const rimColor = '#888';

  return (
    <div
      style={{
        transform: `translateX(${driveInX}px) rotate(${rockAngle}deg) translateY(${bounceY}px)`,
        transformOrigin: 'bottom center',
        display: 'inline-block',
      }}
    >
      <svg width={busW} height={busH * 1.5} viewBox={`0 0 ${busW} ${busH * 1.5}`} overflow="visible">
        {/* Body */}
        <rect x={4} y={busH * 0.1} width={busW - 8} height={busH * 0.72} rx={6} fill={accentColor} />
        {/* Dach */}
        <rect x={8} y={busH * 0.08} width={busW - 16} height={busH * 0.1} rx={4} fill={darkColor} opacity={0.4} />
        {/* Reflexion */}
        <rect x={6} y={busH * 0.13} width={busW - 12} height={busH * 0.06} rx={3} fill={color} opacity={0.15} />
        {/* Fenster */}
        {[0.12, 0.27, 0.44, 0.59, 0.74].map((xPct, i) => (
          <rect key={i} x={busW * xPct} y={busH * 0.16} width={busW * 0.11} height={busH * 0.22} rx={3}
            fill={windowColor} stroke={darkColor} strokeWidth={1} />
        ))}
        {/* Windschutz */}
        <rect x={busW * 0.88} y={busH * 0.14} width={busW * 0.09} height={busH * 0.24} rx={3}
          fill={windowColor} stroke={darkColor} strokeWidth={1} />
        {/* Scheinwerfer */}
        <circle cx={busW * 0.94} cy={busH * 0.45} r={busH * 0.045} fill="#FFFDE7" opacity={0.9} />
        <circle cx={busW * 0.94} cy={busH * 0.45} r={busH * 0.025} fill="#FFF9C4" />
        {/* Tür */}
        <rect x={busW * 0.27} y={busH * 0.42} width={busW * 0.11} height={busH * 0.38} rx={2}
          fill={windowColor} stroke={darkColor} strokeWidth={0.8} opacity={0.7} />
        <line x1={busW * 0.325} y1={busH * 0.42} x2={busW * 0.325} y2={busH * 0.80}
          stroke={darkColor} strokeWidth={0.8} />
        {/* Bodenstreifen */}
        <rect x={4} y={busH * 0.77} width={busW - 8} height={busH * 0.06} fill={darkColor} opacity={0.5} />
        {/* Schriftzug */}
        <text x={busW * 0.5} y={busH * 0.73} textAnchor="middle" fill={color}
          fontSize={busH * 0.14} fontFamily="Arial Black, sans-serif" fontWeight="900"
          letterSpacing="2" opacity={0.9}>MOJOBUS</text>
        {/* Räder */}
        {[busW * 0.22, busW * 0.72].map((cx, i) => (
          <g key={i} transform={`translate(${cx}, ${busH * 0.9})`}>
            <circle r={busH * 0.16} fill={darkColor} />
            <circle r={busH * 0.09} fill={rimColor} />
            {[0, 60, 120].map((baseAngle) => {
              const angle = ((baseAngle + wheelRotation) * Math.PI) / 180;
              const r2 = busH * 0.085;
              return (
                <line key={baseAngle}
                  x1={Math.cos(angle) * r2} y1={Math.sin(angle) * r2}
                  x2={Math.cos(angle + Math.PI) * r2} y2={Math.sin(angle + Math.PI) * r2}
                  stroke={darkColor} strokeWidth={2} />
              );
            })}
            <circle r={busH * 0.025} fill={darkColor} />
          </g>
        ))}
        {/* Unterboden */}
        <rect x={busW * 0.08} y={busH * 0.83} width={busW * 0.84} height={busH * 0.05} rx={2}
          fill={darkColor} opacity={0.6} />
      </svg>
    </div>
  );
};

// ── Lottie-Bus (nur wenn @remotion/lottie + bus.json vorhanden) ────────────

const LottieAnimatedBus: React.FC<{ size: number }> = ({ size }) => {
  if (!HAS_LOTTIE) return null;
  const LottiePlayer = LottieComponent as React.FC<{ animationData: object; style?: React.CSSProperties }>;
  return <LottiePlayer animationData={_busJson} style={{ width: size, height: size }} />;
};

// ── Haupt-Export ──────────────────────────────────────────────────────────

export interface LottieBusIconProps {
  size?: number;
  accentColor?: string;
  color?: string;
  driveIn?: boolean;
  position?: 'center' | 'bottom-center' | 'top-center';
}

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
      ? { position: 'absolute', bottom: '12%', left: '50%', transform: 'translateX(-50%)' }
      : position === 'top-center'
      ? { position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)' }
      : { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  const fadeIn = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const opacity = interpolate(fadeIn, [0, 1], [0, 1]);

  return (
    <div style={{ ...posStyles, opacity, pointerEvents: 'none' }}>
      {HAS_LOTTIE ? (
        <LottieAnimatedBus size={size} />
      ) : (
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

// ── BusRideOverlay ────────────────────────────────────────────────────────

export const BusRideOverlay: React.FC<{
  accentColor?: string;
  size?: number;
  verticalPosition?: number;
}> = ({ accentColor = '#F59E0B', size = 80, verticalPosition = 75 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const xPercent = interpolate(
    frame,
    [0, durationInFrames],
    [-15, 115],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        left: `${xPercent}%`,
        top: `${verticalPosition}%`,
        transform: 'translate(-50%, -50%)',
      }}>
        <CSSAnimatedBus size={size} accentColor={accentColor} driveIn={false} />
      </div>
    </AbsoluteFill>
  );
};
