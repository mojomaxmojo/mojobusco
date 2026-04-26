/**
 * LottieBusIcon — Animierter MojoBus in der Endkarte
 *
 * Kein require(), kein dynamischer Import in dieser Datei.
 * lottieData wird als Prop übergeben (aus render.js per Node.js geladen).
 * Wenn kein lottieData → CSS-animierter Bus (immer verfügbar).
 */

import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// ── CSS-Animierter Bus (immer verfügbar, kein Package) ────────────────────

const CSSAnimatedBus: React.FC<{
  size?: number;
  accentColor?: string;
  color?: string;
  driveIn?: boolean;
}> = ({ size = 120, accentColor = '#F59E0B', color = '#FFFFFF', driveIn = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 18, stiffness: 60, mass: 1.2 } });
  const driveInX = driveIn ? interpolate(enter, [0, 1], [-size * 2.5, 0]) : 0;
  const rockAngle = Math.sin((frame / fps) * Math.PI * 2 * 1.8) * 1.2;
  const bounceY = Math.abs(Math.sin((frame / fps) * Math.PI * 4 * 1.8)) * 1.5;
  const wheelRot = (frame / fps) * 360 * 1.5;

  const bH = size * 0.55;
  const bW = size;
  const wc = 'rgba(180,220,255,0.85)';
  const dc = '#1a1a1a';

  return (
    <div style={{
      transform: `translateX(${driveInX}px) rotate(${rockAngle}deg) translateY(${bounceY}px)`,
      transformOrigin: 'bottom center', display: 'inline-block',
    }}>
      <svg width={bW} height={bH * 1.5} viewBox={`0 0 ${bW} ${bH * 1.5}`} overflow="visible">
        <rect x={4} y={bH * 0.1} width={bW - 8} height={bH * 0.72} rx={6} fill={accentColor} />
        <rect x={8} y={bH * 0.08} width={bW - 16} height={bH * 0.1} rx={4} fill={dc} opacity={0.4} />
        <rect x={6} y={bH * 0.13} width={bW - 12} height={bH * 0.06} rx={3} fill={color} opacity={0.15} />
        {[0.12, 0.27, 0.44, 0.59, 0.74].map((x, i) => (
          <rect key={i} x={bW * x} y={bH * 0.16} width={bW * 0.11} height={bH * 0.22}
            rx={3} fill={wc} stroke={dc} strokeWidth={1} />
        ))}
        <rect x={bW * 0.88} y={bH * 0.14} width={bW * 0.09} height={bH * 0.24} rx={3} fill={wc} stroke={dc} strokeWidth={1} />
        <circle cx={bW * 0.94} cy={bH * 0.45} r={bH * 0.045} fill="#FFFDE7" opacity={0.9} />
        <circle cx={bW * 0.94} cy={bH * 0.45} r={bH * 0.025} fill="#FFF9C4" />
        <rect x={bW * 0.27} y={bH * 0.42} width={bW * 0.11} height={bH * 0.38}
          rx={2} fill={wc} stroke={dc} strokeWidth={0.8} opacity={0.7} />
        <line x1={bW * 0.325} y1={bH * 0.42} x2={bW * 0.325} y2={bH * 0.80} stroke={dc} strokeWidth={0.8} />
        <rect x={4} y={bH * 0.77} width={bW - 8} height={bH * 0.06} fill={dc} opacity={0.5} />
        <text x={bW * 0.5} y={bH * 0.73} textAnchor="middle" fill={color}
          fontSize={bH * 0.14} fontFamily="Arial Black, sans-serif"
          fontWeight="900" letterSpacing="2" opacity={0.9}>MOJOBUS</text>
        {[bW * 0.22, bW * 0.72].map((cx, i) => (
          <g key={i} transform={`translate(${cx},${bH * 0.9})`}>
            <circle r={bH * 0.16} fill={dc} />
            <circle r={bH * 0.09} fill="#888" />
            {[0, 60, 120].map((a) => {
              const rad = ((a + wheelRot) * Math.PI) / 180;
              const r2 = bH * 0.085;
              return <line key={a}
                x1={Math.cos(rad) * r2} y1={Math.sin(rad) * r2}
                x2={Math.cos(rad + Math.PI) * r2} y2={Math.sin(rad + Math.PI) * r2}
                stroke={dc} strokeWidth={2} />;
            })}
            <circle r={bH * 0.025} fill={dc} />
          </g>
        ))}
        <rect x={bW * 0.08} y={bH * 0.83} width={bW * 0.84} height={bH * 0.05} rx={2} fill={dc} opacity={0.6} />
      </svg>
    </div>
  );
};

// ── Haupt-Export ──────────────────────────────────────────────────────────

export interface LottieBusIconProps {
  size?: number;
  accentColor?: string;
  color?: string;
  driveIn?: boolean;
  position?: 'center' | 'bottom-center' | 'top-center';
  /** Lottie JSON-Daten — von render.js per Node.js require() geladen und als inputProp übergeben */
  lottieData?: object | null;
}

export const LottieBusIcon: React.FC<LottieBusIconProps> = ({
  size = 140,
  accentColor = '#F59E0B',
  color = '#FFFFFF',
  driveIn = true,
  position = 'center',
  lottieData,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const posStyles: React.CSSProperties =
    position === 'bottom-center'
      ? { position: 'absolute', bottom: '12%', left: '50%', transform: 'translateX(-50%)' }
      : position === 'top-center'
      ? { position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)' }
      : { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  // lottieData kommt als Prop von außen — kein require() hier
  // (render.js lädt die JSON-Datei und übergibt sie als inputProp)
  return (
    <div style={{ ...posStyles, opacity, pointerEvents: 'none' }}>
      <CSSAnimatedBus size={size} accentColor={accentColor} color={color} driveIn={driveIn} />
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

  const xPercent = interpolate(frame, [0, durationInFrames], [-15, 115], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', left: `${xPercent}%`, top: `${verticalPosition}%`,
        transform: 'translate(-50%, -50%)',
      }}>
        <CSSAnimatedBus size={size} accentColor={accentColor} driveIn={false} />
      </div>
    </AbsoluteFill>
  );
};
