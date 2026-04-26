/**
 * LottieBusIcon — MojoBus US-Oldtimer Hippie-Style (v3)
 *
 * VW-Bus / US-Oldtimer Proporionen (hoch + quadratisch):
 *  - Zweifarbige Karosserie (oben Creme, unten Körperfarbe)
 *  - Große geteilte Windschutzscheibe (VW-typisch, 2-teilig)
 *  - 3 einzelne quadratische Seitenfenster
 *  - Prillblumen (5-Blatt) auf der Seite
 *  - Peace-Zeichen UMGEKEHRT (Strich zeigt nach oben = Anti-Peace/Hippie-Ironie)
 *  - Regenbogenstreifen horizontal
 *  - Rost-Flecken für authentischen Oldtimer-Look
 *  - Chromstoßstange vorne + hinten
 *  - Rundes VW-artiges Emblem vorne
 *  - Klassische Speichenfelgen (Holzlook)
 *  - Animiertes Abgas-Wölkchen
 *  - Surf-Brett aufs Dach geschnallt
 */

import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

// ── Abgas-Wölkchen ────────────────────────────────────────────────────────

const ExhaustPuff: React.FC<{
  cx: number; cy: number; frame: number; fps: number; delay?: number;
}> = ({ cx, cy, frame, fps, delay = 0 }) => {
  const t = ((frame - delay) / fps) % 1.4;
  if (t < 0) return null;
  const opacity = interpolate(t, [0, 0.25, 1.4], [0.55, 0.38, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sc      = interpolate(t, [0, 1.4], [0.35, 2.0],            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dx      = interpolate(t, [0, 1.4], [0, -22],               { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const dy      = interpolate(t, [0, 1.4], [0, -10],               { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <ellipse cx={cx + dx} cy={cy + dy} rx={6 * sc} ry={4 * sc} fill="#b0bec5" opacity={opacity} />;
};

// ── Prillblume (5 Blütenblätter) ─────────────────────────────────────────

const PrillFlower: React.FC<{
  cx: number; cy: number; r: number;
  petalColor: string; centerColor: string;
  frame: number; fps: number; rotOffset?: number;
}> = ({ cx, cy, r, petalColor, centerColor, frame, fps, rotOffset = 0 }) => {
  // leichtes Wackeln
  const wobble = Math.sin((frame / fps) * Math.PI * 2 * 0.9 + rotOffset) * 4;
  return (
    <g transform={`translate(${cx},${cy}) rotate(${wobble})`}>
      {[0, 72, 144, 216, 288].map((a) => {
        const rad = ((a + rotOffset) * Math.PI) / 180;
        const px  = Math.cos(rad) * r * 0.72;
        const py  = Math.sin(rad) * r * 0.72;
        return (
          <ellipse
            key={a}
            cx={px} cy={py}
            rx={r * 0.45} ry={r * 0.3}
            fill={petalColor}
            transform={`rotate(${a + rotOffset}, ${px}, ${py})`}
            opacity={0.92}
          />
        );
      })}
      {/* Blütenzentrum */}
      <circle r={r * 0.32} fill={centerColor} />
      <circle r={r * 0.16} fill="#fff" opacity={0.6} cx={-r * 0.06} cy={-r * 0.06} />
    </g>
  );
};

// ── Peace-Zeichen UMGEKEHRT ───────────────────────────────────────────────
// Umgekehrt = Kreis + senkrechter Strich zeigt nach OBEN + Diagonalen nach UNTEN-AUSSEN
// (normales Peace gespiegelt an X-Achse)

const InvertedPeace: React.FC<{
  cx: number; cy: number; r: number; color: string; strokeW: number;
}> = ({ cx, cy, r, color, strokeW }) => (
  <g transform={`translate(${cx},${cy})`}>
    {/* Äußerer Kreis */}
    <circle r={r} fill="none" stroke={color} strokeWidth={strokeW} />
    {/* Senkrechter Strich: zeigt nach OBEN (von Mitte nach oben) */}
    <line x1={0} y1={0} x2={0} y2={-r} stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
    {/* Linke Diagonale: zeigt nach UNTEN-LINKS (umgekehrt zu normal) */}
    <line x1={0} y1={0} x2={-r * 0.71} y2={r * 0.71} stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
    {/* Rechte Diagonale: zeigt nach UNTEN-RECHTS */}
    <line x1={0} y1={0} x2={r * 0.71} y2={r * 0.71} stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
  </g>
);

// ── Klassische Speichen-Holzfelge (VW-Oldtimer) ───────────────────────────

const VintageWheel: React.FC<{
  cx: number; cy: number; r: number; wheelRot: number;
}> = ({ cx, cy, r, wheelRot }) => (
  <g transform={`translate(${cx},${cy})`}>
    {/* Weißwand-Reifen */}
    <circle r={r}           fill="#111" />
    <circle r={r * 0.85}    fill="#e8e0d0" />   {/* Weißwand */}
    <circle r={r * 0.72}    fill="#111" />
    {/* Holzfelge — dreht sich */}
    <g transform={`rotate(${wheelRot})`}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const rad = (a * Math.PI) / 180;
        return (
          <line
            key={a}
            x1={Math.cos(rad) * r * 0.14} y1={Math.sin(rad) * r * 0.14}
            x2={Math.cos(rad) * r * 0.62} y2={Math.sin(rad) * r * 0.62}
            stroke="#8B6914"
            strokeWidth={r * 0.1}
            strokeLinecap="round"
          />
        );
      })}
      {/* Felgenring */}
      <circle r={r * 0.62} fill="none" stroke="#a07820" strokeWidth={r * 0.07} />
    </g>
    {/* Nabenkappe (chrom) */}
    <circle r={r * 0.2}  fill="#d4af37" />
    <circle r={r * 0.13} fill="#f5e642" />
    <circle r={r * 0.06} fill="#fff" opacity={0.5} cx={-r * 0.04} cy={-r * 0.04} />
  </g>
);

// ── Rost-Fleck ────────────────────────────────────────────────────────────

const RustSpot: React.FC<{ cx: number; cy: number; rx: number; ry: number; opacity?: number }> = (
  { cx, cy, rx, ry, opacity = 0.35 }
) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#8B4513" opacity={opacity} />
);

// ── Hauptbus: US-Oldtimer Hippie-Van ─────────────────────────────────────

const HippieVan: React.FC<{
  size?: number;
  accentColor?: string;
  bodyColor?: string;
  color?: string;
  driveIn?: boolean;
  label?: string;
}> = ({
  size    = 240,
  accentColor = '#F59E0B',
  bodyColor,
  color   = '#FFFFFF',
  driveIn = true,
  label   = 'MOJOBUS',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Animationen ──────────────────────────────────────────────────────────
  const enter    = spring({ frame, fps, config: { damping: 20, stiffness: 50, mass: 1.3 } });
  const driveInX = driveIn ? interpolate(enter, [0, 1], [-(size * 3.5), 0]) : 0;
  const rockAngle = Math.sin((frame / fps) * Math.PI * 2 * 1.4) * 1.1;
  const bounceY   = Math.abs(Math.sin((frame / fps) * Math.PI * 2.8)) * 3;
  const wheelRot  = (frame / fps) * 360 * 1.6;
  const lightPulse = 0.65 + Math.sin((frame / fps) * Math.PI * 2 * 0.7) * 0.2;

  // ── Maße: VW-Bus-artige Proportionen (hoch + kompakt) ───────────────────
  const W  = size;            // Breite
  const H  = size * 0.72;    // Höhe Karosserie (VW-Bus: höher als lang)
  const WR = size * 0.135;   // Rad-Radius (groß, Oldtimer)
  const RY = H + WR * 0.55;  // Rad-Mitte Y

  // Farben
  const upperBody = '#f5f0e8';       // Cremeweiß oben (VW-typisch)
  const lowerBody = bodyColor || '#2d6a4f';  // Dunkelgrün unten (Hippie-typisch)
  const dividerColor = '#d4af37';    // Goldener Trennstreifen
  const glassC    = 'rgba(160,210,240,0.78)';
  const glassHL   = 'rgba(255,255,255,0.4)';

  // Hippie-Blumenfarben
  const flowers = [
    { cx: W * 0.38, cy: H * 0.72, r: H * 0.09, petal: '#ff6b6b', center: '#ffd93d', rot: 0   },
    { cx: W * 0.55, cy: H * 0.68, r: H * 0.07, petal: '#a8edea', center: '#ff6b6b', rot: 36  },
    { cx: W * 0.27, cy: H * 0.65, r: H * 0.065,petal: '#ffd93d', center: '#6bcb77', rot: 18  },
    { cx: W * 0.64, cy: H * 0.75, r: H * 0.055,petal: '#c77dff', center: '#ffd93d', rot: 54  },
  ];

  // Regenbogenstreifen Farben
  const rainbowColors = ['#e63946','#f4a261','#e9c46a','#2a9d8f','#457b9d','#7b2d8b'];

  return (
    <div style={{
      transform:       `translateX(${driveInX}px) rotate(${rockAngle}deg) translateY(${bounceY}px)`,
      transformOrigin: 'bottom center',
      display:         'inline-block',
      filter:          'drop-shadow(0 10px 24px rgba(0,0,0,0.6))',
    }}>
      <svg
        width={W}
        height={RY + WR * 1.2}
        viewBox={`0 0 ${W} ${RY + WR * 1.2}`}
        overflow="visible"
      >
        <defs>
          <linearGradient id="hv-upper" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#fdfaf5" />
            <stop offset="100%" stopColor={upperBody} />
          </linearGradient>
          <linearGradient id="hv-lower" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={lowerBody} />
            <stop offset="100%" stopColor="#1a3d2b" />
          </linearGradient>
          <linearGradient id="hv-glass" x1="0" y1="0" x2="0.3" y2="1">
            <stop offset="0%"   stopColor="#d0eeff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#7ab8e0" stopOpacity="0.65" />
          </linearGradient>
          <radialGradient id="hv-headlight" cx="40%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="#fffde7" stopOpacity="1" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hv-chrome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#f0f0f0" />
            <stop offset="50%"  stopColor="#bdbdbd" />
            <stop offset="100%" stopColor="#9e9e9e" />
          </linearGradient>
        </defs>

        {/* ══ Bodenschatten ══════════════════════════════════════════════ */}
        <ellipse cx={W*0.5} cy={RY + WR*1.1} rx={W*0.42} ry={WR*0.2} fill="rgba(0,0,0,0.4)" />

        {/* ══ Karosserie UNTEN (Grundkörper) ════════════════════════════ */}
        <rect x={W*0.03} y={H*0.38} width={W*0.94} height={H*0.65} rx={8} fill="url(#hv-lower)" />

        {/* ══ Karosserie OBEN (Creme) ════════════════════════════════════ */}
        {/* VW-Bus: obere Hälfte hellere Farbe */}
        <rect x={W*0.03} y={H*0.05} width={W*0.94} height={H*0.38} rx={8} fill="url(#hv-upper)" />

        {/* ══ Goldener Trennstreifen ═════════════════════════════════════ */}
        <rect x={W*0.03} y={H*0.385} width={W*0.94} height={H*0.035} fill={dividerColor} />
        <rect x={W*0.03} y={H*0.415} width={W*0.94} height={H*0.012} fill={dividerColor} opacity={0.5} />

        {/* ══ Regenbogenstreifen (auf unterer Hälfte) ═══════════════════ */}
        {rainbowColors.map((c, i) => (
          <rect
            key={i}
            x={W * 0.03}
            y={H * (0.43 + i * 0.028)}
            width={W * 0.94}
            height={H * 0.026}
            fill={c}
            opacity={0.55}
          />
        ))}

        {/* ══ FRONT RECHTS: VW-Bus Flat-Nose ════════════════════════════ */}
        {/* Frontsäule */}
        <rect x={W*0.86} y={H*0.05} width={W*0.11} height={H*0.95} rx={7} fill={upperBody} />
        {/* Untere Front */}
        <rect x={W*0.86} y={H*0.45} width={W*0.11} height={H*0.55} rx={7} fill={lowerBody} />

        {/* Geteilte Windschutzscheibe (VW-Bus typisch: 2-teilig mit Mittelsteg) */}
        {/* Obere Hälfte */}
        <rect x={W*0.865} y={H*0.07} width={W*0.085} height={H*0.22} rx={4} fill="url(#hv-glass)" />
        {/* Mittelsteg */}
        <rect x={W*0.865} y={H*0.285} width={W*0.085} height={H*0.018} fill={upperBody} />
        {/* Untere Hälfte */}
        <rect x={W*0.865} y={H*0.30} width={W*0.085} height={H*0.13} rx={3} fill="url(#hv-glass)" />
        {/* Windschutzscheibe-Rahmen */}
        <rect x={W*0.865} y={H*0.07} width={W*0.085} height={H*0.36} rx={4} fill="none" stroke="#333" strokeWidth={2} />
        {/* Glanzlicht */}
        <rect x={W*0.872} y={H*0.082} width={W*0.018} height={H*0.18} rx={2} fill={glassHL} />

        {/* Rundes VW-artiges Emblem */}
        <circle cx={W*0.922} cy={H*0.52} r={H*0.055} fill={dividerColor} />
        <circle cx={W*0.922} cy={H*0.52} r={H*0.038} fill={upperBody} />
        <text x={W*0.922} y={H*0.535} textAnchor="middle" fontSize={H*0.038}
          fontFamily="Arial Black, sans-serif" fontWeight="900" fill={lowerBody}>M</text>

        {/* Runde Scheinwerfer (VW-Bus typisch) */}
        <circle cx={W*0.91}  cy={H*0.65} r={H*0.052} fill="#e8e8e8" stroke="#999" strokeWidth={1.5} />
        <circle cx={W*0.91}  cy={H*0.65} r={H*0.036} fill="#fffde7" opacity={lightPulse} />
        <circle cx={W*0.91}  cy={H*0.65} r={H*0.022} fill="#fef08a" opacity={lightPulse} />
        {/* Scheinwerfer-Glow */}
        <ellipse cx={W*0.96} cy={H*0.67} rx={W*0.07} ry={H*0.07}
          fill="url(#hv-headlight)" opacity={lightPulse * 0.7} />

        {/* Front-Stoßstange (Chromoptik) */}
        <rect x={W*0.86}  y={H*0.84} width={W*0.12} height={H*0.07} rx={4} fill="url(#hv-chrome)" />
        <rect x={W*0.865} y={H*0.855} width={W*0.11} height={H*0.02} rx={2} fill="#fff" opacity={0.6} />

        {/* Rückspiegel (außen, VW-typisch rund) */}
        <rect  x={W*0.855} y={H*0.12} width={W*0.022} height={H*0.08} rx={2} fill="#888" />
        <ellipse cx={W*0.845} cy={H*0.11} rx={W*0.025} ry={H*0.04} fill="#aaa" stroke="#666" strokeWidth={1} />
        <ellipse cx={W*0.843} cy={H*0.108} rx={W*0.012} ry={H*0.022} fill={glassHL} />

        {/* ══ SEITE: 3 quadratische Fenster (VW-Bus typisch) ════════════ */}
        {[0.12, 0.36, 0.60].map((x, i) => (
          <g key={i}>
            <rect x={W*x} y={H*0.1} width={W*0.2} height={H*0.26} rx={5}
              fill="url(#hv-glass)" stroke="#555" strokeWidth={1.5} />
            {/* Glasspiegelung */}
            <rect x={W*(x+0.015)} y={H*0.11} width={W*0.04} height={H*0.2}
              rx={2} fill={glassHL} />
            {/* Untere Fensterverdunkelung */}
            <rect x={W*x} y={H*0.31} width={W*0.2} height={H*0.05}
              rx={0} fill="rgba(0,0,0,0.2)" />
          </g>
        ))}
        {/* Fensterschienen oben */}
        <rect x={W*0.03} y={H*0.09} width={W*0.83} height={H*0.02} rx={2} fill="#888" opacity={0.6} />

        {/* ══ HECK LINKS: Heckpartie ═════════════════════════════════════ */}
        <rect x={W*0.01} y={H*0.05} width={W*0.05} height={H*0.95} rx={7} fill={upperBody} />
        <rect x={W*0.01} y={H*0.45} width={W*0.05} height={H*0.55} rx={7} fill={lowerBody} />
        {/* Heckscheibe */}
        <rect x={W*0.015} y={H*0.1} width={W*0.035} height={H*0.25} rx={3}
          fill="url(#hv-glass)" stroke="#555" strokeWidth={1} />
        {/* Rücklichter (rund, VW-typisch) */}
        <circle cx={W*0.03} cy={H*0.62} r={H*0.045} fill="#dc2626" opacity={0.9} />
        <circle cx={W*0.03} cy={H*0.62} r={H*0.025} fill="#fca5a5" opacity={0.7} />
        {/* Heck-Stoßstange */}
        <rect x={W*0.01} y={H*0.84} width={W*0.055} height={H*0.07} rx={3} fill="url(#hv-chrome)" />

        {/* ══ Prillblumen auf der Seite ══════════════════════════════════ */}
        {flowers.map((f, i) => (
          <PrillFlower
            key={i}
            cx={f.cx} cy={f.cy} r={f.r}
            petalColor={f.petal} centerColor={f.center}
            frame={frame} fps={fps} rotOffset={f.rot}
          />
        ))}

        {/* ══ Peace-Zeichen UMGEKEHRT ════════════════════════════════════ */}
        {/* Strich zeigt nach oben, Diagonalen nach unten — das ist das umgekehrte Peace */}
        <InvertedPeace
          cx={W * 0.78} cy={H * 0.70}
          r={H * 0.1}
          color="#ffffffcc"
          strokeW={H * 0.025}
        />

        {/* ══ MOJOBUS Schriftzug ══════════════════════════════════════════ */}
        {/* Hintergrund-Pill */}
        <rect x={W*0.14} y={H*0.86} width={W*0.58} height={H*0.12} rx={6}
          fill="rgba(0,0,0,0.35)" />
        <text
          x={W * 0.43} y={H * 0.945}
          textAnchor="middle"
          fill={color}
          fontSize={H * 0.095}
          fontFamily="Arial Black, Impact, sans-serif"
          fontWeight="900"
          letterSpacing="4"
          opacity={0.95}
        >{label}</text>

        {/* ══ Rost-Flecken (Oldtimer-Authentizität) ══════════════════════ */}
        <RustSpot cx={W*0.08} cy={H*0.75} rx={W*0.022} ry={H*0.018} />
        <RustSpot cx={W*0.15} cy={H*0.90} rx={W*0.015} ry={H*0.013} opacity={0.28} />
        <RustSpot cx={W*0.72} cy={H*0.88} rx={W*0.018} ry={H*0.014} opacity={0.3} />
        <RustSpot cx={W*0.05} cy={H*0.55} rx={W*0.01}  ry={H*0.018} opacity={0.25} />

        {/* ══ Abgas-Wölkchen (links hinten) ═════════════════════════════ */}
        <ExhaustPuff cx={W*0.02} cy={H*0.88} frame={frame} fps={fps} delay={0}  />
        <ExhaustPuff cx={W*0.02} cy={H*0.86} frame={frame} fps={fps} delay={12} />
        <ExhaustPuff cx={W*0.02} cy={H*0.90} frame={frame} fps={fps} delay={6}  />

        {/* ══ Räder ══════════════════════════════════════════════════════ */}
        {/* Radkästen */}
        <ellipse cx={W*0.2}  cy={RY} rx={WR*1.3} ry={WR*0.5} fill="#1a1a1a" />
        <ellipse cx={W*0.76} cy={RY} rx={WR*1.3} ry={WR*0.5} fill="#1a1a1a" />
        {/* Räder */}
        <VintageWheel cx={W*0.76} cy={RY} r={WR} wheelRot={wheelRot} />
        <VintageWheel cx={W*0.2}  cy={RY} r={WR} wheelRot={wheelRot} />

        {/* ══ Dach: Surfbrett ════════════════════════════════════════════ */}
        {/* Träger */}
        <rect x={W*0.2} y={-H*0.04} width={W*0.025} height={H*0.08} rx={2} fill="#888" />
        <rect x={W*0.7} y={-H*0.04} width={W*0.025} height={H*0.08} rx={2} fill="#888" />
        {/* Surfbrett (lang, oval) */}
        <ellipse cx={W*0.46} cy={-H*0.07} rx={W*0.33} ry={H*0.045}
          fill="#e63946" stroke="#b5000a" strokeWidth={1.5} />
        {/* Surfbrett-Streifen */}
        <ellipse cx={W*0.46} cy={-H*0.07} rx={W*0.15} ry={H*0.02}
          fill="#ffd93d" opacity={0.7} />
        <ellipse cx={W*0.46} cy={-H*0.07} rx={W*0.05} ry={H*0.012}
          fill="#fff" opacity={0.5} />
        {/* Halteseile */}
        <line x1={W*0.213} y1={-H*0.025} x2={W*0.28} y2={-H*0.05} stroke="#888" strokeWidth={1.5} />
        <line x1={W*0.713} y1={-H*0.025} x2={W*0.65} y2={-H*0.05} stroke="#888" strokeWidth={1.5} />

      </svg>
    </div>
  );
};

// ── Haupt-Export ──────────────────────────────────────────────────────────

export interface LottieBusIconProps {
  size?: number;
  accentColor?: string;
  bodyColor?: string;
  color?: string;
  driveIn?: boolean;
  position?: 'center' | 'bottom-center' | 'top-center';
  label?: string;
  lottieData?: object | null;
}

export const LottieBusIcon: React.FC<LottieBusIconProps> = ({
  size = 240,
  accentColor = '#F59E0B',
  bodyColor,
  color = '#FFFFFF',
  driveIn = true,
  position = 'center',
  label = 'MOJOBUS',
  lottieData,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const posStyles: React.CSSProperties =
    position === 'bottom-center'
      ? { position: 'absolute', bottom: '6%', left: '50%', transform: 'translateX(-50%)' }
      : position === 'top-center'
      ? { position: 'absolute', top: '6%',    left: '50%', transform: 'translateX(-50%)' }
      : { position: 'absolute', top: '50%',   left: '50%', transform: 'translate(-50%,-50%)' };

  const enter   = spring({ frame, fps, config: { damping: 20, stiffness: 80 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);

  return (
    <div style={{ ...posStyles, opacity, pointerEvents: 'none' }}>
      <HippieVan
        size={size}
        accentColor={accentColor}
        bodyColor={bodyColor}
        color={color}
        driveIn={driveIn}
        label={label}
      />
    </div>
  );
};

// ── BusRideOverlay — Hippie-Van fährt durchs Bild ─────────────────────────

export const BusRideOverlay: React.FC<{
  accentColor?: string;
  size?: number;
  verticalPosition?: number;
  label?: string;
}> = ({ accentColor = '#F59E0B', size = 180, verticalPosition = 75, label = 'MOJOBUS' }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const xPercent = interpolate(frame, [0, durationInFrames], [-22, 118], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        left: `${xPercent}%`,
        top:  `${verticalPosition}%`,
        transform: 'translate(-50%, -50%)',
      }}>
        <HippieVan size={size} accentColor={accentColor} driveIn={false} label={label} />
      </div>
    </AbsoluteFill>
  );
};
